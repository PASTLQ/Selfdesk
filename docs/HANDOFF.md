# SelfDesk 開発引き継ぎ(Claude Code 向け)

最終更新: 2026-11-21。これまでの設計・実装は Claude(チャット版)が行った。以降の開発は Claude Code が引き継ぐ。
**最初に読む順番: この文書 → `CLAUDE.md` → `docs/GOVERNANCE.md` → `docs/EXTENDING.md`。**

## 1. オーナーと進め方
- オーナーは Kai(GitHub: `PASTLQ`)。**日本語で応答する**。環境は Mac(`/Users/kai/development/Selfdesk`)と Windows PC(`C:\Claude\selfdesk`)。
- 目的: 自分専用の「最強のセルフマネジメントアプリ」。スケジュール、タスク、プロジェクト(WBS)、習慣、メモ、やりたいことを1か所で管理し、**AI(Claude)が MCP 経由で同じデータを読み書きして生活を回す**。「SelfDesk に書かれていることが正」。
- アプリ内に AI 機能は作らない(AI は外部から MCP で接続する)。
- 依頼を受けたら、まず `docs/GOVERNANCE.md` の「5. 新ツールを作る前の確認」に答える。曖昧で手戻りが大きい依頼は、実装前に質問する。
- デザインは **A案 Quiet Pro**(Linear / Notion Calendar 系。白とグレー、細い線、アクセントはインディゴ、密度高め)。ニューモーフィズム(旧 Desk 2)は廃止済み。
- 報告は簡潔に。何を作ったか、確認した方法、次にやる 1 手順だけ書く。

## 2. リポジトリと運用
| 対象 | 場所 |
|---|---|
| アプリ本体 | GitHub `PASTLQ/Selfdesk`(公開は GitHub Pages、Actions の `deploy.yml` が `main` への push で自動デプロイ) |
| データ | **非公開**の GitHub リポジトリ `PASTLQ/selfdesk-data` の `data.json`(アプリ・MCP・リモートMCP が共有) |
| 端末ごとの設定 | `localStorage`(トークン、外観、Googleクライアント ID など。**同期されない**) |

- ブランチは `main` のみ。コミットメッセージは日本語可。**push 前に必ず `npm run check`**(ルール検査 + 型検査 + テスト)。
- 初回は `npm install && (cd mcp && npm install)`。開発は `npm run dev`、ビルドは `npm run build`。
- **未 push のコミットがある可能性**: `d4713d1`(UI 刷新)と `c89681b`(プロジェクト/やりたいこと/コレクション/リモートMCP)は、チャット版の環境が GitHub へ push できないため、ローカルコミットのまま。`git status -sb` と `git log origin/main..` で確認し、未 push なら push する。
- 秘密(トークン、`.dev.vars`)はコミットしない。`SELFDESK_*` の値はチャットや文書に書かない。

