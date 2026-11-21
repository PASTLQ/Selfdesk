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
if (errors.length) { console.error('✗ ガバナンス検査に失敗:\n' + errors.map(e => '  - ' + e).join('\n')); process.exit(1) }
console.log('✓ ガバナンス検査 OK')
