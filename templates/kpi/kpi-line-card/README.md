# KPI Line Card

A whole KPI card in one Deneb visual: a header band, the reporting month's value, three status lines coloured by its gap to target, and a monthly line with a target line and good/bad markers.

![KPI Line Card](preview.png)

## Fields

| Name | Kind | Type | Description |
|---|---|---|---|
| Month | column | dateTime | Month end date, one row per month. The line draws every month it receives. |
| Value | measure | numeric | The month's value, for example net revenue or an on-time delivery rate. |
| Target | measure | numeric | The month's target for Value. |
| Is Reporting Month | measure | numeric | 1 on the month the card reports on, else 0. With no 1 in the data the latest month is used. |

All the card maths happens in the spec. From the flagged month it works out:

- the big value: that month's Value;
- MoM: the change from the month before it, as a share of that month;
- the gap: Value minus Target for the reporting month, which also sets the colour of the three status lines (good above target, bad below, neutral on it);
- the reporting-year figure: the months of the reporting month's year up to and including it, summed or averaged (`yearAggregate`).

Each marker is coloured by its own month's Value against its own Target. The flag moves the text, never the line.

## Options

Every option is a parameter at the top of the spec. Change it there, or override it by name.

| Parameter | Default | What it changes |
|---|---|---|
| `title` | `REVENUE` | Header text. Type it in the case you want to show. |
| `headerColor` | `pbiColor(0)` | Header band fill, from the report theme. |
| `headerTextColor` | `#FFFFFF` | Header text colour. |
| `cardColor` | `#FFFFFF` | Card background. |
| `borderColor` | `pbiColor(0, -0.25)` | Card border colour. |
| `borderWidth` | `1` | Card border width in pixels. `0` hides it. |
| `valueFormat` | `$,.0f` | d3 format for the big value and the tooltips. Use `.1%` for a rate. |
| `valueColor` | `pbiColor(0, -0.5)` | Big value colour. |
| `valueColorByStatus` | `false` | `true` colours the big value like the status lines. |
| `metricLabel` | `Rev` | First word of the second and third status lines. |
| `rmLabel` | `RM` | Reporting month abbreviation. |
| `ryLabel` | `RY` | Reporting year abbreviation. |
| `momLabel` | `MoM` | Label of the first status line. |
| `momFormat` | `+.1%` | d3 format for the MoM change. A leading `+` shows the sign on rises. |
| `arrowUp` | `▲` | Shown when the value rose. |
| `arrowDown` | `▼` | Shown when it fell. |
| `arrowFlat` | `►` | Shown when it did not change. |
| `varianceUnit` | `absolute` | How the gap is shown: `absolute` (Value minus Target, divided by `valueDivisor`), `points` (the raw difference, for rates: 98.6% against 95% reads +3.6%), or `percent` (the gap as a share of Target). |
| `deltaFormat` | `$,.2~f` | d3 format for the gap. A leading `+` shows the sign on a positive gap; a negative gap always shows `-`. |
| `valueDivisor` | `1000` | Divides the absolute gap and the reporting-year figure before they are formatted. The big value is not divided. Use `1` for rates. |
| `valueSuffix` | `K` | Written after a divided number. Use an empty string for rates. |
| `ryFormat` | `$,.2~f` | d3 format for the reporting-year figure. |
| `yearAggregate` | `sum` | `sum` for totals such as revenue, `mean` for rates (the average of the monthly values). |
| `aboveText` | `above` | Gap line wording when Value is above Target. |
| `belowText` | `below` | Wording when it is below. |
| `onText` | `on` | Wording when it equals Target. |
| `targetNoun` | `target rev` | Last words of the gap line. |
| `targetLabel` | `Target Rev` | Label on the target line. |
| `noDataText` | `n/a` | Shown when a figure cannot be worked out, such as MoM for the first month. |
| `higherIsBetter` | `true` | `false` flips good and bad, for measures such as cost or discount rate. |
| `dateFormat` | `%b %y` | d3 time format for the month labels and tooltips. `%b %y` gives "Jan 15". |
| `colorGood` | `pbiColor('good')` | Good colour, from the theme's sentiment colours. |
| `colorBad` | `pbiColor('bad')` | Bad colour. |
| `colorNeutral` | `pbiColor('neutral')` | Neutral colour (gap of exactly zero, or no target). |
| `lineColor` | `pbiColor(0, -0.5)` | Line colour. |
| `targetLineColor` | `#A19F9D` | Dotted target line colour. |
| `labelColor` | `#605E5C` | Month labels and target label. |
| `xPadding` | `0.4` | Space before the first month and after the last, in months. |

The layout scales with the visual. These parameters are worked out from the container size; change the numbers in them to restyle.