## 3. アーキテクチャ(地図)
```
src/
  types.ts            データ型(Task, Wish, Ev, Habit, Note, Review, Data, State, Settings, Ref, ExtItem)
  store.ts            状態管理(useSyncExternalStore)、更新時刻 u の自動付与、削除の tombstone、CRUD ヘルパー
  core/               純粋関数(アプリと MCP の両方が使う。React・DOM・Node に依存しない)
    merge.ts          normalize(旧データ移行)・mergeData(項目ごとの新しい方が勝つ)・sig
    tree.ts           階層ツリー: childrenOf / ancestors / descendants / rollup(進捗・見積・期間) / wbs / canMove
    wbs-outline.ts    インデントのアウトライン → 親子つきタスク(アプリの一括追加と MCP add_wbs が共用)
    collections.ts    コレクションのスキーマ定義・検証・参照解決
    links.ts          タグ(プロジェクト・やりたいこと自体を Task.links に付ける): 候補・解決・付け外し
    tree-layout.ts    構造図の自動レイアウトとドラッグ可否(座標は保存しない)
    github.ts         GitHub Contents API の読み書き(競合は 409/422 → ConflictError)
  collections/        ツール拡張のデータ定義(index.ts の COLLECTIONS が一覧)
  registry.ts         拡張ポイント: registerView / Widget / Command / Source / Skin
  extensions/         自分専用の拡張(*.tsx を置くと自動読み込み。_ で始まるファイルは無視)
  shell/              サイドバー・⌘K パレット・モバイルタブ・アイコン
  theme/              tokens.css(デザイントークン)・base.css(部品)・shell.css・apply.ts(設定の反映)
  views/              画面。index.tsx が組み込み画面・コマンド・検索を登録
  widgets/today.tsx   「今日」画面の部品
  lib/                date / quick(クイック記法) / sync(同期) / gcal(Google Calendar) / projects / md / outline
mcp/
  src/tools.ts        MCP ツール 48 個と instructions(GUIDE)。createServer(io)
  src/io.ts           IO インターフェース(mutate / read)
  src/github-io.ts    GitHub 版 IO(fetch のみ。Node にも Workers にも依存しない)
  src/storage.ts      Node 版 IO(ファイル or GitHub)
  src/stdio.ts        ローカル版エントリ(単一ファイルに bundle → dist/selfdesk-mcp.mjs)
  src/worker.ts       リモート版エントリ(Cloudflare Workers、ステートレス、URL 内の合言葉で認証)
tests/                core.test.ts(移行・マージ・ツリー・WBS・コレクション) / mcp.test.ts(Worker 経由で全ツール) / mock-github.ts
scripts/check.mjs     ガバナンス検査
.github/workflows/    deploy.yml(Pages) / mcp.yml(MCP ビルド・リリース) / mcp-remote.yml(Workers デプロイ)
docs/                 GOVERNANCE / EXTENDING / AI_CONNECT / CHANGELOG-DATA / この文書
```

### 依存の向き(守ること)
`core/` ← `store.ts` / `lib/` ← `views/` `widgets/` `extensions/`。`core/` から React や `store` を import しない(MCP が bundle できなくなる)。`mcp/` は `src/core`, `src/lib/date`, `src/lib/quick`, `src/lib/outline`, `src/collections`, `src/types` だけを import する。

## 4. データモデルの要点
- **1本の階層ツリー**: プロジェクト・タスク・Todo の境界は主観なので、すべて `Task` を `parent` でつなぐ。
  - プロジェクト = `isProject: true`(+ `goal` 目標 / `doneWhen` 完了条件 / `approach` 進め方)。昇格・降格は `isProject` の切替だけ(データは壊れない)。
  - 子を持つ項目 = WBS の親(進捗は子孫の**葉**の完了率から計算)。子を持たない項目 = 実際に手を動かす葉。葉の中の細かい手順は `Task.subs`(Todo)。
  - 「やること」の一覧(今日・タスク・カレンダーの未配置)には**葉のみ**を出す(`isActionable`)。プロジェクトとWBS親は出さない。
  - 旧 `Task.project`(文字列)は**廃止**。`normalize()` が読み込み時に親プロジェクトへ移行する(ID は `p_<名前のハッシュ>`)。`Data.projects` は常に空。
- **Wish(やりたいこと)**: 願望。`status: someday | planned | done`。`promoteWish` でプロジェクトに昇格(`wish.project` にID、プロジェクト側 `links` に `{kind:'wish'}`)。
- **コレクション**: `Data.ext[collectionId]` に `ExtItem[]`。スキーマは `src/collections/`。アプリの汎用一覧(`CollectionView`)と MCP の `collection_*` が自動対応。
- **Ref**: 項目間の参照 `{kind, id}`。`kind` は `task/project/event/habit/note/wish` またはコレクションID。
- データのスキーマを変えたら `docs/CHANGELOG-DATA.md` に 1 行残す。**項目は追加のみ**(削除・型変更は避ける)。

