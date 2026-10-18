#!/usr/bin/env node
/**
 * Generate the eight KPI templates that share one set of helpers:
 *
 *   KPI Delta Tile, KPI Progress Card, KPI Bullet Tile, KPI Scorecard, Hit or Miss Strip,
 *   Run-rate Projection Card, KPI Small Multiples, Ring Progress Card
 *
 * Edit this generator, not the JSON, then run from the repo root:
 *
 *   node tools/kpi/build.mjs
 *   node tools/check-templates.mjs templates/kpi --theme showcase/theme/bi-nexus.json --render tools/out
 *   py tools/showcase/build_showcase.py
 *
 * Each template lands in templates/kpi/<slug>/ as <slug>.json (a Deneb v1 Vega-Lite template,
 * tokenised __0__, __1__, ...), sample-data.csv and render.json. Its showcase part goes to
 * showcase/parts/<slug>.json, and the rows of every showcase instance but the first (which draws
 * the template's own sample) to showcase/data/<id>.csv. The thumbnail that
 * tools/showcase/crop_previews.py --embed writes into a template is carried over, so a rerun
 * keeps it. The READMEs are written by hand: a param added here goes in its README's tables.
 *
 * The designs were picked from an eight-way prototype, kept on the prototype/kpi-templates branch.
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const GENERATED = '2026-10-18T00:00:00.000Z'
const CREDIT = 'Design by Timothy Osborn.'
const MINUS = '−'
// SVG collapses runs of spaces, so a wider gap inside one text mark is an em space.
const EM_SPACE = ' '

// ---------------------------------------------------------------- spec helpers

const P = (name, value, doc) => ({ name, value, doc })
const E = (name, expr, doc) => ({ name, expr, doc })
const calc = (as, calculate) => ({ calculate, as })
const ex = (expr) => ({ expr })
const one = { values: [{}] }
const px = (field) => ({ field, type: 'quantitative', scale: null })
const nom = (field) => ({ field, type: 'nominal' })
const raw = (field) => ({ field, type: 'nominal', scale: null })
const tip = (pairs) => pairs.map(([field, title]) => ({ field, type: 'nominal', title }))
/** A showcase instance after the template's own: `<slug>-<suffix>`, its size, params and rows. */
const shown = (suffix, size, params, rows) => ({ suffix, size, params, rows })

/** Power of a thousand for 'auto' formatting, rounded so 999,960 reads 1.0M, not 1,000K. */
const U = (x) => `(abs(${x}) >= 999.5e6 ? 1e9 : abs(${x}) >= 999.5e3 ? 1e6 : abs(${x}) >= 999.5 ? 1e3 : 1)`
const SFX = (x) => `(abs(${x}) >= 999.5e6 ? 'bn' : abs(${x}) >= 999.5e3 ? 'M' : abs(${x}) >= 999.5 ? 'K' : '')`

/** x as text: a d3 format, or 'auto' (K, M, bn; one decimal under ten, none above). */
const num = (x, f = 'valueFormat') =>
  `(!isValid(${x}) || !isFinite(${x}) ? noDataText : ${f} !== 'auto' ? format(${x}, ${f}) : ` +
  `(${x} < 0 ? '${MINUS}' : '') + prefix + format(abs(${x}) / ${U(x)}, abs(${x}) / ${U(x)} < 10 ? (${U(x)} > 1 ? '.1f' : '.2~f') : ',.0f') + ${SFX(x)})`
const signed = (x, f = 'valueFormat') => `(isValid(${x}) && ${x} > 0 ? '+' : '') + ${num(x, f)}`
const pct = (x, f = 'pctFormat') => `(!isValid(${x}) || !isFinite(${x}) ? noDataText : format(${x}, ${f}))`
const pts = (x) => `(!isValid(${x}) ? noDataText : (${x} > 0 ? '+' : ${x} < 0 ? '${MINUS}' : '') + format(abs(${x}) * 100, '.1f') + ' pts')`
const arrow = (x) => `(!isValid(${x}) ? '' : ${x} > 0 ? arrowUp : ${x} < 0 ? arrowDown : arrowFlat)`
const status = (g) => `(${g} > 0 ? colorGood : ${g} < 0 ? colorBad : colorNeutral)`
/** A d3 format specifier, d3's own pattern: anything else falls back to valueFormat. */
const D3_FORMAT = String.raw`/^(?:(.)?([<>=^]))?([+\-( ])?([$#])?(0)?(\d+)?(,)?(\.\d+)?(~)?([a-z%])?$/i`

const config = {
  autosize: { type: 'fit', contains: 'padding' },
  view: { stroke: 'transparent' },
  background: 'transparent',
  font: 'Segoe UI',
}

const formatParams = (pctFormat = '+.1%') => [
  P('valueFormat', 'auto', "d3 format for every value. 'auto' rounds to K, M or bn with one decimal under ten, as a KPI should; use '.1%' for a rate or ',.0f' for a count."),
  P('prefix', '$', "Written before an 'auto' value. Use an empty string for counts."),
  P('pctFormat', pctFormat, 'd3 format for percentages.'),
  P('noDataText', 'n/a', 'Shown when a figure cannot be worked out.'),
]
/** Only the params a template reads: an option that changes nothing is a trap. */
const sentimentParams = ({ neutral = true, arrows = ['arrowUp', 'arrowDown', 'arrowFlat'] } = {}) => [
  P('higherIsBetter', true, '`false` flips good and bad, for cost, spend or a returns rate.'),
  E('colorGood', "pbiColor('good')", 'Good colour, from the theme.'),
  E('colorBad', "pbiColor('bad')", 'Bad colour, from the theme.'),
  ...(neutral ? [E('colorNeutral', "pbiColor('neutral')", 'Neutral colour: no change, or nothing to compare.')] : []),
  ...[
    P('arrowUp', '▲', 'Shown when the figure rose.'),
    P('arrowDown', '▼', 'Shown when it fell.'),
    P('arrowFlat', '►', 'Shown when it did not change.'),
  ].filter((p) => arrows.includes(p.name)),
]
const cardParams = ({ value = true, muted = true } = {}) => [
  P('cardColor', '#FFFFFF', 'Card background.'),
  P('borderColor', '#E1DFDD', 'Card border.'),
  P('borderWidth', 1, 'Border width in pixels. `0` hides it.'),
  P('cardRadius', 4, 'Corner radius of the card.'),
  ...(value ? [E('valueColor', 'pbiColor(0, -0.5)', 'Headline value colour.')] : []),
  P('labelColor', '#605E5C', 'Labels and secondary text.'),
  ...(muted ? [P('mutedColor', '#A19F9D', 'Axis labels and the quietest text.')] : []),
]

const cardLayer = () => ({
  description: 'Card background and border, inset by half the border so the container never clips it',
  data: one,
  mark: {
    type: 'rect',
    x: ex('borderWidth / 2'), y: ex('borderWidth / 2'),
    x2: ex('width - borderWidth / 2'), y2: ex('height - borderWidth / 2'),
    fill: ex('cardColor'), stroke: ex('borderColor'), strokeWidth: ex('borderWidth'),
    cornerRadius: ex('cardRadius'),
  },
})

/** A text layer: constant text from a param (`value`) or a datum field (`field`). */
function txt(description, o) {
  const mark = {
    type: 'text',
    align: o.alignExpr ? ex(o.alignExpr) : (o.align ?? 'left'),
    baseline: o.baseline ?? 'alphabetic',
    fontWeight: o.weight ?? 'normal',
  }
  if (o.x !== undefined) mark.x = ex(o.x)
  if (o.y !== undefined) mark.y = ex(o.y)
  if (o.size !== undefined) mark.fontSize = ex(o.size)
  if (o.limit) mark.limit = ex(o.limit)
  if (o.fill) mark.fill = ex(o.fill)
  if (o.value) mark.text = ex(o.value)
  if (o.italic) mark.fontStyle = 'italic'
  const layer = { description }
  if (o.data) layer.data = o.data
  if (o.transform) layer.transform = o.transform
  layer.mark = mark
  const encoding = { ...(o.encoding ?? {}) }
  if (o.field) encoding.text = nom(o.field)
  if (o.colorField) encoding.color = raw(o.colorField)
  if (o.tooltip) encoding.tooltip = o.tooltip
  if (Object.keys(encoding).length) layer.encoding = encoding
  return layer
}

/** Measures-only templates get one row from Power BI; sum anyway, so extra rows add up. */
const sumOf = (token, as) => [
  { op: 'sum', field: token, as: `${as}Sum` },
  { op: 'valid', field: token, as: `${as}N` },
]
const validSum = (as) => calc(as, `datum.${as}N > 0 ? datum.${as}Sum : null`)

/** The shared rate rule: a value format with % in it makes gaps percentage points. */
const ratePts = (f = 'valueFormat') => `(varianceUnit === 'points' || (varianceUnit === 'auto' && indexof(${f}, '%') >= 0))`
const varianceParam = () =>
  P('varianceUnit', 'auto', "'percent' shows a gap as a share of the comparison, 'points' as the difference in percentage points (for rates). 'auto' uses points when valueFormat has a %.")

// ---------------------------------------------------------------- 1. KPI Delta Tile

const deltaTile = {
  slug: 'kpi-delta-tile',
  name: 'KPI Delta Tile',
  description: 'The plainest KPI card: the value, its change against a benchmark (prior year, prior period or target) as an amount and a percentage, and an arrow coloured good or bad. Side by side in a band tile, stacked in a taller card.',
  author: 'Timothy Osborn',
  render: { width: 300, height: 90 },
  fields: [
    { name: 'Value', kind: 'measure', type: 'numeric', description: 'The KPI, for example sales this month.' },
    { name: 'Benchmark', kind: 'measure', type: 'numeric', description: 'What Value is compared with: prior year, prior period, budget or target. Name it in comparisonLabel.' },
  ],
  params: [
    P('title', 'Sales', 'Card label, top left. An empty string hides it.'),
    P('comparisonLabel', 'PY', 'What Benchmark is, written after "vs": PY, Budget, Target.'),
    ...formatParams(),
    varianceParam(),
    ...sentimentParams(),
    ...cardParams({ muted: false }),
    E('stacked', 'width < 2.4 * height', 'Side by side in a wide tile, stacked in a taller one. Set `true` or `false` to force a layout.'),
    E('unit', 'stacked ? clamp(min(width / 240, height / 150), 0.5, 3) : clamp(min(width / 300, height / 90), 0.5, 3)', 'Scale factor: the tile is drawn for 300 x 90 (240 x 150 stacked) and grows or shrinks from there.'),
    E('pad', '14 * unit', 'Inset of the text from the card edge.'),
    E('top0', 'max(0, (height - (stacked ? 150 : 90) * unit) / 2)', 'Top of the drawing, so a card taller than its scale centres the text.'),
    E('titleSize', '(stacked ? 13 : 12) * unit', 'Title text size.'),
    E('titleY', 'top0 + (stacked ? 26 : 23) * unit', 'Title baseline.'),
    E('valueSize', '(stacked ? 40 : 32) * unit', 'Value text size.'),
    E('valueY', 'top0 + (stacked ? 82 : 67) * unit', 'Value baseline.'),
    E('deltaSize', '(stacked ? 15 : 17) * unit', 'Size of the change line (arrow and percentage).'),
    E('deltaY', 'top0 + (stacked ? 112 : 46) * unit', 'Baseline of the change line.'),
    E('noteSize', '(stacked ? 12 : 11.5) * unit', 'Size of the note under the change.'),
    E('noteY', 'top0 + (stacked ? 134 : 67) * unit', 'Baseline of the note.'),
    E('sideX', 'stacked ? pad : width - pad', 'Where the change and the note sit: right-aligned at the right edge, or under the value when stacked.'),
    E('sideAlign', "stacked ? 'left' : 'right'", 'Alignment of the change and the note.'),
    E('valueLimit', 'stacked ? width - 2 * pad : width * 0.58 - pad', 'Widest the value may be before it ends in an ellipsis.'),
    E('sideLimit', 'stacked ? width - 2 * pad : width * 0.42 - pad', 'Widest the change and the note may be.'),
  ],
  body: () => ({
    transform: [
      { aggregate: [...sumOf('__0__', 'v'), ...sumOf('__1__', 'b')] },
      validSum('v'),
      validSum('b'),
      calc('d', 'isValid(datum.v) && isValid(datum.b) ? datum.v - datum.b : null'),
      calc('p', 'isValid(datum.d) && datum.b !== 0 ? datum.d / abs(datum.b) : null'),
      calc('g', 'isValid(datum.d) ? (higherIsBetter ? 1 : -1) * datum.d : 0'),
      calc('statusColor', status('datum.g')),
      calc('isPts', ratePts()),
      calc('valueText', num('datum.v')),
      calc('benchText', num('datum.b')),
      calc('amountText', signed('datum.d')),
      calc('relText', `datum.isPts ? ${pts('datum.d')} : ${pct('datum.p')}`),
      calc('deltaText', `${arrow('datum.d')} + ' ' + (stacked && !datum.isPts ? datum.amountText + '${EM_SPACE}' : '') + datum.relText`),
      calc('noteText', `stacked || datum.isPts ? 'vs ' + comparisonLabel + ' ' + datum.benchText : datum.amountText + ' vs ' + comparisonLabel`),
      calc('noteColor', 'stacked ? labelColor : datum.statusColor'),
      calc('tipChange', "datum.amountText + ' (' + datum.relText + ')'"),
    ],
    layer: [
      cardLayer(),
      txt('Title', { data: one, value: 'title', x: 'pad', y: 'titleY', size: 'titleSize', fill: 'labelColor', weight: 600, limit: 'width - 2 * pad' }),
      txt('Value', {
        field: 'valueText', x: 'pad', y: 'valueY', size: 'valueSize', fill: 'valueColor', weight: 'bold', limit: 'valueLimit',
        tooltip: tip([['valueText', 'Value'], ['benchText', 'Benchmark'], ['tipChange', 'Change']]),
      }),
      txt('Change: arrow and percentage, coloured good or bad', {
        field: 'deltaText', x: 'sideX', y: 'deltaY', size: 'deltaSize', alignExpr: 'sideAlign', colorField: 'statusColor', weight: 'bold', limit: 'sideLimit',
        tooltip: tip([['valueText', 'Value'], ['benchText', 'Benchmark'], ['tipChange', 'Change']]),
      }),
      txt('Note: the amount (side by side) or the benchmark itself (stacked)', {
        field: 'noteText', x: 'sideX', y: 'noteY', size: 'noteSize', alignExpr: 'sideAlign', colorField: 'noteColor', limit: 'sideLimit',
      }),
    ],
  }),
  sample: [{ Value: 4215380, Benchmark: 3926140 }],
  showcase: [
    shown('margin', [300, 90], { title: 'Gross margin', valueFormat: '.1%' }, [{ Value: 0.382, Benchmark: 0.401 }]),
    shown('cost', [240, 150], { title: 'Operating cost', higherIsBetter: false }, [{ Value: 2614900, Benchmark: 2448300 }]),
  ],
}

