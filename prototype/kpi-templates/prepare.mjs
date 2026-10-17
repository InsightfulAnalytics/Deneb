/**
 * PROTOTYPE, throwaway (KAN-41). Turns a template into a runnable Vega spec the way
 * tools/check-templates.mjs does, for the viewer (index.html) and the contact sheet (sheet.mjs).
 * Takes vega and vega-lite as arguments so the browser and Node share it.
 */
const TOKEN = /__(\d+)__/g

export const POWER_BI_DEFAULT = {
  name: 'Power BI default',
  dataColors: ['#118DFF', '#12239E', '#E66C37', '#6B007B', '#E044A7', '#744EC2', '#D9B300', '#D64550'],
  good: '#1AAB40', bad: '#D64554', neutral: '#D9B300',
  minimum: '#118DFF', center: '#D9B300', maximum: '#D64550',
}

/** Replace the tokens with the field names and apply param overrides ({name: value | {expr}}). */
export function resolveTemplate(template, overrides = {}) {
  const { $schema, usermeta, ...body } = template
  const names = Object.fromEntries(usermeta.dataset.map((f) => [f.key, f.name]))
  const spec = JSON.parse(JSON.stringify(body).replace(TOKEN, (t) => (names[t] === undefined ? t : JSON.stringify(names[t]).slice(1, -1))))
  for (const p of spec.params ?? []) {
    if (!(p.name in overrides)) continue
    const o = overrides[p.name]
    if (o && typeof o === 'object' && !Array.isArray(o) && 'expr' in o) {
      delete p.value
      p.expr = o.expr
    } else {
      delete p.expr
      p.value = o
    }
  }
  return spec
}

/** Size the spec like a Deneb container and compile it; returns the Vega spec and any log lines. */
export function toVega(vl, liteSpec, width, height) {
  const spec = JSON.parse(JSON.stringify(liteSpec))
  spec.width = width
  spec.height = height
  spec.config = { ...(spec.config ?? {}), customFormatTypes: true }
  const logs = []
  const logger = {
    level() { return this },
    error: (...m) => logs.push('error: ' + m.join(' ')),
    warn: (...m) => logs.push('warn: ' + m.join(' ')),
    info() {}, debug() {},
  }
  const vg = vl.compile(spec, { logger }).spec
  const text = JSON.stringify(vg)
  const defined = new Set((vg.signals ?? []).map((s) => s.name))
  const injected = []
  if (/\bpbiContainerWidth\b/.test(text) && !defined.has('pbiContainerWidth')) injected.push({ name: 'pbiContainerWidth', value: width })
  if (/\bpbiContainerHeight\b/.test(text) && !defined.has('pbiContainerHeight')) injected.push({ name: 'pbiContainerHeight', value: height })
  vg.signals = [...injected, ...(vg.signals ?? [])]
  return { vg, logs }
}

function shade(hex, pct) {
  const n = parseInt(hex.slice(1), 16)
  const channels = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  const out = channels.map((c) => Math.round(pct >= 0 ? c + (255 - c) * pct : c * (1 + pct)))
  return '#' + out.map((c) => Math.max(0, Math.min(255, c)).toString(16).padStart(2, '0')).join('')
}

/** Deneb's expression functions and schemes, from a report theme. Vega has one global registry. */
export function registerDeneb(vega, themeJson) {
  const theme = { ...POWER_BI_DEFAULT, ...(themeJson ?? {}) }
  const pbiColor = (which, pct = 0) => {
    const named = {
      good: theme.good, positive: theme.good, bad: theme.bad, negative: theme.bad,
      neutral: theme.neutral, min: theme.minimum, middle: theme.center, max: theme.maximum,
    }
    const base = typeof which === 'number' ? theme.dataColors[which % theme.dataColors.length] : named[which] ?? theme.dataColors[1 % theme.dataColors.length]
    return pct ? shade(base, pct) : base
  }
  const pbiFormat = (value) => (value === null || value === undefined ? '' : String(value))
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
  return theme
}

/**
 * Node only: measure text with Segoe UI's real advance widths (segoe-widths.json) instead of
 * Vega's estimate, which runs wide and truncates text a browser fits. Weights 600 and above
 * that are not bold read the semibold table.
 */
export function useSegoeWidths(vega, table) {
  const fallback = vega.textMetrics.estimateWidth
  vega.textMetrics.width = (item, text) => {
    if (text === null || text === undefined) return 0
    const weight = item.fontWeight
    const key = item.fontStyle === 'italic' ? 'italic' : weight === 'bold' || Number(weight) >= 700 ? 'bold' : Number(weight) >= 600 ? '600' : 'normal'
    const widths = table[key]
    const size = item.fontSize ?? 11
    let w = 0
    for (const ch of String(text)) {
      const cw = widths[ch]
      if (cw === undefined) return fallback(item, text)
      w += cw
    }
    return w * size
  }
}

/**
 * Rows as Deneb hands them over: dateTime fields become Dates (local midnight, as the checker
 * reads the CSVs) and __row__ is added. Report Hacker's rows keep their date strings, because
 * that is what its preview passes.
 */
export function denebRows(rows, fields, { keepStrings = false } = {}) {
  const types = Object.fromEntries(fields.map((f) => [f.name, f.type]))
  return rows.map((row, i) => {
    const out = { ...row, __row__: i }
    if (!keepStrings) {
      for (const [k, v] of Object.entries(row)) {
        if (types[k] === 'dateTime' && typeof v === 'string') out[k] = new Date(v.length === 10 ? v + 'T00:00:00' : v)
      }
    }
    return out
  })
}
