import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, In } from 'typeorm';
import {
  Submission,
  SubmissionStatus,
} from '../../entities/submission.entity';
import { SubmissionAnswer } from '../../entities/submission-answer.entity';
import { SubmissionHistory, HistoryAction } from '../../entities/submission-history.entity';
import { Form } from '../../entities/form.entity';
import { FormQuestion } from '../../entities/form-question.entity';
import { Sample, SampleStatus } from '../../entities/sample.entity';
import { Attachment } from '../../entities/attachment.entity';
import { Project } from '../../entities/project.entity';
import { UserRole } from '../../entities/user.entity';
import {
  CreateSubmissionDto,
  UpdateSubmissionDto,
  QuerySubmissionDto,
} from './dto/submission.dto';
import { CurrentUserPayload } from '../auth/current-user.decorator';

type ValidationIssue = {
  type: 'duplicate' | 'missing' | 'invalid';
  field: string;
  message: string;
};

@Injectable()
export class SubmissionService {
  constructor(
    @InjectRepository(Submission)
    private submissionRepo: Repository<Submission>,
    @InjectRepository(SubmissionAnswer)
    private answerRepo: Repository<SubmissionAnswer>,
    @InjectRepository(SubmissionHistory)
    private historyRepo: Repository<SubmissionHistory>,
    @InjectRepository(Form)
    private formRepo: Repository<Form>,
    @InjectRepository(FormQuestion)
    private questionRepo: Repository<FormQuestion>,
    @InjectRepository(Sample)
    private sampleRepo: Repository<Sample>,
    @InjectRepository(Attachment)
    private attachmentRepo: Repository<Attachment>,
    @InjectRepository(Project)
    private projectRepo: Repository<Project>,
  ) {}

  private getDownloadUrl(attachmentId: string) {
    const port = process.env.PORT || 3000;
    return `http://localhost:${port}/api/attachments/${attachmentId}/download`;
  }

  private async checkAttachmentUserAccess(
    att: Attachment,
    user: CurrentUserPayload,
    targetProjectId: string,
    targetSubmissionId: string,
  ) {
    if (att.projectId && att.projectId !== targetProjectId) {
      throw new ForbiddenException(
        `附件(${att.id}) 属于项目(${att.projectId})，不允许绑定到当前项目(${targetProjectId})`,
      );
    }
    if (att.submissionId && att.submissionId !== targetSubmissionId) {
      throw new BadRequestException(
        `附件(${att.id}) 已绑定到提交记录(${att.submissionId})，不允许改绑到其他提交，请先解绑原记录或上传新附件`,
      );
    }
    let clientId: string | undefined;
    if (att.submissionId) {
      const sub = await this.submissionRepo.findOne({
        where: { id: att.submissionId },
        relations: ['sample', 'sample.project'],
      });
      clientId = sub ? (sub.sample as any)?.project?.clientId : undefined;
    } else if (att.projectId) {
      const p = await this.projectRepo.findOne({ where: { id: att.projectId } });
      clientId = p?.clientId;
    }
    if (clientId && user.role !== UserRole.ADMIN && clientId !== user.clientId) {
      throw new ForbiddenException(`附件(${att.id}) 属于其他调用方(clientId)，无权绑定`);
    }
    if (user.role === UserRole.COLLECTOR && att.submissionId) {
      const sub = await this.submissionRepo.findOne({ where: { id: att.submissionId } });
      if (sub && sub.submittedBy && sub.submittedBy !== user.id) {
        throw new ForbiddenException(`附件(${att.id}) 属于其他采集员的提交记录，无权绑定`);
      }
    }
    if (user.role === UserRole.COLLECTOR && !att.submissionId && !att.projectId) {
      throw new ForbiddenException(
        `附件(${att.id}) 尚未绑定任何项目/提交，采集员只能绑定自己有权限的附件`,
      );
    }
  }

  private async validateAndBindAttachments(
    attachmentIds: string[] | undefined,
    targetSubmissionId: string,
    user: CurrentUserPayload,
    targetProjectId: string,
  ) {
    if (!attachmentIds || attachmentIds.length === 0) return 0;
    const ids = [...new Set(attachmentIds)];
    const attachments = await this.attachmentRepo.find({ where: { id: In(ids) } });
    if (attachments.length !== ids.length) {
      const found = new Set(attachments.map((a) => a.id));
      const missing = ids.filter((i) => !found.has(i));
      throw new NotFoundException(`附件 ID 不存在: ${missing.join(', ')}`);
    }
    for (const att of attachments) {
      await this.checkAttachmentUserAccess(att, user, targetProjectId, targetSubmissionId);
    }
    await this.attachmentRepo
      .createQueryBuilder()
      .update()
      .set({ submissionId: targetSubmissionId, projectId: targetProjectId })
      .whereInIds(ids)
      .execute();
    return attachments.length;
  }

