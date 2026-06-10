import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User, UserRole } from './entities/user.entity';
import { Project, ProjectStatus } from './entities/project.entity';
import { Form, FormStatus, QuestionType } from './entities/form.entity';
import { FormQuestion } from './entities/form-question.entity';
import { Sample, SampleStatus } from './entities/sample.entity';

const dataSource = new DataSource({
  type: 'better-sqlite3',
  database: './data/collection.db',
  entities: [__dirname + '/**/*.entity{.ts,.js}'],
  synchronize: true,
});

async function seed() {
  await dataSource.initialize();
  console.log('开始初始化种子数据...');

  const userRepo = dataSource.getRepository(User);
  const projectRepo = dataSource.getRepository(Project);
  const formRepo = dataSource.getRepository(Form);
  const questionRepo = dataSource.getRepository(FormQuestion);
  const sampleRepo = dataSource.getRepository(Sample);

  const existing = await userRepo.count();
  if (existing > 0) {
    console.log('数据已存在，跳过种子初始化');
    await dataSource.destroy();
    return;
  }

  const pwd = await bcrypt.hash('123456', 10);

  const admin = userRepo.create({
    username: 'admin',
    password: pwd,
    name: '系统管理员',
    role: UserRole.ADMIN,
    clientId: 'client_default',
  });
  await userRepo.save(admin);

  const client = userRepo.create({
    username: 'client01',
    password: pwd,
    name: '甲方客户端',
    role: UserRole.CLIENT,
    clientId: 'client_001',
  });
  await userRepo.save(client);

  const reviewer = userRepo.create({
    username: 'reviewer01',
    password: pwd,
    name: '复核员小张',
    role: UserRole.REVIEWER,
    clientId: 'client_001',
  });
  await userRepo.save(reviewer);

  const collector1 = userRepo.create({
    username: 'collector01',
    password: pwd,
    name: '采集员小李',
    role: UserRole.COLLECTOR,
    clientId: 'client_001',
  });
  await userRepo.save(collector1);

  const collector2 = userRepo.create({
    username: 'collector02',
    password: pwd,
    name: '采集员小王',
    role: UserRole.COLLECTOR,
    clientId: 'client_001',
  });
  await userRepo.save(collector2);

  console.log('用户创建完成');

  const project = projectRepo.create({
    name: '2024年度市场调研采集',
    description: '面向多个区域的居民消费习惯调研',
    status: ProjectStatus.PUBLISHED,
    ownerId: client.id,
    clientId: 'client_001',
    region: '华东区',
    deadline: new Date('2024-12-31'),
  });
  await projectRepo.save(project);

  console.log('项目创建完成');

  const form = formRepo.create({
    projectId: project.id,
    name: '居民消费调查问卷',
    description: '采集居民基本消费信息',
    version: 1,
    status: FormStatus.PUBLISHED,
  });
  await formRepo.save(form);

  const questions = [
    { formId: form.id, questionKey: 'name', label: '受访者姓名', type: QuestionType.TEXT, required: true, order: 1 },
    { formId: form.id, questionKey: 'phone', label: '联系电话', type: QuestionType.TEXT, required: true, order: 2, extra: { unique: true } },
    { formId: form.id, questionKey: 'age', label: '年龄', type: QuestionType.NUMBER, required: true, order: 3 },
    { formId: form.id, questionKey: 'gender', label: '性别', type: QuestionType.SELECT, required: true, order: 4, options: ['男', '女', '其他'] },
    { formId: form.id, questionKey: 'region', label: '所在区域', type: QuestionType.SELECT, required: true, order: 5, options: ['黄浦区', '徐汇区', '长宁区', '静安区', '普陀区'] },
    { formId: form.id, questionKey: 'address', label: '详细地址', type: QuestionType.TEXTAREA, required: false, order: 6 },
    { formId: form.id, questionKey: 'income', label: '月收入范围', type: QuestionType.SELECT, required: true, order: 7, options: ['5000以下', '5000-10000', '10000-20000', '20000以上'] },
    { formId: form.id, questionKey: 'location', label: '采集定位', type: QuestionType.LOCATION, required: false, order: 8 },
    { formId: form.id, questionKey: 'photo', label: '现场照片', type: QuestionType.PHOTO, required: false, order: 9 },
    { formId: form.id, questionKey: 'remark', label: '备注', type: QuestionType.TEXTAREA, required: false, order: 10 },
  ].map((q) => questionRepo.create(q));
  await questionRepo.save(questions);

  console.log('表单和题目创建完成');

  const samples = [];
  const regions = ['黄浦区', '徐汇区', '长宁区', '静安区', '普陀区'];
  for (let i = 1; i <= 50; i++) {
    samples.push(
      sampleRepo.create({
        projectId: project.id,
        uniqueCode: `SAMPLE_${String(i).padStart(4, '0')}`,
        name: `样本${i}`,
        region: regions[i % regions.length],
        address: `${regions[i % regions.length]}某某街道${i}号`,
        phone: `138${String(10000000 + i).slice(0, 8)}`,
        assignedTo: i % 2 === 0 ? collector1.id : collector2.id,
        status: i % 5 === 0 ? SampleStatus.PENDING : SampleStatus.ASSIGNED,
      }),
    );
  }
  await sampleRepo.save(samples);

  console.log('50个样本分配完成');
  console.log('');
  console.log('=== 种子数据初始化成功 ===');
  console.log('默认账号（密码均为 123456）：');
  console.log('  admin      - 系统管理员');
  console.log('  client01   - 甲方客户端');
  console.log('  reviewer01 - 复核员小张');
  console.log('  collector01 - 采集员小李');
  console.log('  collector02 - 采集员小王');
  console.log('');

  await dataSource.destroy();
}

seed().catch(console.error);
