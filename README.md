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
