# Bullet with Prior Period

One horizontal bullet per metric: a thick bar for the actual, a lighter band behind it for the previous period, and a dark tick for the target, each row on its own axis.

![Bullet with Prior Period](preview.png)

## Fields

| Name | Kind | Type | Description |
|---|---|---|---|
| Metric | column | text | Row label, one row per metric, e.g. `RM Revenue`. |
| Sort Order | column | numeric | Row order, smallest at the top. |
| Actual | measure | numeric | Current period value: the thick bar. |
| Target | measure | numeric | Target for the current period: the dark tick. |
| Previous | measure | numeric | Previous period value: the light band behind the bar. |
| Higher Is Better | measure | numeric | `1` when a value above target is good, `0` when a value below target is good. Blank counts as `1`. |

## Options

Every option is a parameter at the top of the spec. Colours default to the report theme.

| Parameter | Default | What it changes |
|---|---|---|
| `valueFormat` | `.1~%` | d3 format for the axis labels and the tooltip. `.1~%` shows `2%` on the axis and `8.1%` in the tooltip. Use `,.0f` or `$,.0f` for amounts. |
| `independentScales` | `true` | `true` gives every row its own axis. `false` puts all rows on one shared scale. |
| `axisMax` | `null` | A fixed axis maximum for every row, e.g. `1` for rates that stop at 100%. `null` sizes each axis from its data. |
| `headroom` | `0.1` | Space past the largest value, as a share of it. `0.1` ends the track 10% past the longest bar or tick. |
| `tickCount` | `3` | Rough number of axis ticks per row. Labels are thinned automatically when a row is too narrow to fit them. |
| `colorGood` | `pbiColor('good')` | Actual bar when it beats target. |
| `colorBad` | `pbiColor('bad')` | Actual bar when it misses target. |
| `colorNeutral` | `pbiColor('neutral')` | Actual bar when the row has no target. |
| `colorGoodTint` | `pbiColor('good', 0.6)` | Previous-period band when that period beat target. |
| `colorBadTint` | `pbiColor('bad', 0.6)` | Previous-period band when that period missed target. |
| `colorNeutralTint` | `pbiColor('neutral', 0.6)` | Previous-period band when the row has no target. |
| `trackColor` | `#EEF0F3` | Grey background track behind each bullet. |
| `targetColor` | `#252423` | Target tick. |
| `trackThickness` | `0.48` | Track height as a share of the row height. |
| `previousBandThickness` | `0.66` | Previous-period band height as a share of the track. |
| `actualBarThickness` | `0.4` | Actual bar height as a share of the track. |
| `targetTickLength` | `0.7` | Target tick height as a share of the track. |
| `targetTickWidth` | `3` | Target tick width in pixels. |
| `rowLabelFontSize` | `12` | Row label size in pixels. |
| `rowLabelColor` | `#252423` | Row label colour. |
| `rowLabelLimit` | `140` | Maximum row label width in pixels; longer labels end in an ellipsis. |
| `axisFontSize` | `9` | Axis label size in pixels. |
| `axisLabelColor` | `#605E5C` | Axis label colour. |
| `axisTickColor` | `#A19F9D` | Axis tick mark colour. |

## Use it

In Power BI, add a Deneb visual, open its editor, choose to create a new specification from a template (Import), and pick `bullet-prior-period.json`. Map Metric and Sort Order as columns (set Sort Order to Don't summarize) and the other four as measures.

The actual bar takes the theme's good colour when it beats target and the bad colour when it misses. The previous-period band takes a light tint of the same two colours, judged against the same target. "Beats" depends on the row: revenue and on-time delivery are higher-is-better, a discount rate is lower-is-better.

The visual expects one row per metric. A small table with one row per metric (Metric, Sort Order) and `SWITCH` measures for Actual, Target, Previous and Higher Is Better works well. All rows share one `valueFormat`, so keep one unit per visual: put amounts in one visual and rates in another. Rows are sorted by Sort Order, whatever order they arrive in. Negative values draw from zero to the left.

`sample-data.csv` has four rate rows, two higher-is-better (on-time delivery, target 95%) and two lower-is-better (discount rate, target 6.5%). Between them they show both bar colours, both band tints and two different axes (0-100% and 0-8%) in one picture, which a revenue row could not join because it needs a different number format. The figures are Gerard Duggan's April 2015 Northwind values; the previous figure for RY OTD is illustrative.

The spec is Vega-Lite. It is one layered view rather than a facet, because a Vega-Lite facet cannot fill the Deneb container, so each row's axis is drawn with tick and text marks.

## Credit

Design by Gerard Duggan ([dg-analysis.com](https://dg-analysis.com), [YouTube @dganalysis](https://www.youtube.com/@dganalysis)). It is one of the analysis charts on his Northwind "KPI Dashboard | 2015", shown in his video [Next Level KPIs in Power BI](https://youtu.be/ZVknC7YEMB4) (2023) and his Medium article [Next level KPI in Power BI](https://medium.com/@duggangerard/next-level-kpi-in-power-bi-6d9dc7825ee4). In his original, the KPI cards are native visuals and the analysis charts, this bullet among them, were built in Deneb. His spec was never published: this is an independent Deneb reimplementation of the design, with its own spec.

Rebuilt as a Deneb template by Timothy Osborn.

Changed from the original:

- Colours come from the report theme (good, bad and their tints) instead of his fixed teal and red.
- The axis ticks line up with the bars. In his published image the axis sits a few pixels to the right of the bars' zero.
- His chart title and coloured subtitle are not part of the template. Use the visual title or a text box.
- The tooltip is built in: actual, target, previous, the gap to target and the status. His dashboard used a report page tooltip.
- Added a shared-scale option, a fixed axis maximum, automatic thinning of axis labels on narrow rows, and a neutral colour for rows without a target.

## Licence

MIT, see [LICENSE](../../../LICENSE). The design credit above stays with its author.
