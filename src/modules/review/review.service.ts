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
import { CreateReviewDto, QueryReviewTodoDto } from './dto/review.dto';
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
      throw new ForbiddenException('无权进行复核：需要 ADMIN 或 REVIEWER 角色');
    }

    if (user.role !== UserRole.ADMIN) {
      if (submission.sample.project.clientId !== user.clientId) {
        throw new ForbiddenException('无权访问：该资源属于其他调用方(clientId)');
      }
      if (submission.assignedReviewer && submission.assignedReviewer !== user.id) {
        throw new ForbiddenException('无权复核：该记录未分配给您，请在"我的复核"中查看分配给您的待办');
      }
    }

    if (submission.isLocked) {
      throw new BadRequestException('记录已锁定，无法复核');
    }

    if (![SubmissionStatus.SUBMITTED, SubmissionStatus.REVIEWING].includes(submission.status)) {
      throw new BadRequestException(`当前状态(${submission.status})不可复核，仅 SUBMITTED/REVIEWING 可操作`);
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
      submission.assignedReviewer = null;
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
      submission.assignedReviewer = null;
      await this.addHistory(submission.id, user.id, HistoryAction.REJECTED);
    } else if (dto.result === ReviewResult.NEEDS_REVISION) {
      submission.status = SubmissionStatus.REJECTED;
      submission.assignedReviewer = null;
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

    if (user.role !== UserRole.ADMIN && user.role !== UserRole.CLIENT) {
      throw new ForbiddenException('无权锁定：需要 ADMIN 或 CLIENT 角色');
    }
    if (user.role !== UserRole.ADMIN && submission.sample.project.clientId !== user.clientId) {
      throw new ForbiddenException('无权操作：该资源属于其他调用方(clientId)');
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

    if (user.role !== UserRole.ADMIN && user.role !== UserRole.CLIENT) {
      throw new ForbiddenException('无权解锁：需要 ADMIN 或 CLIENT 角色');
    }
    if (user.role !== UserRole.ADMIN && submission.sample.project.clientId !== user.clientId) {
      throw new ForbiddenException('无权操作：该资源属于其他调用方(clientId)');
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
    if (submissionIds.length === 0) {
      throw new BadRequestException('submissionIds 不能为空');
    }
    const reviewer = await this.userRepo.findOne({ where: { id: reviewerId } });
    if (!reviewer) throw new NotFoundException('复核人员不存在');
    if (reviewer.role !== UserRole.REVIEWER && reviewer.role !== UserRole.ADMIN) {
      throw new BadRequestException('该用户不是复核人员(REVIEWER/ADMIN)');
    }

    const submissions = await this.submissionRepo.find({
      where: { id: In(submissionIds) },
      relations: ['sample', 'sample.project'],
    });
    if (submissions.length !== submissionIds.length) {
      throw new NotFoundException('部分提交记录不存在');
    }

    for (const s of submissions) {
      if (user.role !== UserRole.ADMIN) {
        if (s.sample.project.clientId !== user.clientId) {
          throw new ForbiddenException('无权操作：部分记录属于其他调用方(clientId)');
        }
        if (user.role !== UserRole.CLIENT) {
          throw new ForbiddenException('无权分配：需要 ADMIN 或 CLIENT 角色');
        }
      }
      if (reviewer.role !== UserRole.ADMIN && s.sample.project.clientId !== reviewer.clientId) {
        throw new BadRequestException(
          `复核人员(${reviewer.username})与目标记录不在同一调用方(clientId)下，无法跨租户分配`,
        );
      }
      if (s.isLocked) {
        throw new BadRequestException(`提交(${s.id})已锁定，无法分配复核`);
      }
      if (![SubmissionStatus.SUBMITTED, SubmissionStatus.REVIEWING].includes(s.status)) {
        throw new BadRequestException(
          `提交(${s.id})状态为${s.status}，仅 SUBMITTED/REVIEWING 可分配复核`,
        );
      }
      s.status = SubmissionStatus.REVIEWING;
      s.assignedReviewer = reviewerId;
    }

    await this.submissionRepo.save(submissions);
    return { assigned: submissions.length, reviewerId, reviewerName: reviewer.name };
  }

  async myReviewTodos(user: CurrentUserPayload, query: QueryReviewTodoDto) {
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.REVIEWER) {
      throw new ForbiddenException('无权查看复核待办');
    }
    const qb = this.submissionRepo
      .createQueryBuilder('s')
      .innerJoinAndSelect('s.sample', 'sample')
      .innerJoinAndSelect('sample.project', 'project')
      .leftJoinAndSelect('s.answers', 'answers')
      .where('s.assignedReviewer = :uid', { uid: user.id });

    if (query.status) {
      qb.andWhere('s.status = :st', { st: query.status });
    } else {
      qb.andWhere('s.status IN (:...sts)', {
        sts: [SubmissionStatus.REVIEWING, SubmissionStatus.SUBMITTED],
      });
    }
    if (query.projectId) {
      qb.andWhere('project.id = :pid', { pid: query.projectId });
    }
    if (user.role !== UserRole.ADMIN) {
      qb.andWhere('project.clientId = :cid', { cid: user.clientId });
    }
    qb.orderBy('s.updatedAt', 'DESC');
    return qb.getMany();
  }

  async myReviewHistory(user: CurrentUserPayload, projectId?: string) {
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
      throw new ForbiddenException('无权访问：该资源属于其他调用方(clientId)');
    }
    return this.reviewRepo.find({
      where: { submissionId },
      relations: ['reviewer'],
      order: { reviewedAt: 'DESC' },
    });
  }
}
