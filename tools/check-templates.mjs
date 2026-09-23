#!/usr/bin/env node
/**
 * Check the Deneb templates in this repo, and optionally render each one to SVG.
 *
 *   node tools/check-templates.mjs                       every template under templates/
 *   node tools/check-templates.mjs templates/kpi/foo     one folder (or a template .json)
 *   node tools/check-templates.mjs --render out          also write out/<slug>.svg and .png (--scale 2)
 *   node tools/check-templates.mjs --theme showcase/theme.json --render out
 *
 * A template lives at templates/<category>/<slug>/<slug>.json, beside a sample-data.csv whose
 * header row is the template's dataset field names. An optional render.json in the same folder,
 * {"width": 1600, "height": 740}, sets the container size used for the render (default 600x400).
 *
 * What is checked, per template:
 *   - the file is strict JSON, and nothing in the folder contains an em or en dash
 *   - $schema is Vega or Vega-Lite v6 and agrees with usermeta.deneb.provider
 *   - usermeta validates against Deneb's v1 template schema (tools/schema/), with keys
 *     __0__, __1__, ... in order, unique names, and an interactivity block
 *   - every __n__ token in the body is declared, and every declared token is used
 *   - no dot access to a token (datum.__0__ breaks once the token becomes a name with a space)
 *   - the spec reads the dataset named "dataset" and never references denebContainer,
 *     which Deneb 1.9 cannot parse
 *   - the file is under 400 KB, Background Designer's bundle cap
 *   - sample-data.csv has exactly the declared field names as its header
 *   - with the tokens replaced by those names, the spec compiles and a headless Vega view
 *     runs over the sample rows without an error
 *
 * Deneb's expression functions are stubbed: pbiColor reads the theme given with --theme (or the
 * Power BI default palette), pbiFormat is a rough approximation. Check number formatting in
 * Desktop, not here. Exit code 1 when any template has an error; warnings never fail the run.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..')
const MAX_BYTES = 400 * 1024
const TOKEN = /__(\d+)__/g
const DASHES = /[\u2013\u2014]/

// ---------------------------------------------------------------- arguments

const args = process.argv.slice(2)
const opt = (name) => {
  const i = args.indexOf(name)
  if (i === -1) return undefined
  const value = args[i + 1]
  args.splice(i, 2)
  return value
}
const renderDir = opt('--render')
const themePath = opt('--theme')
const defaultWidth = Number(opt('--width') ?? 600)
const defaultHeight = Number(opt('--height') ?? 400)
const renderScale = Number(opt('--scale') ?? 2)

const vega = await import('vega')
const vl = await import('vega-lite')
const Ajv = (await import('ajv')).default
const addFormats = (await import('ajv-formats')).default

// ---------------------------------------------------------------- theme and Deneb stubs

const POWER_BI_DEFAULT = {
  dataColors: ['#118DFF', '#12239E', '#E66C37', '#6B007B', '#E044A7', '#744EC2', '#D9B300', '#D64550'],
  good: '#1AAB40', bad: '#D64554', neutral: '#D9B300',
  minimum: '#118DFF', center: '#D9B300', maximum: '#D64550',
}
const theme = themePath ? { ...POWER_BI_DEFAULT, ...JSON.parse(readFileSync(themePath, 'utf8')) } : POWER_BI_DEFAULT

function shade(hex, pct) {
  const n = parseInt(hex.slice(1), 16)
  const channels = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  const out = channels.map((c) => Math.round(pct >= 0 ? c + (255 - c) * pct : c * (1 + pct)))
  return '#' + out.map((c) => Math.max(0, Math.min(255, c)).toString(16).padStart(2, '0')).join('')
}

function pbiColor(which, pct = 0) {
  const named = {
    good: theme.good, positive: theme.good, bad: theme.bad, negative: theme.bad,
    neutral: theme.neutral, min: theme.minimum, middle: theme.center, max: theme.maximum,
  }
  let base
  if (typeof which === 'number') base = theme.dataColors[which % theme.dataColors.length]
  else base = named[which] ?? theme.dataColors[1 % theme.dataColors.length]
  return pct ? shade(base, pct) : base
}

function pbiFormat(value, format) {
  if (value === null || value === undefined || Number.isNaN(value)) return ''
  const fmt = typeof format === 'string' ? format.split(';')[0] : ''
  const decimals = (fmt.split('.')[1] ?? '').replace(/[^0#]/g, '').length
  if (fmt.includes('%')) return (value * 100).toFixed(decimals) + '%'
  const text = Number(value).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
  return fmt.includes('$') ? '$' + text : text
}

vega.expressionFunction('pbiColor', pbiColor)
vega.expressionFunction('pbiFormat', pbiFormat)
vega.expressionFunction('pbiFormatAutoUnit', pbiFormat)
vega.expressionFunction('pbiPatternSVG', (_pattern, fg) => fg ?? '#000000')
vega.expressionFunction('pbiCrossFilterApply', () => null)
vega.expressionFunction('pbiCrossFilterClear', () => null)
vega.scheme('pbiColorNominal', theme.dataColors)
vega.scheme('pbiColorOrdinal', theme.dataColors)
vega.scheme('pbiColorLinear', [theme.minimum, theme.maximum])
vega.scheme('pbiColorDivergent', [theme.minimum, theme.center, theme.maximum])

// ---------------------------------------------------------------- schema

const ajv = new Ajv({ allErrors: true, strict: false })
addFormats(ajv)
const validateUsermeta = ajv.compile(JSON.parse(readFileSync(join(HERE, 'schema', 'deneb-template-usermeta-v1.json'), 'utf8')))

// ---------------------------------------------------------------- helpers

function findTemplates(targets) {
  const found = []
  const visit = (path) => {
    const stat = statSync(path)
    if (stat.isFile()) {
      if (path.endsWith('.json') && basename(path, '.json') === basename(dirname(path))) found.push(path)
      return
    }
    for (const entry of readdirSync(path)) {
      if (entry === 'node_modules' || entry.startsWith('.')) continue
      visit(join(path, entry))
    }
  }
  for (const target of targets) visit(resolve(target))
  return found.sort()
}

function parseCsv(text) {
  const rows = []
  let row = [], field = '', quoted = false
  const clean = text.replace(/^\uFEFF/, '')
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i]
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') { field += '"'; i++ }
      else if (ch === '"') quoted = false
      else field += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') { row.push(field); field = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && clean[i + 1] === '\n') i++
      row.push(field); field = ''
      if (row.length > 1 || row[0] !== '') rows.push(row)
      row = []
    } else field += ch
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row) }
  return rows
}

function coerce(raw, type) {
  if (raw === '') return null
  switch (type) {
    case 'numeric': return Number(raw)
    case 'dateTime': return new Date(raw.length === 10 ? raw + 'T00:00:00' : raw)
    case 'bool': return /^(true|1|yes)$/i.test(raw)
    default: return raw
  }
}

function withoutUsermeta(template) {
  const { $schema, usermeta, ...body } = template
  return body
}

/** Replace every __n__ token with its field name, working on the serialised body. */
function resolveTokens(body, dataset) {
  const names = Object.fromEntries(dataset.map((f) => [f.key, f.name]))
  const text = JSON.stringify(body).replace(TOKEN, (token) => {
    const name = names[token]
    if (name === undefined) return token
    return JSON.stringify(name).slice(1, -1)
  })
  return JSON.parse(text)
}

