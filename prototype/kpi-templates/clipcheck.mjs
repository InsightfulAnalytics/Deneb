#!/usr/bin/env node
/**
 * PROTOTYPE, throwaway (KAN-41). A Deneb container clips its marks, so ink outside it is lost
 * without a word. Re-render every panel the sheet draws with 24 px of padding and autosize none:
 * Vega does not clip the root group, so any ink in that margin is a mark the container would cut.
 */
import { readFileSync } from 'node:fs'
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
const PAD = 24

registerDeneb(vega, JSON.parse(readFileSync(join(REPO, 'showcase', 'theme', 'bi-nexus.json'), 'utf8')))
useSegoeWidths(vega, JSON.parse(readFileSync(join(HERE, 'segoe-widths.json'), 'utf8')))
const manifest = JSON.parse(readFileSync(join(HERE, 'manifest.json'), 'utf8'))
const sizes = [{ width: 300, height: 90 }, { width: 400, height: 220 }, { width: 640, height: 360 }, { width: 220, height: 120 }]

let bad = 0
for (const t of manifest) {
  const template = JSON.parse(readFileSync(join(HERE, t.file), 'utf8'))
  const cases = [['sample', {}, t.sample, false], ...t.band.map((b) => [b.label, b.params, b.rows, false]), ['alt', t.alt.params, t.alt.rows, false]]
  if (t.rh) cases.push(['report hacker', {}, t.rh, true])
  for (const size of sizes) {
    for (const [label, params, rows, keepStrings] of cases) {
      const { vg } = toVega(vl, resolveTemplate(template, params), size.width, size.height)
      vg.autosize = 'none'
      vg.padding = PAD
      const view = new vega.View(vega.parse(vg), { renderer: 'none' })
      view.logger({ level() { return this }, error() {}, warn() {}, info() {}, debug() {} })
      view.data('dataset', denebRows(rows, template.usermeta.dataset, { keepStrings }))
      await view.runAsync()
      const svg = await view.toSVG()
      view.finalize()
      const { data, info } = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
      let ink = 0
      const where = []
      for (let y = 0; y < info.height; y++) {
        for (let x = 0; x < info.width; x++) {
          const inside = x >= PAD - 1 && x <= PAD + size.width && y >= PAD - 1 && y <= PAD + size.height
          if (inside) continue
          if (data[(y * info.width + x) * 4 + 3] > 40) {
            ink++
            if (where.length < 3) where.push(`${x - PAD},${y - PAD}`)
          }
        }
      }
      if (ink > 0) {
        bad++
        console.log(`CLIP  ${t.slug} ${size.width}x${size.height} [${label}] ${ink} px outside, e.g. ${where.join(' ')}`)
      }
    }
  }
}
console.log(bad ? `${bad} renders put ink outside the container` : 'no ink outside the container')
