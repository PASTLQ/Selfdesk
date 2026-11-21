import type { TreeNode } from '../types'
import { uid } from './date'

/** ツリー → インデント付きテキスト */
export function treeToOutline(tree: TreeNode[]): string {
  const kids = (p: string | null) => tree.filter(n => n.parent === p).sort((a, b) => a.order - b.order)
  const out: string[] = []
  const walk = (p: string | null, d: number) => kids(p).forEach(n => { out.push('  '.repeat(d) + n.text); walk(n.id, d + 1) })
  walk(null, 0); return out.join('\n')
}
/** インデント付きテキスト(-, *, ・, 番号つきも可) → ツリー。先頭行がルート。 */
export function outlineToTree(text: string): TreeNode[] {
  const lines = text.split('\n').map(l => l.replace(/\t/g, '  ')).filter(l => l.trim())
  if (!lines.length) return [{ id: uid(), text: '中心テーマ', parent: null, order: 0 }]
  const out: TreeNode[] = []; const stack: { indent: number; id: string }[] = []; const orders = new Map<string | null, number>()
  lines.forEach((raw, i) => {
    const indent = raw.match(/^ */)![0].length; const t = raw.trim().replace(/^([-*・•]|\d+[.)])\s+/, '')
    while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop()
    const parent = i === 0 ? null : (stack.length ? stack[stack.length - 1].id : out[0].id)
    const id = uid(); const o = orders.get(parent) ?? 0; orders.set(parent, o + 1)
    out.push({ id, text: t, parent, order: o }); stack.push({ indent: i === 0 ? -1 : indent, id })
  })
  return out
}
