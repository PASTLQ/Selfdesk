import http from 'node:http'
/** GitHub Contents API の最小モック(1ファイル)。テスト用。 */
export function mockGithub(initial?: object) {
  let content = initial ? Buffer.from(JSON.stringify(initial)).toString('base64') : ''; let sha = initial ? 's1' : ''; let n = 1; let puts = 0
  const srv = http.createServer((rq, rs) => {
    const send = (c: number, b: unknown) => { rs.writeHead(c, { 'content-type': 'application/json' }); rs.end(JSON.stringify(b)) }
    if (rq.url!.startsWith('/repos/o/r/contents/') && rq.method === 'GET') return content ? send(200, { content, encoding: 'base64', sha }) : send(404, { message: 'Not Found' })
    if (rq.url === '/repos/o/r' && rq.method === 'GET') return send(200, {})
    if (rq.url!.startsWith('/repos/o/r/contents/') && rq.method === 'PUT') { let b = ''; rq.on('data', c => b += c); rq.on('end', () => { const j = JSON.parse(b); if (content && j.sha !== sha) return send(409, { message: 'conflict' }); content = j.content; sha = 's' + ++n; puts++; send(200, { content: { sha } }) }); return }
    send(404, {})
  })
  return new Promise<{ url: string; data: () => any; puts: () => number; close: () => void }>(res => srv.listen(0, () => res({ url: `http://127.0.0.1:${(srv.address() as any).port}`, data: () => JSON.parse(Buffer.from(content, 'base64').toString()), puts: () => puts, close: () => srv.close() })))
}