| Parameter | Default | What it changes |
|---|---|---|
| `unit` | `clamp(min(width / 264, height / 235), 0.5, 4)` | Scale factor. The card is drawn for 264 x 235 pixels and grows or shrinks from there. |
| `margin` | `19 * unit` | Left and right inset of the text and the chart. |
| `headerHeight` | `33 * unit` | Header band height. |
| `titleSize` | `14.5 * unit` | Header text size. |
| `valueSize` | `35 * unit` | Big value size. |
| `statusSize` | `11 * unit` | Status line text size. |
| `statusLineHeight` | `13.8 * unit` | Status line spacing. |
| `labelSize` | `9.5 * unit` | Month label size. |
| `valueBaseline` | `headerHeight + 39 * unit` | Baseline of the big value. |
| `statusBaseline` | `valueBaseline + 31 * unit` | Baseline of the first status line. |
| `plotTop` | `statusBaseline + 2 * statusLineHeight + 17 * unit` | Where the highest point of the line sits. |
| `plotBottom` | `height - 30 * unit` | Where the lowest point sits. |
| `axisBaseline` | `height - 10 * unit` | Baseline of the month labels. |
| `markerRadius` | `4.6 * unit` | Marker radius. |
| `lineWidth` | `1.8 * unit` | Monthly line width. |
| `targetLineWidth` | `2 * unit` | Target line width. |
| `targetLineDash` | `[2 * unit, 1.7 * unit]` | Target line dash and gap lengths. |
| `targetLabelSize` | `10 * unit` | Target label size. |

## Use it

1. In Power BI, add a Deneb visual and add the four fields to its Values well.
2. Open the Deneb editor, choose to create a new specification from a template (Import), and pick `kpi-line-card.json`.
3. Map Month, Value, Target and Is Reporting Month to your fields, then create.
4. Turn off the Power BI visual border and background: the card draws its own.

The data should be one row per month. Use a month-end date column itself, not its date hierarchy, and filter the visual to the months the line should show (for example the reporting year). The spec sorts the months itself. Value and Target are ordinary measures evaluated per month, so they need no `ALL()`.

To pick the reporting month with a slicer that moves the text but not the line, slice on a disconnected month table and flag the matching row:

```dax
Is Reporting Month =
VAR SelectedMonth = SELECTEDVALUE ( 'Reporting Month'[End of Month] )
RETURN IF ( MAX ( 'Date'[End of Month] ) = SelectedMonth, 1, 0 )
```

For a rate such as on-time delivery, set `valueFormat` to `.1%`, `varianceUnit` to `points`, `deltaFormat` and `ryFormat` to `+.1%` or `.1%`, `valueDivisor` to `1`, `valueSuffix` to an empty string and `yearAggregate` to `mean`.

## Credit

Design by Gerard Duggan ([dg-analysis.com](https://dg-analysis.com)), from his video [Next Level KPIs in Power BI](https://youtu.be/ZVknC7YEMB4) (2023) and his Medium article [Next level KPI in Power BI](https://medium.com/@duggangerard/next-level-kpi-in-power-bi-6d9dc7825ee4). His YouTube channel is [@dganalysis](https://www.youtube.com/@dganalysis). The REVENUE and ON-TIME DELIVERY cards on his Northwind KPI dashboard use this design.

His original KPI cards were built with native Power BI visuals: a line chart with a dynamic title and subtitle, grouped with a text box header. (The analysis charts lower on his dashboard were Deneb.) This template is an independent Deneb reimplementation of the design, with its own spec.

Rebuilt as a Deneb template by Timothy Osborn.

What changed from the original:

- The whole card, header and border included, is one Deneb visual instead of a line chart grouped with a text box.
- Colours come from the report theme instead of his fixed teal, red and grey, and the font is Segoe UI instead of Trebuchet MS.
- The reporting-year figure follows the flagged month: it covers that month's year up to and including it. His followed the date table's completed months and did not move with the slicer.
- For rates, `yearAggregate: mean` is the plain average of the monthly rates. His on-time delivery figure was weighted by order count, so on real data the two can differ slightly when monthly volumes differ.
- The on-time delivery sample months were nudged: January is 0.910 and February 0.983 in [`showcase/data/dash-otd.csv`](../../../showcase/data/dash-otd.csv), against the 0.908 and 0.980 read from his dashboard, so that the plain mean of the four months reproduces his on-screen RY of +94.9%. His exact months give a plain mean of 94.8%. March, April and the four revenue months are his numbers unchanged.
- MoM compares with the month before it in the data; his DAX looked up the previous calendar month.
- A gap of exactly zero reads "on target" in the neutral colour; his text read "below".
- The target label moves below the line when the first month sits above target, so it does not collide with that marker. The target line steps if the target changes from month to month.
- Month labels thin out when the months are too close to label them all.

## Licence

MIT, see [LICENSE](../../../LICENSE). The design credit above stays with its author.
