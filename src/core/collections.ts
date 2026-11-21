/**
 * コレクション = ツール拡張のデータの置き場(ガバナンスの要)
 * 新しいツールは、データを自前の localStorage や別ファイルに持たず、ここでスキーマを宣言して保存する。
 * すると 同期・バックアップ・MCP(AIから読み書き)・汎用の一覧画面・検索・ほかの項目への参照 が自動で付く。
 * 定義は src/collections/ に置く(docs/GOVERNANCE.md)。
 */
import type { Data, ExtItem, Ref } from '../types'

export type FieldType = 'text' | 'longtext' | 'number' | 'date' | 'bool' | 'select' | 'tags' | 'ref'
export interface Field { key: string; label: string; type: FieldType; required?: boolean; options?: string[]; help?: string }
export interface CollectionDef {
  /** 英小文字・数字・ハイフン。一度決めたら変えない(データのキーになる) */
  id: string; label: string; description: string
  fields: Field[]
  /** 一覧で題名として使う項目 */
  titleField: string
  /** スキーマを非互換に変えたら上げる(変更履歴は docs に残す) */
  version: number
  icon?: string
  /** 画面を自前で用意する場合は true(汎用の一覧画面を出さない) */
  customView?: boolean
}
export const defineCollection = (d: CollectionDef): CollectionDef => {
  if (!/^[a-z][a-z0-9-]{1,30}$/.test(d.id)) throw new Error(`コレクションID "${d.id}" は英小文字・数字・ハイフンで2〜31文字にしてください`)
  if (RESERVED.has(d.id)) throw new Error(`コレクションID "${d.id}" は予約済みです`)
  if (!d.fields.some(f => f.key === d.titleField)) throw new Error(`${d.id}: titleField が fields にありません`)
  const keys = d.fields.map(f => f.key); if (new Set(keys).size !== keys.length) throw new Error(`${d.id}: fields の key が重複しています`)
  for (const f of d.fields) { if (f.key === 'id' || f.key === 'u') throw new Error(`${d.id}: key "${f.key}" は予約済みです`); if (f.type === 'select' && !f.options?.length) throw new Error(`${d.id}.${f.key}: select には options が必要です`) }
  return d
}
/** 組み込みの種類と衝突しないよう予約 */
export const RESERVED = new Set(['task', 'project', 'event', 'habit', 'note', 'wish', 'review', 'tasks', 'events', 'habits', 'notes', 'wishes'])
export const BUILTIN_KINDS = ['task', 'project', 'event', 'habit', 'note', 'wish']

/** 入力を検証して、スキーマに沿った値だけを取り出す(余計なキーは捨てる) */
export function validateItem(def: CollectionDef, input: Record<string, unknown>, partial = false): { ok: true; value: Record<string, unknown> } | { ok: false; errors: string[] } {
  const errors: string[] = []; const value: Record<string, unknown> = {}
  for (const f of def.fields) {
    const v = input[f.key]
    if (v === undefined || v === null || v === '') { if (f.required && !partial) errors.push(`${f.label}(${f.key})は必須です`); if (v === null) value[f.key] = undefined; continue }
    switch (f.type) {
      case 'text': case 'longtext': if (typeof v !== 'string') errors.push(`${f.key}は文字列`); else value[f.key] = v; break
      case 'number': if (typeof v !== 'number' || !Number.isFinite(v)) errors.push(`${f.key}は数値`); else value[f.key] = v; break
      case 'bool': if (typeof v !== 'boolean') errors.push(`${f.key}は true/false`); else value[f.key] = v; break
      case 'date': if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) errors.push(`${f.key}は YYYY-MM-DD`); else value[f.key] = v; break
      case 'select': if (typeof v !== 'string' || !f.options!.includes(v)) errors.push(`${f.key}は ${f.options!.join(' / ')} のいずれか`); else value[f.key] = v; break
      case 'tags': if (!Array.isArray(v) || v.some(x => typeof x !== 'string')) errors.push(`${f.key}は文字列の配列`); else value[f.key] = v; break
      case 'ref': { const r = v as Ref; if (!r || typeof r.kind !== 'string' || typeof r.id !== 'string') errors.push(`${f.key}は {kind,id}`); else value[f.key] = { kind: r.kind, id: r.id }; break }
    }
  }
  return errors.length ? { ok: false, errors } : { ok: true, value }
}

/** 参照(Ref)の指す先の題名。見つからなければ undefined */
export function refTitle(d: Data, defs: CollectionDef[], r: Ref): string | undefined {
  switch (r.kind) {
    case 'task': case 'project': return d.tasks.find(t => t.id === r.id)?.title
    case 'event': return d.events.find(t => t.id === r.id)?.title
    case 'habit': return d.habits.find(t => t.id === r.id)?.name
    case 'note': return d.notes.find(t => t.id === r.id)?.title
    case 'wish': return d.wishes.find(t => t.id === r.id)?.title
  }
  const def = defs.find(x => x.id === r.kind); const it = d.ext[r.kind]?.find(x => x.id === r.id)
  return def && it ? String(it[def.titleField] ?? '') : undefined
}
/** 参照先の候補(選択肢)。個人用なので全件を返す */
export function refChoices(d: Data, defs: CollectionDef[], kind: string): { id: string; title: string }[] {
  switch (kind) {
    case 'task': return d.tasks.filter(t => !t.isProject).map(t => ({ id: t.id, title: t.title }))
    case 'project': return d.tasks.filter(t => t.isProject).map(t => ({ id: t.id, title: t.title }))
    case 'note': return d.notes.map(t => ({ id: t.id, title: t.title || '(無題)' }))
    case 'wish': return d.wishes.map(t => ({ id: t.id, title: t.title }))
    case 'habit': return d.habits.map(t => ({ id: t.id, title: t.name }))
  }
  const def = defs.find(x => x.id === kind); return def ? (d.ext[kind] || []).map((x: ExtItem) => ({ id: x.id, title: String(x[def.titleField] ?? '') })) : []
}