// ---------------------------------------------------------------- 2. KPI Progress Card

const progressCard = {
  slug: 'kpi-progress-card',
  name: 'KPI Progress Card',
  description: 'Value against target as a progress bar, the share of target reached, what is left to go, and a pace marker showing where the bar should be by now. With Percent Elapsed blank there is no marker and the bar takes the theme colour.',
  author: 'Timothy Osborn',
  render: { width: 300, height: 90 },
  fields: [
    { name: 'Value', kind: 'measure', type: 'numeric', description: 'Progress so far, for example sales month to date.' },
    { name: 'Target', kind: 'measure', type: 'numeric', description: 'The target for the whole period.' },
    { name: 'Percent Elapsed', kind: 'measure', type: 'numeric', description: 'Share of the period gone, 0 to 1, for the pace marker. A measure returning BLANK() hides the marker.' },
  ],
  params: [
    P('title', 'Sales MTD', 'Card label, top left.'),
    P('targetLabel', 'target', 'Word for the target in the text.'),
    P('aheadText', 'ahead of pace', 'Pace line wording when the bar is past the marker.'),
    P('behindText', 'behind pace', 'Wording when it is short of the marker.'),
    P('toGoText', 'to go', 'After the amount still needed.'),
    P('overText', 'over target', 'After the amount past the target.'),
    ...formatParams('.0%'),
    ...sentimentParams({ neutral: false }),
    ...cardParams({ muted: false }),
    E('barColor', 'pbiColor(0)', 'Bar colour when no pace is bound. With a pace, the bar is good or bad.'),
    P('trackColor', '#EDEBE9', 'Bar track.'),
    P('paceColor', '#252423', 'Pace marker.'),
    E('stacked', 'width < 2.4 * height', 'Side by side in a wide tile, stacked in a taller one.'),
    E('unit', 'stacked ? clamp(min(width / 240, height / 160), 0.5, 3) : clamp(min(width / 300, height / 90), 0.5, 3)', 'Scale factor, from 300 x 90 (240 x 160 stacked).'),
    E('pad', '14 * unit', 'Inset of the text and the bar from the card edge.'),
    E('top0', 'max(0, (height - (stacked ? 160 : 90) * unit) / 2)', 'Top of the drawing, so a card taller than its scale centres it.'),
    E('titleSize', '(stacked ? 13 : 12) * unit', 'Title text size.'),
    E('titleY', 'top0 + (stacked ? 26 : 22) * unit', 'Title baseline.'),
    E('valueSize', '(stacked ? 38 : 28) * unit', 'Value text size.'),
    E('valueY', 'top0 + (stacked ? 76 : 53) * unit', 'Value baseline.'),
    E('headSize', '12 * unit', 'Size of the share-of-target line ("80% of $4.0M").'),
    E('headX', 'stacked ? pad : width - pad', 'Where the share-of-target line sits: top right, or under the value when stacked.'),
    E('headY', 'top0 + (stacked ? 98 : 22) * unit', 'Baseline of the share-of-target line.'),
    E('headAlign', "stacked ? 'left' : 'right'", 'Its alignment.'),
    E('statusSize', '(stacked ? 12 : 11.5) * unit', 'Size of the pace line (or the gap line with no pace).'),
    E('statusX', 'stacked ? pad : width - pad', 'Where the pace line sits.'),
    E('statusY', 'top0 + (stacked ? 148 : 52) * unit', 'Baseline of the pace line.'),
    E('statusAlign', "stacked ? 'left' : 'right'", 'Its alignment.'),
    E('barX0', 'pad', 'Left end of the bar.'),
    E('barX1', 'width - pad', 'Right end of the bar.'),
    E('barY0', 'top0 + (stacked ? 110 : 63) * unit', 'Top of the bar.'),
    E('barY1', 'top0 + (stacked ? 124 : 73) * unit', 'Bottom of the bar.'),
    E('barRadius', '(barY1 - barY0) / 2', 'Corner radius of the bar: fully round ends.'),
    E('paceOverhang', '4 * unit', 'How far the pace marker reaches above and below the bar.'),
  ],
  body: () => ({
    transform: [
      { aggregate: [...sumOf('__0__', 'v'), ...sumOf('__1__', 'tg'), { op: 'mean', field: '__2__', as: 'peMean' }, { op: 'valid', field: '__2__', as: 'peN' }] },
      validSum('v'),
      validSum('tg'),
      calc('pe', 'datum.peN > 0 ? clamp(datum.peMean, 0, 1) : null'),
      calc('r', 'isValid(datum.v) && isValid(datum.tg) && datum.tg !== 0 ? datum.v / datum.tg : null'),
      calc('pg', 'isValid(datum.r) && isValid(datum.pe) ? datum.r - datum.pe : null'),
      calc('g', 'isValid(datum.pg) ? (higherIsBetter ? 1 : -1) * datum.pg : 0'),
      calc('fillColor', 'isValid(datum.pg) ? (datum.g >= 0 ? colorGood : colorBad) : barColor'),
      calc('rem', 'isValid(datum.v) && isValid(datum.tg) ? datum.tg - datum.v : null'),
      calc('valueText', num('datum.v')),
      calc('targetText', num('datum.tg')),
      calc('ratioText', pct('datum.r')),
      calc('headText', "datum.ratioText + ' of ' + datum.targetText + (stacked ? ' ' + targetLabel : '')"),
      calc('remAbs', 'isValid(datum.rem) ? abs(datum.rem) : null'),
      calc('gapText', `!isValid(datum.rem) ? noDataText : datum.rem > 0 ? ${num('datum.remAbs')} + ' ' + toGoText : datum.rem < 0 ? ${num('datum.remAbs')} + ' ' + overText : 'on ' + targetLabel`),
      calc('paceN', "isValid(datum.pg) ? format(abs(datum.pg) * 100, '.0f') : ''"),
      calc('paceText', `isValid(datum.pg) ? ${arrow('datum.pg')} + ' ' + datum.paceN + (datum.paceN === '1' ? ' pt ' : ' pts ') + (datum.pg >= 0 ? aheadText : behindText) : ''`),
      calc('statusText', 'isValid(datum.pg) ? datum.paceText : datum.gapText'),
      calc('overColor', 'isValid(datum.rem) && datum.rem < 0 ? (higherIsBetter ? colorGood : colorBad) : labelColor'),
      calc('statusColor', 'isValid(datum.pg) ? datum.fillColor : datum.overColor'),
      calc('restText', "stacked && isValid(datum.pg) ? datum.gapText : ''"),
      calc('barMax', 'max(1, isValid(datum.r) ? datum.r : 0)'),
      calc('fillX', 'barX0 + clamp(isValid(datum.r) ? datum.r : 0, 0, datum.barMax) / datum.barMax * (barX1 - barX0)'),
      calc('targetX', 'barX0 + (barX1 - barX0) / datum.barMax'),
      calc('paceX', 'isValid(datum.pe) ? barX0 + datum.pe / datum.barMax * (barX1 - barX0) : null'),
      calc('bx0', 'barX0'), calc('bx1', 'barX1'), calc('by0', 'barY0'), calc('by1', 'barY1'),
      calc('py0', 'barY0 - paceOverhang'), calc('py1', 'barY1 + paceOverhang'),
      calc('tipPace', "isValid(datum.pe) ? format(datum.pe, '.0%') + ' of the period gone' : 'no pace bound'"),
    ],
    layer: [
      cardLayer(),
      txt('Title', { data: one, value: 'title', x: 'pad', y: 'titleY', size: 'titleSize', fill: 'labelColor', weight: 600, limit: 'width * 0.5' }),
      txt('Share of target: top right in a tile, under the value when stacked', {
        field: 'headText', x: 'headX', y: 'headY', size: 'headSize', alignExpr: 'headAlign', fill: 'labelColor', limit: 'stacked ? width - 2 * pad : width * 0.5 - pad',
      }),
      txt('Value', {
        field: 'valueText', x: 'pad', y: 'valueY', size: 'valueSize', fill: 'valueColor', weight: 'bold', limit: 'stacked ? width - 2 * pad : width * 0.5 - pad',
        tooltip: tip([['valueText', 'Value'], ['targetText', 'Target'], ['ratioText', 'Of target'], ['tipPace', 'Pace']]),
      }),
      txt('Pace line, or the gap when no pace is bound', {
        field: 'statusText', x: 'statusX', y: 'statusY', size: 'statusSize', alignExpr: 'statusAlign', colorField: 'statusColor', weight: 600, limit: 'stacked ? width * 0.62 - pad : width * 0.5 - pad',
      }),
      txt('What is left to go, opposite the pace line (stacked only)', {
        field: 'restText', x: 'width - pad', y: 'statusY', size: 'statusSize', align: 'right', fill: 'labelColor', limit: 'width * 0.38 - pad',
        transform: [{ filter: "length(datum.restText) > 0" }],
      }),
      {
        description: 'Bar track',
        mark: { type: 'rect', cornerRadius: ex('barRadius'), fill: ex('trackColor') },
        encoding: { x: px('bx0'), x2: { field: 'bx1' }, y: px('by0'), y2: { field: 'by1' } },
      },
      {
        description: 'Bar fill, to the share of target reached; past 100% the target moves inside the bar',
        transform: [{ filter: 'datum.fillX > datum.bx0' }],
        mark: { type: 'rect', cornerRadius: ex('barRadius') },
        encoding: {
          x: px('bx0'), x2: { field: 'fillX' }, y: px('by0'), y2: { field: 'by1' }, color: raw('fillColor'),
          tooltip: tip([['valueText', 'Value'], ['targetText', 'Target'], ['ratioText', 'Of target'], ['tipPace', 'Pace']]),
        },
      },
      {
        description: 'Target mark inside an overfull bar',
        transform: [{ filter: 'datum.r > 1' }],
        mark: { type: 'rule', strokeWidth: ex('2 * unit'), stroke: ex('cardColor') },
        encoding: { x: px('targetX'), x2: { field: 'targetX' }, y: px('by0'), y2: { field: 'by1' } },
      },
      {
        description: 'Pace marker: where the bar should be by now',
        transform: [{ filter: 'isValid(datum.paceX)' }],
        mark: { type: 'rule', strokeWidth: ex('2 * unit'), stroke: ex('paceColor'), strokeCap: 'butt' },
        encoding: { x: px('paceX'), x2: { field: 'paceX' }, y: px('py0'), y2: { field: 'py1' }, tooltip: tip([['tipPace', 'Pace']]) },
      },
    ],
  }),
  sample: [{ Value: 3184500, Target: 4000000, 'Percent Elapsed': 0.71 }],
  showcase: [
    shown('spend', [300, 90], { title: 'Spend', targetLabel: 'budget', higherIsBetter: false }, [{ Value: 3050000, Target: 4000000, 'Percent Elapsed': 0.71 }]),
    shown('no-pace', [240, 160], {}, [{ Value: 4380000, Target: 4000000, 'Percent Elapsed': null }]),
  ],
}

