# ノビログ（Nobilog）引き継ぎドキュメント

最終更新: 2026年7月6日 / このドキュメントは開発の全体像・設計思想・作業履歴・次タスクを引き継ぐためのもの。

---

## 1. プロジェクト概要・コンセプト

**ノビログ** は、初心者でもすばやく記録できる**スマホ向け筋トレ記録アプリ**。ジム・自宅の筋トレと有酸素運動を記録し、カレンダーと概算消費カロリーで毎日の頑張りを可視化する。

**基本方針:**
- **端末内のみにデータ保存**（`localStorage` / iOSは Preferences）。**外部サーバー送信なし・広告なし・トラッキングなし・アカウント登録不要**。
- **初心者が迷わず速く記録できる**ことを最優先。入力ステップを絞り、確認・提案でサポートする。
- Webアプリ（GitHub Pages で公開）をベースに、**Capacitor で iOS アプリ化**する（ビルドは Mac 非所有のため Codemagic で別途行う想定）。

### ロック済み設計（勝手に変えない UI/挙動）
以下は意図的に固定された仕様。変更する場合は必ず確認を取ること。
1. **セット後確認モーダル**（1セット保存ごとに「次はどうする？」を出す）
2. **7ボタン重量調整 UI**（−10 / −1 / −0.5 / 数値 / +0.5 / +1 / +10 kg）
3. **縦5択 RIR セレクター**（0回=限界 / 1回 / 2〜3回 / 4回以上 / 未入力）
4. **レストタイマー非自動起動**（通常フローでは自動で始めない。自動起動はガイドモードかつ設定ONの時のみ）

---

## 2. 技術構成

- **フロントのみのバニラ構成（バンドラなし）**。ソースは3ファイル:
  - `index.html`（画面構成・約950行。先頭に FOUC 防止のテーマ先読みインラインスクリプト、`?debug=1` 用のデバッグオーバーレイあり）
  - `style.css`（デザイン・約2900行。ライト/ダーク対応、カラーテーマ切替）
  - `script.js`（記録/計算/保存の全ロジック・約7700行。全体が1つの IIFE）
- **Capacitor 6 系**で iOS ラッパー化。プラグイン: `@capacitor/preferences` `@capacitor/local-notifications` `@capacitor/haptics` `@capacitor/ios`（`package.json` 参照）。
- **ビルド**: `npm run build` で `index.html`/`style.css`/`script.js`/`README.md` を `www/` へコピーするだけ（`scripts/build.js`）。バンドル・トランスパイルは一切しない。
- **プラグイン取得は無バンドラ対応**: `Capacitor.registerPlugin("...")` を使用。取得不能・呼び出し失敗時は静かに no-op / localStorage へフォールバック。
- **テスト**: Playwright（`tests/`）。`scripts/serve.js`（依存ゼロの静的サーバ）で実オリジン配信して検証。

### 主要コマンド
```bash
npm install          # 依存取得
npm run build        # www/ へコピー
npm test             # Playwright 全スイート
npm run serve        # http://localhost:4173 で静的配信
npx cap sync ios     # www/ を iOS へ同期（要 iOS プラットフォーム追加済み）
```

### アプリ ID
- `capacitor.config.json`: **appId = `com.sakoapps.nobilog`**（確定 Bundle ID）/ appName = ノビログ / webDir = www。
- Apple Developer で作成する App ID / Bundle ID もこの値に合わせること。

---

## 3. データモデル & ストレージ

### ストレージキー（`gymlog-` プレフィックス。キー名は歴史的経緯で "gymlog"）
| キー | 用途 |
|---|---|
| `gymlog-data-v1` | メインデータ（後述の `data`） |
| `gymlog-draft-v1` | 記録途中の下書き（自動保存） |
| `gymlog-pre-restore-v1` | バックアップ復元前のスナップショット |
| `gymlog-ui-settings-v1` | UI 設定（テーマ・各オプション） |
| `gymlog-migrated-v1` | ネイティブへのマイグレーション完了フラグ |
| `gymlog-data-corrupt-<timestamp>` | 破損データの退避（読めなかった時） |

### メインデータ `data` の形（`version: 2`）
```
{ version, profile, exercises[], sessions[], records[], sets[], cardios[],
  recentExerciseIds[], routines[], scheduledRoutines[], pendingSuggestions[] }
```
- `records` は session と exercise を参照、`sets` は record を、`cardios` は session を参照（`validateCurrentData` で整合性チェック）。
- **重量は grams 単位**で保存（例: 50kg = `weight: 50000`）。表示時に /1000。
- `pendingSuggestions`: 「次回に反映」で承認された増量提案（`{exerciseId, fromWeight, toWeight, reason}`）。
- 下書き `draft` には `records[]`（各 `sets[]`）、`cardios[]`（実際に記録した有酸素）、**`pendingCardioTypes[]`（予定だが未記録の有酸素の種別名）**、`guideState` などがある。

