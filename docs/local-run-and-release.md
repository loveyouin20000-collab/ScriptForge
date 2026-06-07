# 本地运行与发布

本文集中记录 ScriptForge 的本地运行、服务重启、验证命令和发布流程。

## 新窗口复现前置检查

如果你在新的 Codex 窗口或新的终端里看到 `README.md` 只有 `# 我的项目`，说明当前目录或分支不是本次实现所在的工作区。

本次实现所在分支：

```text
codex/ai-adaptation-pipeline-mvp
```

本次实现所在 worktree 路径：

```text
C:\Users\35078\.codex\worktrees\46d4\ScriptForge
```

在新窗口中优先进入这个目录：

```powershell
cd C:\Users\35078\.codex\worktrees\46d4\ScriptForge
```

确认当前仓库根目录和分支：

```powershell
git rev-parse --show-toplevel
git branch --show-current
```

期望输出分别包含：

```text
C:/Users/35078/.codex/worktrees/46d4/ScriptForge
codex/ai-adaptation-pipeline-mvp
```

如果你是在主仓库目录或全新克隆里复现，请先拉取远端分支：

```powershell
git fetch origin
git switch codex/ai-adaptation-pipeline-mvp
git pull --ff-only origin codex/ai-adaptation-pipeline-mvp
```

如果 `git switch` 提示该分支已经被其他 worktree 使用，就直接进入上面的 worktree 路径运行服务，不要在主仓库目录重复切换同一个分支。

确认 README 是否已经是新版本：

```powershell
Get-Content README.md -TotalCount 5
```

第一行应为：

```text
# ScriptForge
```

并且后面应包含“当前代码结果”等章节。

## 本地运行

安装依赖并启动开发服务：

```bash
npm.cmd install
npm.cmd run dev
```

打开：

```text
http://localhost:3000
```

## 重启本地服务

如果 `http://localhost:3000` 出现 500、页面打不开，或你在新窗口中需要重新启动服务，可以按下面步骤操作。

### 1. 查看 3000 端口是否仍被占用

```powershell
netstat -ano | Select-String ':3000'
```

如果看到 `LISTENING`，记录最后一列 PID，例如：

```text
TCP  127.0.0.1:3000  0.0.0.0:0  LISTENING  57400
```

### 2. 停止旧服务

把上一步看到的 PID 替换到命令里：

```powershell
Stop-Process -Id 57400 -Force
```

如果有多个同一时间启动的 Node/Next 进程，也可以一起停止：

```powershell
Stop-Process -Id 57400,102576 -Force
```

停止后再次确认没有 `LISTENING`：

```powershell
netstat -ano | Select-String ':3000'
```

只剩 `TIME_WAIT` 是正常的，表示端口连接正在释放；没有 `LISTENING` 就说明服务已停止。

### 3. 可选：清理 Next 构建缓存

如果之前遇到过 `500 Internal Server Error` 或构建缓存异常，可以清理 `.next`：

```powershell
$target = Resolve-Path '.next' -ErrorAction SilentlyContinue
if ($target -and $target.Path.StartsWith((Resolve-Path '.').Path)) {
  Remove-Item -LiteralPath $target.Path -Recurse -Force
}
```

### 4. 重新启动服务

推荐直接运行：

```bash
npm.cmd run dev
```

如果需要后台启动，可以使用 Node 直接启动 Next：

```powershell
Start-Process -FilePath 'C:\Program Files\nodejs\node.exe' `
  -ArgumentList @('node_modules\next\dist\bin\next','dev','--hostname','127.0.0.1','--port','3000') `
  -WorkingDirectory 'C:\Users\35078\.codex\worktrees\46d4\ScriptForge' `
  -WindowStyle Hidden
```

### 5. 验证服务是否恢复

```powershell
try {
  (Invoke-WebRequest -UseBasicParsing http://127.0.0.1:3000).StatusCode
} catch {
  $_.Exception.Message
}
```

返回 `200` 表示服务已恢复。然后打开：

```text
http://localhost:3000
```

如果 in-app browser 仍显示旧错误页，请刷新当前标签页；服务端已经返回 `200` 时，通常只是浏览器保留了旧页面状态。

## 构建后 500 的快速恢复

如果 `http://127.0.0.1:3000` 或 `http://localhost:3000` 在运行 `npm.cmd run build` 后返回 `500`，旧 Next.js dev 进程可能持有过期的 `.next` 缓存。

推荐恢复步骤：

```powershell
netstat -ano | Select-String ':3000'
Stop-Process -Id <PID> -Force
npm run dev -- --hostname 127.0.0.1 --port 3000
```

重新打开：

```text
http://localhost:3000/
```

## 验证命令

```bash
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
