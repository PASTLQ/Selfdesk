/**
 * 構造図の自動レイアウト(純粋関数)。左→右に深さを並べ、葉を縦に詰め、親は子の中央に置く。
 * 座標は保存しない(階層=データ、図=表示)。ドラッグで親を付け替えると、再計算されて図が整う。
 */
import type { Task } from '../types'
import { childrenOf } from './tree'

export interface LayoutOpts {
  /** 図に出す項目か(例: プロジェクトだけ)。出さない項目の子孫も出さない */
  show?: (t: Task) => boolean
  collapsed?: Set<string>
  nodeW?: number; nodeH?: number; gapX?: number; gapY?: number
}
export interface LNode { t: Task; x: number; y: number; depth: number; parent?: string; /** 畳まれて見えない子の数 */ hidden: number }
export interface Layout { nodes: LNode[]; width: number; height: number; byId: Map<string, LNode> }

export function layoutTree(tasks: Task[], roots: Task[], o: LayoutOpts = {}): Layout {
  const W = o.nodeW ?? 200, H = o.nodeH ?? 64, GX = o.gapX ?? 56, GY = o.gapY ?? 14
  const show = o.show ?? (() => true); const collapsed = o.collapsed ?? new Set<string>()
  const nodes: LNode[] = []; const byId = new Map<string, LNode>(); const seen = new Set<string>()
  let row = 0
  /** 戻り値: その部分木の中心の行位置 */
  const place = (t: Task, depth: number, parent?: string): number => {
    seen.add(t.id)
    const kids = childrenOf(tasks, t.id).filter(c => show(c) && !seen.has(c.id))
    const open = !collapsed.has(t.id)
    const node: LNode = { t, x: depth * (W + GX), y: 0, depth, parent, hidden: open ? 0 : kids.length }
    nodes.push(node); byId.set(t.id, node)
    if (!open || !kids.length) { node.y = row * (H + GY); row++; return node.y }
    const ys = kids.map(c => place(c, depth + 1, t.id))
    node.y = (ys[0] + ys[ys.length - 1]) / 2
    return node.y
  }
  for (const r of roots) if (!seen.has(r.id)) place(r, 0)
  const width = nodes.reduce((m, n) => Math.max(m, n.x + W), 0); const height = nodes.reduce((m, n) => Math.max(m, n.y + H), 0)
  return { nodes, width, height, byId }
}

/** ドラッグで t を target の子にしてよいか(自分・子孫・同じ親は不可) */
export function canDropOn(tasks: Task[], id: string, target: string): boolean {
  if (id === target) return false
  const by = new Map(tasks.map(t => [t.id, t])); let c = by.get(target)?.parent; const seen = new Set<string>([target])
  while (c && !seen.has(c)) { if (c === id) return false; seen.add(c); c = by.get(c)?.parent }
  return by.get(id)?.parent !== target
}
