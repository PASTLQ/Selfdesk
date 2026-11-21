import { useSyncExternalStore } from 'react'
import { get, syncData, applyRemote, onLocalChange } from '../store'
import { readRemote, writeRemote, ConflictError, type GhCfg } from '../core/github'
import { mergeData, sig, emptyData } from '../core/merge'

export interface SyncStatus { state: 'off' | 'idle' | 'syncing' | 'error'; last?: number; msg?: string }
let status: SyncStatus = { state: 'off' }
const subs = new Set<() => void>()
const setStatus = (s: SyncStatus) => { status = s; subs.forEach(f => f()) }
export const useSyncStatus = () => useSyncExternalStore(cb => { subs.add(cb); return () => { subs.delete(cb) } }, () => status)

const cfg = (): GhCfg | null => { const s = get().settings; return s.ghToken && s.ghRepo ? { token: s.ghToken.trim(), repo: s.ghRepo.trim(), path: (s.ghPath || 'data.json').trim(), branch: s.ghBranch.trim() || undefined, api: localStorage.getItem('selfdesk.ghapi') || undefined } : null }
export const syncEnabled = () => !!cfg()
let running = false, again = false

export async function syncNow(): Promise<void> {
  const c = cfg(); if (!c) { setStatus({ state: 'off' }); return }
  if (running) { again = true; return }
  running = true; setStatus({ ...status, state: 'syncing', msg: undefined })
  try {
    for (let attempt = 0; attempt < 4; attempt++) {
      const remote = await readRemote(c)
      const local = syncData()
      const merged = remote ? mergeData(local, remote.data) : mergeData(emptyData(), local)
      if (sig(merged) !== sig(local)) applyRemote(merged)
      if (!remote || sig(merged) !== sig(remote.data)) {
        try { await writeRemote(c, merged, remote?.sha, 'SelfDesk: 同期'); } catch (e) { if (e instanceof ConflictError) continue; throw e }
      }
      setStatus({ state: 'idle', last: Date.now() }); break
    }
    if (status.state === 'syncing') throw new Error('他の端末の更新と競合し続けています。しばらくして再試行してください')
  } catch (e: any) { setStatus({ state: 'error', last: status.last, msg: e?.message || String(e) }) }
  finally { running = false; if (again) { again = false; setTimeout(syncNow, 500) } }
}

let debounce: number | undefined
export function startSync() {
  onLocalChange(() => { if (!syncEnabled()) return; clearTimeout(debounce); debounce = window.setTimeout(syncNow, 1500) })
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncNow() })
  window.addEventListener('online', () => syncNow())
  window.addEventListener('beforeunload', () => { /* 最後の変更は localStorage に残り、次回起動時に同期される */ })
  setInterval(() => { if (document.visibilityState === 'visible') syncNow() }, 45000)
  syncNow()
}
