# 数据采集后端服务

面向多个移动采集 App 和网页录入端的统一数据采集接入后端服务。

## 功能能力

| 模块 | 能力 |
|------|------|
| **项目管理** | 创建采集任务、按调用方(clientId)限制可见范围、状态流转 |
| **表单发布** | 题目配置、必填规则、选项设置、唯一性规则、版本管理、发布/关闭 |
| **样本分配** | 批量导入采集对象、按区域管理、分配采集人员、批量分配 |
| **数据提交** | 文本/定位信息回收、必填缺项校验、唯一性重复检测、返回异常提示、记录修改痕迹、撤回重提 |
| **附件接收** | 照片、录音、视频、文件上传与下载 |
| **质量复核** | 分配复核人员、通过/驳回/需修改、锁定已复核记录、复核历史 |
| **进度查询** | 按区域查看进度、按人员统计进度、待办催办 |
| **结果下载** | 汇总有效样本、筛选异常数据、生成 Excel+附件 ZIP 下载包 |

## 技术栈

- **框架**: NestJS 10 + TypeScript
- **数据库**: SQLite（可快速切换至 PostgreSQL/MySQL）
- **ORM**: TypeORM
- **认证**: JWT + Passport
- **文档**: Swagger / OpenAPI
- **导出**: xlsx (Excel) + archiver (ZIP)

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 初始化数据库与种子数据（可选）
npm run seed

# 3. 启动开发服务
npm run start:dev
```

启动后访问：
- 服务地址: http://localhost:3000
- API 文档: http://localhost:3000/api/docs

## 默认账号（seed 脚本生成）

密码均为 `123456`

| 用户名 | 角色 | 说明 |
|--------|------|------|
| admin | ADMIN | 系统管理员，全部权限 |
| client01 | CLIENT | 甲方客户端，管理项目/表单/样本 |
| reviewer01 | REVIEWER | 复核人员，执行质量复核 |
| collector01 | COLLECTOR | 采集人员，提交数据 |
| collector02 | COLLECTOR | 采集人员，提交数据 |

## API 概览

所有接口均以 `/api` 为前缀。

### 认证
- `POST /api/auth/login` - 登录获取 Token
- `POST /api/auth/register` - 注册用户
- `GET  /api/auth/me` - 获取当前用户信息

### 项目管理
- `POST   /api/projects` - 创建项目
- `GET    /api/projects` - 项目列表（按调用方隔离）
- `GET    /api/projects/:id` - 项目详情
- `PATCH  /api/projects/:id` - 更新项目
- `DELETE /api/projects/:id` - 删除项目
- `POST   /api/projects/:id/publish` - 发布项目

### 表单发布
- `POST   /api/forms` - 创建表单与题目
- `GET    /api/forms?projectId=` - 项目表单列表
- `GET    /api/forms/:id` - 表单详情（含题目）
- `PATCH  /api/forms/:id` - 更新表单/题目（自动升级版本）
- `POST   /api/forms/:id/publish` - 发布表单
- `DELETE /api/forms/:id` - 删除表单

### 样本分配
- `POST   /api/samples` - 创建样本
- `POST   /api/samples/batch` - 批量创建样本
- `GET    /api/samples?projectId=` - 项目样本列表
- `GET    /api/samples/mine` - 分配给我的样本
- `GET    /api/samples/:id` - 样本详情
- `POST   /api/samples/:id/assign` - 分配样本
- `POST   /api/samples/batch/assign` - 批量分配
- `PATCH  /api/samples/:id` - 更新样本

### 数据提交
- `POST   /api/submissions` - 新建提交草稿
- `POST   /api/submissions/:id/submit` - 正式提交（触发校验）
- `POST   /api/submissions/:id/recall` - 撤回重提
- `GET    /api/submissions?projectId=` - 项目提交列表
- `GET    /api/submissions/mine` - 我的提交
- `GET    /api/submissions/:id` - 提交详情（含历史/附件/复核）
- `PATCH  /api/submissions/:id` - 修改提交

### 附件接收
- `POST /api/attachments/upload` - 上传文件（multipart/form-data, type: photo/audio/video/file）
- `GET  /api/attachments/:id` - 附件元信息
- `GET  /api/attachments/:id/download` - 下载附件
- `DELETE /api/attachments/:id` - 删除附件

### 质量复核
- `POST /api/reviews` - 提交复核结论（APPROVED/REJECTED/NEEDS_REVISION）
- `POST /api/reviews/assign` - 分配复核人员
- `POST /api/reviews/:id/lock` - 锁定记录
- `POST /api/reviews/:id/unlock` - 解锁记录
- `GET  /api/reviews/mine` - 我的复核任务
- `GET  /api/reviews/submission/:submissionId` - 提交的复核历史

### 进度查询
- `GET  /api/progress/project/:projectId` - 项目整体进度
- `GET  /api/progress/project/:projectId/by-region` - 按区域进度
- `GET  /api/progress/project/:projectId/by-collector` - 按人员进度
- `GET  /api/progress/project/:projectId/pending` - 待办样本
- `POST /api/progress/remind` - 催办未提交人员

### 结果下载
- `GET  /api/export/project/:projectId/valid` - 有效样本列表
- `GET  /api/export/project/:projectId/abnormal` - 异常数据列表
- `GET  /api/export/project/:projectId/download?includeAbnormal=true|false` - 下载 ZIP（Excel + 附件）

## 核心数据校验规则

1. **必填缺项校验**: 提交时扫描表单所有 `required: true` 的题目，缺失字段返回提示
2. **唯一性重复校验**: 题目配置 `extra.unique = true` 时，系统检测与其他样本的同字段值重复
3. **锁定保护**: 已复核通过或已锁定的记录无法修改/提交/撤回
4. **调用方隔离**: 非管理员用户只能查看和操作自己 `clientId` 下的数据

## 目录结构

```
src/
├── entities/              # 数据库实体
│   ├── user.entity.ts
│   ├── project.entity.ts
│   ├── form.entity.ts
│   ├── form-question.entity.ts
│   ├── sample.entity.ts
│   ├── submission.entity.ts
│   ├── submission-answer.entity.ts
│   ├── submission-history.entity.ts
│   ├── attachment.entity.ts
│   └── review-record.entity.ts
├── modules/
│   ├── auth/              # 认证与权限
│   ├── project/           # 项目管理
│   ├── form/              # 表单发布
│   ├── sample/            # 样本分配
│   ├── submission/        # 数据提交
│   ├── attachment/        # 附件接收
│   ├── review/            # 质量复核
│   ├── progress/          # 进度查询
│   └── export/            # 结果下载
├── main.ts                # 入口
├── app.module.ts          # 根模块
└── seed.ts                # 种子数据脚本
```
