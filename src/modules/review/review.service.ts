import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import {
  Submission,
  SubmissionStatus,
} from '../../entities/submission.entity';
import {
  SubmissionHistory,
  HistoryAction,
} from '../../entities/submission-history.entity';
import {
  ReviewRecord,
  ReviewResult,
} from '../../entities/review-record.entity';
import { Sample, SampleStatus } from '../../entities/sample.entity';
import { User, UserRole } from '../../entities/user.entity';
import { CreateReviewDto } from './dto/review.dto';
import { CurrentUserPayload } from '../auth/current-user.decorator';

@Injectable()
export class ReviewService {
  constructor(
    @InjectRepository(Submission)
    private submissionRepo: Repository<Submission>,
    @InjectRepository(SubmissionHistory)
    private historyRepo: Repository<SubmissionHistory>,
    @InjectRepository(ReviewRecord)
    private reviewRepo: Repository<ReviewRecord>,
    @InjectRepository(Sample)
    private sampleRepo: Repository<Sample>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {}

  private async addHistory(
    submissionId: string,
    actionBy: string,
    action: HistoryAction,
  ) {
    const h = this.historyRepo.create({ submissionId, actionBy, action });
    await this.historyRepo.save(h);
  }

  async create(dto: CreateReviewDto, user: CurrentUserPayload) {
    const submission = await this.submissionRepo.findOne({
      where: { id: dto.submissionId },
      relations: ['sample', 'sample.project'],
    });
    if (!submission) throw new NotFoundException('提交记录不存在');

    if (user.role !== UserRole.ADMIN && user.role !== UserRole.REVIEWER) {
      throw new ForbiddenException('无权进行复核');
    }
    if (
      user.role !== UserRole.ADMIN &&
      submission.sample.project.clientId !== user.clientId
    ) {
      throw new ForbiddenException('无权访问该项目');
    }

    if (submission.isLocked) {
      throw new BadRequestException('记录已锁定');
    }

    const review = this.reviewRepo.create({
      submissionId: dto.submissionId,
      reviewerId: user.id,
      result: dto.result,
      comment: dto.comment,
      issues: dto.issues,
    });
    await this.reviewRepo.save(review);

    if (dto.result === ReviewResult.APPROVED) {
      submission.status = SubmissionStatus.APPROVED;
      submission.isLocked = true;
      await this.addHistory(submission.id, user.id, HistoryAction.APPROVED);
      await this.addHistory(submission.id, user.id, HistoryAction.LOCKED);
      const sample = await this.sampleRepo.findOne({
        where: { id: submission.sampleId },
      });
      if (sample) {
        sample.status = SampleStatus.REVIEWED;
        await this.sampleRepo.save(sample);
      }
    } else if (dto.result === ReviewResult.REJECTED) {
      submission.status = SubmissionStatus.REJECTED;
      await this.addHistory(submission.id, user.id, HistoryAction.REJECTED);
    } else if (dto.result === ReviewResult.NEEDS_REVISION) {
      submission.status = SubmissionStatus.REJECTED;
    }

    await this.submissionRepo.save(submission);
    return review;
  }

  async lock(id: string, user: CurrentUserPayload) {
    const submission = await this.submissionRepo.findOne({
      where: { id },
      relations: ['sample', 'sample.project'],
    });
    if (!submission) throw new NotFoundException('提交记录不存在');
    if (user.role !== UserRole.ADMIN && submission.sample.project.clientId !== user.clientId) {
      throw new ForbiddenException('无权操作');
    }
    submission.isLocked = true;
    submission.status = SubmissionStatus.LOCKED;
    const saved = await this.submissionRepo.save(submission);
    await this.addHistory(saved.id, user.id, HistoryAction.LOCKED);
    return saved;
  }

  async unlock(id: string, user: CurrentUserPayload) {
    const submission = await this.submissionRepo.findOne({
      where: { id },
      relations: ['sample', 'sample.project'],
    });
    if (!submission) throw new NotFoundException('提交记录不存在');
    if (user.role !== UserRole.ADMIN && submission.sample.project.clientId !== user.clientId) {
      throw new ForbiddenException('无权操作');
    }
    submission.isLocked = false;
    if (submission.status === SubmissionStatus.LOCKED) {
      submission.status = SubmissionStatus.SUBMITTED;
    }
    const saved = await this.submissionRepo.save(submission);
    await this.addHistory(saved.id, user.id, HistoryAction.UNLOCKED);
    return saved;
  }

  async assignReviewer(
    submissionIds: string[],
    reviewerId: string,
    user: CurrentUserPayload,
  ) {
    const reviewer = await this.userRepo.findOne({ where: { id: reviewerId } });
    if (!reviewer) throw new NotFoundException('复核人员不存在');
    if (reviewer.role !== UserRole.REVIEWER && reviewer.role !== UserRole.ADMIN) {
      throw new BadRequestException('该用户不是复核人员');
    }

    const submissions = await this.submissionRepo.find({
      where: { id: In(submissionIds) },
      relations: ['sample', 'sample.project'],
    });

    for (const s of submissions) {
      if (
        user.role !== UserRole.ADMIN &&
        s.sample.project.clientId !== user.clientId
      ) {
        throw new ForbiddenException('无权操作部分记录');
      }
      s.status = SubmissionStatus.REVIEWING;
    }
    await this.submissionRepo.save(submissions);
    return { assigned: submissions.length, reviewerId };
  }

  async myReviews(user: CurrentUserPayload, projectId?: string) {
    const qb = this.reviewRepo
      .createQueryBuilder('r')
      .innerJoinAndSelect('r.submission', 's')
      .innerJoinAndSelect('s.sample', 'sample')
      .innerJoinAndSelect('sample.project', 'project')
      .where('r.reviewerId = :uid', { uid: user.id });
    if (projectId) qb.andWhere('project.id = :pid', { pid: projectId });
    qb.orderBy('r.reviewedAt', 'DESC');
    return qb.getMany();
  }

  async findBySubmission(submissionId: string, user: CurrentUserPayload) {
    const submission = await this.submissionRepo.findOne({
      where: { id: submissionId },
      relations: ['sample', 'sample.project'],
    });
    if (!submission) throw new NotFoundException('提交记录不存在');
    if (
      user.role !== UserRole.ADMIN &&
      submission.sample.project.clientId !== user.clientId
    ) {
      throw new ForbiddenException('无权访问');
    }
    return this.reviewRepo.find({
      where: { submissionId },
      relations: ['reviewer'],
      order: { reviewedAt: 'DESC' },
    });
  }
}
