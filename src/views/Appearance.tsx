import { useStore, setSettings } from '../store'
import { Seg } from '../ui'
import { ACCENTS, accentHex } from '../theme/apply'
import { useSkins, useWidgets } from '../registry'

/** 設定 > 外観。ここで触れるものは全部 tokens.css の変数 / data 属性に対応している */
export function Appearance() {
  const s = useStore(x => x.settings); const skins = useSkins(); const widgets = useWidgets()
  const order = [...widgets].sort((a, b) => { const f = (id: string) => { const i = s.todayOrder.indexOf(id); return i < 0 ? 1000 + widgets.findIndex(w => w.id === id) : i }; return f(a.id) - f(b.id) })
  const move = (id: string, d: -1 | 1) => { const ids = order.map(w => w.id); const i = ids.indexOf(id); const j = i + d; if (j < 0 || j >= ids.length) return; [ids[i], ids[j]] = [ids[j], ids[i]]; setSettings({ todayOrder: ids }) }
  const toggle = (id: string) => setSettings({ todayHidden: s.todayHidden.includes(id) ? s.todayHidden.filter(x => x !== id) : [...s.todayHidden, id] })
  const cur = accentHex(s.accent)
  return <div className="stack" style={{ gap: 'var(--s5)' }}>
    <section className="stack"><h2 className="sec-h">外観</h2>
      <div className="field"><span className="label">モード</span><Seg value={s.theme} onChange={v => setSettings({ theme: v })} items={[['auto', '自動'], ['light', 'ライト'], ['dark', 'ダーク']]} /></div>
      <div className="field"><span className="label">スキン</span>
        <Seg value={s.skin} onChange={v => setSettings({ skin: v })} items={skins.map(k => [k.id, k.label] as [string, string])} /></div>
      <div className="field"><span className="label">アクセント色</span>
        <div className="swatches">
          {ACCENTS.map(a => <button key={a.id} className="swatch" style={{ background: a.hex }} aria-label={a.label} aria-pressed={s.accent === a.id} onClick={() => setSettings({ accent: a.id })} />)}
          <label className="swatch" style={{ background: cur, display: 'inline-block', position: 'relative' }} title="好きな色"><span className="sr">カスタム色</span>
            <input type="color" value={cur} onChange={e => setSettings({ accent: e.target.value })} style={{ opacity: 0, position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: 'pointer' }} /></label>
        </div></div>
      <div className="field"><span className="label">密度</span><Seg value={s.density} onChange={v => setSettings({ density: v })} items={[['compact', '詰める'], ['normal', '標準'], ['roomy', 'ゆったり']]} /></div>
      <div className="field"><label htmlFor="fs">文字サイズ({Math.round(s.fontScale * 100)}%)</label><input id="fs" type="range" min={0.85} max={1.3} step={0.05} value={s.fontScale} onChange={e => setSettings({ fontScale: Number(e.target.value) })} /></div>
      <div className="row"><div className="field grow"><label htmlFor="ds">1日の開始(時)</label><input id="ds" type="number" min={0} max={20} value={s.dayStart} onChange={e => setSettings({ dayStart: Math.max(0, Math.min(20, Number(e.target.value) || 0)) })} /></div>
        <div className="field grow"><label htmlFor="de">1日の終了(時)</label><input id="de" type="number" min={4} max={24} value={s.dayEnd} onChange={e => setSettings({ dayEnd: Math.max(4, Math.min(24, Number(e.target.value) || 24)) })} /></div></div>
    </section>
    <hr className="rule" />
    <section className="stack"><h2 className="sec-h">「今日」画面の部品</h2>
      <p className="small muted">並び順と表示/非表示を変えられます。拡張で追加した部品もここに並びます。</p>
      <div className="rows">{order.map((w, i) => <div className="order-row" key={w.id}>
        <label className="switch-row grow"><span>{w.title}</span><input className="switch" type="checkbox" checked={!s.todayHidden.includes(w.id)} onChange={() => toggle(w.id)} aria-label={w.title + 'を表示'} /></label>
        <button className="btn btn-quiet btn-sm" disabled={i === 0} onClick={() => move(w.id, -1)} aria-label={w.title + 'を上へ'}>↑</button>
        <button className="btn btn-quiet btn-sm" disabled={i === order.length - 1} onClick={() => move(w.id, 1)} aria-label={w.title + 'を下へ'}>↓</button>
      </div>)}</div>
    </section>
    <hr className="rule" />
    <section className="stack"><h2 className="sec-h">カスタムCSS</h2>
      <p className="small muted">レイヤーの外に置かれるため、スキンやトークンより必ず優先されます。変数の上書きが基本です(例: <code>:root{'{'}--r: 4px; --accent-base: #0ea5e9;{'}'}</code>)。使える変数は src/theme/tokens.css にあります。この端末だけの設定です。</p>
      <textarea className="css-ed" aria-label="カスタムCSS" spellCheck={false} value={s.customCss} onChange={e => setSettings({ customCss: e.target.value })} placeholder=":root { --r: 4px; }" />
    </section>
  </div>
}
