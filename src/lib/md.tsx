import type { ReactNode } from 'react'

function inline(s: string, wiki: (t: string) => void, key: string): ReactNode[] {
  const out: ReactNode[] = []; const re = /(\[\[[^\]]+\]\]|\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\)|\*[^*\s][^*]*\*)/g
  let last = 0, m: RegExpExecArray | null, i = 0
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index))
    const t = m[0], k = key + '-' + i++
    if (t.startsWith('[[')) { const n = t.slice(2, -2); out.push(<a key={k} className="wl" role="button" tabIndex={0} onClick={() => wiki(n)} onKeyDown={e => e.key === 'Enter' && wiki(n)}>{n}</a>) }
    else if (t.startsWith('**')) out.push(<strong key={k}>{t.slice(2, -2)}</strong>)
    else if (t.startsWith('`')) out.push(<code key={k}>{t.slice(1, -1)}</code>)
    else if (t.startsWith('[')) { const mm = t.match(/\[([^\]]+)\]\(([^)]+)\)/)!; const safe = /^(https?:|mailto:)/.test(mm[2]); out.push(safe ? <a key={k} href={mm[2]} target="_blank" rel="noreferrer noopener">{mm[1]}</a> : mm[1]) }
    else out.push(<em key={k}>{t.slice(1, -1)}</em>)
    last = m.index + t.length
  }
  if (last < s.length) out.push(s.slice(last)); return out
}

export function renderMd(src: string, wiki: (t: string) => void, toggle: (line: number) => void): ReactNode {
  const lines = src.split('\n'); const out: ReactNode[] = []; let i = 0
  while (i < lines.length) {
    const l = lines[i]
    if (l.startsWith('```')) { const buf: string[] = []; i++; while (i < lines.length && !lines[i].startsWith('```')) buf.push(lines[i++]); i++; out.push(<pre key={i}><code>{buf.join('\n')}</code></pre>); continue }
    const h = l.match(/^(#{1,3})\s+(.*)/)
    if (h) { const T = ('h' + h[1].length) as 'h1' | 'h2' | 'h3'; out.push(<T key={i}>{inline(h[2], wiki, 'h' + i)}</T>); i++; continue }
    if (/^---+$/.test(l.trim())) { out.push(<hr key={i} className="rule" />); i++; continue }
    if (l.startsWith('> ')) { out.push(<blockquote key={i}>{inline(l.slice(2), wiki, 'q' + i)}</blockquote>); i++; continue }
    if (/^\s*[-*]\s+/.test(l) || /^\s*\d+\.\s+/.test(l)) {
      const items: ReactNode[] = []; const start = i
      while (i < lines.length && (/^\s*[-*]\s+/.test(lines[i]) || /^\s*\d+\.\s+/.test(lines[i]))) {
        const ln = i, txt = lines[i].replace(/^\s*([-*]|\d+\.)\s+/, ''); const c = txt.match(/^\[( |x)\]\s+(.*)/)
        const depth = Math.floor((lines[i].match(/^ */)![0].length) / 2)
        items.push(c ? <li key={i} style={{ listStyle: 'none', marginLeft: depth * 16 - 20 }}><label><input type="checkbox" className="ck" checked={c[1] === 'x'} onChange={() => toggle(ln)} />{c[1] === 'x' ? <s className="muted">{inline(c[2], wiki, 'c' + i)}</s> : inline(c[2], wiki, 'c' + i)}</label></li> : <li key={i} style={{ marginLeft: depth * 16 }}>{inline(txt, wiki, 'l' + i)}</li>)
        i++
      }
      out.push(<ul key={'u' + start}>{items}</ul>); continue
    }
    if (!l.trim()) { i++; continue }
    const buf = [l]; i++
    while (i < lines.length && lines[i].trim() && !/^(#{1,3}\s|```|>\s|\s*[-*]\s|\s*\d+\.\s|---)/.test(lines[i])) buf.push(lines[i++])
    out.push(<p key={i}>{buf.map((b, j) => <span key={j}>{j > 0 && <br />}{inline(b, wiki, 'p' + i + j)}</span>)}</p>)
  }
  return out
}
