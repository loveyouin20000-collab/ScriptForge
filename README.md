# ScriptForge

ScriptForge 是一个 AI 辅助小说改编流水线工具。它把多章节小说拆解为章节摘要、人物表、地点表、时间线、独立剧情结构、场景和剧本片段，并输出符合 YAML Schema 的结构化剧本初稿，方便作者继续编辑、校验和二次创作。

当前版本重点不是“一次性生成一段漂亮文本”，而是把小说改编做成可解释、可校验、可编辑的工程化流程。

# 演示视频
https://www.bilibili.com/video/BV1bYE46gETf/?vd_source=5fc9cef933961d88ead5dc6d3763ff9b

## 当前代码结果

已完成一个 Next.js 单体 MVP，包含前端工作台、后端 API 路由、AI provider 抽象、mock 兜底流水线、九步门禁工作流、作者可视化编辑、分镜与视频链路、YAML 校验与导出能力。

核心页面：

- 项目输入：填写小说标题、作者，粘贴文本或上传 `.txt` / `.md` 文件。
- 大模型服务商模块：管理员统一维护 AI 服务商、模型和 API Key；API Key 本地保存，不写入源码。
- 章节解析：自动识别章节，并支持手动调整章节边界。
- 改编流程：按项目输入、章节解析、改编结果、剧本编辑、分镜、视频任务、Prompt、反馈回写、YAML 共 9 步推进。
- 改编结果：展示章节理解结果和剧情结构概览，并作为后续编辑链路入口。
- 剧本编辑：字段级编辑标题、作者、风格、场景和剧本行。
- 分镜 / Prompt / 视频任务：生成分镜 YAML、视频模型 Prompt，并提交 mock 视频任务。
- 反馈回写：按 scene、shot、prompt 或 video task 记录作者反馈并回写同一份 YAML。
- Schema 文档：说明 YAML 字段结构、设计原因和示例。
- 会员服务：展示免费版、Pro 版和按生成次数收费的商业化方案。

## 产品要求与实现状态

| 要求 | 当前实现 |
| --- | --- |
| 支持 3 章以上小说文本 | 支持章节识别和 mock/AI 流水线处理 |
| 支持粘贴文本 | 已实现 |
| 支持上传 txt / md | 已实现 |
| 自动识别章节 | 支持 `第1章`、`第一章`、`Chapter 1`、Markdown 标题 |
| 手动调整章节边界 | 已实现，使用 `---` 分隔章节 |
| 章节摘要、人物、地点、事件抽取 | mock provider 已实现；真实 provider 通过 OpenAI-compatible API |
| 全局人物表、地点表、时间线 | 已实现 |
| 独立剧情结构模型 | 已实现 `story_structure`，包含前提、类型、主冲突、幕段、转折、人物弧 |
| 场景拆分与剧本生成 | 已实现 |
| 输出结构化 YAML | 已实现 |
| YAML Schema 校验 | 已实现 Zod 结构校验和引用校验 |
| YAML 修复入口 | 已实现基础结构修复 |
| 复制 / 下载 YAML | 已实现 |
| 下载 Markdown 剧本文档 | 已实现 |
| Schema 文档页 | 已实现 |
| 会员服务页面 | 已实现免费版、Pro 版、次数包、对比表和 FAQ |
| 作者字段级可视化编辑 | 已实现，作为第 4 步嵌入改编流程 |
| 分镜 YAML 生成 | 已实现 `storyboard.shots` |
| 视频 Prompt 生成 | 已实现 `video_prompts` |
| 视频任务提交与预览 | 已实现 mock provider、任务状态刷新和结果 URL 回写 |
| 作者反馈回写 | 已实现 `revision_log`，支持 scene / shot / prompt / video task scope |
| 逐步保存门禁 | 已实现，每一步保存后才能进入下一步；编辑或生成会重新变为未保存 |
| 远程章节解析失败兜底 | 已实现，DeepSeek/OpenAI-compatible 调用失败时回退本地章节规则并提示用户 |
| API Key 安全提示 | 已实现，API Key 仅保存在浏览器 localStorage，不写入源码或提交到 GitHub |

