import type { Ev, Task } from '../types'
import { dstr, parse, pad, addDays } from './date'
import { get, patchTask, patchEvent, setGEvents, set } from '../store'

/* Google Identity Services (token flow) + Calendar REST API。OAuth クライアントIDは設定画面で入力。 */
declare global { interface Window { google?: any } }
const SCOPE = 'https://www.googleapis.com/auth/calendar.events'
const TS = 'selfdesk.gtoken'
let token = '', exp = 0
try { const r = JSON.parse(sessionStorage.getItem(TS) || 'null'); if (r && r.exp > Date.now()) { token = r.token; exp = r.exp } } catch { /* */ }
export const isConnected = () => !!token && Date.now() < exp - 30000
export const tz = () => Intl.DateTimeFormat().resolvedOptions().timeZone

function loadGIS(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  return new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true
    s.onload = () => res(); s.onerror = () => rej(new Error('Google のスクリプトを読み込めませんでした(ネットワークを確認してください)'))
    document.head.appendChild(s)
  })
}
export async function connect(): Promise<void> {
  const cid = get().settings.gClientId.trim(); if (!cid) throw new Error('OAuth クライアントIDを設定してください')
  await loadGIS()
  await new Promise<void>((res, rej) => {
    const c = window.google.accounts.oauth2.initTokenClient({
      client_id: cid, scope: SCOPE,
      callback: (r: any) => { if (r.error) return rej(new Error(r.error_description || r.error)); token = r.access_token; exp = Date.now() + (Number(r.expires_in) || 3600) * 1000; try { sessionStorage.setItem(TS, JSON.stringify({ token, exp })) } catch { /* */ } res() },
      error_callback: (e: any) => rej(new Error(e?.message || e?.type || '認可に失敗しました')),
    })
    c.requestAccessToken({ prompt: '' })
  })
}
export function disconnect() { token = ''; exp = 0; sessionStorage.removeItem(TS); setGEvents([]) }

async function api(path: string, init: RequestInit = {}) {
  if (!isConnected()) await connect()
  const r = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/' + path, { ...init, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', ...(init.headers || {}) } })
  if (r.status === 204) return null
  const j = await r.json().catch(() => ({}))
  if (!r.ok) { if (r.status === 401) { token = ''; exp = 0 } throw new Error(j?.error?.message || `Google API error ${r.status}`) }
  return j
}
const body = (e: { title: string; date: string; start: number; dur: number; allDay?: boolean; place?: string }) => {
  if (e.allDay) return { summary: e.title, location: e.place, start: { date: e.date }, end: { date: addDays(e.date, 1) } }
  const iso = (d: string, m: number) => { const dd = parse(d); dd.setMinutes(m); return `${dstr(dd)}T${pad(dd.getHours())}:${pad(dd.getMinutes())}:00` }
  return { summary: e.title, location: e.place, start: { dateTime: iso(e.date, e.start), timeZone: tz() }, end: { dateTime: iso(e.date, e.start + e.dur), timeZone: tz() } }
}
const fromG = (g: any): Ev | null => {
  if (g.status === 'cancelled') return null
  if (g.start?.date) return { id: 'g_' + g.id, gid: g.id, title: g.summary || '(無題)', date: g.start.date, start: 0, dur: 60, allDay: true, source: 'google', place: g.location }
  if (!g.start?.dateTime) return null
  const s = new Date(g.start.dateTime), e = new Date(g.end.dateTime)
  const start = s.getHours() * 60 + s.getMinutes(); const dur = Math.max(15, Math.min(Math.round((e.getTime() - s.getTime()) / 60000), 1440 - start))
  return { id: 'g_' + g.id, gid: g.id, title: g.summary || '(無題)', date: dstr(s), start, dur, source: 'google', place: g.location }
}
export async function fetchRange(from: string, to: string): Promise<number> {
  const q = new URLSearchParams({ timeMin: new Date(from + 'T00:00:00').toISOString(), timeMax: new Date(addDays(to, 1) + 'T00:00:00').toISOString(), singleEvents: 'true', orderBy: 'startTime', maxResults: '500' })
  const j = await api('events?' + q)
  const mine = new Set(get().tasks.map(t => t.block?.gid).filter(Boolean)); const mineE = new Set(get().events.map(e => e.gid).filter(Boolean))
  const list = (j.items as any[]).filter(g => !mine.has(g.id) && !mineE.has(g.id)).map(fromG).filter((x): x is Ev => !!x)
  set(s => ({ ...s, gEvents: [...s.gEvents.filter(e => e.date < from || e.date > to), ...list] }))
  return list.length
}
export async function createEvent(e: Ev): Promise<string> { const j = await api('events', { method: 'POST', body: JSON.stringify(body(e)) }); return j.id }
export async function updateEvent(gid: string, e: Parameters<typeof body>[0]) { await api('events/' + gid, { method: 'PATCH', body: JSON.stringify(body(e)) }) }
export async function removeEvent(gid: string) { await api('events/' + gid, { method: 'DELETE' }) }

export async function pushLocalEvent(id: string) {
  const e = get().events.find(x => x.id === id); if (!e) return
  if (e.gid) await updateEvent(e.gid, e); else patchEvent(id, { gid: await createEvent(e) })
}
export async function pushBlock(t: Task) {
  if (!t.block) return
  const ev = { title: '▪ ' + t.title, date: t.block.date, start: t.block.start, dur: t.block.dur }
  if (t.block.gid) await updateEvent(t.block.gid, ev)
  else { const gid = await api('events', { method: 'POST', body: JSON.stringify(body(ev)) }).then(j => j.id as string); patchTask(t.id, { block: { ...t.block, gid } }) }
}
export const autoPushBlock = (id: string) => { const t = get().tasks.find(x => x.id === id); if (t?.block && get().settings.gSync && isConnected()) pushBlock(t).catch(console.warn) }