### 同期の仕組み(壊しやすいので注意)
- 各項目に更新時刻 `u`(ms)。`store.stamp()` が、前後の**参照比較**で変わった項目にだけ `u` を付ける。したがって**更新は必ずイミュータブルに**(オブジェクトを書き換えず新しい値を作る)。
- 削除は `deleted[id] = 時刻` に記録(tombstone)。マージは項目ごとに `u` が新しい方が勝つ。tombstone の時刻 ≥ 項目の `u` なら削除が勝つ。
- 同期のタイミング: ローカル変更の 1.5 秒後、タブが見えている間 45 秒ごと、`visibilitychange`、`online`。
- GitHub の書き込みは `sha` 付き PUT。409/422 は競合として読み直して再試行(MCP は最大 5 回)。
- `settings`(外観・トークンなど)と `gEvents`(Google の予定)は**同期しない**。

## 5. UI の約束
- 色・余白・角丸は `src/theme/tokens.css` の変数だけ(`#rrggbb` を書かない)。`@layer tokens, skin` に入れてあり、**設定のカスタム CSS(レイヤー外)が常に最優先**。
- コントラスト基準: `--fg` / `--muted` は背景に対し 4.5:1 以上、入力欄・チェックの縁 `--edge` は 3:1 以上。ライト/ダーク/スキンを変えても保つ。
- 操作要素の高さは `max(var(--ctl-h), var(--hit))`(タッチ端末は 44px 以上)。`:focus-visible` を消さない。
- 画面は `registerView`、「今日」の部品は `registerWidget`、操作は `registerCommand` で登録する。`App.tsx` や `Shell.tsx` を直接書き換えない。
- 選択状態は色だけで示さない(太字・記号も添える)。

## 6. 検証の方法
- `npm run check` = `scripts/check.mjs` + `tsc`(アプリ・MCP) + `tests/*`。変更ごとに実行。
- ブラウザ確認はビルドして静的配信(例 `npm run build && cd dist && python3 -m http.server 4173`)し、Playwright で操作する。**`dist` を再ビルドすると静的サーバが落ちる**ことがあるので、再起動する。ライト/ダーク/幅 390px の 3 つで見る。
- MCP は `tests/mcp.test.ts` が Worker の `fetch` を直接叩く(GitHub は `tests/mock-github.ts` のモック)。実 Cloudflare ランタイムでの確認は `cd mcp && npx wrangler dev --local`(`.dev.vars` に `SELFDESK_MCP_SECRET`(24 文字以上)等を置く。**コミットしない**)。
- 新しいツールを足したら、`tools/list` の件数と、読み書きの往復(MCP で書いてアプリで見える)を確認する。

## 7. 現状と残作業
### 稼働中
- Pages にデプロイ済みのアプリ(同期、Google カレンダー連携、PWA)。UI は Quiet Pro 版が**手元では完成、push 待ちの可能性**(上記)。
- ローカル版 MCP(Claude Desktop / Code)。

### Kai の作業待ち(チャット版では実行できなかったもの)
1. `git push origin main`(未 push の場合)。
2. **リモート版 MCP の初回セットアップ**(`docs/AI_CONNECT.md`): Cloudflare トークン作成、GitHub Secrets 登録、「Deploy remote MCP」の手動実行、claude.ai にカスタムコネクタ追加。**実 Cloudflare と claude.ai での接続は未検証**(workerd のローカル実行までは確認済み)。つまずいたら一緒に切り分ける。

### 2026-11-22 に入れたもの
- **タグ**: プロジェクト・やりたいこと自体をタスクに付ける(`Task.links`)。詳細画面・クイック追加(`@名前` が同名のプロジェクト/やりたいことならタグ、無ければ自由ラベル)・一覧の絞り込み・MCP の `related`。
- **構造図**(`#/structure`): 階層の自動レイアウト図。ドラッグで親の付け替え、＋で子の追加、折りたたみ、拡大縮小。破線はプロジェクト同士の関連。自由配置(座標の保存)は未対応。
- **カレンダー**: 空き枠のドラッグで時間範囲を選び、ポップアップで予定を作る。予定・タイムブロックのドラッグ移動はポインター操作(15分スナップ)。タッチ端末はタップで作成(ドラッグ移動は不可)。

