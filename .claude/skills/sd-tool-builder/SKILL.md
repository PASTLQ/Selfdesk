---
name: sd-tool-builder
description: SelfDesk に個別のツール(コレクション・拡張・画面)を新規実装・改修するときに必ず使う。「sd-tool-builder を読んで〜ツールを作って」「SelfDesk にツールを追加して」のような依頼で起動する。触ってよい範囲・設計メモ・検査・納品形式を定めたガバナンスの入口。本体(types/store/core/mcp/theme など)の開発では使わない。
---

# sd-tool-builder

SelfDesk のツール実装担当として動く。**ルールの正は `docs/TOOL-SPEC.md`**(このファイルに複製しない)。
spec-version: 1

## 手順

1. 次を読む(この順)。`docs/TOOL-SPEC.md` → `docs/GOVERNANCE.md` の §5 → `docs/EXTENDING.md` → `docs/tools/README.md`(既存ツール台帳)→ 近い既存コレクション(`src/collections/`)と拡張(`src/extensions/`)。
2. **設計メモを先に書く**: `docs/tools/_TEMPLATE.md` を複製して `docs/tools/<id>.md` を埋める。GOVERNANCE §5 の4問に答える。依頼が曖昧なら質問する。**Kai の承認が出るまで実装しない。**
3. 承認後、TOOL-SPEC §2 の範囲だけを変更して実装する。ツールID はコレクション id・拡張ファイル名・カード名で同一にする。
4. 範囲外の変更が必要になったら、変更せず TOOL-SPEC §7 の「本体への依頼」を書いて Kai に渡す。
5. 完了前に `npm run check` と `npm run check:scope` を通す。
6. TOOL-SPEC §8 の形式で納品する(「準拠: TOOL-SPEC v1」、変更ファイル一覧、本体への依頼の有無)。コミット・push は Kai が行うので、依頼がなければしない。

## 最低限の禁止事項(詳細は TOOL-SPEC)

- `src/types.ts` `src/store.ts` `src/core/` `src/registry.ts` `src/shell/` `src/views/` `src/theme/` `src/App.tsx` `mcp/` `scripts/` `package.json` は変更しない。
- 自前の localStorage・別ファイル・別アプリにデータを持たない。コレクションに載せ、他項目とは `Ref` でつなぐ。
- 拡張で `fetch` など外部通信をしない。色リテラルを使わず `tokens.css` の変数だけを使う。
- スキーマは追加のみ。データ形を変えたら `docs/CHANGELOG-DATA.md` に1行残す。
