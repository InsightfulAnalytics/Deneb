// Shared plumbing for the three P&L numeric gates (verify_spec.mjs, verify_classic.mjs,
// verify_monthly.mjs).
//
// A gate runs the TEMPLATE file itself, not a copy of the spec: it strips $schema and usermeta,
// replaces each __n__ token with a field name, feeds rows keyed by those names into the
// "dataset" data source and runs the view headless. The tokens are resolved twice:
//   - to the template's own field names (the names in sample-data.csv), and
//   - to deliberately awkward names with spaces and an ampersand,
// so a gate also proves that the alias block isolates the transform chain from whatever the
// user's fields are called.
//
// vega and vega-lite resolve from tools/node_modules (run `npm install` in tools/ once).
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const HERE = dirname(fileURLToPath(import.meta.url))
export const REPO = resolve(HERE, '..', '..')
export const vega = await import('vega')
export const vegaLite = await import('vega-lite')

// Deneb injects its own expression functions; vanilla Vega throws "Unrecognized function"
// on them, so stub them. Only the numbers are checked here, never the colours.
vega.expressionFunction('pbiColor', () => '#118DFF')
vega.expressionFunction('pbiFormat', (v) => String(v))
vega.expressionFunction('pbiFormatAutoUnit', (v) => String(v))
vega.expressionFunction('pbiPatternSVG', () => '')

const TOKEN = /__(\d+)__/g
const ALIAS = /^datum\['(__\d+__)'\]$/

export function templatePath(slug) {
  return join(REPO, 'templates', 'financial', slug, `${slug}.json`)
}

/** Load a template: its body (no $schema, no usermeta), dataset fields and alias block. */
export function loadTemplate(path) {
  const template = JSON.parse(readFileSync(path, 'utf8'))
  const { $schema, usermeta, ...body } = template
  const provider = usermeta.deneb.provider
  const steps = provider === 'vega'
    ? (body.data.find((d) => d.name === 'dataset').transform ?? []).map((t) => [t.expr, t.as])
    : (body.transform ?? []).map((t) => [t.calculate, t.as])
  const alias = new Map()          // token -> internal name
  for (const [expr, as] of steps) {
    const m = ALIAS.exec(expr ?? '')
    if (!m) break                   // the alias block is the leading run of copies
    alias.set(m[1], as)
  }
  const dataset = usermeta.dataset
  for (const f of dataset) {
    if (!alias.has(f.key)) throw new Error(`${path}: ${f.key} has no alias transform`)
  }
  return { body, dataset, provider, alias }
}

/** Field-name sets the gates run under: the template's own names, and awkward ones. */
export function nameSets(dataset) {
  return {
    'template field names': dataset.map((f) => f.name),
    'renamed fields': dataset.map((f, i) => `Field ${i} & ${f.name} (user)`),
  }
}

/** Replace every token with its name, working on the serialised body, as Deneb does. */
export function resolveTokens(body, dataset, names) {
  const byKey = Object.fromEntries(dataset.map((f, i) => [f.key, names[i]]))
  const text = JSON.stringify(body).replace(TOKEN, (token) =>
    byKey[token] === undefined ? token : JSON.stringify(byKey[token]).slice(1, -1))
  return JSON.parse(text)
}

/** Re-key rows from the spec's internal names to the given field names. */
export function rekey(rows, dataset, alias, names) {
  return rows.map((row) => {
    const out = {}
    dataset.forEach((f, i) => { out[names[i]] = row[alias.get(f.key)] })
    return out
  })
}

/** Build and run a headless view of a resolved spec over the rows. */
export async function runSpec(spec, provider, rows, size = { width: 1608, height: 740 }) {
  let vgSpec
  if (provider === 'vega') {
    vgSpec = JSON.parse(JSON.stringify(spec))
    vgSpec.data.find((d) => d.name === 'dataset').values = rows
    vgSpec.signals = [
      { name: 'pbiContainerWidth', value: size.width },
      { name: 'pbiContainerHeight', value: size.height },
      ...(vgSpec.signals ?? []),
    ]
  } else {
    const lite = { ...spec, data: { name: 'dataset', values: rows } }
    vgSpec = vegaLite.compile(lite).spec
  }
  const view = new vega.View(vega.parse(vgSpec), { renderer: 'none' })
  await view.runAsync()
  return { view, compiled: vgSpec }
}

/** Minimal CSV reader (quoted fields, BOM tolerated). Returns objects keyed by the header. */
export function readCsv(path) {
  const text = readFileSync(path, 'utf8').replace(/^\uFEFF/, '').trim()
  const split = (line) => {
    const out = []
    let cur = '', quoted = false
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (c === '"') {
        if (quoted && line[i + 1] === '"') { cur += '"'; i++ } else quoted = !quoted
      } else if (c === ',' && !quoted) { out.push(cur); cur = '' } else cur += c
    }
    out.push(cur)
    return out
  }
  const lines = text.split(/\r?\n/)
  const header = split(lines[0])
  return lines.slice(1).map((line) => {
    const cells = split(line)
    return Object.fromEntries(header.map((h, j) => [h, cells[j]]))
  })
}

/** Read the template's sample-data.csv and re-key it to the internal names. */
export function sampleRows(slug, dataset, alias) {
  const raw = readCsv(join(REPO, 'templates', 'financial', slug, 'sample-data.csv'))
  return raw.map((r) => {
    const out = {}
    for (const f of dataset) {
      const v = r[f.name]
      out[alias.get(f.key)] = f.type === 'numeric' ? (v === '' ? null : Number(v)) : v
    }
    return out
  })
}
