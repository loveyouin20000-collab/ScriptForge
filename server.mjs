import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const port = 3000;

function escapeHtml(text) {
  return text.replace(/[&<>]/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
  }[char]));
}

function send(res, statusCode, body, contentType = "text/plain; charset=utf-8") {
  res.writeHead(statusCode, { "Content-Type": contentType });
  res.end(body);
}

const server = http.createServer((req, res) => {
  const requestUrl = new URL(req.url, `http://localhost:${port}`);

  if (requestUrl.pathname === "/") {
    const readmePath = path.join(root, "README.md");
    const readme = fs.existsSync(readmePath)
      ? fs.readFileSync(readmePath, "utf8")
      : "ScriptForge";

    return send(
      res,
      200,
      `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <title>ScriptForge</title>
    <style>
      body {
        font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
        max-width: 880px;
        margin: 48px auto;
        padding: 0 24px;
        line-height: 1.6;
      }

      pre {
        white-space: pre-wrap;
        background: #f6f8fa;
        padding: 16px;
        border-radius: 8px;
      }
    </style>
  </head>
  <body>
    <pre>${escapeHtml(readme)}</pre>
    <p><a href="/README.md">README.md</a> · <a href="/LICENSE">LICENSE</a></p>
  </body>
</html>`,
      "text/html; charset=utf-8",
    );
  }

  const filePath = path.normalize(path.join(root, decodeURIComponent(requestUrl.pathname)));
  if (!filePath.startsWith(root)) return send(res, 403, "Forbidden");

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) return send(res, 404, "Not found");
    const contentType = path.extname(filePath).toLowerCase() === ".md"
      ? "text/markdown; charset=utf-8"
      : "text/plain; charset=utf-8";
    res.writeHead(200, { "Content-Type": contentType });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(port, "127.0.0.1");