function referencesSignal(text, name) {
  return new RegExp(`\\b${name}\\b`).test(text)
}

// ---------------------------------------------------------------- one template

async function checkTemplate(file, seenUuids) {
  const errors = [], warnings = []
  const folder = dirname(file)
  const slug = basename(folder)
  const raw = readFileSync(file, 'utf8')

  for (const entry of readdirSync(folder)) {
    if (!/\.(json|csv|md|txt|py|mjs|dax)$/i.test(entry)) continue
    const content = readFileSync(join(folder, entry), 'utf8')
    if (DASHES.test(content)) errors.push(`${entry} contains an em or en dash`)
  }

  let template
  try { template = JSON.parse(raw) } catch (e) { errors.push(`not strict JSON: ${e.message}`); return { slug, errors, warnings } }

  const bytes = Buffer.byteLength(raw, 'utf8')
  if (bytes > MAX_BYTES) errors.push(`${Math.round(bytes / 1024)} KB, over the 400 KB bundle cap`)

  const schema = template.$schema ?? ''
  const isLite = /vega-lite\/v6/.test(schema)
  const isVega = /schema\/vega\/v6/.test(schema)
  if (!isLite && !isVega) errors.push(`$schema must be Vega or Vega-Lite v6, found "${schema}"`)

  const meta = template.usermeta
  if (!meta) { errors.push('no usermeta block'); return { slug, errors, warnings } }
  if (!validateUsermeta(meta)) {
    for (const e of validateUsermeta.errors) errors.push(`usermeta${e.instancePath} ${e.message}`)
  }
  const provider = meta.deneb?.provider
  if (isLite && provider !== 'vegaLite') errors.push('provider must be vegaLite for a Vega-Lite $schema')
  if (isVega && provider !== 'vega') errors.push('provider must be vega for a Vega $schema')
  if (!meta.interactivity) errors.push('usermeta.interactivity is missing')
  if (!meta.information?.description) errors.push('usermeta.information.description is empty')
  const author = meta.information?.author ?? ''
  if (!author.startsWith('Timothy Osborn')) warnings.push(`author "${author}" does not start with "Timothy Osborn"`)
  const uuid = meta.information?.uuid
  if (uuid && seenUuids.has(uuid)) errors.push(`uuid ${uuid} is also used by ${seenUuids.get(uuid)}`)
  if (uuid) seenUuids.set(uuid, slug)
  const preview = meta.information?.previewImageBase64PNG
  if (preview !== undefined && !preview.startsWith('data:image/png;base64,')) {
    errors.push('previewImageBase64PNG must start with data:image/png;base64,')
  }

  const dataset = Array.isArray(meta.dataset) ? meta.dataset : []
  dataset.forEach((field, i) => {
    if (field.key !== `__${i}__`) errors.push(`dataset[${i}] key is ${field.key}, expected __${i}__`)
  })
  const names = dataset.map((f) => f.name)
  if (new Set(names).size !== names.length) errors.push('dataset names are not unique')

  const body = withoutUsermeta(template)
  const bodyText = JSON.stringify(body)
  const used = new Set([...bodyText.matchAll(TOKEN)].map((m) => m[0]))
  const declared = new Set(dataset.map((f) => f.key))
  for (const token of used) if (!declared.has(token)) errors.push(`${token} is used in the spec but not declared`)
  for (const token of declared) if (!used.has(token)) errors.push(`${token} is declared but never used`)
  if (/datum\.__\d+__/.test(bodyText)) errors.push('dot access to a token (datum.__n__); use datum[\'__n__\']')
  if (referencesSignal(bodyText, 'denebContainer')) errors.push('references denebContainer, which Deneb 1.9 cannot parse')

  const readsDataset = isLite
    ? body.data?.name === 'dataset' || /"name":"dataset"/.test(bodyText)
    : Array.isArray(body.data) && body.data.some((d) => d.name === 'dataset')
  if (!readsDataset) errors.push('the spec never reads the dataset named "dataset"')
  if (isLite && (typeof body.width === 'number' || typeof body.height === 'number')) {
    warnings.push('a literal width/height fights Deneb autosize; leave the spec size-free')
  }

  // sample data
  const csvPath = join(folder, 'sample-data.csv')
  let rows = []
  if (!existsSync(csvPath)) errors.push('sample-data.csv is missing')
  else {
    const csv = parseCsv(readFileSync(csvPath, 'utf8'))
    const header = csv[0] ?? []
    const missing = names.filter((n) => !header.includes(n))
    const extra = header.filter((h) => !names.includes(h))
    if (missing.length) errors.push(`sample-data.csv lacks ${missing.join(', ')}`)
    if (extra.length) errors.push(`sample-data.csv has undeclared columns ${extra.join(', ')}`)
    const types = Object.fromEntries(dataset.map((f) => [f.name, f.type]))
    rows = csv.slice(1).map((cells, i) => {
      const row = Object.fromEntries(header.map((h, j) => [h, coerce(cells[j] ?? '', types[h])]))
      row.__row__ = i
      return row
    })
    const kb = statSync(csvPath).size / 1024
    if (kb > 50) warnings.push(`sample-data.csv is ${Math.round(kb)} KB; keep it to the rows the visual receives`)
  }
  if (!existsSync(join(folder, 'README.md'))) warnings.push('README.md is missing')
  if (errors.length) return { slug, errors, warnings }

  // compile and run
  const sizePath = join(folder, 'render.json')
  const size = existsSync(sizePath) ? JSON.parse(readFileSync(sizePath, 'utf8')) : {}
  const width = size.width ?? defaultWidth
  const height = size.height ?? defaultHeight
  let spec = resolveTokens(body, dataset)
  try {
    if (isLite) {
      const single = !['hconcat', 'vconcat', 'concat', 'facet', 'repeat'].some((k) => k in spec)
      if (single) {
        if (spec.width === undefined || spec.width === 'container') spec.width = width
        if (spec.height === undefined || spec.height === 'container') spec.height = height
      }
      spec.config = { ...(spec.config ?? {}), customFormatTypes: true }
      const logs = []
      const logger = {
        level() { return this }, error: (...m) => logs.push(['error', m.join(' ')]),
        warn: (...m) => logs.push(['warn', m.join(' ')]), info() {}, debug() {},
      }
      spec = vl.compile(spec, { logger }).spec
      for (const [level, message] of logs) (level === 'error' ? errors : warnings).push(`vega-lite: ${message}`)
    } else {
      if (spec.width === undefined) spec.width = width
      if (spec.height === undefined) spec.height = height
    }
    const text = JSON.stringify(spec)
    const injected = []
    const defined = new Set((spec.signals ?? []).map((s) => s.name))
    if (referencesSignal(text, 'pbiContainerWidth') && !defined.has('pbiContainerWidth')) injected.push({ name: 'pbiContainerWidth', value: width })
    if (referencesSignal(text, 'pbiContainerHeight') && !defined.has('pbiContainerHeight')) injected.push({ name: 'pbiContainerHeight', value: height })
    if (/\bpbiContainer\b(?!Width|Height)/.test(text) && !defined.has('pbiContainer')) injected.push({ name: 'pbiContainer', value: { width, height } })
    spec.signals = [...injected, ...(spec.signals ?? [])]

    const vegaLogs = []
    const view = new vega.View(vega.parse(spec), { renderer: 'none' })
    view.logger({
      level() { return this }, error: (...m) => vegaLogs.push(['error', m.join(' ')]),
      warn: (...m) => vegaLogs.push(['warn', m.join(' ')]), info() {}, debug() {},
    })
    view.data('dataset', rows)
    await view.runAsync()
    for (const [level, message] of vegaLogs) (level === 'error' ? errors : warnings).push(`vega: ${message}`)
    if (renderDir) {
      mkdirSync(renderDir, { recursive: true })
      const svg = await view.toSVG()
      writeFileSync(join(renderDir, `${slug}.svg`), svg)
      const sharp = (await import('sharp')).default
      await sharp(Buffer.from(svg), { density: 72 * renderScale }).png().toFile(join(renderDir, `${slug}.png`))
    }
    view.finalize()
  } catch (e) {
    errors.push(`render failed: ${e.message}`)
  }
  return { slug, errors, warnings }
}

// ---------------------------------------------------------------- run

const targets = args.length ? args : [join(REPO, 'templates')]
const files = findTemplates(targets)
if (!files.length) {
  console.error('no templates found (expected templates/<category>/<slug>/<slug>.json)')
  process.exit(1)
}
const seenUuids = new Map()
let failed = 0
for (const file of files) {
  const { slug, errors, warnings } = await checkTemplate(file, seenUuids)
  const where = relative(REPO, file).replaceAll('\\', '/')
  console.log(`${errors.length ? 'FAIL' : 'ok  '}  ${where}`)
  for (const e of errors) console.log(`        error: ${e}`)
  for (const w of warnings) console.log(`        warn:  ${w}`)
  if (errors.length) failed++
}
console.log(`\n${files.length - failed}/${files.length} templates pass`)
process.exit(failed ? 1 : 0)
