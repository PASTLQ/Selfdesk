# SelfDesk

スケジュール・タスク・タイムブロッキング・習慣・振り返り・メモ(Markdown / ロジックツリー / ホワイトボード)をまとめたセルフマネジメントアプリです。

- **どの端末でも**: GitHub Pages にデプロイしたWebアプリ(PWA)。データは非公開のGitHubリポジトリ(`data.json`)に同期します
- **AIから操作**: MCPサーバーを通じて、Claude などのAIが同じデータを読み書きできます(アプリ内にAI機能はありません)
- **Googleカレンダー**: アプリ内で予定の表示・編集が可能(任意)

```
 ブラウザ(PC/スマホ) ──┐
                         ├── GitHub: 非公開リポジトリの data.json ──┐
 MCPサーバー(Claude) ──┘                                          └ 変更は項目単位でマージ
```

## セットアップ(所要15分)

### 1. アプリを公開する(GitHub Actions)
1. このフォルダを GitHub の新規リポジトリ(例 `selfdesk`)へ push(ブランチは `main`)
   - アプリのコードに秘密情報は含まれないので **public** で構いません(privateのPagesは有料プランが必要です)
2. リポジトリの Settings → Pages → **Source を「GitHub Actions」** にする
3. push すると `.github/workflows/deploy.yml` が走り、`https://<ユーザー名>.github.io/selfdesk/` に公開されます

### 2. データ用リポジトリとトークンを作る
1. GitHubで **private** リポジトリを作成(例 `selfdesk-data`)。中身は空で構いません
2. Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → Generate
   - Repository access: **Only select repositories** → `selfdesk-data` だけ
   - Repository permissions: **Contents → Read and write**
3. 発行された `github_pat_...` を控える

### 3. アプリで同期を有効にする(端末ごとに1回)
アプリの「記録 → 設定 → 同期(GitHub)」に `yourname/selfdesk-data` とトークンを入力すると同期が始まります。他の端末でも同じ入力をすれば、同じデータが開きます。
(トークンは各端末のブラウザにだけ保存されます。ホーム画面に追加するとアプリのように使えます)

### 4. MCPサーバーを接続する(AIに操作させる)
単一ファイルにまとめたサーバーを使います。ビルド済みファイルは、リポジトリで `mcp-v1.0.0` のようなタグを push すると Actions が Releases に添付します(Actions の成果物 `selfdesk-mcp` からも取得できます)。手元でビルドするなら `npm run build:mcp` → `mcp/dist/selfdesk-mcp.mjs`。Node.js 18 以上が必要です。

**Claude Desktop**(`claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "selfdesk": {
      "command": "node",
      "args": ["/絶対パス/selfdesk-mcp.mjs"],
      "env": {
        "SELFDESK_GITHUB_TOKEN": "github_pat_...",
        "SELFDESK_REPO": "yourname/selfdesk-data"
      }
    }
  }
}
```
**Claude Code**:
```
claude mcp add selfdesk -e SELFDESK_GITHUB_TOKEN=github_pat_... -e SELFDESK_REPO=yourname/selfdesk-data -- node /絶対パス/selfdesk-mcp.mjs
```
任意の環境変数: `SELFDESK_PATH`(既定 data.json) / `SELFDESK_BRANCH` / `SELFDESK_FILE`(GitHubの代わりにローカルJSONファイルを使う。試用向け)

接続後は「今日の予定とタスクを見て、空き時間にタイムブロックして」「この議事録からロジックツリーを作って」のように頼めます。アプリへの反映は、次の同期(最大45秒、タブを開き直した時は即時)です。

#### MCPのツール(30個)
| 分類 | ツール |
|---|---|
| 把握 | `get_overview` `list_tasks` `get_task` `list_events` `find_free_slots` `list_habits` `list_notes` `get_note` `get_review` |
| タスク | `add_task` `update_task` `complete_task` `delete_task` `add_subtask` `set_subtask_done` `schedule_task` `unschedule_task` |
| 予定 | `add_event` `update_event` `delete_event` |
| 習慣 | `add_habit` `log_habit` `archive_habit` |
| メモ | `add_note` `update_note` `add_tree_note` `add_tree_children` `add_board_note` `delete_note` |
| 振り返り | `save_review` |

Googleカレンダーの予定は MCP 経由のデータには含まれません。AIには Google Calendar のコネクタ/MCPも併用させてください(`find_free_slots` はSelfDeskの予定とブロックだけを見ます)。

## 同期の仕組みと注意
- 各項目(タスク・予定・習慣・メモ・振り返り)に更新時刻を持たせ、端末間・MCP間で**項目単位の新しい方が勝つ**マージをします。削除も伝播します。同じ項目を2か所で同時に編集した場合は後勝ちです(習慣の記録は習慣1件単位)
- オフラインでも使え、再接続時に同期されます
- `data.json` はGitHubのコミット履歴に残るので、誤操作しても過去の版に戻せます
- 大きなホワイトボードを大量に作ると `data.json` が肥大します(数MBまでは問題ありません)
- MCPサーバーは**自分のPC上で動くローカルプロセス**です。Claude のスマホアプリ/Webからは使えません(その場合はリモートMCPサーバーのホスティングが別途必要です)

## 開発
```
npm install
npm run dev          # http://localhost:5173
npm run build        # 型検査 + dist/
```
主なキー操作 — ロジックツリー: Tab=子を追加 / Enter=兄弟を追加 / F2=編集 / Space=折りたたみ / 矢印=移動 / Delete=削除。タスク入力: `資料を作る !2 #仕事 @tag ~45m 明日`


## 見た目・機能の拡張
色・密度・スキンは「設定 > 外観」から変更できます。画面や「今日」の部品、⌘Kコマンドの追加方法は [docs/EXTENDING.md](docs/EXTENDING.md) を参照してください。⌘K(Windows は Ctrl+K)で検索・移動・タスク追加ができます。
