import { useSyncExternalStore } from 'react'

/** どこからでも呼べる UI 状態(タスク詳細シート・コマンドパレット) */
function box<T>(init: T) {
  let v = init; const subs = new Set<() => void>()
  return {
    get: () => v,
    set: (n: T) => { if (n !== v) { v = n; subs.forEach(f => f()) } },
    use: () => useSyncExternalStore(f => { subs.add(f); return () => { subs.delete(f) } }, () => v),
  }
}
const task = box<string | null>(null); const pal = box(false)
export const openTask = (id: string | null) => task.set(id)
export const useOpenTask = task.use
export const setPalette = (open: boolean) => pal.set(open)
export const togglePalette = () => pal.set(!pal.get())
export const usePalette = pal.use
