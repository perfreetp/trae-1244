import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Project, ProjectStatus } from '../../entities/project.entity';
import { UserRole } from '../../entities/user.entity';
import {
  CreateProjectDto,
  UpdateProjectDto,
  QueryProjectDto,
} from './dto/project.dto';
import { CurrentUserPayload } from '../auth/current-user.decorator';

@Injectable()
export class ProjectService {
  constructor(
    @InjectRepository(Project)
    private projectRepo: Repository<Project>,
  ) {}

  async create(dto: CreateProjectDto, user: CurrentUserPayload) {
    const clientId = dto.clientId || user.clientId || `client_${user.id}`;
    const project = this.projectRepo.create({
      ...dto,
      ownerId: user.id,
      clientId,
      status: ProjectStatus.DRAFT,
    });
    return this.projectRepo.save(project);
  }

  async findAll(query: QueryProjectDto, user: CurrentUserPayload) {
    const where: any = {};
    if (user.role !== UserRole.ADMIN) {
      where.clientId = user.clientId;
    }
    if (query.status) where.status = query.status;
    if (query.region) where.region = query.region;
    if (query.keyword) where.name = Like(`%${query.keyword}%`);

    return this.projectRepo.find({
      where,
      order: { createdAt: 'DESC' },
      relations: ['owner'],
    });
  }

  async findOne(id: string, user: CurrentUserPayload) {
    const project = await this.projectRepo.findOne({
      where: { id },
      relations: ['owner', 'forms', 'samples'],
    });
    if (!project) throw new NotFoundException('项目不存在');
    if (user.role !== UserRole.ADMIN && project.clientId !== user.clientId) {
      throw new ForbiddenException('无权访问该项目');
    }
    return project;
  }

  async update(
    id: string,
    dto: UpdateProjectDto,
    user: CurrentUserPayload,
  ) {
    const project = await this.findOne(id, user);
    Object.assign(project, dto);
    return this.projectRepo.save(project);
  }

  async remove(id: string, user: CurrentUserPayload) {
    const project = await this.findOne(id, user);
    await this.projectRepo.remove(project);
    return { success: true };
  }

  async publish(id: string, user: CurrentUserPayload) {
    const project = await this.findOne(id, user);
    project.status = ProjectStatus.PUBLISHED;
    return this.projectRepo.save(project);
  }
}
