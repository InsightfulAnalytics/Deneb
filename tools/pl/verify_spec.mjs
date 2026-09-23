// Numeric gate for the Odd Rows P&L Statement template
// (templates/financial/pl-odd-rows/pl-odd-rows.json).
//
// Runs the template over a real 30-row extract from the source model (_deneb_base.csv), pulls
// each intermediate dataset back out, finds the one that carries the full 13 x 14 grid, and
// diffs every value against _golden_182.csv: the same statement's numbers as the native matrix
// showed them. Both files come from the synthetic demo model the template was built on.
//
// This is the gate that matters: a spec can render beautifully and still be arithmetically
// wrong. A ratio of differences instead of a difference of ratios shows up as plausible
// numbers, not as an error. Rendering a PNG proves nothing about the maths.
//
// Usage (from the repo root or anywhere):
//   node tools/pl/verify_spec.mjs [template.json] [dataset.csv] [golden.csv]
import { join } from 'node:path'
import {
  HERE, loadTemplate, nameSets, readCsv, rekey, resolveTokens, runSpec, templatePath,
} from './harness.mjs'

const [
  specPath = templatePath('pl-odd-rows'),
  dataPath = join(HERE, '_deneb_base.csv'),
  goldPath = join(HERE, '_golden_182.csv'),
] = process.argv.slice(2)

const ROWS = [
  'Total Income', 'Total Cost of Sales', 'Gross Profit', 'Total Operating Expenses',
  'Net Profit', 'Gross Margin %', 'Net Margin %', 'COGS % of Income', 'Opex % of Income',
  'Income per Trading Store', 'Net Profit per Trading Store', 'Income per Active Product',
  'Trading Stores',
]
const COLS = [
  'Actual', 'LY', 'vs LY', 'vs LY %', 'Budget', 'Var to Budget', 'Var to Budget %',
  'YTD Actual', 'YTD LY', 'YTD vs LY', 'YTD vs LY %', 'YTD Budget',
  'YTD Var to Budget', 'YTD Var to Budget %',
]
const rowSet = new Set(ROWS), colSet = new Set(COLS)

// ---- the extract, keyed by the spec's internal names (the alias block's targets)
const base = readCsv(dataPath).map((r) => ({
  'Line': r['P&L Lines[Line]'],
  'P&L View': r['P&L View[P&L View]'],
  'Amount': Number(r['[Amount]']),
  'Trading Stores': Number(r['[Trading Stores]']),
  'Active Products': Number(r['[Active Products]']),
}))
const gold = new Map()
for (const g of readCsv(goldPath)) gold.set(`${g.Line}|${g.Item}`, g.Value === '' ? null : Number(g.Value))
console.log(`dataset: ${base.length} rows | golden: ${gold.size} cells`)

const { body, dataset, provider, alias } = loadTemplate(specPath)

/** Find whichever internal dataset carries (row, column, value) triples for the grid. */
function findGrid(view, compiled) {
  let best = null
  for (const n of compiled.data.map((d) => d.name)) {
    let d
    try { d = view.data(n) } catch { continue }
    if (!Array.isArray(d) || !d.length) continue
    const keys = Object.keys(d[0])
    const rowKey = keys.find((k) => d.some((x) => rowSet.has(x[k])))
    const colKey = keys.find((k) => k !== rowKey && d.some((x) => colSet.has(x[k])))
    if (!rowKey || !colKey) continue
    // After the final fold the row still carries the pre-fold pivot columns ("Actual",
    // "LY", ...), so the first numeric field is NOT the folded value. Exclude anything whose
    // name is itself a row or column label, and prefer a field literally called "value".
    const cand = keys.filter((k) => k !== rowKey && k !== colKey && !rowSet.has(k) && !colSet.has(k)
      && d.some((x) => typeof x[k] === 'number'))
    const valKey = cand.find((k) => /^(value|val|v)$/i.test(k)) || cand[0]
    if (!valKey) continue
    const cells = d.filter((x) => rowSet.has(x[rowKey]) && colSet.has(x[colKey])).length
    if (!best || cells > best.cells) best = { n, rowKey, colKey, valKey, cells, d }
  }
  return best
}

let failed = 0
for (const [label, names] of Object.entries(nameSets(dataset))) {
  const spec = resolveTokens(body, dataset, names)
  const { view, compiled } = await runSpec(spec, provider, rekey(base, dataset, alias, names))
  const grid = findGrid(view, compiled)
  if (!grid) { console.log(`${label}: no dataset carries the grid`); failed++; continue }

  let bad = 0, checked = 0
  const missing = []
  for (const r of ROWS) {
    for (const c of COLS) {
      const hit = grid.d.find((x) => x[grid.rowKey] === r && x[grid.colKey] === c)
      if (!hit) { missing.push(`${r} / ${c}`); continue }
      const got = hit[grid.valKey]
      const want = gold.get(`${r}|${c}`)
      checked++
      if (want == null && (got == null || !isFinite(got))) continue
      if (want == null || got == null || !isFinite(got)
          || Math.abs(got - want) > Math.max(1e-6, Math.abs(want) * 1e-9)) {
        if (bad < 15) console.log(`  DIFF ${r} / ${c}: got ${got}  want ${want}`)
        bad++
      }
    }
  }
  if (missing.length) console.log(`  MISSING ${missing.length} cells, first: ${missing.slice(0, 5).join(' | ')}`)
  console.log(`${label.padEnd(21)}: DERIVED vs GOLDEN checked ${checked}/182 | BADDIFF=${bad} | MISSING=${missing.length}`)
  if (bad || missing.length || checked !== 182) failed++
  view.finalize()
}
process.exit(failed ? 1 : 0)