  private async addHistory(
    submissionId: string,
    actionBy: string,
    action: HistoryAction,
    changes?: Record<string, { old: any; new: any }>,
  ) {
    const history = this.historyRepo.create({ submissionId, actionBy, action, changes });
    await this.historyRepo.save(history);
  }

  private async validateSubmission(
    formId: string,
    answers: { questionKey: string; value?: string; valueJson?: any }[],
    sampleId: string,
    excludeId?: string,
  ): Promise<{ issues: ValidationIssue[]; hasDuplicate: boolean; hasMissing: boolean }> {
    const issues: ValidationIssue[] = [];
    const questions = await this.questionRepo.find({ where: { formId } });
    const answerMap = new Map(answers.map((a) => [a.questionKey, a]));

    for (const q of questions) {
      const ans = answerMap.get(q.questionKey);
      const hasValue = ans && (ans.value || ans.valueJson);
      if (q.required && !hasValue) {
        issues.push({
          type: 'missing',
          field: q.questionKey,
          message: `字段"${q.label}"为必填项`,
        });
      }
    }

    const duplicateChecks = questions.filter((q) => q.extra?.unique);
    for (const q of duplicateChecks) {
      const ans = answerMap.get(q.questionKey);
      if (ans && ans.value) {
        const existingAnswers = await this.answerRepo
          .createQueryBuilder('a')
          .innerJoin('a.submission', 's')
          .where('a.questionKey = :key', { key: q.questionKey })
          .andWhere('a.value = :val', { val: ans.value })
          .andWhere('s.sampleId != :sid', { sid: sampleId })
          .andWhere(excludeId ? 's.id != :eid' : '1=1', { eid: excludeId })
          .getCount();
        if (existingAnswers > 0) {
          issues.push({
            type: 'duplicate',
            field: q.questionKey,
            message: `字段"${q.label}"值"${ans.value}"已存在`,
          });
        }
      }
    }

    return {
      issues,
      hasDuplicate: issues.some((i) => i.type === 'duplicate'),
      hasMissing: issues.some((i) => i.type === 'missing'),
    };
  }

  private async validateProjectConsistency(
    formId: string,
    sampleId: string,
  ): Promise<{ form: Form; sample: Sample; projectId: string; clientId: string }> {
    const form = await this.formRepo.findOne({ where: { id: formId }, relations: ['project'] });
    if (!form) throw new NotFoundException('表单不存在');

    const sample = await this.sampleRepo.findOne({ where: { id: sampleId }, relations: ['project'] });
    if (!sample) throw new NotFoundException('样本不存在');

    if (form.projectId !== sample.projectId) {
      throw new BadRequestException(
        `跨项目提交被禁止：表单(projectId=${form.projectId})与样本(projectId=${sample.projectId})不属于同一项目`,
      );
    }

    const sampleWithProject = sample as any;
    return {
      form,
      sample,
      projectId: form.projectId,
      clientId: sampleWithProject.project ? sampleWithProject.project.clientId : form.project.clientId,
    };
  }

  private async checkAccess(submission: Submission, user: CurrentUserPayload) {
    const result = await this.validateProjectConsistency(submission.formId, submission.sampleId);
    const { sample, clientId, projectId } = result;

    if (user.role !== UserRole.ADMIN && clientId !== user.clientId) {
      throw new ForbiddenException('无权访问：该资源属于其他调用方(clientId)');
    }

    if (user.role === UserRole.COLLECTOR) {
      if (!sample.assignedTo) {
        throw new ForbiddenException('无权操作：该样本尚未分配采集人员，需先由管理员/客户分配后才能操作');
      }
      if (sample.assignedTo !== user.id) {
        throw new ForbiddenException('无权操作：该样本未分配给您');
      }
      if (submission.submittedBy && submission.submittedBy !== user.id) {
        throw new ForbiddenException('无权操作：该提交记录不是由您创建的');
      }
    }

    if (user.role === UserRole.REVIEWER) {
      if (!submission.assignedReviewer) {
        throw new ForbiddenException('无权访问：该提交记录尚未分配复核人员，请等待客户/管理员派单后在"我的复核待办"中处理');
      }
      if (submission.assignedReviewer !== user.id) {
        throw new ForbiddenException('无权操作：该提交记录未分配给您复核，仅可处理"我的复核待办"中的指派记录');
      }
    }

    return { sample, projectId, clientId };
  }

