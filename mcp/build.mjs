import { build } from 'esbuild'
await build({
  entryPoints: ['src/stdio.ts'], bundle: true, platform: 'node', format: 'esm', target: 'node18', outfile: 'dist/selfdesk-mcp.mjs',
  banner: { js: "#!/usr/bin/env node\nimport { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);" }, minify: false, legalComments: 'none',
})
console.log('built dist/selfdesk-mcp.mjs')