// ---------------------------------------------------------------- 3. KPI Bullet Tile

const bulletTile = {
  slug: 'kpi-bullet-tile',
  name: 'KPI Bullet Tile',
  description: 'One KPI as a compact bullet: the value bar, a target tick and qualitative bands set as shares of target, with the value and its gap to target beside it. Sized for a card, where Bullet Chart draws one row per category.',
  author: 'Timothy Osborn',
  render: { width: 300, height: 90 },
  fields: [
    { name: 'Value', kind: 'measure', type: 'numeric', description: 'The KPI.' },
    { name: 'Target', kind: 'measure', type: 'numeric', description: 'Its target. The bands are shares of it.' },
  ],
  params: [
    P('title', 'Sales', 'Card label, top left.'),
    P('targetLabel', 'Target', 'Label over the target tick.'),
    P('bandBreaks', [0.7, 0.9], 'Where the qualitative bands change, as shares of Target, lowest first. Two breaks make three bands.'),
    P('scaleMax', 1.2, 'Where the bullet ends, as a share of Target. It stretches when Value goes past it.'),
    P('bandColors', ['#C8C6C4', '#DCDAD8', '#EDEBE9'], 'Band fills from worst to best. With higherIsBetter false the worst band is the highest.'),
    P('axisFormat', '.0%', 'd3 format for the band labels under the bullet.'),
    E('barColor', 'pbiColor(0, -0.5)', 'Value bar.'),
    P('colorBarByStatus', false, '`true` colours the value bar good or bad against target.'),
    P('targetColor', '#252423', 'Target tick.'),
    ...formatParams(),
    varianceParam(),
    ...sentimentParams(),
    ...cardParams(),
    E('stacked', 'width < 2.4 * height', 'Side by side in a wide tile, stacked in a taller one.'),
    E('unit', 'stacked ? clamp(min(width / 240, height / 160), 0.5, 3) : clamp(min(width / 300, height / 90), 0.5, 3)', 'Scale factor, from 300 x 90 (240 x 160 stacked).'),
    E('pad', '14 * unit', 'Inset of the text and the bullet from the card edge.'),
    E('top0', 'max(0, (height - (stacked ? 160 : 90) * unit) / 2)', 'Top of the drawing, so a card taller than its scale centres it.'),
    E('textLimit', 'stacked ? width - 2 * pad : width * 0.44 - 1.5 * pad', 'Widest the title, value and gap may be before they end in an ellipsis.'),
    E('titleSize', '(stacked ? 13 : 11.5) * unit', 'Title text size.'),
    E('titleY', 'top0 + (stacked ? 24 : 21) * unit', 'Title baseline.'),
    E('valueSize', '(stacked ? 36 : 26) * unit', 'Value text size.'),
    E('valueY', 'top0 + (stacked ? 66 : 52) * unit', 'Value baseline.'),
    E('gapSize', '(stacked ? 12.5 : 11) * unit', 'Size of the gap-to-target line.'),
    E('gapY', 'top0 + (stacked ? 88 : 71) * unit', 'Baseline of the gap line.'),
    E('bulletX0', 'stacked ? pad : width * 0.44', 'Left end of the bullet: beside the text, or under it when stacked.'),
    E('bulletX1', 'width - pad', 'Right end of the bullet.'),
    E('labelSize', '9.5 * unit', 'Size of the target label and the band labels.'),
    E('targetLabelY', 'top0 + (stacked ? 106 : 22) * unit', 'Baseline of the target label over the tick.'),
    E('bandY0', 'top0 + (stacked ? 112 : 29) * unit', 'Top of the bands.'),
    E('bandY1', 'top0 + (stacked ? 136 : 61) * unit', 'Bottom of the bands.'),
    E('barY0', 'top0 + (stacked ? 119 : 39) * unit', 'Top of the value bar.'),
    E('barY1', 'top0 + (stacked ? 129 : 51) * unit', 'Bottom of the value bar.'),
    E('tickY0', 'top0 + (stacked ? 108 : 25) * unit', 'Top of the target tick.'),
    E('tickY1', 'top0 + (stacked ? 140 : 65) * unit', 'Bottom of the target tick.'),
    E('axisY', 'top0 + (stacked ? 153 : 78) * unit', 'Baseline of the band labels.'),
  ],
  body: () => {
    const xOf = (s) => `bulletX0 + (${s}) / datum.scaleEnd * (bulletX1 - bulletX0)`
    return {
      transform: [
        { aggregate: [...sumOf('__0__', 'v'), ...sumOf('__1__', 'tg')] },
        validSum('v'),
        validSum('tg'),
        calc('d', 'isValid(datum.v) && isValid(datum.tg) ? datum.v - datum.tg : null'),
        calc('p', 'isValid(datum.d) && datum.tg !== 0 ? datum.d / abs(datum.tg) : null'),
        calc('r', 'isValid(datum.v) && isValid(datum.tg) && datum.tg !== 0 ? datum.v / datum.tg : null'),
        calc('g', 'isValid(datum.d) ? (higherIsBetter ? 1 : -1) * datum.d : 0'),
        calc('statusColor', status('datum.g')),
        calc('isPts', ratePts()),
        calc('valueText', num('datum.v')),
        calc('targetText', num('datum.tg')),
        calc('gapText', `${arrow('datum.d')} + ' ' + (datum.isPts ? ${pts('datum.d')} : ${signed('datum.d')} + ' (' + ${pct('datum.p')} + ')')`),
        calc('scaleEnd', 'max(scaleMax, 1.04, isValid(datum.r) ? datum.r * 1.04 : 0)'),
        calc('barEnd', xOf('clamp(isValid(datum.r) ? datum.r : 0, 0, datum.scaleEnd)')),
        calc('targetX', xOf('1')),
        calc('targetLabelText', "targetLabel + ' ' + datum.targetText"),
        calc('targetLabelX', 'min(max(datum.targetX, bulletX0 + labelSize * 0.29 * length(datum.targetLabelText)), bulletX1 - labelSize * 0.29 * length(datum.targetLabelText))'),
        calc('barFill', 'colorBarByStatus ? datum.statusColor : barColor'),
        calc('bx0', 'bulletX0'), calc('by0', 'barY0'), calc('by1', 'barY1'), calc('ty0', 'tickY0'), calc('ty1', 'tickY1'),
        calc('tipGap', 'datum.gapText'),
      ],
      layer: [
        cardLayer(),
        txt('Title', { data: one, value: 'title', x: 'pad', y: 'titleY', size: 'titleSize', fill: 'labelColor', weight: 600, limit: 'textLimit' }),
        txt('Value', {
          field: 'valueText', x: 'pad', y: 'valueY', size: 'valueSize', fill: 'valueColor', weight: 'bold', limit: 'textLimit',
          tooltip: tip([['valueText', 'Value'], ['targetText', 'Target'], ['tipGap', 'Gap']]),
        }),
        txt('Gap to target, coloured good or bad', { field: 'gapText', x: 'pad', y: 'gapY', size: 'gapSize', colorField: 'statusColor', weight: 600, limit: 'textLimit' }),
        {
          description: 'Qualitative bands, one row each from the breaks',
          transform: [
            calc('bi', 'sequence(0, length(bandBreaks) + 1)'),
            { flatten: ['bi'] },
            calc('s0', 'datum.bi === 0 ? 0 : bandBreaks[datum.bi - 1]'),
            calc('s1', 'min(datum.bi === length(bandBreaks) ? datum.scaleEnd : bandBreaks[datum.bi], datum.scaleEnd)'),
            { filter: 'datum.s1 > datum.s0' },
            calc('x0', xOf('datum.s0')),
            calc('x1', xOf('datum.s1')),
            calc('y0', 'bandY0'), calc('y1', 'bandY1'),
            calc('fillBand', 'bandColors[clamp(higherIsBetter ? datum.bi : length(bandBreaks) - datum.bi, 0, length(bandColors) - 1)]'),
          ],
          mark: { type: 'rect' },
          encoding: { x: px('x0'), x2: { field: 'x1' }, y: px('y0'), y2: { field: 'y1' }, color: raw('fillBand') },
        },
        {
          description: 'Value bar',
          transform: [{ filter: 'datum.barEnd > datum.bx0' }],
          mark: { type: 'rect' },
          encoding: {
            x: px('bx0'), x2: { field: 'barEnd' }, y: px('by0'), y2: { field: 'by1' }, color: raw('barFill'),
            tooltip: tip([['valueText', 'Value'], ['targetText', 'Target'], ['tipGap', 'Gap']]),
          },
        },
        {
          description: 'Target tick',
          transform: [{ filter: 'isValid(datum.r)' }],
          mark: { type: 'rule', strokeWidth: ex('2.5 * unit'), stroke: ex('targetColor'), strokeCap: 'butt' },
          encoding: { x: px('targetX'), x2: { field: 'targetX' }, y: px('ty0'), y2: { field: 'ty1' }, tooltip: tip([['targetText', 'Target']]) },
        },
        txt('Target label over the tick, kept inside the bullet', {
          field: 'targetLabelText', align: 'center', size: 'labelSize', fill: 'labelColor', y: 'targetLabelY',
          transform: [{ filter: 'isValid(datum.r)' }],
          encoding: { x: px('targetLabelX') },
        }),
        txt('Band labels under the bullet, one per break; the target is labelled over its tick', {
          align: 'center', size: 'labelSize', fill: 'mutedColor', y: 'axisY',
          transform: [
            calc('li', 'sequence(0, length(bandBreaks))'),
            { flatten: ['li'] },
            calc('ls', 'bandBreaks[datum.li]'),
            { filter: 'datum.ls < datum.scaleEnd' },
            calc('lx', xOf('datum.ls')),
            calc('lt', 'format(datum.ls, axisFormat)'),
          ],
          field: 'lt',
          encoding: { x: px('lx') },
        }),
      ],
    }
  },
  sample: [{ Value: 1084200, Target: 1150000 }],
  showcase: [
    shown('orders', [300, 90], { title: 'Orders', valueFormat: ',.0f' }, [{ Value: 21400, Target: 18000 }]),
    shown('cost', [240, 160], { title: 'Operating cost', higherIsBetter: false, targetLabel: 'Budget', colorBarByStatus: true }, [{ Value: 2614900, Target: 2448300 }]),
  ],
}

// ---------------------------------------------------------------- 4. KPI Scorecard

