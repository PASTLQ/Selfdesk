export const pad = (n: number) => String(n).padStart(2, '0')
export const dstr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const parse = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
export const today = () => dstr(new Date())
export const addDays = (s: string, n: number) => { const d = parse(s); d.setDate(d.getDate() + n); return dstr(d) }
export const addMonths = (s: string, n: number) => { const d = parse(s); d.setDate(1); d.setMonth(d.getMonth() + n); return dstr(d) }
export const weekStart = (s: string) => { const d = parse(s); const w = (d.getDay() + 6) % 7; d.setDate(d.getDate() - w); return dstr(d) }
export const dow = (s: string) => parse(s).getDay()
export const JA = ['日', '月', '火', '水', '木', '金', '土']
export const fmtDate = (s: string) => { const d = parse(s); return `${d.getMonth() + 1}月${d.getDate()}日(${JA[d.getDay()]})` }
export const fmtShort = (s: string) => { const d = parse(s); return `${d.getMonth() + 1}/${d.getDate()}` }
export const hm = (m: number) => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`
export const fromHm = (s: string) => { const [h, m] = s.split(':').map(Number); return h * 60 + (m || 0) }
export const durLabel = (m: number) => m >= 60 ? `${Math.floor(m / 60)}時間${m % 60 ? m % 60 + '分' : ''}` : `${m}分`
export const monthGrid = (s: string) => {
  const first = parse(s); first.setDate(1)
  const start = weekStart(dstr(first)); return Array.from({ length: 42 }, (_, i) => addDays(start, i))
}
export const isoWeekKey = (s: string) => `W${weekStart(s)}`
export const daysBetween = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / 864e5)
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
