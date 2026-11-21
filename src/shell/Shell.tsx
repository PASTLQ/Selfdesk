import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { useViews, type ViewDef } from '../registry'
import { useRoute, go } from '../route'
import { useOpenTask, openTask, setPalette } from '../ui-state'
import { useSyncStatus } from '../lib/sync'
import { applyTheme } from '../theme/apply'
import { Icon } from './Icon'
import { Palette } from './Palette'
import { Sheet } from '../ui'
import { TaskSheet } from '../views/TaskSheet'

const GROUPS: Record<string, string> = { main: '', plan: '整理', log: '記録' }
const isMac = /Mac|iPhone|iPad/.test(navigator.platform)

export function Shell() {
  const route = useRoute(); const views = useViews(); const st = useSyncStatus(); const taskId = useOpenTask()
  const s = useStore(x => x.settings); const skinKey = s.theme + s.skin + s.accent + s.density + s.fontScale + s.customCss
  const [more, setMore] = useState(false)
  useEffect(() => { applyTheme(s) }, [skinKey, views.length]) // eslint-disable-line
  const view = views.find(v => v.id === route.id) ?? views[0]
  useEffect(() => { if (view && route.id !== view.id) history.replaceState(null, '', '#/' + view.id) }, [view?.id, route.id]) // eslint-disable-line
  useEffect(() => { document.title = view ? `${view.title} - SelfDesk` : 'SelfDesk' }, [view?.title])
  const groups = [...new Set(views.map(v => v.group ?? 'main'))]
  const link = (v: ViewDef) => <a key={v.id} href={'#/' + v.id} aria-current={view?.id === v.id ? 'page' : undefined}><Icon name={v.icon} />{v.title}</a>
  const sync = st.state === 'off' ? ['', '同期は未設定'] : st.state === 'syncing' ? ['busy', '同期中…'] : st.state === 'error' ? ['err', '同期エラー'] : ['ok', '同期済み']
  if (!view) return null
  const V = view.component; const A = view.aside
  const mobile = views.filter(v => v.mobile); const rest = views.filter(v => !v.mobile)
  return <>
    <div className="shell">
      <aside className="sidebar">
        <div className="brand"><i>S</i>SelfDesk</div>
        <button className="search" onClick={() => setPalette(true)}><Icon name="search" /><span>検索・コマンド</span><kbd className="kbd">{isMac ? '⌘' : 'Ctrl'} K</kbd></button>
        <nav className="nav" aria-label="メイン">
          {groups.map(g => <div key={g} className="nav" role="group" aria-label={GROUPS[g] ?? g}>
            {(GROUPS[g] ?? g) && <h2>{GROUPS[g] ?? g}</h2>}{views.filter(v => (v.group ?? 'main') === g).map(link)}</div>)}
        </nav>
        <a className="side-foot" href="#/settings" style={{ textDecoration: 'none' }} role="status"><span className={'dot ' + sync[0]} />{sync[1]}</a>
      </aside>
      <main className="main">
        <div className={'page w-' + (view.width ?? 'normal')}>
          {!view.hideTitle && <header className="page-head"><h1>{view.title}</h1>{A && <A />}</header>}
          <V param={route.param} nav={go} />
        </div>
      </main>
    </div>
    <nav className="mtabs" aria-label="メイン">
      {mobile.map(link)}
      {rest.length > 0 && <button onClick={() => setMore(true)} aria-haspopup="dialog"><Icon name="menu" />その他</button>}
    </nav>
    {more && <Sheet title="メニュー" onClose={() => setMore(false)}><div className="rows" onClick={() => setMore(false)}>
      {rest.map(v => <a key={v.id} className="row-link" href={'#/' + v.id}><span className="row" style={{ gap: 8 }}><Icon name={v.icon} />{v.title}</span></a>)}
      <button className="row-link btn-quiet" style={{ border: 0, background: 'none', textAlign: 'left', cursor: 'pointer' }} onClick={() => setPalette(true)}><span className="row" style={{ gap: 8 }}><Icon name="search" />検索・コマンド</span></button>
    </div></Sheet>}
    <Palette />
    {taskId && <TaskSheet id={taskId} onClose={() => openTask(null)} />}
  </>
}