### StorageService（指示書①で新設・A案）
`script.js` 冒頭の IIFE 内。`window.GymLog.storageService` で参照可能。
- **A案 = 起動時全ロード＋メモリキャッシュ**。読み取りはキャッシュから**同期**で返す。
- **ブラウザ**: `localStorage` を同期バックエンドに使用 → 挙動は移行前と完全一致。
- **ネイティブ**: Preferences を非同期バックエンド。キャッシュ即時更新／永続化は非同期（失敗時 `console.error`＋リトライ1回）。書き込みは直列化で順序保証。
- **初回マイグレーション**: Preferences が空かつ localStorage に既存データありで全 `gymlog-` キーをコピー。`gymlog-migrated-v1` で2回目以降スキップ。**元データは削除しない**（安全側）。
- **UI設定キーはネイティブでも localStorage へミラー**書き込み（`index.html` 先頭の同期テーマ先読み＝FOUC防止のため）。
- **非同期ブートストラップ**: ネイティブはキャッシュ準備完了後に `bootApp()` で初期化。ブラウザは同期で即起動。

---

## 4. 主要機能の設計（要点）

### ガイドモード
- ルーティンやコピーから作った下書きを元に、**種目ごとにセット入力を順番にガイド**する。`draft.guideState` に状態を持つ（`buildGuideStateFromDraft`）。
- 保存時 `prepareGuideDraftForSave` は**完了したセットのみ**を `draft.records` に確定。**予定だけで未記録のものは保存しない**。

### 重量自動提案（プログレッシブオーバーロード / v3〜v4）
- `calculateWeightSuggestion(exerciseId)`（`script.js` 内）が**履歴＋設定から毎回オンザフライ計算**（提案値は永続化しない）。
- **昇格条件**: 前回のメインセット（最大重量セット）が全て `promotionReps`（既定10回）以上、かつ RIR≠限界(0)。
- **部位別増量**: `脚(legs)は +5.0kg / その他は +2.5kg`。
- **承認制**: 完了サマリーの「次回に反映」ボタンで承認した種目だけ `data.pendingSuggestions` に保存され、次回入力にプリフィルされる（`getPrefillSetsForExercise`）。保存時に消費される。

### レストタイマー通知（指示書②）
`window.GymLog.restTimerNotify`。ネイティブのみ有効、ブラウザは全て no-op。
- **通知は「実行中タイマー かつ アプリが非表示(background/画面ロック)」の時だけ予約**（`syncRestNotification`）。フォアグラウンドではバナーを出さず Haptics＋既存サウンドで知らせ、**二重通知を回避**。
- **許可リクエストは初回にタイマーが実際に起動した瞬間に一度だけ**。拒否時は画面表示のみで従来動作（エラーなし）。
- フック点: start / stop / pause / resume / +30秒 / finish / `visibilitychange`。
- 実機検証項目は `docs/rest-timer-notification-verification.md` にチェックリストあり。

### コピー / ルーティン開始と有酸素の扱い（重要な設計判断）
- `appendRecordsAndCardiosToDraft(target, records, cardios, { cardioAsPending })` が下書きを組む。
- **コピー系（`createDraftFromSession` keepSessionId=false、コピー競合の追加、旧形式ルーティン）は有酸素を `pendingCardioTypes`（予定）として引き継ぐ**。実際に記録した時だけ実績（`draft.cardios`）になる。
- **編集（keepSessionId=true）・記録途中のマージは記録済み有酸素を維持**（自分でやった分なので）。
- 筋トレのコピーは従来どおりセットをプリフィル。承認済み提案はコピー下書きにも反映される（`applyPendingSuggestionsToDraftRecords` in `finishCopiedDraft`）。

---

## 5. このセッションでやったこと（作業履歴）

すべて `main` にマージ・GitHub Pages に本番反映済み。

| PR | 内容 |
|---|---|
| #1 | **指示書①**: Capacitor 導入＋localStorage→Preferences 移行（StorageService／初回マイグレーション／Capacitor構成一式）。**指示書②**: レストタイマー振動通知（LocalNotifications + Haptics）。 |
| #3 | appId を仮値 `com.nobilog.app` → 確定値 **`com.sakoapps.nobilog`**。README の仮値但し書き削除。 |
| #4 | **プライバシーポリシー** `privacy.html` を公開（後述）。 |
| #5 | privacy.html の問い合わせメールを `dev.saku2026@gmail.com` に訂正。 |
| #6 | **バグ修正**: コピーで引き継いだ有酸素を「予定」扱いにし、未記録なら保存しない。 |

※ 途中、指示書①のコピー時に**重量提案が反映されない不具合**も修正済み（`applyPendingSuggestionsToDraftRecords`、PR #2）。

### プライバシーポリシー（`privacy.html`）
- 公開URL: **`https://wataruosako-debug.github.io/sako/privacy.html`**（App Store Connect のプライバシーポリシーURL欄に設定可）。
- 提供者: **sakoapps** / 連絡先: **dev.saku2026@gmail.com** / 施行日・最終更新日: 2026年7月6日。
- 内容: 個人情報を収集しない・データは端末内のみ・広告/解析なし、を明記。`<meta robots noindex>` 付き（直接URLでは閲覧可）。