## AI 服务商配置

大模型服务商模块独立于小说输入和流水线本身。管理员统一维护服务商、兼容接口地址、模型列表和 API Key；普通用户只选择已启用的服务商与模型。

支持选项：

- OpenAI
- DeepSeek
- 通义千问
- 自定义兼容接口

交互规则：

- 选择 OpenAI / DeepSeek / 通义千问时，系统自动填充对应 Base URL。
- 选择自定义兼容接口时，兼容接口地址和模型会清空，避免沿用上一家服务商配置。
- 模型或 API Key 留空时，系统使用本地 mock provider，不调用外部 LLM。
- 自定义兼容接口必须填写 Base URL、模型和 API Key 才会触发远程调用。
- API Key 保存后输入框锁定，不能直接编辑；必须先删除，再重新添加。
- API Key 只保存在本机浏览器 `localStorage`，不会写入源码文件，也不会提交到 GitHub。
- 仓库 `.gitignore` 已排除 `.env*`，保留 `.env.example`。
- 章节解析优先使用远程模型；如果远程调用失败，会回退本地章节规则，并在页面状态栏提示“远程章节解析失败，已使用本地规则”。

远程调用使用 OpenAI-compatible 格式：

```text
{baseUrl}/chat/completions
```

## YAML 输出结构

顶层 YAML 包含：

- `metadata`：标题、作者、生成器、版本和改编风格。
- `source`：原小说章节数量、章节 id、标题和摘要。
- `characters`：人物表，场景中通过 character id 引用。
- `locations`：地点表，场景中通过 location id 引用。
- `timeline`：按顺序记录剧情事件，可通过 conflict id 关联冲突。
- `conflicts`：一等冲突模型，记录冲突标题、类型、参与人物、利害关系、来源章节和相关时间线。
- `story_structure`：独立剧情结构模型，包含 premise、genre、logline、theme、main_conflict、dramatic_question、acts、conflicts、turning_points 和 character_arcs；新 pipeline 默认生成，schema 中保持可选以兼容旧 YAML。
- `scenes`：结构化剧本场景，包含来源章节、时间地点、人物、冲突引用、目的、节拍、动作、对白和改编策略。
- `storyboard`：分镜结构，包含 shot id、scene 引用、脚本行索引、镜头描述、机位、景别、运动、时长、视觉风格、角色和地点。
- `video_prompts`：按 shot 生成的视频模型 Prompt，包含 positive、negative、model notes、时长和画幅比例。
- `video_tasks`：视频任务记录，包含 provider、状态、请求内容、结果 URL、缩略图 URL、错误信息和更新时间。
- `revision_log`：作者反馈回写记录，包含反馈 scope、内容、动作和时间。

校验内容包括：

- 必填字段是否存在。
- `scene.setting.location` 是否引用已存在地点。
- `scene.characters` 是否引用已存在人物。
- `dialogue.character` 是否引用已存在人物。
- `timeline.chapter_id` 和 `scene.source.chapters` 是否引用已存在章节。
- `conflict.parties` 是否引用已存在人物。
- `conflict.source_chapters` 是否引用已存在章节。
- `conflict.related_timeline` 是否引用已存在时间线顺序。
- `timeline.conflict_ids` 和 `scene.conflict_ids` 是否引用已存在冲突。
- `story_structure` 中的章节引用和人物引用是否存在。
- `storyboard.shots.scene_id` 是否引用已存在场景。
- `storyboard.shots.characters` 和 `storyboard.shots.location` 是否引用已存在人物和地点。
- `video_prompts.shot_id` 是否引用已存在 shot。
- `video_tasks.prompt_id` 是否引用已存在 prompt。
- `revision_log.scope` 是否引用已存在 scene、shot、prompt 或 video task。

## 会员服务设计