const scorecard = {
  slug: 'kpi-scorecard',
  name: 'KPI Scorecard',
  description: 'Several KPIs in one visual, one row each: name, actual, target, the variance and a mini bar or status dot. A Format column lets a currency, a rate and a count share the table; rows that do not fit become a "+n more" line.',
  author: 'Timothy Osborn',
  render: { width: 400, height: 220 },
  fields: [
    { name: 'KPI Name', kind: 'column', type: 'text', description: 'One row per KPI, for example from a disconnected KPI table. Any category works too: a region or a product.' },
    { name: 'Value', kind: 'measure', type: 'numeric', description: 'The KPI value for the row.' },
    { name: 'Target', kind: 'measure', type: 'numeric', description: 'Its target, or a prior period.' },
    { name: 'Format', kind: 'column', type: 'text', description: "A d3 format per row ('$,.0f', '.1%', ',.0f' or 'auto'). Anything else, including a Power BI format string, falls back to valueFormat." },
  ],
  params: [
    P('title', 'KPI', 'Header over the name column.'),
    P('valueHeader', 'Actual', 'Header over the values.'),
    P('comparisonLabel', 'Target', 'Header over the targets.'),
    P('deltaHeader', 'Var', 'Header over the variances.'),
    P('sortBy', 'none', "'none' keeps the data order, 'name', 'value' (largest first) or 'status' (furthest behind first)."),
    P('statusStyle', 'bar', "'bar' draws a mini bar of Value against Target, 'dot' a status dot."),
    P('lowerIsBetter', ['Cost', 'Returns Rate'], 'KPI names where lower is better. Their colours flip.'),
    P('showTarget', true, 'Show the target column. It also hides itself under 360 px wide.'),
    ...formatParams(),
    varianceParam(),
    ...sentimentParams(),
    ...cardParams(),
    P('trackColor', '#EDEBE9', 'Mini bar track.'),
    P('rowLineColor', '#EDEBE9', 'Lines between rows.'),
    E('unit', 'clamp(min(width / 360, height / 140), 0.8, 2)', 'Scale factor for text and rows: drawn for 360 x 140.'),
    E('pad', '12 * unit', 'Inset from the card edge.'),
    E('fontSize', '12 * unit', 'Row text size.'),
    E('headerSize', '10 * unit', 'Column header text size.'),
    E('headerH', '22 * unit', 'Height of the header row.'),
    E('minRowH', '18 * unit', 'Shortest a row may be. Rows that would go under it become the "+n more" line.'),
    E('maxRowH', '30 * unit', 'Tallest a row may be, however few KPIs there are.'),
    E('statusW', "statusStyle === 'bar' ? clamp(width * 0.16, 28, 80 * unit) : 10 * unit", 'Width of the status column: the mini bar, or the dot.'),
    E('statusX1', 'width - pad', 'Right edge of the status column.'),
    E('statusX0', 'statusX1 - statusW', 'Left edge of the status column.'),
    E('deltaRight', 'statusX0 - 10 * unit', 'Right edge of the variance column.'),
    E('targetOn', 'showTarget && width >= 360', 'Whether the target column is drawn.'),
    E('targetRight', 'deltaRight - 70 * unit', 'Right edge of the target column.'),
    E('valueRight', 'targetOn ? targetRight - 50 * unit : deltaRight - 70 * unit', 'Right edge of the actual column.'),
    E('nameLimit', 'max(20, valueRight - 52 * unit - pad - 6)', 'Widest a KPI name may be before it ends in an ellipsis.'),
  ],
  body: () => ({
    transform: [
      { window: [{ op: 'row_number', as: 'rowIn' }] },
      {
        aggregate: [...sumOf('__1__', 'v'), ...sumOf('__2__', 'tg'), { op: 'min', field: 'rowIn', as: 'firstRow' }],
        groupby: ['__0__', '__3__'],
      },
      validSum('v'),
      validSum('tg'),
      calc('name', "isValid(datum['__0__']) ? datum['__0__'] + '' : noDataText"),
      calc('fmtRaw', "isValid(datum['__3__']) ? datum['__3__'] + '' : ''"),
      calc('f', `datum.fmtRaw === 'auto' || (length(datum.fmtRaw) > 0 && test(${D3_FORMAT}, datum.fmtRaw)) ? datum.fmtRaw : valueFormat`),
      calc('dir', '(indexof(lowerIsBetter, datum.name) >= 0 ? -1 : 1) * (higherIsBetter ? 1 : -1)'),
      calc('d', 'isValid(datum.v) && isValid(datum.tg) ? datum.v - datum.tg : null'),
      calc('p', 'isValid(datum.d) && datum.tg !== 0 ? datum.d / abs(datum.tg) : null'),
      calc('r', 'isValid(datum.v) && isValid(datum.tg) && datum.tg !== 0 ? datum.v / datum.tg : null'),
      calc('g', 'isValid(datum.d) ? datum.dir * datum.d : 0'),
      calc('statusColor', status('datum.g')),
      calc('isPts', ratePts('datum.f')),
      calc('valueText', num('datum.v', 'datum.f')),
      calc('targetText', num('datum.tg', 'datum.f')),
      calc('deltaText', `${arrow('datum.d')} + ' ' + (datum.isPts ? ${pts('datum.d')} : ${pct('datum.p')})`),
      calc('sortKey', "sortBy === 'value' ? (isValid(datum.v) ? -datum.v : 1e300) : sortBy === 'status' ? (isValid(datum.p) ? datum.dir * datum.p : 1e300) : sortBy === 'name' ? 0 : datum.firstRow"),
      { window: [{ op: 'row_number', as: 'rank' }], sort: [{ field: 'sortKey', order: 'ascending' }, { field: 'name', order: 'ascending' }] },
      { joinaggregate: [{ op: 'count', as: 'n' }] },
      calc('rowsFit', 'max(1, floor((height - headerH - pad / 2) / minRowH))'),
      calc('shown', 'datum.n <= datum.rowsFit ? datum.n : max(1, datum.rowsFit - 1)'),
      calc('rowH', 'clamp((height - headerH - pad / 2) / min(datum.n, datum.rowsFit), minRowH, maxRowH)'),
      calc('cy', 'headerH + (datum.rank - 0.5) * datum.rowH'),
      calc('lineY', 'headerH + (datum.rank - 1) * datum.rowH'),
      calc('barFrac', 'clamp(isValid(datum.r) ? datum.r : 0, 0, 1.25) / 1.25'),
      calc('sx0', 'statusX0'), calc('sx1', 'statusX1'),
      calc('fillX', 'statusX0 + datum.barFrac * statusW'),
      calc('tickX', 'statusX0 + statusW / 1.25'),
      calc('barY0', 'datum.cy - 3.5 * unit'), calc('barY1', 'datum.cy + 3.5 * unit'),
      calc('tickY0', 'datum.cy - 6 * unit'), calc('tickY1', 'datum.cy + 6 * unit'),
      calc('dotX', 'statusX1 - 5 * unit'),
      calc('dotSize', 'PI * pow(4.5 * unit, 2)'),
      calc('moreText', "'+' + (datum.n - datum.shown) + ' more'"),
      calc('lx0', 'pad'), calc('lx1', 'width - pad'),
    ],
    layer: [
      cardLayer(),
      txt('Header: name column', { data: one, value: 'title', x: 'pad', y: 'headerH * 0.68', size: 'headerSize', fill: 'labelColor', weight: 600, limit: 'nameLimit' }),
      txt('Header: values', { data: one, value: 'valueHeader', x: 'valueRight', y: 'headerH * 0.68', size: 'headerSize', fill: 'labelColor', weight: 600, align: 'right' }),
      txt('Header: targets', { data: one, value: 'comparisonLabel', x: 'targetRight', y: 'headerH * 0.68', size: 'headerSize', fill: 'labelColor', weight: 600, align: 'right', transform: [{ filter: 'targetOn' }] }),
      txt('Header: variances', { data: one, value: 'deltaHeader', x: 'deltaRight', y: 'headerH * 0.68', size: 'headerSize', fill: 'labelColor', weight: 600, align: 'right' }),
      {
        description: 'Line under the header',
        data: one,
        transform: [calc('lx0', 'pad'), calc('lx1', 'width - pad'), calc('ly', 'headerH')],
        mark: { type: 'rule', stroke: ex('borderColor'), strokeWidth: 1 },
        encoding: { x: px('lx0'), x2: { field: 'lx1' }, y: px('ly'), y2: { field: 'ly' } },
      },
      {
        description: 'Lines between rows',
        transform: [{ filter: 'datum.rank > 1 && datum.rank <= datum.shown + (datum.n > datum.shown ? 1 : 0)' }],
        mark: { type: 'rule', stroke: ex('rowLineColor'), strokeWidth: 1 },
        encoding: { x: px('lx0'), x2: { field: 'lx1' }, y: px('lineY'), y2: { field: 'lineY' } },
      },
      txt('KPI name', {
        field: 'name', size: 'fontSize', fill: 'labelColor', baseline: 'middle', x: 'pad', limit: 'nameLimit',
        transform: [{ filter: 'datum.rank <= datum.shown' }], encoding: { y: px('cy') },
        tooltip: tip([['name', 'KPI'], ['valueText', 'Actual'], ['targetText', 'Target'], ['deltaText', 'Variance']]),
      }),
      txt('Value', {
        field: 'valueText', size: 'fontSize', fill: 'valueColor', weight: 'bold', baseline: 'middle', align: 'right', x: 'valueRight',
        transform: [{ filter: 'datum.rank <= datum.shown' }], encoding: { y: px('cy') },
        tooltip: tip([['name', 'KPI'], ['valueText', 'Actual'], ['targetText', 'Target'], ['deltaText', 'Variance']]),
      }),
      txt('Target', {
        field: 'targetText', size: 'fontSize', fill: 'labelColor', baseline: 'middle', align: 'right', x: 'targetRight',
        transform: [{ filter: 'targetOn && datum.rank <= datum.shown' }], encoding: { y: px('cy') },
      }),
      txt('Variance, coloured good or bad', {
        field: 'deltaText', size: 'fontSize', colorField: 'statusColor', weight: 600, baseline: 'middle', align: 'right', x: 'deltaRight',
        transform: [{ filter: 'datum.rank <= datum.shown' }], encoding: { y: px('cy') },
      }),
      {
        description: 'Mini bar track',
        transform: [{ filter: "statusStyle === 'bar' && datum.rank <= datum.shown" }],
        mark: { type: 'rect', fill: ex('trackColor') },
        encoding: { x: px('sx0'), x2: { field: 'sx1' }, y: px('barY0'), y2: { field: 'barY1' } },
      },
      {
        description: 'Mini bar: Value against Target, to 125%',
        transform: [{ filter: "statusStyle === 'bar' && datum.rank <= datum.shown && datum.fillX > datum.sx0" }],
        mark: { type: 'rect' },
        encoding: {
          x: px('sx0'), x2: { field: 'fillX' }, y: px('barY0'), y2: { field: 'barY1' }, color: raw('statusColor'),
          tooltip: tip([['name', 'KPI'], ['valueText', 'Actual'], ['targetText', 'Target'], ['deltaText', 'Variance']]),
        },
      },
      {
        description: 'Mini bar: target tick at 100%',
        transform: [{ filter: "statusStyle === 'bar' && datum.rank <= datum.shown" }],
        mark: { type: 'rule', stroke: ex('valueColor'), strokeWidth: ex('1.5 * unit') },
        encoding: { x: px('tickX'), x2: { field: 'tickX' }, y: px('tickY0'), y2: { field: 'tickY1' } },
      },
      {
        description: 'Status dot',
        transform: [{ filter: "statusStyle === 'dot' && datum.rank <= datum.shown" }],
        mark: { type: 'point', filled: true, opacity: 1, shape: 'circle' },
        encoding: {
          x: px('dotX'), y: px('cy'), size: px('dotSize'), color: raw('statusColor'),
          tooltip: tip([['name', 'KPI'], ['valueText', 'Actual'], ['targetText', 'Target'], ['deltaText', 'Variance']]),
        },
      },
      txt('"+n more" when the rows do not fit', {
        field: 'moreText', size: 'fontSize', fill: 'mutedColor', italic: true, baseline: 'middle', x: 'pad',
        transform: [{ filter: 'datum.n > datum.shown && datum.rank === datum.shown + 1' }], encoding: { y: px('cy') },
      }),
    ],
  }),
  sample: [
    { 'KPI Name': 'Revenue', Value: 4215380, Target: 4000000, Format: 'auto' },
    { 'KPI Name': 'Gross Margin', Value: 0.382, Target: 0.4, Format: '.1%' },
    { 'KPI Name': 'Orders', Value: 18240, Target: 17500, Format: ',.0f' },
    { 'KPI Name': 'Avg Order Value', Value: 231.1, Target: 228, Format: '$,.2f' },
    { 'KPI Name': 'Returns Rate', Value: 0.041, Target: 0.035, Format: '.1%' },
    { 'KPI Name': 'New Customers', Value: 1320, Target: 1500, Format: ',.0f' },
  ],
  showcase: null,
}
scorecard.showcase = [shown('status', [400, 220], { sortBy: 'status', statusStyle: 'dot' }, scorecard.sample)]

// ---------------------------------------------------------------- date series for the samples

const wiggle = (i, seed) => {
  const x = Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453
  return x - Math.floor(x)
}
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const monthEnds = (year) => Array.from({ length: 12 }, (_, m) => iso(new Date(year, m + 1, 0)))

function monthlyHits(ratios, base, growth, valueKey = 'Value', round = 0) {
  return monthEnds(2025).map((date, i) => {
    const target = base * (1 + growth * i)
    const r = (x) => (round ? Math.round(x / round) * round : Math.round(x))
    return { Date: date, [valueKey]: r(target * ratios[i]), Target: r(target) }
  })
}
const weeklyHits = (ratios, base) =>
  ratios.map((ratio, i) => {
    const d = new Date(2026, 6, 6 + 7 * i)
    const target = Math.round(base * (1 + 0.01 * i))
    return { Date: iso(d), Value: Math.round(target * ratio), Target: target }
  })