  async create(dto: CreateSubmissionDto, user: CurrentUserPayload) {
    const { form, sample, clientId, projectId } = await this.validateProjectConsistency(
      dto.formId,
      dto.sampleId,
    );

    if (user.role !== UserRole.ADMIN && clientId !== user.clientId) {
      throw new ForbiddenException('无权访问：该资源属于其他调用方(clientId)');
    }

    if (user.role === UserRole.COLLECTOR) {
      if (!sample.assignedTo) {
        throw new ForbiddenException(
          '无权创建：该样本尚未分配给任何人，请等待管理员/客户分配给您后再操作',
        );
      }
      if (sample.assignedTo !== user.id) {
        throw new ForbiddenException('无权创建：该样本未分配给您');
      }
    }

    const existing = await this.submissionRepo.findOne({
      where: { sampleId: dto.sampleId, formId: dto.formId },
    });
    if (existing) {
      throw new BadRequestException('该样本已存在对应提交记录，请使用 PATCH 更新或 POST /submit 提交');
    }

    const validation = await this.validateSubmission(dto.formId, dto.answers, dto.sampleId);

    const submission = this.submissionRepo.create({
      formId: dto.formId,
      sampleId: dto.sampleId,
      submittedBy: user.id,
      latitude: dto.latitude,
      longitude: dto.longitude,
      locationAddress: dto.locationAddress,
      status: SubmissionStatus.DRAFT,
      validationIssues: validation.issues,
      hasDuplicate: validation.hasDuplicate,
      hasMissing: validation.hasMissing,
      answers: dto.answers.map((a) =>
        this.answerRepo.create({
          questionKey: a.questionKey,
          value: a.value,
          valueJson: a.valueJson,
        }),
      ),
    });

    const saved = await this.submissionRepo.save(submission);

    await this.validateAndBindAttachments(dto.attachmentIds, saved.id, user, projectId);

    await this.addHistory(saved.id, user.id, HistoryAction.CREATED);
    return saved;
  }

  async submit(id: string, user: CurrentUserPayload) {
    const submission = await this.submissionRepo.findOne({
      where: { id },
      relations: ['answers'],
    });
    if (!submission) throw new NotFoundException('提交不存在');

    const { sample } = await this.checkAccess(submission, user);

    if (submission.isLocked) {
      throw new BadRequestException('该记录已锁定，无法提交');
    }

    const validation = await this.validateSubmission(
      submission.formId,
      submission.answers,
      submission.sampleId,
      submission.id,
    );

    submission.status = SubmissionStatus.SUBMITTED;
    submission.submittedAt = new Date();
    submission.validationIssues = validation.issues;
    submission.hasDuplicate = validation.hasDuplicate;
    submission.hasMissing = validation.hasMissing;

    if (sample) {
      sample.status = SampleStatus.SUBMITTED;
      await this.sampleRepo.save(sample);
    }

    const saved = await this.submissionRepo.save(submission);
    await this.addHistory(saved.id, user.id, HistoryAction.SUBMITTED);
    return saved;
  }

  async recall(id: string, user: CurrentUserPayload) {
    const submission = await this.submissionRepo.findOne({ where: { id } });
    if (!submission) throw new NotFoundException('提交不存在');

    await this.checkAccess(submission, user);

    if (submission.isLocked) {
      throw new BadRequestException('该记录已锁定，无法撤回');
    }
    if (![SubmissionStatus.SUBMITTED, SubmissionStatus.REJECTED, SubmissionStatus.REVIEWING].includes(submission.status)) {
      throw new BadRequestException('当前状态不可撤回');
    }

    submission.status = SubmissionStatus.DRAFT;
    submission.assignedReviewer = null;
    const saved = await this.submissionRepo.save(submission);
    await this.addHistory(saved.id, user.id, HistoryAction.RECALLED);
    return saved;
  }

