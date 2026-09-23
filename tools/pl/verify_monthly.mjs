// Numeric gate for the Monthly P&L Grid template
// (templates/financial/pl-monthly-grid/pl-monthly-grid.json).
//
// Diffs every cell of the grid against an independent Python recomputation written by
// gen_monthly_spec.py: two implementations of the same DAX rules, and the gate is zero
// mismatches. Two datasets:
//   monthly-pl.sample-rows.json   12 edge-case rows: a zero LY denominator, a blank actual,
//                                 actuals that stop after the current month, a highlighted month
//   sample-data.csv               the template's own sample
// each against its expected file (monthly-pl.expected.json, monthly-pl.sample-data.expected.json),
// and each under the template's field names and under renamed fields.
//
// Usage: node tools/pl/verify_monthly.mjs
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  HERE, loadTemplate, nameSets, rekey, resolveTokens, runSpec, sampleRows, templatePath,
} from './harness.mjs'

const { body, dataset, provider, alias } = loadTemplate(templatePath('pl-monthly-grid'))
const readJson = (name) => JSON.parse(readFileSync(join(HERE, name), 'utf8'))
const cases = [
  ['edge-case rows', readJson('monthly-pl.sample-rows.json'), readJson('monthly-pl.expected.json')],
  ['sample-data.csv', sampleRows('pl-monthly-grid', dataset, alias),
    readJson('monthly-pl.sample-data.expected.json')],
]
const close = (a, b) =>
  (a == null && b == null) ||
  (a != null && b != null && Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b)))

let failed = 0
for (const [caseName, rows, expected] of cases) {
  for (const [label, names] of Object.entries(nameSets(dataset))) {
    const spec = resolveTokens(body, dataset, names)
    const { view } = await runSpec(spec, provider, rekey(rows, dataset, alias, names))
    const cells = view.data('cells')
    const got = new Map(cells.map((c) => [`${c.rowIdx}|${c.colIdx}`, c]))
    let bad = 0
    for (const e of expected) {
      const c = got.get(`${e.rowIdx}|${e.colIdx}`)
      if (!c) { console.log(`  MISSING cell r${e.rowIdx} c${e.colIdx} (${e.key})`); bad++; continue }
      if (!close(c.value ?? null, e.value ?? null)) {
        if (bad < 12) console.log(`  DIFF ${e.key} r${e.rowIdx} c${e.colIdx}: spec=${c.value} expected=${e.value}`)
        bad++
      }
    }
    if (cells.length !== expected.length) {
      console.log(`  COUNT spec=${cells.length} expected=${expected.length}`)
      bad++
    }
    console.log(`${caseName.padEnd(16)} ${label.padEnd(21)}: ${expected.length} cells, ${bad} differences`)
    if (bad) failed++
    view.finalize()
  }
}

const names = dataset.map((f) => f.name)
const edge = rekey(readJson('monthly-pl.sample-rows.json'), dataset, alias, names)
const spec = resolveTokens(body, dataset, names)

// Regression guard. If the month offset ever stops arriving (a dropped field, or it goes into
// the group-by on a model where DATEADD blanks it), the current month is unknowable and YTD and
// YTG must both come back EMPTY. The failure this catches is the silent one: null coercing to
// 0 so that `Month > curP` is true for every month and YTG renders the full year, which looks
// entirely plausible on the canvas.
{
  const offsetName = names[[...alias.values()].indexOf('MonthOffset')]
  const stripped = edge.map(({ [offsetName]: _drop, ...rest }) => rest)
  const { view } = await runSpec(spec, provider, stripped)
  const cells = view.data('cells')
  const leaked = cells.filter((c) => (c.colIdx === 12 || c.colIdx === 13) && c.value != null)
  if (leaked.length) {
    console.log(`GUARD FAIL: ${leaked.length} YTD/YTG cells populated with no month offset`
      + ` (e.g. col ${leaked[0].colIdx} ${leaked[0].key}=${leaked[0].value})`)
    failed++
  } else {
    const fy = cells.filter((c) => c.colIdx === 14 && c.value != null).length
    console.log(`guard ok : no month offset -> YTD/YTG blank, FY still populated (${fy} FY cells)`)
  }
  view.finalize()
}

// Spot-check the formatter: $M/$K/$ thresholds and the percent rule, negatives in brackets.
{
  const { view } = await runSpec(spec, provider, edge)
  const got = new Map(view.data('cells').map((c) => [`${c.rowIdx}|${c.colIdx}`, c]))
  const samples = [
    [1, 0, /^\$[\d,]+\.\dM$/],       // Income Act, Jan   -> $xxx.xM
    [2, 0, /^\$[\d,]+\.\dM$/],       // Income LY, Jan
    [5, 0, /^\(\$[\d,]+\.\dM\)$/],   // COGS Act, Jan     -> negative, bracketed
    [13, 0, /^\d+\.\d%$/],           // GM % Act, Jan
  ]
  let bad = 0
  for (const [r, c, re] of samples) {
    const cell = got.get(`${r}|${c}`)
    if (!cell || !re.test(cell.fmtd)) {
      console.log(`FORMAT r${r} c${c}: got ${JSON.stringify(cell && cell.fmtd)}, expected ${re}`)
      bad++
    }
  }
  console.log(`formats  : ${samples.length - bad}/${samples.length} spot checks ok`)
  if (bad) failed++
  view.finalize()
}

process.exit(failed ? 1 : 0)
