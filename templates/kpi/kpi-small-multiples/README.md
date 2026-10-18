# KPI Small Multiples

One small KPI panel per category: the name on the left, the latest value and its change on the right, and a sparkline across the bottom, in a grid that reflows with the visual. Sorted by value, change or name; panels that do not fit are dropped from the end.

![KPI Small Multiples](preview.png)

## Fields

| Name | Kind | Type | Description |
|---|---|---|---|
| Category | column | text | One panel each, for example Region or Product. |
| Date | column | dateTime | The sparkline axis: a day, a week or a month. |
| Value | measure | numeric | The KPI per category and date. |

All the maths happens in the spec:

- **One panel per Category**, its sparkline drawn over Date. Rows with the same category and date are summed.
- **The latest value** is the category's value at its last date, written top right, with its change under it: against the point before (`changeVs` `previous`) or against the first point (`first`), as a percentage with an arrow, coloured good or bad. The last point on the sparkline takes the same colour.
- **The grid reflows** with the visual: as many columns as fit `minPanelWidth` (or `columns`, when set), and as many rows as fit `minPanelHeight`. Panels that do not fit are dropped from the end of the sort order.
- **`sortBy`** orders the panels: by latest value (the default), by change, by name, or as the data arrives.
- **Each sparkline** fits its own range, so a small category still shows its shape. `sharedScale` `true` puts every sparkline on one scale, so their sizes compare.

Numbers use `valueFormat`. Its default, `auto`, rounds to K, M or bn with one decimal under ten (`$4.2M`, `$816K`, `$18`), with `prefix` in front. Give it a d3 format instead for anything else: `.1%` for a rate, `,.0f` for a count, `$,.0f` for whole dollars.

The panels scale with their own size, drawn for 150 by 72 each. It is built for a grid cell, 400 by 220 and up, rather than a KPI band: at 90 pixels tall it shows its first row of panels only.

## Options

Every option is a parameter at the top of the spec. Change it there, or override it by name.

| Parameter | Default | What it changes |
|---|---|---|
| `title` | empty | Header over the panels. Empty by default: use the visual title. |
| `columns` | `0` | `0` lets the width decide; a number fixes the columns. |
| `minPanelWidth` | `130` | Narrowest panel, in pixels, when the width decides. |
| `minPanelHeight` | `52` | Shortest panel. Rows that would go under it are dropped. |
| `sortBy` | `value` | 'value' (largest latest first), 'change' (best change first), 'name' or 'none' (data order). |
| `changeVs` | `previous` | 'previous' compares the latest point with the one before, 'first' with the first point. |
| `sharedScale` | `false` | `true` puts every sparkline on one value scale, so sizes compare; `false` fits each to its own range. |
| `valueFormat` | `auto` | d3 format for every value. 'auto' rounds to K, M or bn with one decimal under ten, as a KPI should; use '.1%' for a rate or ',.0f' for a count. |
| `prefix` | `$` | Written before an 'auto' value. Use an empty string for counts. |
| `pctFormat` | `+.1%` | d3 format for percentages. |
| `noDataText` | `n/a` | Shown when a figure cannot be worked out. |
| `higherIsBetter` | `true` | `false` flips good and bad, for cost, spend or a returns rate. |
| `colorGood` | `pbiColor('good')` | Good colour, from the theme. |
| `colorBad` | `pbiColor('bad')` | Bad colour, from the theme. |
| `colorNeutral` | `pbiColor('neutral')` | Neutral colour: no change, or nothing to compare. |
| `arrowUp` | `▲` | Shown when the figure rose. |
| `arrowDown` | `▼` | Shown when it fell. |
| `arrowFlat` | `►` | Shown when it did not change. |
| `cardColor` | `#FFFFFF` | Card background. |
| `borderColor` | `#E1DFDD` | Card border. |
| `borderWidth` | `1` | Border width in pixels. `0` hides it. |
| `cardRadius` | `4` | Corner radius of the card. |
| `valueColor` | `pbiColor(0, -0.5)` | Headline value colour. |
| `labelColor` | `#605E5C` | Labels and secondary text. |
| `panelColor` | `#FAF9F8` | Panel background. |
| `panelGap` | `4` | Gap between panels. |
| `lineColor` | `pbiColor(0, -0.3)` | Sparklines. |

The layout scales with the visual. These parameters are worked out from the container size; change the numbers in them to restyle.

| Parameter | Default | What it changes |
|---|---|---|
| `headerH` | `length(title) > 0 ? clamp(height * 0.14, 18, 30) : 0` | Height of the header: none without a title. |

## Use it

1. In Power BI, add a Deneb visual and add the three fields to its Values well.
2. Open the Deneb editor, choose to create a new specification from a template (Import), and pick `kpi-small-multiples.json`.
3. Map Category, Date and Value to your fields, then create.
4. Turn off the Power BI visual border and background: the card draws its own.

Bind a category column (Region, Product, Channel), a date column at the grain of the sparkline (a day, a week or a month, not its date hierarchy) and one measure. Filter the visual to the dates the sparklines should cover. Leave `title` empty and use the visual's own title, or set it to draw a header over the panels.

This template and seven other KPI templates are generated by [`tools/kpi/build.mjs`](../../../tools/kpi/build.mjs), which they share their number formatting and layout rules through: change the generator rather than the JSON.

## Credit

Design by Timothy Osborn.

## Licence

MIT, see [LICENSE](../../../LICENSE).
