#!/usr/bin/env node
"use strict";

/*
 * キャッシュバスターの自動採番。
 *
 * GitHub Pages はリポジトリのルートを直接配信するため、本番に効かせるには
 * ルートの index.html 自体を書き換える必要がある(www/ は .gitignore 済みで
 * Capacitor 向けの中間物)。そのため「ルートの index.html の ?v= を、
 * 各アセットの内容ハッシュで上書きする」方式をとる。
 *
 * - `npm run stamp` で単体実行
 * - `npm run build` の冒頭でも実行され、その結果が www/ へコピーされる
 * - 内容が変わらなければハッシュも変わらないため、無用なキャッシュ破棄は起きない
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = path.resolve(__dirname, "..");
const indexPath = path.join(root, "index.html");

// スタンプ対象。ファイル分割でアセットが増えたときはここに追加するだけでよい。
const STAMPED_ASSETS = ["style.css", "script.js"];

// 内容のSHA-256先頭8桁。同じ内容なら同じ値になる
function assetHash(asset) {
  const filePath = path.join(root, asset);
  if (!fs.existsSync(filePath)) return null;
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex").slice(0, 8);
}

function expectedStamps() {
  const stamps = {};
  STAMPED_ASSETS.forEach(function (asset) {
    const hash = assetHash(asset);
    if (hash) stamps[asset] = hash;
  });
  return stamps;
}

/* index.html の <link>/<script> の href/src 属性だけを対象にする。
   インラインスクリプト内の文字列(?debug=1 のオーバーレイが使う
   'script[src*="script.js"]' など)を巻き込まないため、開始タグに限定して置換する。 */
const TAG_ATTR_PATTERN = /(<(?:link|script)\b[^>]*?\b(?:href|src)=")([^"]*)(")/gi;

function readIndexStamps(html) {
  const source = html === undefined ? fs.readFileSync(indexPath, "utf8") : html;
  const found = {};
  let match;
  TAG_ATTR_PATTERN.lastIndex = 0;
  while ((match = TAG_ATTR_PATTERN.exec(source)) !== null) {
    const value = match[2];
    const asset = value.split("?")[0];
    if (STAMPED_ASSETS.indexOf(asset) < 0) continue;
    const query = value.indexOf("?v=") >= 0 ? value.split("?v=")[1] : null;
    found[asset] = query;
  }
  return found;
}

// index.html のスタンプを最新のハッシュへ書き換える。変更があれば true を返す
function stampIndexHtml() {
  const stamps = expectedStamps();
  const original = fs.readFileSync(indexPath, "utf8");
  TAG_ATTR_PATTERN.lastIndex = 0;
  const updated = original.replace(TAG_ATTR_PATTERN, function (whole, prefix, value, suffix) {
    const asset = value.split("?")[0];
    if (!Object.prototype.hasOwnProperty.call(stamps, asset)) return whole;
    return prefix + asset + "?v=" + stamps[asset] + suffix;
  });
  const changed = updated !== original;
  if (changed) fs.writeFileSync(indexPath, updated);
  return { changed: changed, stamps: stamps };
}

function main() {
  const result = stampIndexHtml();
  const summary = Object.keys(result.stamps).map(function (asset) { return asset + "?v=" + result.stamps[asset]; }).join(" / ");
  console.log("[stamp] " + (result.changed ? "index.html を更新しました" : "index.html は最新です") + ": " + summary);
}

if (require.main === module) main();

module.exports = { STAMPED_ASSETS: STAMPED_ASSETS, assetHash: assetHash, expectedStamps: expectedStamps, readIndexStamps: readIndexStamps, stampIndexHtml: stampIndexHtml, indexPath: indexPath };