// ---------------------------------------------------------------- 5. Hit or Miss Strip

const hitRatios = [0.96, 1.04, 1.07, 0.98, 1.03, 0.94, 0.99, 1.02, 1.05, 1.03, 1.08, 1.04]
const hitMiss = {
  slug: 'kpi-hit-miss-strip',
  name: 'Hit or Miss Strip',
  description: 'The last twelve periods against target, each a short column coloured hit or miss (or an even dot), with the hit count written large ("8 of 12 months on target"). Reads day, week, month, quarter or year from the dates.',
  author: 'Timothy Osborn',
  render: { width: 400, height: 220 },
  fields: [
    { name: 'Date', kind: 'column', type: 'dateTime', description: 'One row per period: a day, a week start, a month end. The strip shows the latest ones.' },
    { name: 'Value', kind: 'measure', type: 'numeric', description: 'The period value.' },
    { name: 'Target', kind: 'measure', type: 'numeric', description: 'The period target.' },
  ],
  params: [
    P('title', 'Sales vs target', 'Card label, top left.'),
    P('periods', 12, 'How many of the latest periods to show.'),
    P('periodNoun', 'auto', "'auto' reads the spacing of the dates; or 'day', 'week', 'month', 'quarter', 'year'."),
    P('hitText', 'on target', 'Wording after the period noun, "8 of 12 months on target".'),
    P('goodShare', 0.5, 'Share of periods hit at which the headline takes the good colour; below it, the bad one.'),
    P('markStyle', 'column', "'column' draws each gap to target as a short column above or below the target line, 'dot' an even dot."),
    P('maxGap', 0.1, 'The gap to target, as a share, that fills a column. Bigger gaps are capped.'),
    P('targetLineColor', '#C8C6C4', 'Target line through the strip.'),
    ...formatParams(),
    ...sentimentParams({ neutral: false, arrows: [] }),
    ...cardParams({ value: false }),
    E('stacked', 'width < 2.4 * height', 'Strip beside the text in a wide tile, under it in a taller one.'),
    E('unit', 'stacked ? clamp(min(width / 280, height / 190), 0.5, 3) : clamp(min(width / 300, height / 90), 0.5, 3)', 'Scale factor, from 300 x 90 (280 x 190 stacked).'),
    E('pad', '14 * unit', 'Inset of the text and the strip from the card edge.'),
    E('textLimit', 'stacked ? width * 0.6 : width * 0.46 - pad', 'Widest the hit count may be before it ends in an ellipsis.'),
    E('titleLimit', 'stacked ? width * 0.6 : width - 2 * pad', 'Widest the title may be.'),
    E('titleSize', '(stacked ? 13 : 11.5) * unit', 'Title text size.'),
    E('titleY', '(stacked ? 24 : 20) * unit', 'Title baseline.'),
    E('hitsSize', '(stacked ? 34 : 26) * unit', 'Size of the hit count, "8 of 12".'),
    E('hitsY', '(stacked ? 64 : 55) * unit', 'Baseline of the hit count.'),
    E('runSize', '(stacked ? 14 : 11) * unit', 'Size of the words after it, "months on target".'),
    E('runY', '(stacked ? 64 : 72) * unit', 'Their baseline: beside the count when stacked, under it in a tile.'),
    E('stripX0', 'stacked ? pad : width * 0.48', 'Left end of the strip: beside the text, or under it when stacked.'),
    E('stripX1', 'width - pad', 'Right end of the strip.'),
    E('stripY0', '(stacked ? 82 : 32) * unit', 'Top of the strip.'),
    E('stripY1', 'stacked ? height - 26 * unit : 80 * unit', 'Bottom of the strip.'),
    E('stripMid', '(stripY0 + stripY1) / 2', 'The target line, through the middle of the strip.'),
    E('showLabels', 'stacked', 'Whether the period labels are drawn under the strip. A band tile has no room for them.'),
    E('labelSize', '9.5 * unit', 'Period label size.'),
    E('labelY', 'height - 9 * unit', 'Period label baseline.'),
  ],
  body: () => ({
    transform: [
      calc('t', "time(toDate(datum['__0__']))"),
      { filter: 'isFinite(datum.t)' },
      { aggregate: [...sumOf('__1__', 'v'), ...sumOf('__2__', 'tg')], groupby: ['t'] },
      { filter: 'datum.vN > 0 && datum.tgN > 0' },
      calc('v', 'datum.vSum'),
      calc('tg', 'datum.tgSum'),
      { window: [{ op: 'row_number', as: 'back' }], sort: [{ field: 't', order: 'descending' }] },
      { filter: 'datum.back <= periods' },
      calc('hitNum', '(higherIsBetter ? datum.v >= datum.tg : datum.v <= datum.tg) ? 1 : 0'),
      { window: [{ op: 'lag', field: 't', as: 'prevT' }], sort: [{ field: 't', order: 'ascending' }] },
      calc('gapMs', 'isValid(datum.prevT) ? datum.t - datum.prevT : null'),
      {
        joinaggregate: [
          { op: 'count', as: 'n' }, { op: 'sum', field: 'hitNum', as: 'hits' }, { op: 'median', field: 'gapMs', as: 'gapMed' },
        ],
      },
      calc('noun', "periodNoun !== 'auto' ? periodNoun : !isValid(datum.gapMed) ? 'period' : datum.gapMed <= 1.5 * 864e5 ? 'day' : datum.gapMed <= 8.5 * 864e5 ? 'week' : datum.gapMed <= 32 * 864e5 ? 'month' : datum.gapMed <= 95 * 864e5 ? 'quarter' : 'year'"),
      calc('hitsText', "datum.hits + ' of ' + datum.n"),
      calc('runText', "(datum.n === 1 ? datum.noun : datum.noun + 's') + ' ' + hitText"),
      calc('hitsW', '((length(datum.hits + \'\') + length(datum.n + \'\')) * 0.575 + 1.545) * hitsSize'),
      calc('runX', 'stacked ? pad + datum.hitsW + 7 * unit : pad'),
      calc('runLimit', 'stacked ? width - pad - datum.runX : textLimit'),
      calc('hitsColor', 'datum.hits >= goodShare * datum.n ? colorGood : colorBad'),
      calc('idx', 'datum.n - datum.back'),
      calc('pitch', '(stripX1 - stripX0) / datum.n'),
      calc('cx', 'stripX0 + (datum.idx + 0.5) * datum.pitch'),
      calc('cw', 'min(datum.pitch * 0.68, 26 * unit)'),
      calc('cx0', 'datum.cx - datum.cw / 2'), calc('cx1', 'datum.cx + datum.cw / 2'),
      calc('gapShare', 'datum.tg !== 0 ? (datum.v - datum.tg) / abs(datum.tg) : 0'),
      calc('mag', 'max(abs(clamp(datum.gapShare / maxGap, -1, 1)) * (stripY1 - stripY0) / 2, 2 * unit)'),
      calc('cy0', 'datum.gapShare >= 0 ? stripMid - datum.mag : stripMid'),
      calc('cy1', 'datum.gapShare >= 0 ? stripMid : stripMid + datum.mag'),
      calc('cellColor', 'datum.hitNum === 1 ? colorGood : colorBad'),
      calc('dotSize', 'PI * pow(min(datum.cw, (stripY1 - stripY0) * 0.5) / 2, 2)'),
      calc('my', 'stripMid'),
      calc('lbl', "datum.noun === 'month' ? timeFormat(datum.t, '%b') : datum.noun === 'quarter' ? 'Q' + (quarter(datum.t) + 1) : datum.noun === 'year' ? timeFormat(datum.t, '%Y') : datum.noun === 'day' ? timeFormat(datum.t, '%-d') : timeFormat(datum.t, '%-d %b')"),
      calc('lblShort', "datum.noun === 'month' && datum.pitch < labelSize * 2.2 ? substring(datum.lbl, 0, 1) : datum.lbl"),
      calc('labelEvery', 'max(1, ceil(labelSize * 0.62 * length(datum.lblShort) * 1.2 / datum.pitch))'),
      calc('tipDate', "timeFormat(datum.t, '%-d %b %Y')"),
      calc('tipValue', num('datum.v')),
      calc('tipTarget', num('datum.tg')),
      calc('tipGap', pct('datum.gapShare')),
      calc('tipHit', "datum.hitNum === 1 ? 'Hit' : 'Miss'"),
      calc('sx0', 'stripX0'), calc('sx1', 'stripX1'),
    ],
    layer: [
      cardLayer(),
      txt('Title', { data: one, value: 'title', x: 'pad', y: 'titleY', size: 'titleSize', fill: 'labelColor', weight: 600, limit: 'titleLimit' }),
      txt('Hit count, the headline: 8 of 12', {
        field: 'hitsText', x: 'pad', y: 'hitsY', size: 'hitsSize', colorField: 'hitsColor', weight: 'bold', limit: 'textLimit',
        transform: [{ filter: 'datum.back === 1' }],
      }),
      txt('What was counted: months on target', {
        field: 'runText', y: 'runY', size: 'runSize', colorField: 'hitsColor', weight: 600, limit: 'datum.runLimit',
        transform: [{ filter: 'datum.back === 1' }], encoding: { x: px('runX') },
      }),
      {
        description: 'Target line through the strip',
        transform: [{ filter: "markStyle === 'column' && datum.back === 1" }],
        mark: { type: 'rule', stroke: ex('targetLineColor'), strokeWidth: 1, strokeDash: [3, 2] },
        encoding: { x: px('sx0'), x2: { field: 'sx1' }, y: px('my'), y2: { field: 'my' } },
      },
      {
        description: 'Columns: each period above or below the target line, coloured hit or miss',
        transform: [{ filter: "markStyle === 'column'" }],
        mark: { type: 'rect', cornerRadius: ex('1 * unit') },
        encoding: {
          x: px('cx0'), x2: { field: 'cx1' }, y: px('cy0'), y2: { field: 'cy1' }, color: raw('cellColor'),
          tooltip: tip([['tipDate', 'Period'], ['tipValue', 'Value'], ['tipTarget', 'Target'], ['tipGap', 'Gap'], ['tipHit', 'Result']]),
        },
      },
      {
        description: 'Dots: one per period, coloured hit or miss',
        transform: [{ filter: "markStyle === 'dot'" }],
        mark: { type: 'point', filled: true, opacity: 1, shape: 'circle' },
        encoding: {
          x: px('cx'), y: px('my'), size: px('dotSize'), color: raw('cellColor'),
          tooltip: tip([['tipDate', 'Period'], ['tipValue', 'Value'], ['tipTarget', 'Target'], ['tipGap', 'Gap'], ['tipHit', 'Result']]),
        },
      },
      txt('Period labels, thinned from the latest backwards', {
        field: 'lblShort', y: 'labelY', size: 'labelSize', fill: 'mutedColor', align: 'center',
        transform: [{ filter: 'showLabels && (datum.back - 1) % datum.labelEvery === 0' }], encoding: { x: px('cx') },
      }),
    ],
  }),
  sample: monthlyHits(hitRatios, 1200000, 0.017),
  showcase: [
    shown('orders', [300, 90], { title: 'Orders vs plan', valueFormat: ',.0f', markStyle: 'dot' }, weeklyHits([1.02, 0.97, 1.01, 1.04, 0.99, 1.03, 1.05, 1.02, 0.96, 1.01, 1.03, 1.02], 4200)),
    shown('cost', [300, 90], { title: 'Cost vs budget', higherIsBetter: false, hitText: 'within budget' }, monthlyHits([0.98, 1.03, 0.97, 0.99, 1.02, 0.96, 0.98, 0.99, 0.97, 1.01, 0.98, 0.99], 640000, 0.008)),
  ],
}

// ---------------------------------------------------------------- 6. Run-rate Projection Card

function dailyRun({ year = 2026, month = 9, days = 31, actualDays = 18, weekday, weekend, ratio, seed, round = 1, periodTarget = false }) {
  const rows = []
  const daily = []
  for (let d = 1; d <= days; d++) {
    const date = new Date(year, month, d)
    const dow = date.getDay()
    daily.push(dow === 0 || dow === 6 ? weekend : weekday)
  }
  const total = daily.reduce((a, b) => a + b, 0)
  for (let d = 1; d <= days; d++) {
    const target = daily[d - 1]
    const v = d <= actualDays ? Math.round((target * (ratio + 0.16 * (wiggle(d, seed) - 0.5))) / round) * round : null
    rows.push({ Date: iso(new Date(year, month, d)), Value: v, Target: periodTarget ? total : target })
  }
  return rows
}