  async findAll(query: QuerySubmissionDto, user: CurrentUserPayload) {
    const qb = this.submissionRepo
      .createQueryBuilder('s')
      .innerJoinAndSelect('s.sample', 'sample')
      .innerJoinAndSelect('sample.project', 'project')
      .leftJoinAndSelect('s.answers', 'answers')
      .where('project.id = :pid', { pid: query.projectId });

    if (user.role !== UserRole.ADMIN) {
      qb.andWhere('project.clientId = :cid', { cid: user.clientId });
    }
    if (user.role === UserRole.COLLECTOR) {
      qb.andWhere('(sample.assignedTo = :uid OR s.submittedBy = :uid)', { uid: user.id });
    }
    if (user.role === UserRole.REVIEWER) {
      qb.andWhere('s.assignedReviewer = :uid', { uid: user.id });
    }
    if (query.formId) qb.andWhere('s.formId = :fid', { fid: query.formId });
    if (query.status) qb.andWhere('s.status = :st', { st: query.status });
    if (query.sampleId) qb.andWhere('s.sampleId = :sid', { sid: query.sampleId });
    if (query.submittedBy) qb.andWhere('s.submittedBy = :uid', { uid: query.submittedBy });

    qb.orderBy('s.createdAt', 'DESC');
    return qb.getMany();
  }

  async findOne(id: string, user: CurrentUserPayload) {
    const submission = await this.submissionRepo.findOne({
      where: { id },
      relations: ['answers', 'attachments', 'reviews', 'history', 'sample', 'form', 'form.questions'],
    });
    if (!submission) throw new NotFoundException('提交不存在');
    await this.checkAccess(submission, user);
    if (submission.attachments && submission.attachments.length > 0) {
      (submission as any).attachments = submission.attachments.map((att) => ({
        id: att.id,
        type: att.type,
        filename: att.filename,
        originalName: att.originalName,
        mimeType: att.mimeType,
        size: att.size,
        questionKey: att.questionKey,
        metadata: att.metadata,
        submissionId: att.submissionId,
        projectId: att.projectId,
        uploadedAt: att.uploadedAt,
        downloadUrl: this.getDownloadUrl(att.id),
      }));
    }
    return submission;
  }

  async update(id: string, dto: UpdateSubmissionDto, user: CurrentUserPayload) {
    const submission = await this.submissionRepo.findOne({
      where: { id },
      relations: ['answers'],
    });
    if (!submission) throw new NotFoundException('提交不存在');

    await this.checkAccess(submission, user);

    if (submission.isLocked) {
      throw new BadRequestException('该记录已锁定，无法修改');
    }

    const changes: Record<string, { old: any; new: any }> = {};
    if (dto.latitude !== undefined) {
      changes.latitude = { old: submission.latitude, new: dto.latitude };
      submission.latitude = dto.latitude;
    }
    if (dto.longitude !== undefined) {
      changes.longitude = { old: submission.longitude, new: dto.longitude };
      submission.longitude = dto.longitude;
    }
    if (dto.locationAddress !== undefined) {
      changes.locationAddress = { old: submission.locationAddress, new: dto.locationAddress };
      submission.locationAddress = dto.locationAddress;
    }

    if (dto.answers) {
      await this.answerRepo.delete({ submissionId: submission.id });
      submission.answers = dto.answers.map((a) =>
        this.answerRepo.create({
          submissionId: submission.id,
          questionKey: a.questionKey,
          value: a.value,
          valueJson: a.valueJson,
        }),
      );
      changes.answers = { old: 'updated', new: 'updated' };
    }

    if (dto.attachmentIds && dto.attachmentIds.length > 0) {
      const access = await this.checkAccess(submission, user);
      await this.validateAndBindAttachments(
        dto.attachmentIds,
        submission.id,
        user,
        access.projectId,
      );
    }

    const validation = await this.validateSubmission(
      submission.formId,
      submission.answers,
      submission.sampleId,
      submission.id,
    );
    submission.validationIssues = validation.issues;
    submission.hasDuplicate = validation.hasDuplicate;
    submission.hasMissing = validation.hasMissing;

    const saved = await this.submissionRepo.save(submission);
    await this.addHistory(saved.id, user.id, HistoryAction.UPDATED, changes);
    return saved;
  }

  async mySubmissions(user: CurrentUserPayload, projectId?: string) {
    const qb = this.submissionRepo
      .createQueryBuilder('s')
      .innerJoinAndSelect('s.sample', 'sample')
      .innerJoinAndSelect('sample.project', 'project')
      .where('s.submittedBy = :uid', { uid: user.id });
    if (projectId) qb.andWhere('project.id = :pid', { pid: projectId });
    qb.orderBy('s.updatedAt', 'DESC');
    return qb.getMany();
  }
}
