#!/usr/bin/env node
/**
 * PROTOTYPE, throwaway (KAN-41). Contact sheet of every candidate: the four band variants at
 * 300 x 90, then the template sample, the alternative setting and Report Hacker's sample at
 * 400 x 220. Headless Vega with the BI Nexus theme, the same stubs as tools/check-templates.mjs.
 *
 *   node prototype/kpi-templates/sheet.mjs            writes contact-sheet.png and out/<slug>.png
 *   node prototype/kpi-templates/sheet.mjs --only kpi-delta-tile
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { denebRows, registerDeneb, resolveTemplate, toVega, useSegoeWidths } from './prepare.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = join(HERE, '..', '..')
const require = createRequire(join(REPO, 'tools', 'package.json'))
const load = (name) => import(pathToFileURL(require.resolve(name)).href)
const vega = await load('vega')
const vl = await load('vega-lite')
const sharp = (await load('sharp')).default

const SCALE = 2
const GAP = 14
const BAND = { width: 300, height: 90 }
const CELL = { width: 400, height: 220 }
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null

registerDeneb(vega, JSON.parse(readFileSync(join(REPO, 'showcase', 'theme', 'bi-nexus.json'), 'utf8')))
useSegoeWidths(vega, JSON.parse(readFileSync(join(HERE, 'segoe-widths.json'), 'utf8')))
const manifest = JSON.parse(readFileSync(join(HERE, 'manifest.json'), 'utf8')).filter((t) => !only || t.slug === only)

const esc = (s) => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

async function render(template, entry, rows, size, opts = {}) {
  const lite = resolveTemplate(template, entry.params ?? {})
  const { vg, logs } = toVega(vl, lite, size.width, size.height)
  const view = new vega.View(vega.parse(vg), { renderer: 'none' })
  const vlogs = []
  view.logger({
    level() { return this }, error: (...m) => vlogs.push('error: ' + m.join(' ')),
    warn: (...m) => vlogs.push('warn: ' + m.join(' ')), info() {}, debug() {},
  })
  view.data('dataset', denebRows(rows, template.usermeta.dataset, opts))
  await view.runAsync()
  const svg = await view.toSVG()
  view.finalize()
  const png = await sharp(Buffer.from(svg), { density: 72 * SCALE }).png().toBuffer()
  return { png, logs: [...logs, ...vlogs] }
}

async function sheetFor(t) {
  const template = JSON.parse(readFileSync(join(HERE, t.file), 'utf8'))
  const panels = []
  t.band.forEach((b, i) => panels.push({ label: b.label, entry: b, rows: b.rows, size: BAND, x: i * (BAND.width + GAP), y: 0 }))
  const cells = [
    { label: 'Template sample', entry: { params: {} }, rows: t.sample },
    { label: `Option: ${t.alt.label}`, entry: t.alt, rows: t.alt.rows },
  ]
  if (t.rh) cells.push({ label: 'Report Hacker sample', entry: { params: {} }, rows: t.rh, keepStrings: true })
  cells.forEach((c, i) => panels.push({ ...c, size: CELL, x: i * (CELL.width + GAP), y: BAND.height + 28 }))
  const width = Math.max(4 * BAND.width + 3 * GAP, 3 * CELL.width + 2 * GAP)
  const height = BAND.height + 28 + CELL.height + 22
  const layers = []
  const labels = []
  for (const p of panels) {
    const { png, logs } = await render(template, p.entry, p.rows, p.size, { keepStrings: p.keepStrings })
    for (const line of logs) console.log(`  ${t.slug} [${p.label}] ${line}`)
    layers.push({ input: png, left: p.x * SCALE, top: p.y * SCALE })
    labels.push(`<text x="${p.x}" y="${p.y + p.size.height + 15}" font-family="Segoe UI" font-size="11" fill="#605E5C">${esc(p.label)}</text>`)
  }
  const overlay = `<svg xmlns="http://www.w3.org/2000/svg" width="${width * SCALE}" height="${height * SCALE}"><g transform="scale(${SCALE})">${labels.join('')}</g></svg>`
  layers.push({ input: Buffer.from(overlay), left: 0, top: 0 })
  const png = await sharp({ create: { width: width * SCALE, height: height * SCALE, channels: 4, background: '#F3F2F1' } }).composite(layers).png().toBuffer()
  return { png, width, height }
}

mkdirSync(join(HERE, 'out'), { recursive: true })
const parts = []
for (const t of manifest) {
  const sheet = await sheetFor(t)
  writeFileSync(join(HERE, 'out', `${t.slug}.png`), sheet.png)
  parts.push({ ...sheet, name: t.name })
  console.log(`rendered ${t.slug}`)
}

if (!only) {
  const MARGIN = 24
  const TITLE = 34
  const width = Math.max(...parts.map((p) => p.width)) + 2 * MARGIN
  const height = parts.reduce((h, p) => h + TITLE + p.height + 18, MARGIN)
  const layers = []
  const titles = []
  let y = MARGIN
  for (const [i, p] of parts.entries()) {
    titles.push(`<text x="${MARGIN}" y="${y + 22}" font-family="Segoe UI" font-size="17" font-weight="600" fill="#252423">${i + 1}. ${esc(p.name)}</text>`)
    layers.push({ input: p.png, left: MARGIN * SCALE, top: (y + TITLE) * SCALE })
    y += TITLE + p.height + 18
  }
  const overlay = `<svg xmlns="http://www.w3.org/2000/svg" width="${width * SCALE}" height="${height * SCALE}"><g transform="scale(${SCALE})">${titles.join('')}</g></svg>`
  layers.push({ input: Buffer.from(overlay), left: 0, top: 0 })
  await sharp({ create: { width: width * SCALE, height: height * SCALE, channels: 4, background: '#F3F2F1' } })
    .composite(layers).png().toFile(join(HERE, 'contact-sheet.png'))
  console.log(`contact-sheet.png ${width * SCALE} x ${height * SCALE}`)
}