const runRate = {
  slug: 'kpi-run-rate-card',
  name: 'Run-rate Projection Card',
  description: 'Period to date actual, a projected period end from the run rate so far, and the target: a cumulative line that turns into a dashed projection after the last day with data, coloured by whether it lands on target.',
  author: 'Timothy Osborn',
  render: { width: 400, height: 220 },
  fields: [
    { name: 'Date', kind: 'column', type: 'dateTime', description: 'One row per day of the period. Days still to come can carry a Target and a blank Value.' },
    { name: 'Value', kind: 'measure', type: 'numeric', description: 'The day value. Blank after the last day with data.' },
    { name: 'Target', kind: 'measure', type: 'numeric', description: 'The day target (summed), or the whole period target on every row with targetPerRow false.' },
  ],
  params: [
    P('title', 'Sales MTD', 'Card label, top left.'),
    P('periodEnd', 'auto', "Where the projection ends. 'data' is the last date in the data, 'month', 'quarter' or 'year' the end of that period around the last actual. 'auto' takes the data when it runs past the last actual, else the calendar period that fits the span."),
    P('targetPerRow', true, '`true`: each row carries its own target and the targets add up. `false`: every row carries the period target.'),
    P('projectedLabel', 'Projected', 'Label of the projection.'),
    P('targetNoun', 'target', 'Word for the target in the text.'),
    P('dateFormat', '%-d %b', 'd3 time format for the dates under the chart.'),
    E('lineColor', 'pbiColor(0, -0.3)', 'Actual line and area.'),
    P('areaOpacity', 0.12, 'Area under the actual line.'),
    P('targetLineColor', '#A19F9D', 'Dotted target line.'),
    P('todayLineColor', '#C8C6C4', 'Line at the last day with data.'),
    ...formatParams('.0%'),
    ...sentimentParams(),
    ...cardParams(),
    E('stacked', 'width < 2.4 * height', 'Chart beside the text in a wide tile, under it in a taller one.'),
    E('unit', 'stacked ? clamp(min(width / 280, height / 190), 0.5, 3) : clamp(min(width / 300, height / 90), 0.5, 3)', 'Scale factor, from 300 x 90 (280 x 190 stacked).'),
    E('pad', '14 * unit', 'Inset of the text and the chart from the card edge.'),
    E('titleSize', '(stacked ? 13 : 11.5) * unit', 'Title text size.'),
    E('titleY', '(stacked ? 24 : 19) * unit', 'Title baseline.'),
    E('valueSize', '(stacked ? 30 : 24) * unit', 'Size of the actual to date.'),
    E('valueY', '(stacked ? 58 : 46) * unit', 'Its baseline.'),
    E('leftLimit', 'stacked ? width * 0.5 - pad : width * 0.44 - pad', 'Widest the title and the actual may be before they end in an ellipsis.'),
    E('rightX', 'stacked ? width - pad : pad', 'Where the projection and its share of target sit: top right when stacked, under the actual in a tile.'),
    E('rightAlign', "stacked ? 'right' : 'left'", 'Their alignment.'),
    E('projSize', '(stacked ? 20 : 11) * unit', 'Size of the projected period end.'),
    E('projY', '(stacked ? 50 : 63) * unit', 'Its baseline.'),
    E('projLabelY', '24 * unit', 'Baseline of the projection label (stacked only).'),
    E('shareSize', '(stacked ? 11 : 10) * unit', 'Size of the share-of-target line.'),
    E('shareY', '(stacked ? 67 : 78) * unit', 'Its baseline.'),
    E('plotX0', 'stacked ? pad : width * 0.47', 'Left edge of the chart: beside the text, or under it when stacked.'),
    E('plotX1', 'width - pad', 'Right edge of the chart.'),
    E('plotY0', '(stacked ? 84 : 12) * unit', 'Top of the chart.'),
    E('plotY1', 'stacked ? height - 24 * unit : height - 12 * unit', 'Bottom of the chart, where the lines start from zero.'),
    E('labelSize', '9.5 * unit', 'Date label size (stacked only).'),
    E('labelY', 'height - 9 * unit', 'Date label baseline.'),
  ],
  body: () => {
    const xOf = (ms) => `plotX0 + ((${ms}) - datum.tMin) / (datum.pe - datum.tMin) * (plotX1 - plotX0)`
    const yOf = (val) => `plotY1 - (${val}) / datum.yMax * (plotY1 - plotY0)`
    return {
      transform: [
        calc('t', "time(toDate(datum['__0__']))"),
        { filter: 'isFinite(datum.t)' },
        { aggregate: [...sumOf('__1__', 'v'), ...sumOf('__2__', 'tg')], groupby: ['t'] },
        validSum('v'),
        validSum('tg'),
        { window: [{ op: 'row_number', as: 'k' }, { op: 'lag', field: 't', as: 'prevT' }], sort: [{ field: 't', order: 'ascending' }] },
        calc('gapMs', 'isValid(datum.prevT) ? datum.t - datum.prevT : null'),
        calc('actualT', 'isValid(datum.v) ? datum.t : null'),
        {
          joinaggregate: [
            { op: 'min', field: 't', as: 'tMin' }, { op: 'max', field: 't', as: 'tMax' }, { op: 'median', field: 'gapMs', as: 'step0' },
            { op: 'max', field: 'actualT', as: 'lastT' }, { op: 'sum', field: 'tg', as: 'tgSum' }, { op: 'max', field: 'tg', as: 'tgMax' },
          ],
        },
        { filter: 'isValid(datum.lastT)' },
        calc('step', 'isValid(datum.step0) && datum.step0 > 0 ? datum.step0 : 864e5'),
        calc('span', 'datum.lastT - datum.tMin + datum.step'),
        calc('endMonth', 'time(datetime(year(datum.lastT), month(datum.lastT) + 1, 1))'),
        calc('endQuarter', 'time(datetime(year(datum.lastT), floor(month(datum.lastT) / 3) * 3 + 3, 1))'),
        calc('endYear', 'time(datetime(year(datum.lastT) + 1, 0, 1))'),
        calc('peRaw', "periodEnd === 'data' ? datum.tMax + datum.step : periodEnd === 'month' ? datum.endMonth : periodEnd === 'quarter' ? datum.endQuarter : periodEnd === 'year' ? datum.endYear : datum.tMax > datum.lastT ? datum.tMax + datum.step : datum.span <= 31.5 * 864e5 ? datum.endMonth : datum.span <= 92.5 * 864e5 ? datum.endQuarter : datum.endYear"),
        calc('elapsedEnd', 'datum.lastT + datum.step'),
        calc('pe', 'max(datum.peRaw, datum.elapsedEnd)'),
        calc('share', '(datum.elapsedEnd - datum.tMin) / (datum.pe - datum.tMin)'),
        calc('v0', 'datum.t <= datum.lastT && isValid(datum.v) ? datum.v : 0'),
        calc('tg0', 'isValid(datum.tg) ? datum.tg : 0'),
        { window: [{ op: 'sum', field: 'v0', as: 'cumV' }, { op: 'sum', field: 'tg0', as: 'cumT' }], sort: [{ field: 't', order: 'ascending' }] },
        { joinaggregate: [{ op: 'sum', field: 'v0', as: 'actual' }] },
        calc('proj', 'datum.share > 0 ? datum.actual / datum.share : null'),
        calc('target', 'targetPerRow ? datum.tgSum : datum.tgMax'),
        calc('tShare', 'isValid(datum.proj) && isValid(datum.target) && datum.target !== 0 ? datum.proj / datum.target : null'),
        calc('g', 'isValid(datum.tShare) ? (higherIsBetter ? 1 : -1) * (datum.tShare - 1) : 0'),
        calc('projColor', status('datum.g')),
        calc('yMax', 'max(1e-9, datum.actual, isValid(datum.proj) ? datum.proj : 0, isValid(datum.target) ? datum.target : 0) * 1.06'),
        calc('valueText', num('datum.actual')),
        calc('projText', num('datum.proj')),
        calc('targetText', num('datum.target')),
        calc('shareText', `${pct('datum.tShare')} + ' of ' + datum.targetText + ' ' + targetNoun`),
        calc('projLine', `stacked ? ${arrow('datum.tShare - 1')} + ' ' + datum.projText : ${arrow('datum.tShare - 1')} + ' ' + projectedLabel + ' ' + datum.projText`),
        calc('tipLast', "timeFormat(datum.lastT, '%-d %b %Y')"),
      ],
      layer: [
        cardLayer(),
        txt('Title', { data: one, value: 'title', x: 'pad', y: 'titleY', size: 'titleSize', fill: 'labelColor', weight: 600, limit: 'leftLimit' }),
        txt('Actual to date', {
          field: 'valueText', x: 'pad', y: 'valueY', size: 'valueSize', fill: 'valueColor', weight: 'bold', limit: 'leftLimit',
          transform: [{ filter: 'datum.k === 1' }],
          tooltip: tip([['valueText', 'Actual'], ['projText', 'Projected'], ['targetText', 'Target'], ['tipLast', 'Data to']]),
        }),
        txt('Projection label (stacked only)', { data: one, value: 'projectedLabel', x: 'width - pad', y: 'projLabelY', size: '10.5 * unit', fill: 'labelColor', align: 'right', transform: [{ filter: 'stacked' }] }),
        txt('Projected period end, coloured by whether it reaches target', {
          field: 'projLine', x: 'rightX', y: 'projY', size: 'projSize', alignExpr: 'rightAlign', colorField: 'projColor', weight: 'bold', limit: 'stacked ? width * 0.46 - pad : width * 0.44 - pad',
          transform: [{ filter: 'datum.k === 1' }],
        }),
        txt('Projection as a share of target', {
          field: 'shareText', x: 'rightX', y: 'shareY', size: 'shareSize', alignExpr: 'rightAlign', fill: 'labelColor', limit: 'stacked ? width * 0.5 - pad : width * 0.44 - pad',
          transform: [{ filter: 'datum.k === 1' }],
        }),
        {
          description: 'Actual: cumulative area and line from zero, through the last day with data',
          transform: [
            { filter: 'datum.t <= datum.lastT' },
            calc('pts', 'datum.k === 1 ? [0, 1] : [1]'),
            { flatten: ['pts'] },
            calc('ax', `datum.pts === 0 ? ${xOf('datum.tMin')} : ${xOf('datum.t + datum.step')}`),
            calc('ay', `datum.pts === 0 ? ${yOf('0')} : ${yOf('datum.cumV')}`),
            calc('ay0', yOf('0')),
          ],
          layer: [
            { mark: { type: 'area', fill: ex('lineColor'), fillOpacity: ex('areaOpacity') }, encoding: { x: px('ax'), y: px('ay'), y2: { field: 'ay0' } } },
            { mark: { type: 'line', stroke: ex('lineColor'), strokeWidth: ex('2 * unit'), strokeJoin: 'round' }, encoding: { x: px('ax'), y: px('ay') } },
          ],
        },
        {
          description: 'Target: cumulative day targets, or a straight line to the period target',
          transform: [
            { filter: 'targetPerRow || datum.k === 1' },
            calc('pts', 'targetPerRow ? (datum.k === 1 ? [0, 1] : [1]) : [0, 2]'),
            { flatten: ['pts'] },
            calc('tx', `datum.pts === 0 ? ${xOf('datum.tMin')} : datum.pts === 2 ? ${xOf('datum.pe')} : ${xOf('datum.t + datum.step')}`),
            calc('ty', `datum.pts === 0 ? ${yOf('0')} : datum.pts === 2 ? ${yOf('datum.target')} : ${yOf('datum.cumT')}`),
          ],
          mark: { type: 'line', stroke: ex('targetLineColor'), strokeWidth: ex('1.5 * unit'), strokeDash: [2, 2] },
          encoding: { x: px('tx'), y: px('ty') },
        },
        {
          description: 'Line at the last day with data',
          transform: [{ filter: 'datum.k === 1 && datum.elapsedEnd < datum.pe' }, calc('lx', xOf('datum.elapsedEnd')), calc('ly0', 'plotY0'), calc('ly1', 'plotY1')],
          mark: { type: 'rule', stroke: ex('todayLineColor'), strokeWidth: 1, strokeDash: [3, 3] },
          encoding: { x: px('lx'), x2: { field: 'lx' }, y: px('ly0'), y2: { field: 'ly1' } },
        },
        {
          description: 'Projection: dashed from the last actual to the period end',
          transform: [
            { filter: 'datum.t === datum.lastT' },
            calc('pts', '[0, 1]'),
            { flatten: ['pts'] },
            calc('qx', `datum.pts === 0 ? ${xOf('datum.elapsedEnd')} : ${xOf('datum.pe')}`),
            calc('qy', `datum.pts === 0 ? ${yOf('datum.actual')} : ${yOf('datum.proj')}`),
          ],
          mark: { type: 'line', strokeWidth: ex('2 * unit'), strokeDash: [4, 3] },
          encoding: { x: px('qx'), y: px('qy'), color: raw('projColor') },
        },
        {
          description: 'Projection end point',
          transform: [{ filter: 'datum.t === datum.lastT && isValid(datum.proj)' }, calc('ex', xOf('datum.pe')), calc('ey', yOf('datum.proj')), calc('es', 'PI * pow(3.5 * unit, 2)')],
          mark: { type: 'point', filled: true, opacity: 1, shape: 'circle' },
          encoding: {
            x: px('ex'), y: px('ey'), size: px('es'), color: raw('projColor'),
            tooltip: tip([['projText', 'Projected'], ['targetText', 'Target'], ['shareText', 'Of target']]),
          },
        },
        {
          description: 'Dates under the chart: start, last actual, end (stacked only)',
          transform: [
            { filter: 'stacked && datum.k === 1' },
            calc('li', '[0, 1, 2]'),
            { flatten: ['li'] },
            calc('lx', `datum.li === 0 ? plotX0 : datum.li === 2 ? plotX1 : ${xOf('datum.elapsedEnd')}`),
            calc('lt', 'timeFormat(datum.li === 0 ? datum.tMin : datum.li === 2 ? datum.pe - 864e5 : datum.lastT, dateFormat)'),
            { filter: 'datum.li !== 1 || (datum.lx - plotX0 > 40 * unit && plotX1 - datum.lx > 40 * unit)' },
          ],
          layer: ['left', 'center', 'right'].map((align, li) => ({
            transform: [{ filter: `datum.li === ${li}` }],
            mark: { type: 'text', align, baseline: 'alphabetic', y: ex('labelY'), fontSize: ex('labelSize'), fill: ex('mutedColor') },
            encoding: { text: nom('lt'), x: px('lx') },
          })),
        },
      ],
    }
  },
  sample: dailyRun({ weekday: 165000, weekend: 95000, ratio: 0.95, seed: 3 }),
  showcase: [
    shown('orders', [300, 90], { title: 'Orders MTD', valueFormat: ',.0f' }, dailyRun({ weekday: 520, weekend: 310, ratio: 1.05, seed: 5 })),
    shown('cost', [300, 90], { title: 'Cost MTD', higherIsBetter: false }, dailyRun({ weekday: 98000, weekend: 52000, ratio: 0.97, seed: 11 })),
  ],
}
// ---------------------------------------------------------------- 7. KPI Small Multiples