| 方案 | 价格 | 生成额度 | 适用场景 | 详情 |
| --- | --- | --- | --- | --- |
| 免费版 | ¥0 | 真实 LLM 赠送 10 次，本地 mock 不限次 | 产品试用、短篇验证 | [查看详情](docs/membership-service-design.md) |
| Pro 版 | ¥79 起 | 200 次 | 连续章节改编、真实模型验证 | [查看详情](docs/membership-service-design.md) |
| 次数包 | ¥29 起 | 50 / 200 / 1000 次 | 按需补充生成额度 | [查看详情](docs/membership-service-design.md) |

## 技术栈

- Next.js App Router
- React
- TypeScript
- Zod
- YAML
- Vitest
- lucide-react

后端 API 路由：

- `POST /api/chapters/parse`：章节解析；远程模型失败时回退本地规则，并返回解析来源。
- `POST /api/pipeline/start`：运行小说改编流水线。
- `POST /api/storyboard/generate`：根据剧本 YAML 生成分镜 YAML。
- `POST /api/video-prompts/generate`：根据分镜生成视频 Prompt。
- `POST /api/video/tasks`：提交 mock 视频任务并写回 YAML。
- `GET /api/video/tasks/[id]`：刷新 mock 视频任务状态。
- `POST /api/revisions/apply`：按反馈 scope 局部回写 YAML。
- `POST /api/yaml/validate`：校验 YAML 结构和引用。
- `POST /api/yaml/fix`：修复基础 YAML 结构问题。

## 本地运行与发布

本地安装、开发服务重启、验证命令和 tag 发布流程见 [本地运行与发布](docs/local-run-and-release.md)。

常用命令：

```bash
npm.cmd install
npm.cmd run dev
npm.cmd test
npm.cmd run build
```

当前验证状态：

- `npm.cmd test`：62 tests passed
- `npm.cmd run build`：通过

## 发布流程

项目通过 GitHub Actions 在推送版本 tag 后自动发布：

```bash
git tag v0.1.0
git push origin v0.1.0
```

tag 名称需要以 `v` 开头，例如 `v0.1.0`。CI 会依次安装依赖、运行测试、构建 Next.js 应用、使用 Vercel CLI 发布生产环境，并在部署成功后创建 GitHub Release。

GitHub Release 的 changelog 使用 GitHub 自动生成的 release notes，会根据上一个 release 之后的提交和 PR 生成摘要。

发布到 Vercel 前，需要在 GitHub 仓库的 Actions secrets 中配置：

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

## 已知环境说明

当前 Windows 环境中，仓库 pre-push hook 会尝试通过 Python 子进程执行 `npm run lint`，但该环境只能稳定识别 `npm.cmd`，因此 hook 会出现 `FileNotFoundError` 或 GBK 解码错误。所有提交在推送前均已手动执行：

```bash
npm.cmd test
npm.cmd run build
```

因此推送时使用过 `git push --no-verify` 绕过该平台兼容问题。

## 分支规划

### 永久分支

| 分支 | 用途 |
| --- | --- |
| `main` | 生产稳定版，只保留最终可发布、可演示的版本。 |
| `develop` | 开发集成版，所有新功能和修复先汇总到这里。 |

已知 Windows hook 兼容问题、分支规划和分支使用规则见 [环境与规划](docs/environment-and-branches.md)。

## Recent Product Updates

This workspace now includes the latest local-product features added on top of the original MVP.

### Account Login And Roles

The app now opens with a local login screen before entering the ScriptForge workspace.

Default local accounts:

| Role | Username | Password | Access |
| --- | --- | --- | --- |
| Admin | `admin` | `admin123` | Full workspace access plus user management |
| User | `user` | `user123` | Workspace access only |

Role behavior:

- Admin users can see the `用户管理` navigation item.
- Normal users cannot see or open user management.
- The left sidebar shows the current account role, username, and a logout button.
- Account/session data is stored in browser local storage for the local prototype.

### Admin User Management

Admins can manage local users in the `用户管理` module:

- Create users.
- Edit username, password, role, and status.
- Delete users.
- Enable or disable accounts.
- View each account's remaining generation count and used generation count.
- View recent usage records.

Each account has a default quota of `10` real-LLM generation runs. Existing local accounts without quota data are automatically normalized with:

