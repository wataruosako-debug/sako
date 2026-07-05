#!/usr/bin/env node
"use strict";

/*
 * 簡易ビルド: バンドラは使わず、Webアセットを webDir(www/) へコピーするだけ。
 * Capacitor の `cap sync` はこの www/ をネイティブ側へ取り込む。
 */

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "www");

// コピー対象。ここに列挙したファイルだけを www/ へ入れる（node_modules 等は入れない）。
const assets = ["index.html", "style.css", "script.js", "README.md"];

function rmDirContents(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir)) {
    fs.rmSync(path.join(dir, entry), { recursive: true, force: true });
  }
}

function main() {
  fs.mkdirSync(outDir, { recursive: true });
  rmDirContents(outDir);

  let copied = 0;
  for (const asset of assets) {
    const src = path.join(root, asset);
    if (!fs.existsSync(src)) {
      console.warn("[build] スキップ（存在しない）:", asset);
      continue;
    }
    fs.copyFileSync(src, path.join(outDir, asset));
    copied += 1;
  }

  console.log(`[build] ${copied} 個のアセットを ${path.relative(root, outDir)}/ にコピーしました`);
}

main();
