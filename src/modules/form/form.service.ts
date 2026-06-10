import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Form, FormStatus } from '../../entities/form.entity';
import { FormQuestion } from '../../entities/form-question.entity';
import { Project } from '../../entities/project.entity';
import { UserRole } from '../../entities/user.entity';
import { CreateFormDto, UpdateFormDto } from './dto/form.dto';
import { CurrentUserPayload } from '../auth/current-user.decorator';

@Injectable()
export class FormService {
  constructor(
    @InjectRepository(Form)
    private formRepo: Repository<Form>,
    @InjectRepository(FormQuestion)
    private questionRepo: Repository<FormQuestion>,
    @InjectRepository(Project)
    private projectRepo: Repository<Project>,
  ) {}

  private async checkProjectAccess(projectId: string, user: CurrentUserPayload) {
    const project = await this.projectRepo.findOne({ where: { id: projectId } });
    if (!project) throw new NotFoundException('项目不存在');
    if (user.role !== UserRole.ADMIN && project.clientId !== user.clientId) {
      throw new ForbiddenException('无权访问该项目');
    }
    return project;
  }

  async create(dto: CreateFormDto, user: CurrentUserPayload) {
    await this.checkProjectAccess(dto.projectId, user);
    const form = this.formRepo.create({
      projectId: dto.projectId,
      name: dto.name,
      description: dto.description,
      status: FormStatus.DRAFT,
      version: 1,
      questions: dto.questions.map((q, idx) =>
        this.questionRepo.create({ ...q, order: q.order ?? idx }),
      ),
    });
    return this.formRepo.save(form);
  }

  async findByProject(projectId: string, user: CurrentUserPayload) {
    await this.checkProjectAccess(projectId, user);
    return this.formRepo.find({
      where: { projectId },
      relations: ['questions'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, user: CurrentUserPayload) {
    const form = await this.formRepo.findOne({
      where: { id },
      relations: ['questions', 'project'],
    });
    if (!form) throw new NotFoundException('表单不存在');
    if (user.role !== UserRole.ADMIN && form.project.clientId !== user.clientId) {
      throw new ForbiddenException('无权访问该表单');
    }
    return form;
  }

  async update(id: string, dto: UpdateFormDto, user: CurrentUserPayload) {
    const form = await this.findOne(id, user);
    if (form.status === FormStatus.PUBLISHED) {
      form.version += 1;
    }
    if (dto.name !== undefined) form.name = dto.name;
    if (dto.description !== undefined) form.description = dto.description;
    if (dto.status !== undefined) form.status = dto.status;

    if (dto.questions) {
      await this.questionRepo.delete({ formId: form.id });
      form.questions = dto.questions.map((q, idx) =>
        this.questionRepo.create({
          ...q,
          formId: form.id,
          order: q.order ?? idx,
        }),
      );
    }
    return this.formRepo.save(form);
  }

  async publish(id: string, user: CurrentUserPayload) {
    const form = await this.findOne(id, user);
    if (form.questions.length === 0) {
      throw new BadRequestException('表单至少需要一个题目');
    }
    form.status = FormStatus.PUBLISHED;
    return this.formRepo.save(form);
  }

  async remove(id: string, user: CurrentUserPayload) {
    const form = await this.findOne(id, user);
    await this.formRepo.remove(form);
    return { success: true };
  }
}
