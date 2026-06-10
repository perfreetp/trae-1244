# 数据采集后端服务

面向多个移动采集 App 和网页录入端的统一数据采集接入后端服务。

## 功能能力

| 模块 | 能力 |
|------|------|
| **项目管理** | 创建采集任务、按调用方(clientId)限制可见范围、状态流转 |
| **表单发布** | 题目配置、必填规则、选项设置、唯一性规则、版本管理、发布/关闭 |
| **样本分配** | 批量导入采集对象、按区域管理、分配采集人员、批量分配（跨租户校验） |
| **数据提交** | 文本/定位信息回收、必填缺项校验、唯一性重复校验、跨项目一致性校验、返回异常提示、记录修改痕迹、撤回重提 |
| **附件接收** | 照片、录音、视频、文件上传与下载（multipart 表单字段，支持 mimetype 自动识别） |
| **质量复核** | 分配复核人员形成待办、通过/驳回/需修改、锁定已复核记录、复核历史（assignedReviewer 指派） |
| **进度查询** | 按区域查看进度、按人员统计进度、待办催办 |
| **结果下载** | 汇总有效样本、筛选异常数据、生成 Excel+附件 ZIP 下载包 |

## 技术栈

- **框架**: NestJS 10 + TypeScript
- **数据库**: SQLite（better-sqlite3 预编译驱动，无需 C++ 编译环境）
- **ORM**: TypeORM
- **认证**: JWT + Passport + RBAC（4 种角色）
- **文档**: Swagger / OpenAPI
- **密码加密**: bcryptjs（纯 JS 实现，无需原生编译）
- **导出**: xlsx (Excel) + archiver (ZIP)

## 快速开始

> 💡 **依赖特性**：使用 `better-sqlite3`（预编译二进制）和 `bcryptjs`（纯 JS），**无需 Visual Studio / Windows SDK / Python** 等原生编译环境，`npm install` 可一次性成功。

```bash
# 1. 安装依赖（直接一次跑通，无需 --ignore-scripts）
npm install

# 2. 初始化数据库与种子数据（可选，创建默认用户 + 示例项目 + 表单 + 50 个样本）
npm run seed

# 3. 启动开发服务（默认端口 3000，自动启用 Swagger）
npm run start:dev
```

启动后访问：
- 服务地址: http://localhost:3000
- API 文档: http://localhost:3000/api/docs
- 健康检查: http://localhost:3000/api（Swagger JSON: http://localhost:3000/api/docs-json）

若使用生产构建：

```bash
npm run build
npm run start:prod
```

## 默认账号（seed 脚本生成，密码均为 `123456`）

| 用户名 | 角色 | clientId | 说明与能力边界 |
|--------|------|----------|----------------|
| `admin` | ADMIN | - | 系统管理员，全部权限，跨调用方操作 |
| `client01` | CLIENT | client_demo_001 | 甲方客户，管理本 clientId 下的项目/表单/样本/复核分配 |
| `reviewer01` | REVIEWER | client_demo_001 | 复核人员，仅能复核分配给自己的待办（assignedReviewer） |
| `collector01` | COLLECTOR | client_demo_001 | 采集员小李，**仅能操作分配给自己的样本和提交** |
| `collector02` | COLLECTOR | client_demo_001 | 采集员小王，**仅能操作分配给自己的样本和提交** |

## 角色权限矩阵（越权调用返回 403 Forbidden）

