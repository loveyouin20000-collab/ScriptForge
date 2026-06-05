# ScriptForge

AI 辅助小说改编流水线工具。它将多章节小说拆解为章节摘要、人物表、地点表、时间线、场景与剧本 YAML，并提供 Schema 校验、可编辑结果和导出能力。

## Quick Start

```bash
npm.cmd install
npm.cmd run dev
```

打开 `http://localhost:3000`。

## Features

- 粘贴小说文本或上传 `.txt` / `.md` 文件
- 自动识别中文章节、英文 Chapter、Markdown 标题
- 支持手动调整章节边界
- 可配置 OpenAI-compatible API；未配置时使用内置 mock provider
- 输出结构化 YAML，并校验字段和引用一致性
- 支持复制 YAML、下载 YAML、下载 Markdown 剧本文档
- 内置 YAML Schema 文档页

## Scripts

```bash
npm.cmd run dev
npm.cmd run build
npm.cmd test
```

## 分支规划

### 永久分支

| 分支 | 用途 |
| --- | --- |
| `main` | 生产稳定版，只保留最终可发布、可演示的版本。 |
| `develop` | 开发集成版，所有新功能和修复先汇总到这里。 |

### 功能开发分支

| 分支 | 用途 |
| --- | --- |
| `feature/ai-novel-parser` | AI 小说文本解析，包括人物、对话、场景提取。 |
| `feature/yaml-script-generator` | YAML 格式剧本自动生成。 |
| `feature/schema-definition` | 剧本 YAML Schema 定义与校验。 |
| `feature/chapter-batch-process` | 3 章以上小说批量处理。 |
| `feature/ui-editor` | 剧本可视化编辑界面。 |
| `feature/cli-tool` | 命令行工具入口。 |

### 修复分支

| 分支 | 用途 |
| --- | --- |
| `fix/ai-extract-error` | 修复 AI 提取内容错误。 |
| `fix/yaml-format-broken` | 修复 YAML 格式异常。 |
| `fix/character-recognition-bug` | 修复人物名称识别问题。 |

### 文档分支

| 分支 | 用途 |
| --- | --- |
| `docs/schema-spec-doc` | Schema 规范文档。 |
| `docs/user-guide` | 使用说明文档。 |
| `docs/api-description` | 接口和模块说明文档。 |

### 重构优化分支

| 分支 | 用途 |
| --- | --- |
| `refactor/core-module-cleanup` | 核心模块重构。 |
| `refactor/ai-prompt-optimize` | AI 提示词优化，不改动核心功能。 |

### 紧急修复分支

| 分支 | 用途 |
| --- | --- |
| `hotfix/crash-when-upload-file` | 上传文件崩溃紧急修复。 |
| `hotfix/yaml-output-empty` | YAML 输出为空紧急修复。 |

## 分支使用规则

- 新功能从 `develop` 拉取 `feature/*` 分支开发，完成后合并回 `develop`。
- 普通 Bug 从 `develop` 拉取 `fix/*` 分支修复，完成后合并回 `develop`。
- 文档内容从 `develop` 拉取 `docs/*` 分支维护，完成后合并回 `develop`。
- 重构优化从 `develop` 拉取 `refactor/*` 分支处理，完成后合并回 `develop`。
- 紧急线上问题从 `main` 拉取 `hotfix/*` 分支修复，完成后同时合并回 `main` 和 `develop`。
- `main` 和 `develop` 不直接提交代码，只通过合并进入。
