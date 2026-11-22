# データ構造の変更履歴
スキーマ(`src/types.ts`、`src/collections/*`)を変えたら、ここに1行残す。

- 2026-11-21 v2: `Task` に階層(`parent` `order` `start` `milestone`)とプロジェクト(`isProject` `goal` `doneWhen` `approach`)を追加。旧 `Task.project`(文字列)は読み込み時に親プロジェクトへ自動移行(IDは `p_<名前のハッシュ>` で端末間で一致)。`Data.projects` は廃止(常に空)。`Data.wishes`(やりたいこと)と `Data.ext`(コレクション)を追加。
- 2026-11-22: スキーマの変更なし。既存の `Task.links`(`Ref[]`)を「タグ」として画面と MCP(`add_task` / `update_task` / `list_tasks` の `related`)から編集できるようにした(`kind` は `project` / `wish`。自由ラベルの `Task.tags` は従来どおり)。
