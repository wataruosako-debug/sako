#!/usr/bin/env node
"use strict";

/*
 * 依存ゼロの静的ファイルサーバ。Playwright の webServer から起動して
 * ブラウザ挙動（localStorage を含む）を実オリジン上でテストするために使う。
 * ルートはプロジェクト直下（index.html / style.css / script.js をそのまま配信）。
 */

const http = require("http");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const port = Number(process.env.PORT || 4173);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

const server = http.createServer((req, res) => {
  try {
    const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
    let filePath = path.normalize(path.join(root, urlPath === "/" ? "/index.html" : urlPath));

    // ルート外へのアクセスを拒否（パストラバーサル対策）
    if (!filePath.startsWith(root)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.writeHead(404);
      res.end("Not Found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
    fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    res.writeHead(500);
    res.end("Internal Server Error");
  }
});

server.listen(port, () => {
  console.log(`[serve] http://localhost:${port}/ で配信中`);
});
