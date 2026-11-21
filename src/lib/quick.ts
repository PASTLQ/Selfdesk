import type { Task } from '../types'
import { addDays, today, dow } from './date'

/** 「資料を作る !2 #仕事 @tag ~45m 明日」→ Task の素 */
export function parseQuick(input: string): Partial<Task> & { title: string } {
  let s = input.trim(); const out: Partial<Task> & { title: string } = { title: '' }
  const take = (re: RegExp, fn: (m: RegExpMatchArray) => void) => { const m = s.match(re); if (m) { fn(m); s = s.replace(m[0], ' ') } }
  take(/(?:^|\s)!([0-3])(?=\s|$)/, m => { out.priority = Number(m[1]) as Task['priority'] })
  take(/(?:^|\s)#(\S+)/, m => { out.project = m[1] })
  const tags: string[] = []; let m: RegExpMatchArray | null
  while ((m = s.match(/(?:^|\s)@(\S+)/))) { tags.push(m[1]); s = s.replace(m[0], ' ') }
  if (tags.length) out.tags = tags
  take(/(?:^|\s)~(\d+)(h|m|時間|分)?(?=\s|$)/, mm => { const n = Number(mm[1]); out.est = mm[2] === 'h' || mm[2] === '時間' ? n * 60 : n })
  const t = today()
  take(/(?:^|\s)(今日|明日|明後日|来週|毎日|毎週)(?=\s|$)/, mm => {
    if (mm[1] === '今日') out.due = t; else if (mm[1] === '明日') out.due = addDays(t, 1); else if (mm[1] === '明後日') out.due = addDays(t, 2)
    else if (mm[1] === '来週') out.due = addDays(t, 7 - ((dow(t) + 6) % 7))
    else { out.due = t; out.repeat = mm[1] === '毎日' ? 'daily' : 'weekly' }
  })
  take(/(?:^|\s)(\d{1,2})\/(\d{1,2})(?=\s|$)/, mm => { const y = new Date().getFullYear(); out.due = `${y}-${String(mm[1]).padStart(2, '0')}-${String(mm[2]).padStart(2, '0')}` })
  out.title = s.replace(/\s+/g, ' ').trim()
  return out
}
