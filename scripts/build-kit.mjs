#!/usr/bin/env node
/**
 * ツール担当チャット(claude.ai の Project)に渡す「キット」を1ファイルに生成する。
 * 出力: kit/selfdesk-tool-kit.md(.gitignore 済み。毎回ここで作り直すので、写しが古くなる心配がない)
 * 使い方: npm run kit  → 出力を Project のナレッジにアップロード
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'

const parts = [
  ['docs/TOOL-SPEC.md', 'ツール実装仕様(最優先で読む)'],
  ['docs/GOVERNANCE.md', 'ガバナンス'],
  ['docs/EXTENDING.md', '拡張の書き方'],
  ['docs/tools/_TEMPLATE.md', '設計メモ兼カードのひな形'],
  ['docs/tools/README.md', 'ツール台帳(既存ツール一覧)'],
  ['src/core/collections.ts', '型: コレクション定義(FieldType と検証)'],
  ['src/collections/_example.ts', 'ひな形: コレクション'],
  ['src/collections/index.ts', '登録ファイル(ここに追記する)'],
  ['src/extensions/_example.tsx', 'ひな形: 拡張'],
  ['src/registry.ts', '型: 画面・部品・コマンドの登録'],
  ['src/types.ts', '型: データ全体(読み取り専用。変更しない)'],
  ['src/theme/tokens.css', 'デザイントークン(色はここの変数だけ)'],
  ['docs/CHANGELOG-DATA.md', 'データ構造の変更履歴'],
]
const lang = p => p.endsWith('.md') ? '' : p.endsWith('.css') ? 'css' : 'ts'
const out = [`# SelfDesk ツールキット\n\n生成: ${new Date().toISOString().slice(0, 10)}。このファイルはリポジトリから自動生成されたもの。内容を直接直さない。\n`]
for (const [p, label] of parts) {
  const body = readFileSync(p, 'utf8').trimEnd()
  out.push(`\n\n---\n\n## FILE: ${p}\n(${label})\n\n` + (p.endsWith('.md') ? body : '```' + lang(p) + '\n' + body + '\n```'))
}
mkdirSync('kit', { recursive: true })
writeFileSync('kit/selfdesk-tool-kit.md', out.join('') + '\n')
console.log(`✓ kit/selfdesk-tool-kit.md を生成(${parts.length} ファイル)`)
