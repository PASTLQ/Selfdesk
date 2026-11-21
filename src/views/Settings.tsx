import { useState } from 'react'
import { useStore, setSettings, get, replaceAll } from '../store'
import { Seg } from '../ui'
import * as G from '../lib/gcal'
import { syncNow, useSyncStatus } from '../lib/sync'

export function Settings() {
  const s = useStore(x => x.settings); const st = useSyncStatus(); const [msg, setMsg] = useState(''); const [conn, setConn] = useState(G.isConnected())
  const connect = async () => { try { await G.connect(); setConn(true); setMsg('Googleカレンダーに接続しました。カレンダー画面で予定が読み込まれます。') } catch (e: any) { setMsg(e.message) } }
  const exp = () => { const b = new Blob([JSON.stringify({ ...get(), gEvents: [], settings: undefined }, null, 1)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `selfdesk-${new Date().toISOString().slice(0, 10)}.json`; a.click() }
  const imp = (f?: File) => { if (!f) return; f.text().then(t => { try { const j = JSON.parse(t); if (!confirm('現在のデータを読み込んだ内容で置き換えます。よろしいですか?')) return; replaceAll(j) } catch { alert('JSONを読み込めませんでした') } }) }
  return (
    <div className="stack" style={{ gap: 'var(--s5)' }}>
      <section className="stack"><h2 className="sec-h">表示</h2>
        <Seg value={s.theme} onChange={v => setSettings({ theme: v })} items={[['auto', '自動'], ['light', 'ライト'], ['dark', 'ダーク']]} />
        <div className="row"><div className="field grow"><label htmlFor="ds">1日の開始(時)</label><input id="ds" type="number" min={0} max={20} value={s.dayStart} onChange={e => setSettings({ dayStart: Math.max(0, Math.min(20, Number(e.target.value) || 0)) })} /></div>
          <div className="field grow"><label htmlFor="de">1日の終了(時)</label><input id="de" type="number" min={4} max={24} value={s.dayEnd} onChange={e => setSettings({ dayEnd: Math.max(4, Math.min(24, Number(e.target.value) || 24)) })} /></div></div>
      </section>
      <hr className="rule" />
      <section className="stack"><h2 className="sec-h">同期(GitHub)</h2>
        <p className="small muted">データを非公開のGitHubリポジトリ(data.json)に保存し、すべての端末とMCPサーバーで共有します。</p>
        <div className="field"><label htmlFor="gr">データ用リポジトリ(owner/repo)</label><input id="gr" type="text" placeholder="yourname/selfdesk-data" value={s.ghRepo} onChange={e => setSettings({ ghRepo: e.target.value.trim() })} /></div>
        <div className="field"><label htmlFor="gt">アクセストークン</label><input id="gt" type="password" autoComplete="off" placeholder="github_pat_..." value={s.ghToken} onChange={e => setSettings({ ghToken: e.target.value.trim() })} /></div>
        <details><summary style={{ cursor: 'pointer', minHeight: 36 }}>詳細設定とトークンの作り方</summary>
          <div className="stack">
            <div className="row"><div className="field grow"><label htmlFor="gp">ファイルのパス</label><input id="gp" type="text" value={s.ghPath} onChange={e => setSettings({ ghPath: e.target.value.trim() })} /></div>
              <div className="field grow"><label htmlFor="gb">ブランチ(空欄で既定)</label><input id="gb" type="text" value={s.ghBranch} onChange={e => setSettings({ ghBranch: e.target.value.trim() })} /></div></div>
            <ol className="small" style={{ paddingLeft: 20 }}>
              <li>GitHubで<b>非公開</b>のリポジトリを作成(例 selfdesk-data)。空でも、README付きでも構いません</li>
              <li>Settings → Developer settings → Fine-grained tokens で新規トークンを作成</li>
              <li>Repository access は「Only select repositories」でそのリポジトリだけを選ぶ</li>
              <li>Permissions → Repository permissions → <b>Contents: Read and write</b></li>
              <li>発行されたトークンを上の欄に貼る(トークンはこの端末のブラウザにだけ保存されます)</li>
            </ol>
          </div></details>
        <div className="row"><button className="btn" onClick={() => syncNow()} disabled={!s.ghRepo || !s.ghToken || st.state === 'syncing'}>今すぐ同期</button>
          <span className="small muted" role="status">{st.state === 'off' ? '未設定' : st.state === 'syncing' ? '同期中…' : st.state === 'error' ? '' : `同期済み ${st.last ? new Date(st.last).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : ''}`}</span></div>
        {st.state === 'error' && <div className="notice" role="alert">{st.msg}</div>}
      </section>
      <hr className="rule" />
      <section className="stack"><h2 className="sec-h">Googleカレンダー</h2>
        <div className="field"><label htmlFor="gc">OAuth クライアントID</label><input id="gc" type="text" placeholder="xxxx.apps.googleusercontent.com" value={s.gClientId} onChange={e => setSettings({ gClientId: e.target.value.trim() })} /></div>
        <div className="row"><button className="btn" onClick={connect} disabled={!s.gClientId}>{conn ? '再接続' : '接続する'}</button>{conn && <button className="btn" onClick={() => { G.disconnect(); setConn(false); setMsg('切断しました') }}>切断</button>}<span className="small muted">{conn ? '接続中(約1時間で再認可が必要)' : '未接続'}</span></div>
        <label className="switch-row"><span><b>ブロックと予定を自動でGoogleに書き出す</b><small>タイムブロックの配置・変更時に、Googleカレンダーへ「▪ タスク名」として作成/更新します</small></span><input className="switch" type="checkbox" checked={s.gSync} onChange={e => setSettings({ gSync: e.target.checked })} /></label>
        {msg && <div className="notice" role="status">{msg}</div>}
        <details><summary style={{ cursor: 'pointer', minHeight: 36 }}>クライアントIDの取得方法</summary>
          <ol className="small" style={{ paddingLeft: 20 }}>
            <li>Google Cloud Console でプロジェクトを作成し、「Google Calendar API」を有効にする</li>
            <li>「OAuth 同意画面」を設定し、自分をテストユーザーに追加する</li>
            <li>「認証情報」→「OAuth クライアントID」→種類は「ウェブ アプリケーション」</li>
            <li>「承認済みの JavaScript 生成元」に、このアプリを開いているURLのオリジン(例 <code>http://localhost:5173</code> や <code>https://あなたのドメイン</code>)を追加(file:// では動きません)</li>
            <li>発行されたクライアントIDをここに貼り付けて「接続する」</li>
          </ol></details>
      </section>
      <hr className="rule" />
      <section className="stack"><h2 className="sec-h">データ</h2>
        <div className="row"><button className="btn" onClick={exp}>書き出し(JSON)</button><label className="btn" style={{ cursor: 'pointer' }}>読み込み<input type="file" accept="application/json" className="sr" onChange={e => imp(e.target.files?.[0])} /></label></div>
        <p className="small muted">データはこの端末にも保存されます。書き出しファイルは手動バックアップ用で、トークンは含まれません。</p>
      </section>
    </div>
  )
}
