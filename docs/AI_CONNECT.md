# AI(Claude)から SelfDesk を使う

SelfDesk のデータ(GitHub の `selfdesk-data/data.json`)を、MCP サーバー経由で Claude が読み書きします。**SelfDesk に書かれていることが正**で、Claude は予定・タスク・メモ・プロジェクトを推測せず、必ずここで確認して動きます(使い方は MCP が Claude に自動で伝えます)。

| 経路 | 使える場所 | セットアップ |
|---|---|---|
| ローカル版 | Claude Desktop / Claude Code(PCのみ) | README の手順(単一ファイルを PC に置く) |
| **リモート版(推奨)** | claude.ai / **スマホアプリ** / Desktop | 下記(Cloudflare Workers・無料枠) |

## リモート版のセットアップ(最初の1回・約15分)
1. **Cloudflare に登録**(無料)。ダッシュボードの右上 → 「Profile」→「API Tokens」→「Create Token」→ テンプレート「Edit Cloudflare Workers」を選んで作成。表示されたトークンを控える。また、ダッシュボード右側の **Account ID** を控える。
2. **合言葉を作る**: 次のどちらかで、32文字以上のランダムな文字列を作って控える(これがURLの一部になる)。
   - Mac のターミナル: `openssl rand -hex 24`
3. **GitHub の `Selfdesk` リポジトリ → Settings → Secrets and variables → Actions** で、次の5つを登録する。
   - Secrets: `CLOUDFLARE_API_TOKEN`(1のトークン)、`CLOUDFLARE_ACCOUNT_ID`(1のID)、`SELFDESK_DATA_TOKEN`(selfdesk-data を読み書きできるトークン。アプリの同期に使っているものと同じで可)、`SELFDESK_DATA_REPO`(例 `PASTLQ/selfdesk-data`)、`SELFDESK_MCP_SECRET`(2の合言葉)
   - Variables(任意・自動デプロイを有効にする): `ENABLE_REMOTE_MCP` = `true`
4. **Actions → 「Deploy remote MCP」→ Run workflow**。成功すると、Cloudflare に `selfdesk-mcp` ができる。URL は `https://selfdesk-mcp.<あなたのサブドメイン>.workers.dev`(Cloudflare の Workers & Pages 画面で確認できる)。
5. **claude.ai → Settings → Connectors → 「Add custom connector」**に、次のURLを入れる。
   `https://selfdesk-mcp.<サブドメイン>.workers.dev/<合言葉>/mcp`
   追加したコネクタは、同じアカウントのスマホアプリでも使える。会話で有効にして、「今日の予定とタスクを見せて」などと頼む。

### セキュリティについて(重要)
- 認証は **URLに含まれる合言葉**です。このURLを知っている人は、データの読み書きができます。他人に見せない・スクリーンショットに写さない・チャットに貼らないでください。
- 漏れた(かもしれない)ときは、GitHub の `SELFDESK_MCP_SECRET` を新しい値に変えて、Actions で再デプロイします(古いURLは無効になります)。
- データ用トークンは **selfdesk-data だけ** に、Contents の読み書き権限だけを与えたものを使ってください。
- より厳密な認証(OAuth)が必要になったら、後から差し替えられます。

## ローカル版
README の「MCPサーバーを接続する」を参照。同じツールが使えます(合言葉は不要)。

## できること(48ツール)
概況(`get_overview`)、タスク、**プロジェクト/WBS/マイルストーン**(`list_projects` `get_project` `create_project` `add_wbs` `move_task`)、予定と空き時間、習慣、メモ(ドキュメント/ツリー/ボード)、振り返り、**やりたいこと**(`add_wish` `promote_wish` `complete_wish`)、**拡張コレクション**(`collection_*`)、横断検索(`search`)。
