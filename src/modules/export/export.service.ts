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
      throw new ForbiddenException(
        `无权导出：项目(${projectId})属于调用方(${project.clientId})，您的调用方(${user.clientId})不可跨客户导出`,
      );
    }
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.CLIENT) {
      throw new ForbiddenException('无权导出：需要 ADMIN 或 CLIENT 角色');
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

  private buildRows(
    submissions: Submission[],
    questionsByForm: Map<string, FormQuestion[]>,
  ) {
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
        row['附件相对路径'] = s.attachments
          .map((a) => `attachments/${(s.sample as any).uniqueCode}_${a.questionKey || a.id}_${a.originalName}`)
          .join('; ');
      } else {
        row['附件数'] = 0;
        row['附件文件名'] = '';
        row['附件相对路径'] = '';
      }
      rows.push(row);
    }
    return rows;
  }

  private rowsToCsv(rows: any[]): string {
    if (rows.length === 0) return '';
    const headers = Object.keys(rows[0]);
    const escape = (v: any) => {
      if (v === null || v === undefined) return '';
      const s = String(v).replace(/"/g, '""');
      return /[",\n\r]/.test(s) ? `"${s}"` : s;
    };
    const lines: string[] = [];
    lines.push(headers.map(escape).join(','));
    for (const row of rows) {
      lines.push(headers.map((h) => escape(row[h])).join(','));
    }
    return lines.join('\n');
  }

  private sanitizeFilename(name: string): string {
    return String(name || '').replace(/[\\/:*?"<>|]/g, '_');
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

    const rows = this.buildRows(submissions, questionsByForm);

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '采集数据');

    const uploadDir = path.resolve(process.env.UPLOAD_DIR || './uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    const safeProjectName = this.sanitizeFilename(project.name);
    const stamp = Date.now();

    const excelName = `${safeProjectName}_${stamp}.xlsx`;
    const excelPath = path.join(uploadDir, excelName);
    XLSX.writeFile(wb, excelPath);

    const csvName = `${safeProjectName}_${stamp}.csv`;
    const csvPath = path.join(uploadDir, csvName);
    fs.writeFileSync(csvPath, '\ufeff' + this.rowsToCsv(rows), 'utf8');

    const readmePath = path.join(uploadDir, `${safeProjectName}_${stamp}_README.txt`);
    const readmeContent = [
      `项目名称: ${project.name}`,
      `项目ID: ${project.id}`,
      `导出时间: ${new Date().toISOString()}`,
      `导出人: ${user.username} (${user.role})`,
      `记录数: ${rows.length}`,
      ``,
      `文件结构:`,
      `  ├── ${csvName}        (CSV 明细，UTF-8 BOM，Excel 可直接打开)`,
      `  ├── ${excelName}      (Excel 明细)`,
      `  └── attachments/      (所有附件归档，文件名格式：样本编码_题目key_原文件名)`,
      ``,
      `附件下载可参考 CSV 中"附件相对路径"列。`,
    ].join('\n');
    fs.writeFileSync(readmePath, readmeContent, 'utf8');

    const zipName = `${safeProjectName}_export_${uuidv4()}.zip`;
    const zipPath = path.join(uploadDir, zipName);
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.pipe(output);
    archive.file(csvPath, { name: csvName });
    archive.file(excelPath, { name: excelName });
    archive.file(readmePath, { name: 'README.txt' });

    for (const s of submissions) {
      if (s.attachments) {
        for (const att of s.attachments) {
          if (fs.existsSync(att.filePath)) {
            archive.file(att.filePath, {
              name: `attachments/${this.sanitizeFilename(String((s.sample as any).uniqueCode || s.sampleId))}_${this.sanitizeFilename(att.questionKey || att.id)}_${this.sanitizeFilename(att.originalName)}`,
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
