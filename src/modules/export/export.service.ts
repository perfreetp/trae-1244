import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import * as path from 'path';
import * as fs from 'fs';
import * as archiver from 'archiver';
import * as XLSX from 'xlsx';
import { v4 as uuidv4 } from 'uuid';
import { Project } from '../../entities/project.entity';
import { Sample, SampleStatus } from '../../entities/sample.entity';
import {
  Submission,
  SubmissionStatus,
} from '../../entities/submission.entity';
import { SubmissionAnswer } from '../../entities/submission-answer.entity';
import { Form } from '../../entities/form.entity';
import { FormQuestion } from '../../entities/form-question.entity';
import { Attachment } from '../../entities/attachment.entity';
import { UserRole } from '../../entities/user.entity';
import { CurrentUserPayload } from '../auth/current-user.decorator';

@Injectable()
export class ExportService {
  constructor(
    @InjectRepository(Project)
    private projectRepo: Repository<Project>,
    @InjectRepository(Sample)
    private sampleRepo: Repository<Sample>,
    @InjectRepository(Submission)
    private submissionRepo: Repository<Submission>,
    @InjectRepository(SubmissionAnswer)
    private answerRepo: Repository<SubmissionAnswer>,
    @InjectRepository(Form)
    private formRepo: Repository<Form>,
    @InjectRepository(FormQuestion)
    private questionRepo: Repository<FormQuestion>,
    @InjectRepository(Attachment)
    private attachmentRepo: Repository<Attachment>,
  ) {}

  private async checkProject(projectId: string, user: CurrentUserPayload) {
    const project = await this.projectRepo.findOne({ where: { id: projectId } });
    if (!project) throw new NotFoundException('项目不存在');
    if (user.role !== UserRole.ADMIN && project.clientId !== user.clientId) {
      throw new ForbiddenException('无权访问');
    }
    return project;
  }

  async getValidSubmissions(projectId: string, user: CurrentUserPayload) {
    await this.checkProject(projectId, user);
    const submissions = await this.submissionRepo
      .createQueryBuilder('s')
      .innerJoinAndSelect('s.sample', 'sample')
      .innerJoinAndSelect('s.answers', 'answers')
      .leftJoinAndSelect('s.attachments', 'attachments')
      .innerJoin('sample.project', 'project')
      .where('project.id = :pid', { pid: projectId })
      .andWhere('s.status IN (:...statuses)', {
        statuses: [SubmissionStatus.APPROVED, SubmissionStatus.LOCKED],
      })
      .andWhere('s.hasDuplicate = :hd', { hd: false })
      .andWhere('s.hasMissing = :hm', { hm: false })
      .getMany();
    return submissions;
  }

  async getAbnormalSubmissions(projectId: string, user: CurrentUserPayload) {
    await this.checkProject(projectId, user);
    const submissions = await this.submissionRepo
      .createQueryBuilder('s')
      .innerJoinAndSelect('s.sample', 'sample')
      .innerJoinAndSelect('s.answers', 'answers')
      .innerJoin('sample.project', 'project')
      .where('project.id = :pid', { pid: projectId })
      .andWhere('(s.hasDuplicate = :hd OR s.hasMissing = :hm OR s.status IN (:...statuses))', {
        hd: true,
        hm: true,
        statuses: [SubmissionStatus.REJECTED],
      })
      .getMany();
    return submissions;
  }

  async generateExport(projectId: string, user: CurrentUserPayload, includeAbnormal = false) {
    const project = await this.checkProject(projectId, user);

    const forms = await this.formRepo.find({ where: { projectId } });
    const formMap = new Map(forms.map((f) => [f.id, f]));
    const questions = await this.questionRepo.find({
      where: { formId: In(forms.map((f) => f.id)) as any },
    });
    const questionsByForm = new Map<string, FormQuestion[]>();
    for (const q of questions) {
      if (!questionsByForm.has(q.formId)) {
        questionsByForm.set(q.formId, []);
      }
      questionsByForm.get(q.formId)!.push(q);
    }

    const submissions = includeAbnormal
      ? await this.submissionRepo
          .createQueryBuilder('s')
          .innerJoinAndSelect('s.sample', 'sample')
          .innerJoinAndSelect('s.answers', 'answers')
          .leftJoinAndSelect('s.attachments', 'attachments')
          .innerJoin('sample.project', 'project')
          .where('project.id = :pid', { pid: projectId })
          .getMany()
      : await this.getValidSubmissions(projectId, user);

    const rows: any[] = [];
    for (const s of submissions) {
      const formQuestions = questionsByForm.get(s.formId) || [];
      const answerMap = new Map(s.answers.map((a) => [a.questionKey, a]));
      const row: any = {
        样本ID: s.sampleId,
        样本编码: (s.sample as any).uniqueCode,
        样本名称: (s.sample as any).name,
        区域: (s.sample as any).region,
        提交状态: s.status,
        是否有重复: s.hasDuplicate ? '是' : '否',
        是否缺项: s.hasMissing ? '是' : '否',
        提交时间: s.submittedAt?.toISOString() || '',
        纬度: s.latitude || '',
        经度: s.longitude || '',
        定位地址: s.locationAddress || '',
      };
      for (const q of formQuestions) {
        const ans = answerMap.get(q.questionKey);
        row[q.label] = ans?.value || JSON.stringify(ans?.valueJson || '');
      }
      if (s.attachments && s.attachments.length > 0) {
        row['附件数'] = s.attachments.length;
        row['附件文件名'] = s.attachments.map((a) => a.originalName).join('; ');
      }
      rows.push(row);
    }

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '采集数据');

    const uploadDir = path.resolve(process.env.UPLOAD_DIR || './uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    const excelName = `${project.name}_${Date.now()}.xlsx`;
    const excelPath = path.join(uploadDir, excelName);
    XLSX.writeFile(wb, excelPath);

    const zipName = `${project.name}_export_${uuidv4()}.zip`;
    const zipPath = path.join(uploadDir, zipName);
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.pipe(output);
    archive.file(excelPath, { name: excelName });

    for (const s of submissions) {
      if (s.attachments) {
        for (const att of s.attachments) {
          if (fs.existsSync(att.filePath)) {
            archive.file(att.filePath, {
              name: `attachments/${(s.sample as any).uniqueCode}_${att.questionKey || att.id}_${att.originalName}`,
            });
          }
        }
      }
    }

    await archive.finalize();

    return new Promise<string>((resolve, reject) => {
      output.on('close', () => resolve(zipPath));
      output.on('error', reject);
    });
  }
}
