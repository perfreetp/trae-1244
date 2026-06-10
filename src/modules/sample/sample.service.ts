import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, In } from 'typeorm';
import { Sample, SampleStatus } from '../../entities/sample.entity';
import { Project } from '../../entities/project.entity';
import { User, UserRole } from '../../entities/user.entity';
import {
  CreateSampleDto,
  BatchCreateSampleDto,
  AssignSampleDto,
  UpdateSampleDto,
  QuerySampleDto,
} from './dto/sample.dto';
import { CurrentUserPayload } from '../auth/current-user.decorator';

@Injectable()
export class SampleService {
  constructor(
    @InjectRepository(Sample)
    private sampleRepo: Repository<Sample>,
    @InjectRepository(Project)
    private projectRepo: Repository<Project>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {}

  private async checkProject(projectId: string, user: CurrentUserPayload) {
    const project = await this.projectRepo.findOne({ where: { id: projectId } });
    if (!project) throw new NotFoundException('项目不存在');
    if (user.role !== UserRole.ADMIN && project.clientId !== user.clientId) {
      throw new ForbiddenException('无权访问该项目');
    }
    return project;
  }

  async create(dto: CreateSampleDto, user: CurrentUserPayload) {
    await this.checkProject(dto.projectId, user);
    const exists = await this.sampleRepo.findOne({
      where: { projectId: dto.projectId, uniqueCode: dto.uniqueCode },
    });
    if (exists) throw new ConflictException('唯一编码已存在');

    const sample = this.sampleRepo.create({
      ...dto,
      status: dto.assignedTo ? SampleStatus.ASSIGNED : SampleStatus.PENDING,
    });
    return this.sampleRepo.save(sample);
  }

  async batchCreate(dto: BatchCreateSampleDto, user: CurrentUserPayload) {
    if (dto.samples.length === 0) return { created: 0 };
    await this.checkProject(dto.samples[0].projectId, user);
    const samples = dto.samples.map((s) =>
      this.sampleRepo.create({
        ...s,
        status: s.assignedTo ? SampleStatus.ASSIGNED : SampleStatus.PENDING,
      }),
    );
    const saved = await this.sampleRepo.save(samples);
    return { created: saved.length };
  }

  async findAll(query: QuerySampleDto, user: CurrentUserPayload) {
    await this.checkProject(query.projectId, user);
    const where: any = { projectId: query.projectId };
    if (query.status) where.status = query.status;
    if (query.region) where.region = query.region;
    if (query.assignedTo) where.assignedTo = query.assignedTo;
    if (query.keyword) {
      where.uniqueCode = Like(`%${query.keyword}%`);
    }

    return this.sampleRepo.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, user: CurrentUserPayload) {
    const sample = await this.sampleRepo.findOne({
      where: { id },
      relations: ['project', 'submissions'],
    });
    if (!sample) throw new NotFoundException('样本不存在');
    if (user.role !== UserRole.ADMIN && sample.project.clientId !== user.clientId) {
      throw new ForbiddenException('无权访问该样本');
    }
    return sample;
  }

  async mySamples(user: CurrentUserPayload, projectId?: string) {
    const where: any = { assignedTo: user.id };
    if (projectId) where.projectId = projectId;
    return this.sampleRepo.find({ where, order: { updatedAt: 'DESC' } });
  }

  async assign(id: string, dto: AssignSampleDto, user: CurrentUserPayload) {
    const sample = await this.findOne(id, user);
    const collector = await this.userRepo.findOne({ where: { id: dto.assignedTo } });
    if (!collector) throw new NotFoundException('采集人员不存在');
    sample.assignedTo = dto.assignedTo;
    sample.status = SampleStatus.ASSIGNED;
    return this.sampleRepo.save(sample);
  }

  async batchAssign(
    sampleIds: string[],
    assignedTo: string,
    user: CurrentUserPayload,
  ) {
    const samples = await this.sampleRepo.find({
      where: { id: In(sampleIds) },
      relations: ['project'],
    });
    for (const s of samples) {
      if (user.role !== UserRole.ADMIN && s.project.clientId !== user.clientId) {
        throw new ForbiddenException('无权操作部分样本');
      }
      s.assignedTo = assignedTo;
      s.status = SampleStatus.ASSIGNED;
    }
    await this.sampleRepo.save(samples);
    return { updated: samples.length };
  }

  async update(id: string, dto: UpdateSampleDto, user: CurrentUserPayload) {
    const sample = await this.findOne(id, user);
    Object.assign(sample, dto);
    return this.sampleRepo.save(sample);
  }

  async remove(id: string, user: CurrentUserPayload) {
    const sample = await this.findOne(id, user);
    await this.sampleRepo.remove(sample);
    return { success: true };
  }
}
