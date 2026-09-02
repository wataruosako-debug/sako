# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# プロジェクト指示(ノビログ)

## 報告のルール(必須)
- **調査レポート・実装サマリー・分類表など、ユーザーへの報告はコードブロック(markdownフェンス)版のみを出力する。**
  別スレッドへコピーして使うため。通常表示との併記はしない(同一内容の2回出力は冗長)。どんな報告でも例外なくコードブロックで出すこと。

## 開発のルール
- 指示書ベースで開発する。実装前に影響範囲と変更計画を提示する
- ロック済み設計(セット後確認モーダル / 7ボタン重量調整 / 縦5択RIR / 通常フローのレストタイマー非自動起動)は維持する
- 全Playwrightテスト(`npm test`)がパスしてからコミット・プッシュする
- **開発環境に Mac は存在しない。iPhone のみで作業している。**
  `ios/` ディレクトリはリモートにもローカルにも存在しない。
  iOSビルドは Codemagic(クラウドmacOS CI)上で `npx cap add ios` から生成する方針。
  cap sync / Xcode / ローカルビルドを前提とした依頼・確認は一切行わないこと。
- 指示書に明示されていないファイルを新規作成した場合は、サマリーでその旨と理由を明記すること
- 本番はGitHub Pages(mainへのマージで自動デプロイ)。マージ・本番反映はユーザーの明示指示があったときのみ行う

## 構成で間違えやすいこと

- **GitHub Pages はリポジトリのルートを直接配信する。** ルートの `index.html` / `style.css` / `script.js`
  がそのまま本番であり、ビルド・バンドル・トランスパイルは介在しない。
  `www/` は `.gitignore` 済みの **Capacitor(`cap sync`)専用の中間物**で、ここを直しても本番には出ない。
- キャッシュバスターは `scripts/stamp-assets.js` がアセットの内容ハッシュ(SHA-256先頭8桁)で
  **ルートの index.html** を書き換える方式。アセットを増やしたら `STAMPED_ASSETS` に追加する。
- `window.GymLog.__test__`(`createTestApi`)が **実質的な公開API**。関数名・シグネチャを変えると
  Playwrightテストが壊れるため、リファクタリング時も維持すること。
  `window.__GYMLOG_TEST_MODE` が真のときだけ生え、`window.__GYMLOG_SKIP_INIT` で UI 初期化を止められる。
- ストレージキーは歴史的経緯で `gymlog-` プレフィックス(アプリ名 nobilog と一致しない)。改名しないこと。
- chromium では `100vh` と `100dvh` が同値のため、**iOS Safari のビューポート由来の不具合は自動テストで
  再現できない**。この種の修正は `docs/*-verification.md` の実機チェックリストで担保する。

## コマンド

```bash
npm ci                                       # 依存取得(未実行だとテストが起動しない)
npm test                                     # Playwright 全テスト。完走に約10分かかるためバックグラウンドで回す
npx playwright test tests/calories.spec.js   # ファイル単位
npx playwright test -g "予定セット"           # テスト名(部分一致)単位
npm run serve                                # http://localhost:4173 で静的配信(手動確認用)
npm run stamp                                # index.html の ?v= を実ファイルのハッシュへ更新
npm run build                                # stamp → www/ へコピー(Capacitor向け)
```

テストサーバは `playwright.config.js` が自動起動するので個別に立てない。ブラウザは chromium のみで、
実行ファイルは事前インストール済み(`playwright install` は実行しないこと)。

## 参照ドキュメント

- `docs/HANDOFF.md` — 設計思想・データモデル詳細・ロック済み設計の背景・作業履歴。仕様判断に迷ったらまずここ。
- `docs/*-verification.md` — 指示書ごとの iPhone 実機チェックリスト。
