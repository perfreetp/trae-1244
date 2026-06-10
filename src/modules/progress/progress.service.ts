import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Project } from '../../entities/project.entity';
import { Sample, SampleStatus } from '../../entities/sample.entity';
import {
  Submission,
  SubmissionStatus,
} from '../../entities/submission.entity';
import { User, UserRole } from '../../entities/user.entity';
import { CurrentUserPayload } from '../auth/current-user.decorator';

@Injectable()
export class ProgressService {
  constructor(
    @InjectRepository(Project)
    private projectRepo: Repository<Project>,
    @InjectRepository(Sample)
    private sampleRepo: Repository<Sample>,
    @InjectRepository(Submission)
    private submissionRepo: Repository<Submission>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {}

  private async checkProject(projectId: string, user: CurrentUserPayload) {
    const project = await this.projectRepo.findOne({ where: { id: projectId } });
    if (!project) throw new NotFoundException('项目不存在');
    if (user.role !== UserRole.ADMIN && project.clientId !== user.clientId) {
      throw new ForbiddenException('无权访问');
    }
    return project;
  }

  async getProjectProgress(projectId: string, user: CurrentUserPayload) {
    await this.checkProject(projectId, user);

    const samples = await this.sampleRepo.find({ where: { projectId } });
    const total = samples.length;
    const countByStatus = samples.reduce((acc, s) => {
      acc[s.status] = (acc[s.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const submissions = await this.submissionRepo
      .createQueryBuilder('s')
      .innerJoin('s.sample', 'sample')
      .where('sample.projectId = :pid', { pid: projectId })
      .getMany();

    const approved = submissions.filter(
      (s) => s.status === SubmissionStatus.APPROVED,
    ).length;
    const withIssues = submissions.filter(
      (s) => s.hasDuplicate || s.hasMissing,
    ).length;

    return {
      projectId,
      total,
      statusBreakdown: countByStatus,
      submitted: countByStatus[SampleStatus.SUBMITTED] || 0,
      reviewed: countByStatus[SampleStatus.REVIEWED] || 0,
      approved,
      withIssues,
      pending: total - (countByStatus[SampleStatus.SUBMITTED] || 0) - (countByStatus[SampleStatus.REVIEWED] || 0),
      progressPercent: total === 0 ? 0 : Math.round(((countByStatus[SampleStatus.SUBMITTED] || 0) + (countByStatus[SampleStatus.REVIEWED] || 0)) / total * 100),
    };
  }

  async getProgressByRegion(projectId: string, user: CurrentUserPayload) {
    await this.checkProject(projectId, user);

    const samples = await this.sampleRepo.find({ where: { projectId } });
    const regionMap = new Map<string, { total: number; submitted: number; reviewed: number }>();

    for (const s of samples) {
      const region = s.region || '未分配';
      if (!regionMap.has(region)) {
        regionMap.set(region, { total: 0, submitted: 0, reviewed: 0 });
      }
      const entry = regionMap.get(region)!;
      entry.total++;
      if (s.status === SampleStatus.SUBMITTED) entry.submitted++;
      if (s.status === SampleStatus.REVIEWED) entry.reviewed++;
    }

    return Array.from(regionMap.entries()).map(([region, data]) => ({
      region,
      ...data,
      progress: data.total === 0 ? 0 : Math.round((data.submitted + data.reviewed) / data.total * 100),
    }));
  }

  async getProgressByCollector(projectId: string, user: CurrentUserPayload) {
    await this.checkProject(projectId, user);

    const samples = await this.sampleRepo.find({ where: { projectId } });
    const collectorMap = new Map<string, { total: number; submitted: number; reviewed: number; name: string }>();

    for (const s of samples) {
      if (!s.assignedTo) continue;
      if (!collectorMap.has(s.assignedTo)) {
        collectorMap.set(s.assignedTo, { total: 0, submitted: 0, reviewed: 0, name: s.assignedTo });
      }
      const entry = collectorMap.get(s.assignedTo)!;
      entry.total++;
      if (s.status === SampleStatus.SUBMITTED) entry.submitted++;
      if (s.status === SampleStatus.REVIEWED) entry.reviewed++;
    }

    const collectorIds = Array.from(collectorMap.keys());
    if (collectorIds.length > 0) {
      const users = await this.userRepo.find({ where: { id: In(collectorIds) as any } });
      for (const u of users) {
        if (collectorMap.has(u.id)) {
          collectorMap.get(u.id)!.name = u.name;
        }
      }
    }

    return Array.from(collectorMap.entries()).map(([collectorId, data]) => ({
      collectorId,
      name: data.name,
      total: data.total,
      submitted: data.submitted,
      reviewed: data.reviewed,
      progress: data.total === 0 ? 0 : Math.round((data.submitted + data.reviewed) / data.total * 100),
    }));
  }

  async getPendingSamples(projectId: string, user: CurrentUserPayload) {
    await this.checkProject(projectId, user);
    return this.sampleRepo.find({
      where: {
        projectId,
        status: In([SampleStatus.PENDING, SampleStatus.ASSIGNED, SampleStatus.IN_PROGRESS]) as any,
      },
      order: { updatedAt: 'DESC' },
    });
  }

  async remind(sampleIds: string[], user: CurrentUserPayload) {
    const samples = await this.sampleRepo
      .createQueryBuilder('s')
      .innerJoinAndSelect('s.project', 'project')
      .where('s.id IN (:...ids)', { ids: sampleIds })
      .getMany();

    for (const s of samples) {
      if (user.role !== UserRole.ADMIN && s.project.clientId !== user.clientId) {
        throw new ForbiddenException('无权操作部分样本');
      }
      s.remindedAt = new Date();
      s.remindCount = (s.remindCount || 0) + 1;
    }
    await this.sampleRepo.save(samples);
    return { reminded: samples.length, at: new Date() };
  }
}