---

## 6. デプロイ & 運用（GitHub）

- リポジトリ: **`wataruosako-debug/sako`**（Public）。デフォルトブランチ **`main`**。
- **GitHub Pages**: 「Deploy from a branch」方式・ソース = **`main` / root**。内蔵 `pages-build-deployment` が **main への push ごとに自動デプロイ**。
  - 本番URL: **`https://wataruosako-debug.github.io/sako/`**
  - Pages はリポジトリ直下の静的ファイルをそのまま配信（**`npm run build` は走らない**）。ブラウザ実行では StorageService が localStorage 同期にフォールバックするため、Capacitor 関連は Pages 配信に影響しない。
- **開発ブランチ**: `claude/new-session-vz5ske`。作業は「main から作り直し → 変更 → PR → マージ」で進めてきた。
- **`.gitignore`**: `node_modules/` `www/` `ios/` `test-results/` `playwright-report/` は管理対象外（`npm run build` / `npx cap add ios` で再生成）。

---

## 7. テスト

- Playwright（`tests/`）。`playwright.config.js` は `scripts/serve.js` を webServer に使い、ブラウザは環境の `/opt/pw-browsers/chromium` を指定。
- **現在のスイート（全15、`npm test` で全パス）**:
  - `regression.spec.js` — 起動・ホーム表示・localStorage 書込/リロード
  - `storage.spec.js` — 保持 / マイグレーション / 重量提案オンザフライ / 2回目スキップ
  - `rest-timer-notify.spec.js` — 通知予約・キャンセル / 許可拒否でも動作 / 通常フロー非自動起動
  - `weight-suggestion-copy.spec.js` — コピー下書きへの提案反映 / 冪等性
  - `cardio-copy.spec.js` — コピー有酸素の予定化 / 未記録なら保存されない / 編集は維持 / 傾斜ウォーク正規化
- **テスト用フック**（`script.js` 末尾）:
  - `window.__GYMLOG_TEST_MODE = true` を read 前にセット → `window.GymLog.__test__` に拡張 API が生える（`getData`/`setData`/`calculateWeightSuggestion` など）。
  - `window.__GYMLOG_SKIP_INIT = true` → 初期化（描画・イベント束縛）をスキップしデータ層だけ検証。
  - ネイティブ検証は Capacitor をモック（`tests/helpers.js` の `installNativeMock` / `installTimerNativeMock`）。

---

## 8. 未完了・次にやること

- [ ] **`codemagic.yaml` の作成**（Mac 不要の iOS ビルド／署名／TestFlight 配布パイプライン）。指示書では別タスク扱い。
- [ ] **iOS プラットフォーム追加**（`npx cap add ios`）と実機ビルド。`ios/` は gitignore 済みでビルド機で生成。
- [ ] **実機（TestFlight）検証** — `docs/rest-timer-notification-verification.md` のチェックリスト（背景通知・振動・許可フロー）。
- [ ] Apple Developer で **Bundle ID `com.sakoapps.nobilog`** の App ID 作成、App Store Connect にアプリ登録、プライバシーポリシーURL 設定。
- [ ] **既存データのクリーンアップ**: 修正前に「コピーして開始」で混入してしまった有酸素の実績（例: 7/6 のウォーキング）は自動では消えない。カレンダー該当日 →「編集」で削除して保存し直す。

---

## 9. 既知の注意点・落とし穴

- **重量は grams 単位**。UI との変換ミスに注意。
- **ネイティブの非同期書き込み**: 書き込み直後にアプリ即終了すると Preferences 未反映の理論的リスクあり（Web=localStorage 同期なので無関係）。
- **FOUC 防止のインライン**（`index.html` 先頭）は localStorage を直接読む。UI設定をネイティブでも localStorage にミラーしているのはこのため。ここを Preferences 専用にしないこと。
- **Pages は root を配信**（www ではない）。本番反映は「main に merge → 自動デプロイ（約1〜2分）」。実行環境からは github.io へ直接到達できないため、確認は Actions のデプロイ結果ベース＋手元でハードリロード。
- **この環境（クラウドコンテナ）は GitHub App 権限が限定的**: リポジトリ新規作成・ブランチ削除・`sako` 以外への push は 403 になることがある。Pages 設定変更の API もない（手動トグルが必要）。
- 旧「傾斜ウォーク」は表示・集計時に「ウォーキング」へ正規化される（`type === "傾斜ウォーク" ? "ウォーキング"`）。

---

## 10. クイックリファレンス（コンソール）

```js
// 本番サイトのコンソールで生データを確認
JSON.parse(localStorage.getItem('gymlog-data-v1'))

// ある種目にウォーキング系の実績があるか
(() => { const d = JSON.parse(localStorage.getItem('gymlog-data-v1'));
  return d.cardios.filter(c => /ウォーキング|傾斜ウォーク/.test(c.type))
    .map(c => ({ type: c.type, 日付: (d.sessions.find(s => s.id === c.sessionId)||{}).date })); })()
```
