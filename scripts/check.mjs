#!/usr/bin/env node
/**
 * ガバナンスのルール検査(docs/GOVERNANCE.md)。違反があれば非0で終了する。
 *  1. src/collections/ の定義ファイルは、index.ts の COLLECTIONS に登録されていること
 *  2. 拡張(src/extensions)が、自前で localStorage / IndexedDB に保存していないこと(データは必ずコレクション/ストア経由)
 *  3. 拡張に色のリテラル(#rrggbb, rgb())を書かないこと(トークンを使う)。スキンの css 文字列は除外
 *  4. 拡張から GitHub トークン等の設定(settings)を直接読まないこと
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const errors = []
const walk = d => !existsSync(d) ? [] : readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p] })

// 1
const cdir = 'src/collections'; const idx = readFileSync(join(cdir, 'index.ts'), 'utf8')
for (const f of readdirSync(cdir)) {
  if (f === 'index.ts' || f.startsWith('_') || !/\.tsx?$/.test(f)) continue
  const base = f.replace(/\.tsx?$/, '')
  if (!new RegExp(`from\\s+['"]\\./${base}['"]`).test(idx)) errors.push(`${cdir}/${f}: index.ts に import / 登録されていません(MCPとアプリに載りません)`)
}
// 2-4
for (const f of walk('src/extensions').filter(p => /\.tsx?$/.test(p) && !p.split('/').pop().startsWith('_'))) {
  const src = readFileSync(f, 'utf8'); const code = src.replace(/registerSkin\([\s\S]*?\)\s*$/gm, '').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')
  if (/localStorage|sessionStorage|indexedDB/.test(code)) errors.push(`${f}: 自前のブラウザ保存は禁止です。データは src/collections のコレクション(または store)に置いてください`)
  if (/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|rgba?\(/.test(code.replace(/registerSkin[\s\S]*/g, ''))) errors.push(`${f}: 色のリテラルは禁止です。var(--accent) などのトークンを使ってください(docs/EXTENDING.md)`)
  if (/settings\.(ghToken|gClientId)/.test(code)) errors.push(`${f}: 認証情報には触れないでください`)
}

// 5-9: ツール実装仕様(docs/TOOL-SPEC.md)
const topFiles = d => readdirSync(d).filter(f => /\.tsx?$/.test(f) && !f.startsWith('_') && f !== 'index.ts' && statSync(join(d, f)).isFile()).map(f => f.replace(/\.tsx?$/, ''))
const readme = readFileSync('docs/tools/README.md', 'utf8')
const toolIds = new Set([...topFiles('src/collections'), ...topFiles('src/extensions')])
for (const id of toolIds) {
  // 5: コレクションのファイル名と id が一致していること
  const cf = ['ts', 'tsx'].map(e => join('src/collections', `${id}.${e}`)).find(existsSync)
  if (cf && !new RegExp(`\\bid:\\s*['"]${id}['"]`).test(readFileSync(cf, 'utf8'))) errors.push(`${cf}: ファイル名と defineCollection の id を同じにしてください(id: '${id}')`)
  // 6: カードがあり、台帳に載っていること
  const card = join('docs/tools', `${id}.md`)
  if (!existsSync(card)) { errors.push(`${id}: docs/tools/${id}.md(設計メモ兼カード)がありません。_TEMPLATE.md を複製してください`); continue }
  const c = readFileSync(card, 'utf8')
  if (!new RegExp(`^spec:\\s*TOOL-SPEC v\\d+`, 'm').test(c)) errors.push(`${card}: 「spec: TOOL-SPEC v<番号>」の行がありません`)
  for (const h of ['## 目的', '## 新ツールを作る前の確認', '## AI からの使い方']) if (!c.includes(h)) errors.push(`${card}: 見出し「${h}」がありません(_TEMPLATE.md 参照)`)
  if (!readme.includes(`| ${id} |`)) errors.push(`docs/tools/README.md: 台帳に ${id} の行がありません`)
}
// 7: 拡張からの外部通信は禁止(TOOL-SPEC §5)
for (const f of walk('src/extensions').filter(p => /\.tsx?$/.test(p) && !p.split('/').pop().startsWith('_'))) {
  const code = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')
  if (/\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon/.test(code)) errors.push(`${f}: 外部通信は禁止です(docs/TOOL-SPEC.md §5)。必要なら本体チャットへ依頼してください`)
}
// 8: 仕様の版数が、ツール担当チャット向けの指示文と一致していること
const specV = readFileSync('docs/TOOL-SPEC.md', 'utf8').match(/^spec-version:\s*(\d+)/m)?.[1]
const instV = readFileSync('docs/tools/PROJECT-INSTRUCTIONS.md', 'utf8').match(/^spec-version:\s*(\d+)/m)?.[1]
if (!specV || specV !== instV) errors.push(`docs/TOOL-SPEC.md(v${specV})と docs/tools/PROJECT-INSTRUCTIONS.md(v${instV})の spec-version が一致しません。指示文を更新し、Project に貼り直してください`)

if (errors.length) { console.error('✗ ガバナンス検査に失敗:\n' + errors.map(e => '  - ' + e).join('\n')); process.exit(1) }
console.log('✓ ガバナンス検査 OK')