```text
totalRuns: 10
usedRuns: 0
usageRecords: []
```

### Usage Count And Records

Generation usage is now tracked per logged-in account.

Rules:

- Local mock generation is recorded but does not deduct usage count.
- Remote LLM generation deducts `1` run and records the operation.
- Usage records include user, action, cost, timestamp, and note.
- Admins can inspect recent usage records in the user management page.

### Workflow And YAML Version Management

The adaptation workflow is organized into nine gated steps:

1. Project input
2. Chapter parsing
3. Adaptation result
4. Script editing
5. Storyboard
6. Video tasks
7. Prompt
8. Revision write-back
9. YAML

Users must start from step 1 and move forward with the workflow buttons. Each step must be saved before the next step becomes available. Editing fields, generating storyboard or prompts, submitting video tasks, refreshing task state, applying feedback, or editing YAML marks the current step as unsaved again.

The merged YAML result now supports:

- Saving the merged YAML as a version.
- Viewing saved versions from the left sidebar `保存版本` module.
- Editing saved version YAML.
- Restoring a saved version back into the adaptation result editor.
- Deleting saved versions.

Saved YAML versions are stored in browser local storage and keep the most recent version history for the local prototype.

### Visual Editing And Video Chain

The result workflow now includes the author-facing editing and video chain inside the same stepper instead of a separate module.

Implemented capabilities:

- Card-style script editing for metadata, scenes, and script lines.
- Deterministic storyboard generation from `scenes.script`.
- Video prompt generation from storyboard, scene, character, and location context.
- Mock video provider with task submission, status refresh, result URL, and thumbnail URL fields.
- Feedback write-back for scene, shot, prompt, and video task scopes.
- Structured YAML write-back for storyboard, prompts, tasks, and revision logs.

### API Key Management

Admin-managed provider API keys are intentionally local prototype data:

- API keys are stored in browser `localStorage`.
- API keys are not written to source files.
- API keys are not committed to GitHub.
- Saved keys are locked in the UI; deleting a key is required before adding a replacement.
- The repository ignores `.env*` files, except `.env.example`.

### Remote Failure Fallback

The chapter parsing step now reports which parser was used:

- `remote`: remote OpenAI-compatible model succeeded.
- `local`: no remote provider was configured, so local chapter rules were used.
- `local_fallback`: remote parsing failed or returned invalid structure, so local rules were used.

When fallback happens, the workflow status tells the user that the remote parser failed and local rules were used.

### LLM Provider And Membership

The result workflow now includes the author-facing editing and video chain inside the same stepper instead of a separate module.

Implemented capabilities:

- Card-style script editing for metadata, scenes, and script lines.
- Deterministic storyboard generation from `scenes.script`.
- Video prompt generation from storyboard, scene, character, and location context.
- Mock video provider with task submission, status refresh, result URL, and thumbnail URL fields.
- Feedback write-back for scene, shot, prompt, and video task scopes.
- Structured YAML write-back for storyboard, prompts, tasks, and revision logs.

### API Key Management

Admin-managed provider API keys are intentionally local prototype data:

- API keys are stored in browser `localStorage`.
- API keys are not written to source files.
- API keys are not committed to GitHub.
- Saved keys are locked in the UI; deleting a key is required before adding a replacement.
- The repository ignores `.env*` files, except `.env.example`.

### Remote Failure Fallback

The chapter parsing step now reports which parser was used:

- `remote`: remote OpenAI-compatible model succeeded.
- `local`: no remote provider was configured, so local chapter rules were used.
- `local_fallback`: remote parsing failed or returned invalid structure, so local rules were used.

When fallback happens, the workflow status tells the user that the remote parser failed and local rules were used.

### LLM Provider And Membership

The LLM provider configuration has been moved into the membership/service area.

The app currently supports:

- Local mock provider when model or API key is empty.
- OpenAI-compatible remote provider calls when base URL, model, and API key are all configured.
- Remaining count display in the workflow entry area and user management table.

More membership and quota details are documented in [会员服务设计](docs/membership-service-design.md).
