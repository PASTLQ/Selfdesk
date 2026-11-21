/**
 * 拡張のひな形。使うときは「_」を外したファイル名(例: my-stats.tsx)にコピーする。
 * 1ファイルで 画面 / 今日のウィジェット / ⌘Kコマンド / スキン を足せる。
 */
import { registerView, registerWidget, registerCommand, registerSkin } from '../registry'
import { useStore } from '../store'
import { go } from '../route'

// 1) 今日画面に載る部品(設定 > 外観 で並び替え・非表示にできる)
function Overdue() {
  const n = useStore(s => s.tasks.filter(t => !t.done && t.due && t.due < new Date().toISOString().slice(0, 10)).length)
  return <div className="notice">期限切れ {n}件</div>
}
registerWidget({ id: 'x.overdue', title: '期限切れ', span: 'full', order: 15, component: Overdue })

// 2) 新しい画面(サイドバー・⌘K・URL #/stats に自動で載る)
registerView({ id: 'stats', title: '集計', icon: 'star', group: 'log', order: 70, component: () => <p>ここに自由に実装</p> })

// 3) ⌘K のコマンド
registerCommand({ id: 'x.goStats', title: '集計を開く', run: () => go('stats') })

// 4) スキン(CSS 変数の上書きだけで見た目を変える)
registerSkin({ id: 'night-blue', label: 'Night Blue', css: `:root[data-skin="night-blue"][data-theme="dark"]{--bg:#0b1020;--surface:#121a30;--surface-2:#1a2442;--sidebar:#0e1529;--border:#26325a}` })