function regions(names, bases, trends, seed) {
  const rows = []
  for (const [ri, name] of names.entries()) {
    monthEnds(2025).forEach((date, i) => {
      const season = 1 + 0.06 * Math.sin((i / 12) * 2 * Math.PI + ri)
      const noise = 1 + 0.07 * (wiggle(i + ri * 31, seed) - 0.5)
      rows.push({ Category: name, Date: date, Value: Math.round(bases[ri] * Math.pow(1 + trends[ri], i) * season * noise) })
    })
  }
  return rows
}
const regionNames = ['North', 'South', 'East', 'West', 'Central', 'Online']
const regionRows = regions(regionNames, [820000, 640000, 710000, 590000, 450000, 380000], [0.004, -0.006, 0.01, 0.002, -0.012, 0.035], 4)

const smallMultiples = {
  slug: 'kpi-small-multiples',
  name: 'KPI Small Multiples',
  description: 'One small KPI panel per category: the name on the left, the latest value and its change on the right, and a sparkline across the bottom, in a grid that reflows with the visual. Sorted by value, change or name; panels that do not fit are dropped from the end.',
  author: 'Timothy Osborn',
  render: { width: 400, height: 220 },
  fields: [
    { name: 'Category', kind: 'column', type: 'text', description: 'One panel each, for example Region or Product.' },
    { name: 'Date', kind: 'column', type: 'dateTime', description: 'The sparkline axis: a day, a week or a month.' },
    { name: 'Value', kind: 'measure', type: 'numeric', description: 'The KPI per category and date.' },
  ],
  params: [
    P('title', '', 'Header over the panels. Empty by default: use the visual title.'),
    P('columns', 0, '`0` lets the width decide; a number fixes the columns.'),
    P('minPanelWidth', 130, 'Narrowest panel, in pixels, when the width decides.'),
    P('minPanelHeight', 52, 'Shortest panel. Rows that would go under it are dropped.'),
    P('sortBy', 'value', "'value' (largest latest first), 'change' (best change first), 'name' or 'none' (data order)."),
    P('changeVs', 'previous', "'previous' compares the latest point with the one before, 'first' with the first point."),
    P('sharedScale', false, '`true` puts every sparkline on one value scale, so sizes compare; `false` fits each to its own range.'),
    ...formatParams(),
    ...sentimentParams(),
    ...cardParams({ muted: false }),
    P('panelColor', '#FAF9F8', 'Panel background.'),
    P('panelGap', 4, 'Gap between panels.'),
    E('lineColor', 'pbiColor(0, -0.3)', 'Sparklines.'),
    E('headerH', "length(title) > 0 ? clamp(height * 0.14, 18, 30) : 0", 'Height of the header: none without a title.'),
  ],
  body: () => ({
    transform: [
      { window: [{ op: 'row_number', as: 'rowIn' }] },
      calc('cat', "isValid(datum['__0__']) ? datum['__0__'] + '' : noDataText"),
      calc('t', "time(toDate(datum['__1__']))"),
      { filter: 'isFinite(datum.t)' },
      { aggregate: [...sumOf('__2__', 'v'), { op: 'min', field: 'rowIn', as: 'firstRow' }], groupby: ['cat', 't'] },
      { filter: 'datum.vN > 0' },
      calc('v', 'datum.vSum'),
      { window: [{ op: 'row_number', as: 'k' }, { op: 'lag', field: 'v', as: 'prevV' }], sort: [{ field: 't', order: 'ascending' }], groupby: ['cat'] },
      {
        joinaggregate: [
          { op: 'max', field: 't', as: 'lastT' }, { op: 'min', field: 'v', as: 'vMin' }, { op: 'max', field: 'v', as: 'vMax' },
          { op: 'min', field: 'firstRow', as: 'catRow' },
        ],
        groupby: ['cat'],
      },
      calc('latestPart', 'datum.t === datum.lastT ? datum.v : null'),
      calc('prevPart', 'datum.t === datum.lastT ? datum.prevV : null'),
      calc('firstPart', 'datum.k === 1 ? datum.v : null'),
      {
        joinaggregate: [{ op: 'max', field: 'latestPart', as: 'latest' }, { op: 'max', field: 'prevPart', as: 'prev' }, { op: 'max', field: 'firstPart', as: 'first' }],
        groupby: ['cat'],
      },
      {
        joinaggregate: [
          { op: 'min', field: 'v', as: 'gMin' }, { op: 'max', field: 'v', as: 'gMax' }, { op: 'min', field: 't', as: 'tMin' },
          { op: 'max', field: 't', as: 'tMax' }, { op: 'distinct', field: 'cat', as: 'nCats' },
        ],
      },
      calc('base', "changeVs === 'first' ? datum.first : datum.prev"),
      calc('ch', 'isValid(datum.base) && datum.base !== 0 ? (datum.latest - datum.base) / abs(datum.base) : null'),
      calc('g', 'isValid(datum.ch) ? (higherIsBetter ? 1 : -1) * datum.ch : 0'),
      calc('sortKey', "sortBy === 'value' ? -datum.latest : sortBy === 'change' ? (isValid(datum.ch) ? -datum.g : 1e300) : sortBy === 'name' ? 0 : datum.catRow"),
      { window: [{ op: 'dense_rank', as: 'panel' }], sort: [{ field: 'sortKey', order: 'ascending' }, { field: 'cat', order: 'ascending' }] },
      calc('cols', 'columns > 0 ? min(columns, datum.nCats) : clamp(floor(width / minPanelWidth), 1, datum.nCats)'),
      calc('rowsUsed', 'min(ceil(datum.nCats / datum.cols), max(1, floor((height - headerH) / minPanelHeight)))'),
      { filter: 'datum.panel <= datum.cols * datum.rowsUsed' },
      calc('pw', 'width / datum.cols'),
      calc('ph', '(height - headerH) / datum.rowsUsed'),
      calc('px0', '((datum.panel - 1) % datum.cols) * datum.pw'),
      calc('py0', 'headerH + floor((datum.panel - 1) / datum.cols) * datum.ph'),
      calc('pu', 'clamp(min(datum.pw / 150, datum.ph / 72), 0.6, 1.8)'),
      calc('ip', '7 * datum.pu'),
      calc('topY', 'datum.py0 + datum.ip + 12 * datum.pu'),
      calc('chY', 'datum.topY + 12 * datum.pu'),
      calc('sx0', 'datum.px0 + datum.ip'),
      calc('sx1', 'datum.px0 + datum.pw - datum.ip'),
      calc('sy1', 'datum.py0 + datum.ph - datum.ip'),
      calc('sy0', 'datum.chY + min(11 * datum.pu, 0.4 * (datum.sy1 - datum.chY))'),
      calc('lo', 'sharedScale ? datum.gMin : datum.vMin'),
      calc('hi', 'sharedScale ? datum.gMax : datum.vMax'),
      calc('sx', 'datum.tMax > datum.tMin ? datum.sx0 + (datum.t - datum.tMin) / (datum.tMax - datum.tMin) * (datum.sx1 - datum.sx0) : (datum.sx0 + datum.sx1) / 2'),
      calc('sy', 'datum.hi > datum.lo ? datum.sy1 - (datum.v - datum.lo) / (datum.hi - datum.lo) * (datum.sy1 - datum.sy0) : (datum.sy0 + datum.sy1) / 2'),
      calc('valueText', num('datum.latest')),
      calc('chText', `${arrow('datum.ch')} + ' ' + ${pct('datum.ch')}`),
      calc('chColor', status('datum.g')),
      calc('nameX', 'datum.px0 + datum.ip'),
      calc('nameY', 'datum.topY'),
      calc('nameSize', '10.5 * datum.pu'),
      calc('rightX', 'datum.px0 + datum.pw - datum.ip'),
      calc('valueY', 'datum.topY'),
      calc('valueSize', '15 * datum.pu'),
      calc('chSize', '10 * datum.pu'),
      calc('nameLimit', 'max(20, datum.pw - 2 * datum.ip - 0.6 * datum.valueSize * length(datum.valueText) - 6 * datum.pu)'),
      calc('bx0', 'datum.px0 + panelGap / 2'), calc('bx1', 'datum.px0 + datum.pw - panelGap / 2'),
      calc('by0', 'datum.py0 + panelGap / 2'), calc('by1', 'datum.py0 + datum.ph - panelGap / 2'),
      calc('lineW', '1.6 * datum.pu'),
      calc('dotSize', 'PI * pow(2.6 * datum.pu, 2)'),
      calc('tipDate', "timeFormat(datum.t, '%-d %b %Y')"),
      calc('tipValue', num('datum.v')),
    ],
    layer: [
      cardLayer(),
      txt('Title, when set', { data: one, value: 'title', x: '8', y: 'headerH * 0.7', size: 'headerH * 0.5', fill: 'labelColor', weight: 600, limit: 'width - 2 * panelGap', transform: [{ filter: 'length(title) > 0' }] }),
      {
        description: 'Panel backgrounds, one per category',
        transform: [{ filter: 'datum.t === datum.lastT' }],
        mark: { type: 'rect', fill: ex('panelColor'), cornerRadius: 3 },
        encoding: { x: px('bx0'), x2: { field: 'bx1' }, y: px('by0'), y2: { field: 'by1' } },
      },
      {
        description: 'Category name',
        transform: [{ filter: 'datum.t === datum.lastT' }],
        mark: { type: 'text', align: 'left', baseline: 'alphabetic', fontWeight: 600, fill: ex('labelColor'), limit: ex('datum.nameLimit') },
        encoding: { text: nom('cat'), x: px('nameX'), y: px('nameY'), size: px('nameSize') },
      },
      {
        description: 'Sparkline, one per category',
        mark: { type: 'line', stroke: ex('lineColor'), strokeJoin: 'round' },
        encoding: {
          x: px('sx'), y: px('sy'), detail: nom('cat'), strokeWidth: px('lineW'),
          tooltip: tip([['cat', 'Category'], ['tipDate', 'Date'], ['tipValue', 'Value']]),
        },
      },
      {
        description: 'Latest point',
        transform: [{ filter: 'datum.t === datum.lastT' }],
        mark: { type: 'point', filled: true, opacity: 1, shape: 'circle' },
        encoding: { x: px('sx'), y: px('sy'), size: px('dotSize'), color: raw('chColor') },
      },
      {
        description: 'Latest value',
        transform: [{ filter: 'datum.t === datum.lastT' }],
        mark: { type: 'text', align: 'right', baseline: 'alphabetic', fontWeight: 'bold', fill: ex('valueColor') },
        encoding: {
          text: nom('valueText'), x: px('rightX'), y: px('valueY'), size: px('valueSize'),
          tooltip: tip([['cat', 'Category'], ['valueText', 'Latest'], ['chText', 'Change']]),
        },
      },
      {
        description: 'Change, coloured good or bad',
        transform: [{ filter: 'datum.t === datum.lastT' }],
        mark: { type: 'text', align: 'right', baseline: 'alphabetic', fontWeight: 600 },
        encoding: { text: nom('chText'), x: px('rightX'), y: px('chY'), size: px('chSize'), color: raw('chColor') },
      },
    ],
  }),
  sample: regionRows,
  showcase: [
    shown('shared', [400, 220], { title: 'Sales by region', sharedScale: true, changeVs: 'first' }, regionRows),
  ],
}
// ---------------------------------------------------------------- 8. Ring Progress Card

