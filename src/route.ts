import { useSyncExternalStore } from 'react'

/** ハッシュルーティング: #/<view>/<param>  例 #/notes/abc123 */
const parse = () => { const [id = '', ...rest] = location.hash.replace(/^#\/?/, '').split('/'); return { id, param: rest.join('/') || undefined } }
let cur = parse(); let key = location.hash
const subs = new Set<() => void>()
window.addEventListener('hashchange', () => { if (location.hash !== key) { key = location.hash; cur = parse(); subs.forEach(f => f()) } })
export const useRoute = () => useSyncExternalStore(f => { subs.add(f); return () => { subs.delete(f) } }, () => cur)
/** 画面遷移。go('tasks') / go('notes/<id>') */
export const go = (path: string) => { location.hash = '#/' + path.replace(/^\/+/, '') }
