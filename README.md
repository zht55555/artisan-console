# Artisan (Next.js 15)

一个面向真实创作场景的 Artisan Web 项目，聚焦图文协同创作流程：

- 多轮对话（SSE 流式、可中断、可重试）
- 文生图与图像编辑（任务状态机）
- Prompt 模板管理（CRUD + 变量套用）
- 统一工作台与完整接口闭环

## 核心能力

- 对话能力：SSE 流式返回 token，支持停止和失败重试。
- 生成能力：文生图采用任务创建 + 轮询查询，支持取消。
- 编辑能力：基于已有图片创建编辑任务，保留 parent_asset_id 关联。
- 模板能力：模板创建、更新、删除、变量提取与渲染。
- 历史能力：按类型查看 chat/image/edit 历史记录。

## 当前版本范围

已完成批次：

- Batch 0 基础工程初始化
- Batch 1 匿名访客认证基础能力
- Batch 2 文生图任务创建/查询/取消
- Batch 3 图像编辑任务与 parent_asset_id
- Batch 4 SSE 对话流接口与聊天页
- Batch 5 Prompt 模板 CRUD + 变量套用
- Batch 6 Chat 一体化工作台（对话 + 出图 + 再追问）

关键产品特性：

- 文本和图片生成采用双通道：文本 SSE、图片任务轮询。
- Chat 页面支持图文连续创作：
  - 用上一轮对话直接出图
  - 出图结果回流到会话
  - 基于图片继续追问（细节增强/商用文案/再出 3 版）

## 图像编辑能力在哪里

页面入口：

- /edit/[assetId]：图像编辑页面

接口入口：

- POST /api/v1/edits：创建图像编辑任务
- GET /api/v1/generations/:id：查询编辑任务与产物

使用方式：

1. 先在 /image/new 或 chat 中生成一张图，拿到 assetId。
2. 进入 /edit/[assetId] 提交编辑 prompt。
3. 任务完成后可在任务详情和历史记录中查看编辑结果。

## 页面与路由

- /chat: 一体化创作工作台（对话 + 出图 + 再追问）
- /image/new: 文生图独立页
- /image/[taskId]: 生成任务详情
- /edit/[assetId]: 图像编辑页
- /prompts: Prompt 模板工作台
- /history: 历史记录
- /demo: 一键演示脚本
- /debug: 接口联调面板

## 技术栈

- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS
- Drizzle ORM + PostgreSQL (Neon)
- Better Auth (visitor + magic link)
- SSE + 轮询双轨异步交互
- 阿里百炼兼容模式（聊天与文生图）

## 快速开始

1. 安装依赖

```bash
pnpm install
```

2. 配置环境变量

```bash
cp .env.example .env.local
```

3. 启动开发环境

```bash
pnpm dev
```

4. 健康检查

```bash
curl http://localhost:3000/api/v1/health
```

5. 生产构建校验

```bash
pnpm build
```

## MVP 边界

- 积分/支付/团队协作不在本期范围。
- 对象存储长期持久化为下一阶段增强。
- 当前以 Web 响应式为主，不包含移动端 App。

## 常用命令

```bash
pnpm dev
pnpm lint
pnpm typecheck
pnpm build
pnpm db:push
```
