import { useEffect, useState } from 'react'
import { useStore } from './store'
import { Today } from './views/Today'
import { Tasks } from './views/Tasks'
import { Calendar } from './views/Calendar'
import { Notes } from './views/Notes'
import { Habits } from './views/Habits'
import { Review } from './views/Review'
import { Settings } from './views/Settings'
import { TaskSheet } from './views/TaskSheet'
import { Seg } from './ui'
import { useSyncStatus } from './lib/sync'

type Tab = 'today' | 'plan' | 'log'
type Plan = 'tasks' | 'calendar' | 'notes'
type Log = 'habits' | 'review' | 'settings'

export default function App() {
  const theme = useStore(s => s.settings.theme); const st = useSyncStatus()
  const [tab, setTab] = useState<Tab>('today'); const [plan, setPlan] = useState<Plan>('tasks'); const [log, setLog] = useState<Log>('habits')
  const [taskId, setTaskId] = useState<string | null>(null); const [noteId, setNoteId] = useState<string | null>(null)
  useEffect(() => { const r = document.documentElement; theme === 'auto' ? r.removeAttribute('data-theme') : r.setAttribute('data-theme', theme) }, [theme])
  const go = (v: string) => { if (v === 'calendar') { setTab('plan'); setPlan('calendar') } }
  const wide = tab === 'plan' && (plan === 'calendar' || plan === 'notes')
  const narrow: React.CSSProperties = { maxWidth: 720, width: '100%', margin: '0 auto' }
  return (
    <>
      <main className={'wrap ' + (wide ? 'full' : 'wide')} style={wide ? { maxWidth: 1400 } : undefined}>
        {tab === 'today' && <Today openTask={setTaskId} go={go} />}
        {tab === 'plan' && <>
          <header className="head"><h1 className="title">整理</h1></header>
          <Seg value={plan} onChange={setPlan} items={[['tasks', 'タスク'], ['calendar', 'カレンダー'], ['notes', 'メモ']]} />
          {plan === 'tasks' && <div style={narrow}><Tasks open={setTaskId} /></div>}
          {plan === 'calendar' && <Calendar openTask={setTaskId} />}
          {plan === 'notes' && <Notes openId={noteId} setOpenId={setNoteId} />}
        </>}
        {tab === 'log' && <>
          <header className="head"><h1 className="title">記録</h1></header>
          <Seg value={log} onChange={setLog} items={[['habits', '習慣'], ['review', '振り返り'], ['settings', '設定']]} />
          <div style={narrow}>{log === 'habits' && <Habits />}{log === 'review' && <Review />}{log === 'settings' && <Settings />}</div>
        </>}
      </main>
      {st.state !== 'off' && <div className="small muted" style={{ position: 'fixed', top: 8, right: 12, zIndex: 30 }} role="status">{st.state === 'syncing' ? '同期中…' : st.state === 'error' ? <button className="btn btn-quiet btn-sm" onClick={() => { setTab('log'); setLog('settings') }}>同期エラー</button> : '同期済み'}</div>}
      <nav className="tabbar" aria-label="メイン">
        {([['today', '今日'], ['plan', '整理'], ['log', '記録']] as [Tab, string][]).map(([t, l]) => <button key={t} aria-current={tab === t ? 'page' : undefined} onClick={() => setTab(t)}>{l}</button>)}
      </nav>
      {taskId && <TaskSheet id={taskId} onClose={() => setTaskId(null)} />}
    </>
  )
}
