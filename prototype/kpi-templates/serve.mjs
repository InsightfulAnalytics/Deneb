#!/usr/bin/env node
/**
 * PROTOTYPE, throwaway (KAN-41). Serves the repo root so the viewer can read the templates, the
 * theme and tools/node_modules. `npm run prototype` in tools/ builds, then runs this.
 */
import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { dirname, extname, join, normalize, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const PORT = Number(process.env.PORT ?? 4177)
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.css': 'text/css' }

createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname)
  let file = normalize(join(ROOT, path))
  if (!file.startsWith(ROOT + sep) && file !== ROOT) return res.writeHead(403).end()
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html')
  if (!existsSync(file)) return res.writeHead(404).end('not found')
  res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' })
  createReadStream(file).pipe(res)
}).listen(PORT, () => console.log(`KPI template prototypes: http://localhost:${PORT}/prototype/kpi-templates/`))
