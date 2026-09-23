// Numeric gate for the P&L Accounts Statement template
// (templates/financial/pl-accounts-statement/pl-accounts-statement.json).
//
// Feeds the template a statement dataset, runs every transform, and diffs all 14 columns of
// every line against an INDEPENDENT JS implementation of the column formulas. Three datasets
// by default:
//   classic_real_rows.json    27 lines extracted from the synthetic demo model the template
//                             was built on (line labels carry a U+00A0 indent)
//   classic_synth_rows.json   27 made-up lines, including a zero Budget (the blank-on-Infinity
//                             path)
//   sample-data.csv           the template's own sample
// and a cut-down statement (the sample's subtotal and total lines only) to prove the spec
// takes its row count from the data: the y scale domain must be [rows, 0].
//
// Usage: node tools/pl/verify_classic.mjs [template.json] [rows.json ...]
import { readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import {
  HERE, loadTemplate, nameSets, rekey, resolveTokens, runSpec, sampleRows, templatePath,
} from './harness.mjs'

const [specPath = templatePath('pl-accounts-statement'), ...rowFiles] = process.argv.slice(2)
const { body, dataset, provider, alias } = loadTemplate(specPath)

const COLS = ['Actual', 'Budget', 'Var', 'Var %', 'LY', 'vs LY', 'vs LY %',
  'YTD Actual', 'YTD Budget', 'YTD Var', 'YTD Var %', 'YTD LY',
  'YTD vs LY', 'YTD vs LY %']
const colSet = new Set(COLS)

const sample = sampleRows('pl-accounts-statement', dataset, alias)
const cases = rowFiles.length
  ? rowFiles.map((f) => [basename(f), JSON.parse(readFileSync(f, 'utf8'))])
  : [
      ['classic_real_rows.json', JSON.parse(readFileSync(join(HERE, 'classic_real_rows.json'), 'utf8'))],
      ['classic_synth_rows.json', JSON.parse(readFileSync(join(HERE, 'classic_synth_rows.json'), 'utf8'))],
      ['sample-data.csv', sample],
      ['sample-data.csv, totals only', sample.filter((r) => r.LineClass !== 'Detail')],
    ]

// ---- independent expected values, from the rows as the spec's internal names see them
function expectedFor(rows) {
  const expected = new Map()
  for (const r of rows) {
    const A = r['Actual'], B = r['Budget'], L = r['LY']
    const YA = r['YTD Actual'], YB = r['YTD Budget'], YL = r['YTD LY']
    const e = {
      'Actual': A, 'Budget': B, 'LY': L,
      'Var': A - B, 'Var %': (A - B) / B,
      'vs LY': A - L, 'vs LY %': (A - L) / L,
      'YTD Actual': YA, 'YTD Budget': YB, 'YTD LY': YL,
      'YTD Var': YA - YB, 'YTD Var %': (YA - YB) / YB,
      'YTD vs LY': YA - YL, 'YTD vs LY %': (YA - YL) / YL,
    }
    for (const c of COLS) expected.set(`${r.Line}|${c}`, e[c])
  }
  return expected
}

let failed = 0
for (const [caseName, rows] of cases) {
  const expected = expectedFor(rows)
  const lineSet = new Set(rows.map((r) => r.Line))
  for (const [label, names] of Object.entries(nameSets(dataset))) {
    const spec = resolveTokens(body, dataset, names)
    const { view, compiled } = await runSpec(spec, provider, rekey(rows, dataset, alias, names))

    // the dataset carrying (Line, column, value) triples
    let best = null
    for (const d of compiled.data.map((x) => x.name)) {
      let data
      try { data = view.data(d) } catch { continue }
      if (!Array.isArray(data) || !data.length) continue
      const keys = Object.keys(data[0])
      if (!keys.includes('column') || !keys.includes('value') || !keys.includes('Line')) continue
      const cells = data.filter((x) => lineSet.has(x.Line) && colSet.has(x.column)).length
      if (!best || cells > best.cells) best = { name: d, cells, data }
    }
    if (!best) { console.log(`${caseName} / ${label}: no grid dataset found`); failed++; continue }

    let bad = 0, missing = 0
    for (const [key, want] of expected) {
      const [line, col] = key.split('|')
      const hit = best.data.find((x) => x.Line === line && x.column === col)
      if (!hit) { missing++; continue }
      const got = hit.value
      const bothDead = (!isFinite(want) || want == null) && (!isFinite(got) || got == null)
      if (bothDead) continue
      if (got == null || !isFinite(got)
          || Math.abs(got - want) > Math.max(1e-6, Math.abs(want) * 1e-9)) {
        if (bad < 12) console.log(`  DIFF ${line.trim()} / ${col}: got ${got}  want ${want}`)
        bad++
      }
    }
    // row count from the data: the shared y scale must span exactly the rows received
    const domain = view.scale('y').domain()
    const rowsOk = domain[0] === rows.length && domain[1] === 0
    if (!rowsOk) console.log(`  ROWS y domain is [${domain}], expected [${rows.length},0]`)
    console.log(`${caseName.padEnd(28)} ${label.padEnd(21)}: ${expected.size} cells | BADDIFF=${bad}`
      + ` | MISSING=${missing} | rows ${rowsOk ? 'ok' : 'WRONG'} (${rows.length})`)
    if (bad || missing || !rowsOk) failed++
    view.finalize()
  }
}
process.exit(failed ? 1 : 0)
