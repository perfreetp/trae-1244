import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
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
  ) {}

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

  private async checkAccess(submission: Submission, user: CurrentUserPayload) {
    const sample = await this.sampleRepo.findOne({
      where: { id: submission.sampleId },
      relations: ['project'],
    });
    if (!sample) throw new NotFoundException('样本不存在');
    if (user.role !== UserRole.ADMIN && sample.project.clientId !== user.clientId) {
      throw new ForbiddenException('无权访问');
    }
    return sample;
  }

  async create(dto: CreateSubmissionDto, user: CurrentUserPayload) {
    const form = await this.formRepo.findOne({
      where: { id: dto.formId },
      relations: ['project'],
    });
    if (!form) throw new NotFoundException('表单不存在');

    const sample = await this.sampleRepo.findOne({ where: { id: dto.sampleId } });
    if (!sample) throw new NotFoundException('样本不存在');

    if (sample.assignedTo && sample.assignedTo !== user.id && user.role === UserRole.COLLECTOR) {
      throw new ForbiddenException('该样本未分配给您');
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

    if (dto.attachmentIds && dto.attachmentIds.length > 0) {
      await this.attachmentRepo
        .createQueryBuilder()
        .update()
        .set({ submissionId: saved.id })
        .whereInIds(dto.attachmentIds)
        .execute();
    }

    await this.addHistory(saved.id, user.id, HistoryAction.CREATED);
    return saved;
  }

  async submit(id: string, user: CurrentUserPayload) {
    const submission = await this.submissionRepo.findOne({
      where: { id },
      relations: ['answers'],
    });
    if (!submission) throw new NotFoundException('提交不存在');
    await this.checkAccess(submission, user);

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

    const sample = await this.sampleRepo.findOne({ where: { id: submission.sampleId } });
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
    if (![SubmissionStatus.SUBMITTED, SubmissionStatus.REJECTED].includes(submission.status)) {
      throw new BadRequestException('当前状态不可撤回');
    }

    submission.status = SubmissionStatus.DRAFT;
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
      await this.attachmentRepo
        .createQueryBuilder()
        .update()
        .set({ submissionId: submission.id })
        .whereInIds(dto.attachmentIds)
        .execute();
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