const ringCard = {
  slug: 'kpi-ring-progress-card',
  name: 'Ring Progress Card',
  description: 'Value against target as a full ring with the percentage in the centre, and the value, target and what is left beside it. Past 100% a second lap starts in a darker shade. For when the half-donut gauge is too much.',
  author: 'Timothy Osborn',
  render: { width: 300, height: 90 },
  fields: [
    { name: 'Value', kind: 'measure', type: 'numeric', description: 'Progress so far.' },
    { name: 'Target', kind: 'measure', type: 'numeric', description: 'The target the ring fills to.' },
  ],
  params: [
    P('title', 'Sales', 'Card label, top of the text.'),
    P('targetLabel', 'target', 'Word for the target in the text.'),
    P('toGoText', 'to go', 'After the amount still needed.'),
    P('overText', 'over target', 'After the amount past the target.'),
    E('ringColor', 'pbiColor(0)', 'Ring fill.'),
    E('overColor', 'pbiColor(0, -0.45)', 'Second lap, past 100%.'),
    P('trackColor', '#EDEBE9', 'Ring track.'),
    P('colorByStatus', false, '`true` colours the ring good or bad against target.'),
    P('thickness', 0.17, 'Ring thickness, as a share of its radius.'),
    ...formatParams('.0%'),
    ...sentimentParams({ neutral: false, arrows: ['arrowUp'] }),
    ...cardParams({ muted: false }),
    E('pad', 'clamp(min(width, height) * 0.09, 6, 20)', 'Inset of the ring and the text from the card edge.'),
    E('ringR', 'max(8, min(height - 2 * pad, width * 0.38) / 2)', 'Outer radius of the ring: the full height, or up to 38% of the width.'),
    E('ringCX', 'pad + ringR', 'Horizontal centre of the ring.'),
    E('ringCY', 'height / 2', 'Vertical centre of the ring.'),
    E('innerR', 'ringR * (1 - thickness)', 'Inner radius.'),
    E('ringRound', '(ringR - innerR) / 2', 'Corner radius of the filled arc: fully round ends.'),
    E('textX', 'ringCX + ringR + max(10, pad)', 'Left edge of the text beside the ring.'),
    E('textW', 'max(20, width - textX - pad)', 'Room for the text.'),
    E('unit', 'clamp(min(textW / 150, height / 92), 0.55, 2.4)', 'Text scale, from the room beside the ring.'),
    E('blockTop', 'max(0, (height - 82 * unit) / 2)', 'Top of the text block, so it centres on the ring.'),
  ],
  body: () => ({
    transform: [
      { aggregate: [...sumOf('__0__', 'v'), ...sumOf('__1__', 'tg')] },
      validSum('v'),
      validSum('tg'),
      calc('r', 'isValid(datum.v) && isValid(datum.tg) && datum.tg !== 0 ? datum.v / datum.tg : null'),
      calc('rem', 'isValid(datum.v) && isValid(datum.tg) ? datum.tg - datum.v : null'),
      calc('remAbs', 'isValid(datum.rem) ? abs(datum.rem) : null'),
      calc('g', 'isValid(datum.r) ? (higherIsBetter ? 1 : -1) * (datum.r - 1) : 0'),
      calc('fillColor', 'colorByStatus ? (datum.g >= 0 ? colorGood : colorBad) : ringColor'),
      calc('fillTheta', '2 * PI * clamp(isValid(datum.r) ? datum.r : 0, 0, 1)'),
      calc('overTheta', '2 * PI * clamp(isValid(datum.r) ? datum.r - 1 : 0, 0, 1)'),
      calc('pctText', pct('datum.r')),
      calc('pctSize', 'min(innerR * 0.62, innerR * 1.75 / max(3, length(datum.pctText)))'),
      calc('valueText', num('datum.v')),
      calc('targetText', num('datum.tg')),
      calc('ofText', "'of ' + datum.targetText + ' ' + targetLabel"),
      calc('gapText', `!isValid(datum.rem) ? noDataText : datum.rem > 0 ? ${num('datum.remAbs')} + ' ' + toGoText : datum.rem < 0 ? arrowUp + ' ' + ${num('datum.remAbs')} + ' ' + overText : 'on ' + targetLabel`),
      calc('gapColor', 'isValid(datum.r) ? (higherIsBetter ? (datum.r >= 1 ? colorGood : labelColor) : (datum.r > 1 ? colorBad : colorGood)) : labelColor'),
    ],
    layer: [
      cardLayer(),
      {
        description: 'Ring track',
        data: one,
        mark: { type: 'arc', x: ex('ringCX'), y: ex('ringCY'), radius: ex('ringR'), radius2: ex('innerR'), theta: 0, theta2: ex('2 * PI'), fill: ex('trackColor') },
      },
      {
        description: 'Ring fill to the share of target, rounded ends',
        transform: [{ filter: 'datum.fillTheta > 0' }],
        mark: { type: 'arc', x: ex('ringCX'), y: ex('ringCY'), radius: ex('ringR'), radius2: ex('innerR'), theta: 0, theta2: ex('datum.fillTheta'), cornerRadius: ex('ringRound') },
        encoding: { fill: raw('fillColor'), tooltip: tip([['valueText', 'Value'], ['targetText', 'Target'], ['pctText', 'Of target']]) },
      },
      {
        description: 'Second lap past 100%',
        transform: [{ filter: 'datum.overTheta > 0' }],
        mark: { type: 'arc', x: ex('ringCX'), y: ex('ringCY'), radius: ex('ringR'), radius2: ex('innerR'), theta: 0, theta2: ex('datum.overTheta'), cornerRadius: ex('ringRound'), fill: ex('overColor') },
        encoding: { tooltip: tip([['valueText', 'Value'], ['targetText', 'Target'], ['pctText', 'Of target']]) },
      },
      {
        description: 'Percentage in the centre',
        mark: { type: 'text', x: ex('ringCX'), y: ex('ringCY'), align: 'center', baseline: 'middle', fontWeight: 'bold', fill: ex('valueColor') },
        encoding: { text: nom('pctText'), size: px('pctSize') },
      },
      txt('Title', { data: one, value: 'title', x: 'textX', y: 'blockTop + 13 * unit', size: '11.5 * unit', fill: 'labelColor', weight: 600, limit: 'textW' }),
      txt('Value', {
        field: 'valueText', x: 'textX', y: 'blockTop + 44 * unit', size: '26 * unit', fill: 'valueColor', weight: 'bold', limit: 'textW',
        tooltip: tip([['valueText', 'Value'], ['targetText', 'Target'], ['pctText', 'Of target']]),
      }),
      txt('Target', { field: 'ofText', x: 'textX', y: 'blockTop + 62 * unit', size: '11 * unit', fill: 'labelColor', limit: 'textW' }),
      txt('Left to go, or past target', { field: 'gapText', x: 'textX', y: 'blockTop + 79 * unit', size: '11 * unit', colorField: 'gapColor', weight: 600, limit: 'textW' }),
    ],
  }),
  sample: [{ Value: 3420000, Target: 4000000 }],
  showcase: [
    shown('orders', [300, 90], { title: 'Orders', valueFormat: ',.0f' }, [{ Value: 18240, Target: 17500 }]),
    shown('status', [400, 220], { colorByStatus: true }, [{ Value: 4380000, Target: 4000000 }]),
  ],
}

const TEMPLATES = [deltaTile, progressCard, bulletTile, scorecard, hitMiss, runRate, smallMultiples, ringCard]

// ---------------------------------------------------------------- write

function uuidFor(slug) {
  const h = createHash('sha1').update(`deneb-kpi-${slug}`).digest('hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${'89ab'[parseInt(h[16], 16) % 4]}${h.slice(17, 20)}-${h.slice(20, 32)}`
}

function templateJson(t, thumbnail) {
  const body = t.body()
  const information = { name: t.name, description: `${t.description} ${CREDIT}`, author: t.author, uuid: uuidFor(t.slug), generated: GENERATED }
  if (thumbnail) information.previewImageBase64PNG = thumbnail
  return {
    $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
    usermeta: {
      deneb: { build: '1.9.1.0', metaVersion: 1, provider: 'vegaLite', providerVersion: '6.4.1' },
      information,
      dataset: t.fields.map((f, i) => ({ key: `__${i}__`, name: f.name, description: f.description, type: f.type, kind: f.kind })),
      interactivity: { tooltip: true, contextMenu: true, selection: false, highlight: false, dataPointLimit: 50 },
    },
    config,
    padding: 0,
    params: t.params.map(({ doc, ...p }) => p),
    data: { name: 'dataset' },
    ...body,
  }
}

function csv(rows, names) {
  const cell = (v) => {
    if (v === null || v === undefined) return ''
    const s = String(v)
    return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s
  }
  return [names.join(','), ...rows.map((r) => names.map((n) => cell(r[n])).join(','))].join('\n') + '\n'
}

/** The showcase part: the template's own sample at its render size, then its other instances. */
function showcasePart(t) {
  const folder = `templates/kpi/${t.slug}`
  const own = { id: t.slug, page: 'template', data: `${folder}/sample-data.csv`, size: [t.render.width, t.render.height], params: {} }
  const others = t.showcase.map((s) => ({ id: `${t.slug}-${s.suffix}`, page: 'template', data: `showcase/data/${t.slug}-${s.suffix}.csv`, size: s.size, params: s.params }))
  return { template: `${folder}/${t.slug}.json`, instances: [own, ...others] }
}

const writeText = (path, text) => writeFileSync(path, text, { encoding: 'utf8' })

export { TEMPLATES }

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  for (const t of TEMPLATES) {
    const dir = join(REPO, 'templates', 'kpi', t.slug)
    mkdirSync(dir, { recursive: true })
    const file = join(dir, `${t.slug}.json`)
    const thumbnail = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')).usermeta?.information?.previewImageBase64PNG : undefined
    const names = t.fields.map((f) => f.name)
    writeText(file, JSON.stringify(templateJson(t, thumbnail), null, 2) + '\n')
    writeText(join(dir, 'sample-data.csv'), csv(t.sample, names))
    writeText(join(dir, 'render.json'), JSON.stringify(t.render) + '\n')
    for (const s of t.showcase) writeText(join(REPO, 'showcase', 'data', `${t.slug}-${s.suffix}.csv`), csv(s.rows, names))
    const part = JSON.stringify(showcasePart(t), null, 2).replace(/\[\s+(\d+),\s+(\d+)\s+\]/g, '[$1, $2]')
    writeText(join(REPO, 'showcase', 'parts', `${t.slug}.json`), part + '\n')
    console.log(`wrote ${t.slug}${thumbnail ? '' : ' (no thumbnail yet)'}, ${t.showcase.length + 1} showcase instances`)
  }
}
