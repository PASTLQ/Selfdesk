/** 組み込み画面の登録。画面を足す/外すときはここ(または src/extensions/)を編集する。 */
import { registerView, registerCommand, registerSource } from '../registry'
import { go } from '../route'
import { openTask } from '../ui-state'
import { useStore, addTask, get, setSettings } from '../store'
import { parseQuick } from '../lib/quick'
import { fmtDate } from '../lib/date'
import { Today } from './Today'
import { Tasks } from './Tasks'
import { Calendar } from './Calendar'
import { Notes } from './Notes'
import { Habits } from './Habits'
import { Review } from './Review'
import { Settings } from './Settings'
import { Projects } from './Projects'
import { Wishes, ST } from './Wishes'
import { CollectionView } from './CollectionView'
import { COLLECTIONS } from '../collections'
import '../widgets/today'

const TodayAside = () => <span className="aside">{fmtDate(new Date().toISOString().slice(0, 10))}</span>
const WishCount = () => { const n = useStore(s => s.wishes.filter(w => w.status !== 'done').length); return <span className="aside">これから {n}件</span> }
const Count = () => { const n = useStore(s => s.tasks.filter(t => !t.done).length); return <span className="aside">未完了 {n}件</span> }

registerView({ id: 'today', title: '今日', icon: 'today', group: 'main', order: 10, width: 'normal', mobile: true, component: Today, aside: TodayAside })
registerView({ id: 'tasks', title: 'タスク', icon: 'tasks', group: 'plan', order: 20, width: 'narrow', mobile: true, component: () => <Tasks open={openTask} />, aside: Count })
registerView({ id: 'calendar', title: 'カレンダー', icon: 'calendar', group: 'plan', order: 30, width: 'full', mobile: true, component: () => <Calendar openTask={openTask} /> })
registerView({ id: 'projects', title: 'プロジェクト', icon: 'star', group: 'plan', order: 25, width: 'normal', mobile: false, component: Projects })
registerView({ id: 'wishes', title: 'やりたいこと', icon: 'heart', group: 'plan', order: 45, width: 'narrow', component: Wishes, aside: WishCount })
registerView({ id: 'notes', title: 'メモ', icon: 'notes', group: 'plan', order: 40, width: 'full', mobile: true, component: ({ param, nav }) => <Notes openId={param ?? null} setOpenId={id => nav(id ? `notes/${id}` : 'notes')} /> })
registerView({ id: 'habits', title: '習慣', icon: 'habits', group: 'log', order: 50, width: 'narrow', component: Habits })
registerView({ id: 'review', title: '振り返り', icon: 'review', group: 'log', order: 60, width: 'narrow', component: Review })
registerView({ id: 'settings', title: '設定', icon: 'settings', group: 'log', order: 90, width: 'narrow', component: Settings })

/* ツール拡張のコレクションは、定義があれば汎用の一覧画面を自動で出す(専用画面を作るなら customView: true) */
for (const def of COLLECTIONS) if (!def.customView) registerView({ id: 'c-' + def.id, title: def.label, icon: def.icon || 'notes', group: 'tools', order: 200, width: 'narrow', component: () => <CollectionView def={def} /> })

registerCommand({ id: 'sys.theme', title: 'テーマを切り替える(ライト/ダーク)', section: '操作', keywords: 'dark light theme テーマ', run: () => {
  const m = document.documentElement.getAttribute('data-theme') ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  setSettings({ theme: m === 'dark' ? 'light' : 'dark' })
} })

/** ⌘K の検索: 入力文字からタスク・メモを探し、先頭に「タスクとして追加」を出す */
registerSource('core.search', q => {
  const out = [] as import('../registry').Command[]
  const s = q.trim(); if (!s) return out
  const p = parseQuick(s)
  const { tasks, notes } = get()
  const lc = s.toLowerCase()
  tasks.filter(t => !t.isProject && t.title.toLowerCase().includes(lc)).slice(0, 6).forEach(t => out.push({ id: 't.' + t.id, title: t.title, section: 'タスク', hint: t.done ? '完了' : t.due ?? '', run: () => openTask(t.id) }))
  tasks.filter(t => t.isProject).filter(t => (t.title + (t.goal || '')).toLowerCase().includes(lc)).slice(0, 5).forEach(t => out.push({ id: 'pj.' + t.id, title: t.title, section: 'プロジェクト', run: () => go('projects/' + t.id) }))
  get().wishes.filter(w => (w.title + w.note).toLowerCase().includes(lc)).slice(0, 5).forEach(w => out.push({ id: 'w.' + w.id, title: w.title, section: 'やりたいこと', hint: ST[w.status], run: () => go('wishes') }))
  notes.filter(n => (n.title + ' ' + n.body).toLowerCase().includes(lc)).slice(0, 6).forEach(n => out.push({ id: 'n.' + n.id, title: n.title || '(無題)', section: 'メモ', run: () => go('notes/' + n.id) }))
  if (p.title) out.push({ id: 'q.add', title: `タスクに追加: ${p.title}`, section: '追加', run: () => { addTask({ ...p }) } })  // 誤爆防止: 検索結果の最後に置く
  return out
})