| 能力 | ADMIN | CLIENT | REVIEWER | COLLECTOR |
|------|-------|--------|----------|-----------|
| 项目 CRUD | ✅ | ✅ 仅自己 clientId | ❌ | ❌ |
| 表单 CRUD / 发布 | ✅ | ✅ 仅自己 clientId | ❌ | ❌ |
| 样本 创建/分配/修改/删除 | ✅ | ✅ 仅自己 clientId | ❌ | ❌ |
| 样本 查看列表 | ✅ | ✅ | ✅（只读） | ✅ **仅分配给自己** |
| 提交 创建/修改/提交/撤回 | ✅ | ✅ | ❌ | ✅ **仅自己创建 & 分配给自己的样本** |
| 提交 查看列表/详情 | ✅ | ✅ | ✅ **仅分配给自己复核** | ✅ **仅自己创建** |
| 附件 上传/下载 | ✅ | ✅ | ✅ | ✅ 仅创建提交场景 |
| 复核 分配（assignReviewer） | ✅ | ✅ 仅自己 clientId | ❌ | ❌ |
| 复核 执行结论（通过/驳回） | ✅ | ❌ | ✅ **仅分配给自己的待办** | ❌ |
| 复核 锁定/解锁 | ✅ | ✅ | ❌ | ❌ |
| 进度 查询 | ✅ | ✅ 仅自己 clientId | ✅ 仅自己相关 | ✅ 仅自己相关 |
| 结果 导出下载 | ✅ | ✅ 仅自己 clientId | ❌ | ❌ |

## API 概览

所有接口均以 `/api` 为前缀，所有受保护接口需在 Header 携带 `Authorization: Bearer <JWT Token>`。

### 认证
- `POST /api/auth/login` - 登录获取 Token
- `POST /api/auth/register` - 注册用户（需指定角色）
- `GET  /api/auth/me` - 获取当前登录用户信息

### 项目管理
- `POST   /api/projects` - 创建项目（ADMIN / CLIENT）
- `GET    /api/projects` - 项目列表（自动按调用方隔离）
- `GET    /api/projects/:id` - 项目详情（含表单/样本）
- `PATCH  /api/projects/:id` - 更新项目
- `DELETE /api/projects/:id` - 删除项目
- `POST   /api/projects/:id/publish` - 发布项目

### 表单发布
- `POST   /api/forms` - 创建表单与题目
- `GET    /api/forms?projectId=` - 项目表单列表
- `GET    /api/forms/:id` - 表单详情（含题目）
- `PATCH  /api/forms/:id` - 更新表单/题目（已发布自动升级版本号）
- `POST   /api/forms/:id/publish` - 发布表单
- `DELETE /api/forms/:id` - 删除表单

### 样本分配
- `POST   /api/samples` - 创建样本（ADMIN / CLIENT）
- `POST   /api/samples/batch` - 批量创建样本
- `GET    /api/samples?projectId=` - 项目样本列表（COLLECTOR 仅可见分配给自己的）
- `GET    /api/samples/mine` - 分配给我的样本（仅 COLLECTOR 有效）
- `GET    /api/samples/:id` - 样本详情
- `POST   /api/samples/:id/assign` - 分配样本（ADMIN / CLIENT）
- `POST   /api/samples/batch/assign` - 批量分配（ADMIN / CLIENT）
- `PATCH  /api/samples/:id` - 更新样本（ADMIN / CLIENT）

### 数据提交
- `POST   /api/submissions` - 新建提交草稿（表单+样本必须属于同一项目）
- `POST   /api/submissions/:id/submit` - 正式提交（触发缺项/重复/跨项目校验）
- `POST   /api/submissions/:id/recall` - 撤回重提（同时清空 assignedReviewer）
- `GET    /api/submissions?projectId=` - 项目提交列表（各角色自动过滤可见范围）
- `GET    /api/submissions/mine` - 我的提交
- `GET    /api/submissions/:id` - 提交详情（含历史/附件/复核）
- `PATCH  /api/submissions/:id` - 修改提交（自动记录 changes 审计）

### 附件接收
- `POST /api/attachments/upload` - 上传文件（multipart/form-data）
  - 表单字段：`file`(文件)、`type`(可选 photo/audio/video/file，不传按 mimetype 自动识别)、`questionKey`、`submissionId`、`projectId`、`metadata`(JSON 字符串或对象)
  - 响应包含附件 `id`，后续提交时通过 `attachmentIds` 数组关联
- `GET  /api/attachments/:id` - 附件元信息
- `GET  /api/attachments/:id/download` - 下载附件（照片存 uploads/photo/、录音存 uploads/audio/ 等）
- `DELETE /api/attachments/:id` - 删除附件