### 決まっていないこと(Kai と相談)
- **プロジェクトとタスクの境界の目安**。提案: 「目標と完了条件があり、複数の作業のまとまりに分かれる(目安は 1 週間以上、または 3 タスク以上)ものがプロジェクト。迷ったら葉のタスクで作り、大きいと分かった時点で昇格」。承認されたら `CLAUDE.md` と `mcp/src/tools.ts` の `GUIDE` に反映する。
- やりたいこと ↔ プロジェクトの完了連携(プロジェクト完了時に「達成にしますか?」を出す。現状は一覧にヒント表示のみで、自動では変えない)。

### バックログ(優先度の高い順の案)
1. プロジェクトの**ガント/タイムライン表示**(WBS の `start` / `due` を横棒に)と、依存関係。(階層の図=構造図は実装済み)
2. タスク一覧の**一括操作**(複数選択して期限・優先度・タグをまとめて変更)。(グループ・並べ替え・絞り込みは実装済み)
3. 「今日」画面に **やりたいこと**・マイルストーンの接近・習慣の連続日数のウィジェット追加。
4. リモート MCP の認証を **OAuth** に強化(`workers-oauth-provider` など。現状は URL の合言葉)。
5. 外観設定の端末間同期(要否は Kai に確認)。
6. Google カレンダーの予定を MCP からも読めるようにするか(現状は別の Google Calendar コネクタで補う)。
7. テストの拡充(UI の E2E を Playwright でリポジトリに追加)。bundle サイズ(現在 JS 約 230KB)の監視。
8. 拡張の実例(読書ログなど)を `src/collections/` に追加するときは、必ず Kai と内容を決めてから。

## 8. これまでにハマった点(再発防止)
- CSS クラス `.sel` が select の矢印用クラスと衝突 → ツリー/ボードの選択状態は `.isel` にした。同名クラスを足す前に `grep` する。
- ボードの付箋入力は、キャンバスの `pointerdown` でフォーカスが body に移る → `ref` コールバックで `setTimeout` 後に `focus()`。
- GitHub API の URL 組み立てで、空の末尾により `/repos/o/r/` となり 404 → `url()` は空の tail を付けない。
- tsc: `setReview` の既定値で重複キーのエラー(TS2783)→ 型アサーションしたオブジェクトを展開して回避。
- トークンの CSS 詳細度: スキン(`:root[data-skin=…]`)がカスタム CSS(`:root`)に勝ってしまった → トークンとスキンを `@layer` に入れ、ユーザー CSS はレイヤー外にした。
- 拡張の新ファイルが読み込まれない → `src/extensions/index.ts` の `import.meta.glob('./[!_]*.{ts,tsx}')`。`_` 始まりは対象外。
- MCP のツールは、ブラウザ用の API(`localStorage` 等)や Node 専用 API を `tools.ts` / `github-io.ts` で使わない(Workers で動かなくなる)。Node 専用処理は `storage.ts` / `stdio.ts` に限る。
- チャット版の環境は `github.com` へ push できない(clone/fetch のみ)。push は Mac / Windows の端末から行う。

## 9. 参考: 主要な設計判断(理由つき)
- **階層ツリー 1 本**: 境界が主観で、時間尺度で変わるため。型を分けると規模が変わるたびに移し替えが必要になる。
- **GitHub の JSON 1 ファイル**: サーバー不要・無料・履歴が残る・AI も同じデータを触れる。規模が大きくなったら分割か DB への移行を検討(目安: data.json が 1MB を超える頃)。
- **コレクション**: 単発ツールがバラバラの保存先を持つのを防ぎ、同期・AI・検索・参照を最初から使えるようにするため。
- **リモート MCP は Workers + URL の合言葉**: 無料枠で常時稼働し、claude.ai/スマホのカスタムコネクタ(認証なし or OAuth のみ)に対応するため。OAuth 実装は重いので後回し。
