# SelfDesk — Claude への作業指針
Kai の生活管理アプリ(React + Vite、データは GitHub の data.json、AI連携は MCP)。
**最初に `docs/HANDOFF.md`(引き継ぎ: 構成・データ・運用・残作業・ハマりどころ)を読む。** 日本語で応答する。

- **個別ツール(コレクション・拡張)の実装だけを頼まれた場合は、スキル `sd-tool-builder`(`.claude/skills/`)を使い、`docs/TOOL-SPEC.md` に従う。** 触ってよい範囲が決まっており、範囲外(`types.ts` `store.ts` `core/` `mcp/` `theme/` など)は変更せず「本体への依頼」にする。本体の開発を頼まれた場合は対象外。
- 新しいツール・機能を作る前に `docs/GOVERNANCE.md` の「5. 新ツールを作る前の確認」に答える。曖昧で手戻りが大きい依頼は先に質問する。
- データ: プロジェクト/タスク/Todo は1本の階層ツリー(`Task.parent`、`isProject`)。願望は `Wish`。新しい種類のデータは `src/collections/` のコレクション。自前の localStorage・別ファイル・別アプリにデータを持たない。
- 他の項目との関係は `Ref`(`{kind,id}`)。スキーマは追加のみ。変更したら `docs/CHANGELOG-DATA.md` に1行残す。更新は必ずイミュータブルに(`u` の自動付与が参照比較に依存)。
- 画面: `src/extensions/` に拡張として足す。色・余白は `src/theme/tokens.css` の変数のみ(色リテラル禁止)。`core/` から React・store を import しない(MCP が bundle できなくなる)。
- AI連携: SelfDesk が正。MCP ツールは `mcp/src/tools.ts`(説明文に「いつ使うか」を書く)。コレクションは `collection_*` で自動対応。
- 完了前に `npm run check`(ルール検査・型・テスト)を通す。push は Kai の端末から(チャット版の環境は push 不可)。
- デザインは A案 Quiet Pro(Linear 系)。