### 质量复核
- `POST /api/reviews` - 提交复核结论（APPROVED/REJECTED/NEEDS_REVISION，仅 ADMIN / REVIEWER）
- `POST /api/reviews/assign` - 批量分配复核人员（CLIENT / ADMIN，**分配后形成待办**）
- `POST /api/reviews/:id/lock` - 锁定记录（CLIENT / ADMIN）
- `POST /api/reviews/:id/unlock` - 解锁记录（CLIENT / ADMIN）
- `GET  /api/reviews/mine/todos` - **我的复核待办**（按 assignedReviewer 查询未完成）
- `GET  /api/reviews/mine/history` - **我的复核历史**（我完成过的所有复核）
- `GET  /api/reviews/submission/:submissionId` - 提交的复核历史

### 进度查询
- `GET  /api/progress/project/:projectId` - 项目整体进度（总数/已提交/已通过/进度%）
- `GET  /api/progress/project/:projectId/by-region` - 按区域进度
- `GET  /api/progress/project/:projectId/by-collector` - 按人员进度
- `GET  /api/progress/project/:projectId/pending` - 待办样本
- `POST /api/progress/remind` - 催办未提交人员

### 结果下载
- `GET  /api/export/project/:projectId/valid` - 有效样本列表（已通过/已锁定，无重复缺项）
- `GET  /api/export/project/:projectId/abnormal` - 异常数据列表（重复/缺项/已驳回）
- `GET  /api/export/project/:projectId/download?includeAbnormal=true|false` - 下载 ZIP 包（Excel + 附件）

## 核心校验规则（在 SubmissionService.validateProjectConsistency & validateSubmission 中实现）

1. **跨项目一致性校验**: 提交时 `form.projectId` 必须等于 `sample.projectId`，否则返回 400 `跨项目提交被禁止`
2. **必填缺项校验**: 扫描表单所有 `required: true` 的题目，缺失返回 `missing` 类型提示
3. **唯一性重复校验**: 题目配置 `extra.unique = true` 时，检测与其他样本同字段值重复，返回 `duplicate` 类型提示
4. **角色权限校验**: 每个方法开头执行 `checkAccess()`，越权返回 403 Forbidden（含明确中文原因）
5. **租户隔离校验**: 非 ADMIN 角色的所有查询自动带上 `clientId` 过滤
6. **锁定保护**: 已复核通过或已锁定的记录 `isLocked=true` 时，禁止修改/提交/撤回
7. **分配归属校验**: COLLECTOR 仅能操作 `assignedTo === 自己` 的样本、`submittedBy === 自己` 的提交
8. **复核分配校验**: REVIEWER 仅能复核 `assignedReviewer === 自己` 的记录；复核通过/驳回后自动清空 assignedReviewer

## 环境变量（.env）

```
PORT=3000
DB_TYPE=better-sqlite3
DB_DATABASE=./data/data-collection.db
JWT_SECRET=please-change-this-secret-to-strong-random-value
JWT_EXPIRES_IN=7d
UPLOAD_DIR=./uploads
```

## 目录结构

```
src/
├── entities/              # 数据库实体（10 个表）
│   ├── user.entity.ts
│   ├── project.entity.ts
│   ├── form.entity.ts
│   ├── form-question.entity.ts
│   ├── sample.entity.ts
│   ├── submission.entity.ts            # 新增 assignedReviewer 字段
│   ├── submission-answer.entity.ts
│   ├── submission-history.entity.ts
│   ├── attachment.entity.ts            # 新增 projectId 字段
│   └── review-record.entity.ts
├── modules/
│   ├── auth/              # 认证与权限（JWT + RolesGuard）
│   ├── project/           # 项目管理
│   ├── form/              # 表单发布
│   ├── sample/            # 样本分配
│   ├── submission/        # 数据提交（含跨项目一致性校验）
│   ├── attachment/        # 附件接收（multipart 表单字段）
│   ├── review/            # 质量复核（assignedReviewer 待办机制）
│   ├── progress/          # 进度查询
│   └── export/            # 结果下载
├── main.ts                # 入口（CORS / 全局前缀 / Swagger）
├── app.module.ts          # 根模块（TypeORM + 9 个业务模块）
└── seed.ts                # 种子数据脚本
```
