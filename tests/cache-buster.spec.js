"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("fs");
const stampAssets = require("../scripts/stamp-assets.js");

/*
 * 指示書⑫ フェーズ3: キャッシュバスターの自動採番が正しく効いているかを検証する。
 *
 * GitHub Pages はリポジトリのルートを直接配信するため、ルートの index.html に
 * 書かれた ?v= が古いままだと iOS 側に旧CSS/JSが残る。ハッシュの更新は
 * `npm run stamp`(または `npm run build`)でのコミットが必要なため、
 * 更新忘れをこのテストで検出する。
 *
 * このテストが落ちたときの対処: `npm run stamp` を実行して index.html をコミットする。
 */

test("index.html の ?v= が各アセットの実際の内容ハッシュと一致する", () => {
  const expected = stampAssets.expectedStamps();
  const actual = stampAssets.readIndexStamps();

  stampAssets.STAMPED_ASSETS.forEach((asset) => {
    expect(expected[asset], `${asset} が存在すること`).toBeTruthy();
    expect(
      actual[asset],
      `${asset} のキャッシュバスターが古い。npm run stamp を実行して index.html をコミットしてください`
    ).toBe(expected[asset]);
  });
});

test("スタンプ処理は冪等で、デバッグオーバーレイの参照を壊さない", () => {
  const before = fs.readFileSync(stampAssets.indexPath, "utf8");
  const result = stampAssets.stampIndexHtml();
  const after = fs.readFileSync(stampAssets.indexPath, "utf8");

  // 既に最新なら書き換えは発生しない(=冪等)
  expect(result.changed).toBe(false);
  expect(after).toBe(before);

  // ?debug=1 のオーバーレイは script タグの src から ?v= を読む。
  // インラインスクリプト内のセレクタ文字列がスタンプで壊れていないこと
  expect(after).toContain('script[src*="script.js"]');
  expect(after).toMatch(/<script src="script\.js\?v=[0-9a-f]{8}"><\/script>/);
  expect(after).toMatch(/<link rel="stylesheet" href="style\.css\?v=[0-9a-f]{8}">/);
});
