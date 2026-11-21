/**
 * 拡張ポイント(ここが SelfDesk の「差し込み口」)
 *   registerView    画面を追加(サイドバー・⌘K・URL に自動で載る)
 *   registerWidget  「今日」画面に載せる部品を追加(設定で並び替え・非表示にできる)
 *   registerCommand ⌘K に項目を追加
 *   registerSource  ⌘K の検索結果を動的に追加(タスク・メモ検索など)
 *   registerSkin    見た目のスキンを追加(CSS 変数を上書きするだけ)
 * 自作の拡張は src/extensions/ にファイルを置くだけで読み込まれる(docs/EXTENDING.md)。
 */
import { useSyncExternalStore, type ComponentType } from 'react'

export interface ViewProps { param?: string; nav: (path: string) => void }
export interface ViewDef {
  id: string; title: string; icon: string
  group?: 'main' | 'plan' | 'log' | string   // サイドバーの見出し
  order?: number; width?: 'narrow' | 'normal' | 'full'
  mobile?: boolean                            // モバイル下タブに出す
  component: ComponentType<ViewProps>
  aside?: ComponentType                       // 見出し右側に出す部品
  hideTitle?: boolean
}
export interface WidgetDef { id: string; title: string; span?: 'full' | 'half'; heading?: boolean; order?: number; component: ComponentType }
export interface Command { id: string; title: string; section?: string; hint?: string; keywords?: string; run: () => void }
export type Source = (query: string) => Command[]
export interface SkinDef { id: string; label: string; css?: string }

const views = new Map<string, ViewDef>(); const widgets = new Map<string, WidgetDef>()
const commands = new Map<string, Command>(); const sources = new Map<string, Source>()
const skins = new Map<string, SkinDef>([['quiet', { id: 'quiet', label: 'Quiet(標準)' }], ['paper', { id: 'paper', label: 'Paper(暖色)' }]])
let ver = 0; const subs = new Set<() => void>()
const bump = () => { ver++; subs.forEach(f => f()) }
const useVer = () => useSyncExternalStore(f => { subs.add(f); return () => { subs.delete(f) } }, () => ver)

const byOrder = <T extends { order?: number }>(a: T, b: T) => (a.order ?? 100) - (b.order ?? 100)
export const registerView = (v: ViewDef) => { views.set(v.id, v); bump() }
export const registerWidget = (w: WidgetDef) => { widgets.set(w.id, w); bump() }
export const registerCommand = (c: Command) => { commands.set(c.id, c); bump() }
export const registerSource = (id: string, s: Source) => { sources.set(id, s); bump() }
export const registerSkin = (s: SkinDef) => { skins.set(s.id, s); bump() }

export const useViews = () => { useVer(); return [...views.values()].sort(byOrder) }
export const useWidgets = () => { useVer(); return [...widgets.values()].sort(byOrder) }
export const useSkins = () => { useVer(); return [...skins.values()] }
export const allCommands = () => [...commands.values()]
export const allSources = () => [...sources.values()]
export const skinCss = () => [...skins.values()].map(s => s.css || '').join('\n')
