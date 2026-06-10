import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
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
      throw new ForbiddenException('无权访问该项目：属于其他调用方(clientId)');
    }
    return project;
  }

  private ensureManagerRole(user: CurrentUserPayload) {
    if (user.role === UserRole.COLLECTOR || user.role === UserRole.REVIEWER) {
      throw new ForbiddenException('无权执行该操作：需要 ADMIN 或 CLIENT 角色');
    }
  }

  async create(dto: CreateSampleDto, user: CurrentUserPayload) {
    this.ensureManagerRole(user);
    await this.checkProject(dto.projectId, user);
    const exists = await this.sampleRepo.findOne({
      where: { projectId: dto.projectId, uniqueCode: dto.uniqueCode },
    });
    if (exists) throw new ConflictException('该项目下唯一编码已存在');

    const sample = this.sampleRepo.create({
      ...dto,
      status: dto.assignedTo ? SampleStatus.ASSIGNED : SampleStatus.PENDING,
    });
    return this.sampleRepo.save(sample);
  }

  async batchCreate(dto: BatchCreateSampleDto, user: CurrentUserPayload) {
    this.ensureManagerRole(user);
    if (dto.samples.length === 0) return { created: 0 };
    if (dto.samples.length > 10000) {
      throw new BadRequestException('单次批量创建不超过 10000 条');
    }
    const projectId = dto.samples[0].projectId;
    if (dto.samples.some((s) => s.projectId !== projectId)) {
      throw new BadRequestException('批量样本必须属于同一项目');
    }
    await this.checkProject(projectId, user);

    const codes = new Set<string>();
    for (const s of dto.samples) {
      if (codes.has(s.uniqueCode)) {
        throw new BadRequestException(`请求中包含重复 uniqueCode: ${s.uniqueCode}`);
      }
      codes.add(s.uniqueCode);
    }
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
    const project = await this.checkProject(query.projectId, user);
    const where: any = { projectId: query.projectId };

    if (user.role === UserRole.COLLECTOR) {
      where.assignedTo = user.id;
    }
    if (user.role === UserRole.REVIEWER) {
    }
    if (query.status) where.status = query.status;
    if (query.region) where.region = query.region;
    if (query.assignedTo) {
      if (user.role !== UserRole.COLLECTOR) {
        where.assignedTo = query.assignedTo;
      } else if (query.assignedTo !== user.id) {
        return [];
      }
    }
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
      throw new ForbiddenException('无权访问该样本：属于其他调用方(clientId)');
    }
    if (user.role === UserRole.COLLECTOR && sample.assignedTo && sample.assignedTo !== user.id) {
      throw new ForbiddenException('无权访问：该样本未分配给您');
    }
    return sample;
  }

  async mySamples(user: CurrentUserPayload, projectId?: string) {
    if (user.role !== UserRole.COLLECTOR) {
      return [];
    }
    const where: any = { assignedTo: user.id };
    if (projectId) where.projectId = projectId;
    return this.sampleRepo.find({ where, order: { updatedAt: 'DESC' } });
  }

  async assign(id: string, dto: AssignSampleDto, user: CurrentUserPayload) {
    this.ensureManagerRole(user);
    const sample = await this.findOne(id, user);
    const collector = await this.userRepo.findOne({ where: { id: dto.assignedTo } });
    if (!collector) throw new NotFoundException('采集人员不存在');
    if (collector.role !== UserRole.COLLECTOR && collector.role !== UserRole.ADMIN) {
      throw new BadRequestException('该用户不是采集人员(COLLECTOR/ADMIN)');
    }
    if (collector.role !== UserRole.ADMIN && sample.project.clientId !== collector.clientId) {
      throw new BadRequestException(
        `采集人员(${collector.username})与目标样本不在同一调用方(clientId)下`,
      );
    }
    sample.assignedTo = dto.assignedTo;
    sample.status = SampleStatus.ASSIGNED;
    return this.sampleRepo.save(sample);
  }

  async batchAssign(
    sampleIds: string[],
    assignedTo: string,
    user: CurrentUserPayload,
  ) {
    this.ensureManagerRole(user);
    if (sampleIds.length === 0) {
      throw new BadRequestException('sampleIds 不能为空');
    }
    const collector = await this.userRepo.findOne({ where: { id: assignedTo } });
    if (!collector) throw new NotFoundException('采集人员不存在');
    if (collector.role !== UserRole.COLLECTOR && collector.role !== UserRole.ADMIN) {
      throw new BadRequestException('该用户不是采集人员(COLLECTOR/ADMIN)');
    }

    const samples = await this.sampleRepo.find({
      where: { id: In(sampleIds) },
      relations: ['project'],
    });
    if (samples.length !== sampleIds.length) {
      throw new NotFoundException('部分样本不存在');
    }
    for (const s of samples) {
      if (user.role !== UserRole.ADMIN && s.project.clientId !== user.clientId) {
        throw new ForbiddenException('无权操作：部分样本属于其他调用方(clientId)');
      }
      if (collector.role !== UserRole.ADMIN && s.project.clientId !== collector.clientId) {
        throw new BadRequestException(
          `采集人员(${collector.username})与样本(${s.uniqueCode})不在同一调用方(clientId)下`,
        );
      }
      s.assignedTo = assignedTo;
      s.status = SampleStatus.ASSIGNED;
    }
    await this.sampleRepo.save(samples);
    return { updated: samples.length, assignedTo, collectorName: collector.name };
  }

  async update(id: string, dto: UpdateSampleDto, user: CurrentUserPayload) {
    this.ensureManagerRole(user);
    const sample = await this.findOne(id, user);
    Object.assign(sample, dto);
    return this.sampleRepo.save(sample);
  }

  async remove(id: string, user: CurrentUserPayload) {
    this.ensureManagerRole(user);
    const sample = await this.findOne(id, user);
    await this.sampleRepo.remove(sample);
    return { success: true };
  }
}
