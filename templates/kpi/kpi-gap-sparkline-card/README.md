# KPI Gap Sparkline Card

A month-to-date KPI card: the MTD value against last year (or a target), the gap as an amount and a percentage with an arrow and a good or bad colour, and a sparkline of the daily gap over the last 30 days with a trailing moving average.

![KPI Gap Sparkline Card](preview.png)

## Fields

| Name | Kind | Type | Description |
|---|---|---|---|
| Date | column | dateTime | The day. One row per day; the latest day with an Actual value is today. |
| Actual | measure | numeric | The value for the day, for example orders in euros. |
| Comparison | measure | numeric | The same day last year, or a daily target. |

What the spec works out from those three fields:

- **Today** is the latest Date with a non-blank Actual. Later rows are ignored, so a comparison that already runs to the end of the month does no harm.
- **MTD** is Actual summed over today's month, up to today. **MTD comparison** is Comparison summed over the same days.
- **Gap** is MTD minus MTD comparison, and **gap %** is the gap divided by MTD comparison. A positive gap shows `arrowUp` (↗), a negative one `arrowDown` (↘), a zero gap `arrowFlat` (→).
- **Daily gap** is Actual minus Comparison for each of the last `windowDays` days, today included.
- **Moving average** is the trailing mean of the daily gap over `avgDays` days: the day itself and the days before it, never days after it. The first days of the window use days from before the window when the data has them.
- **Colour:** the gap is good when it points the way `higherIsBetter` says, and bad otherwise. In the sparkline, the side above the baseline takes the good colour when `higherIsBetter` is true.
- **The TODAY callout** sits at the top right of the sparkline. When today's gap is in the top 40% of the chart it moves to the bottom right, on a card-coloured plate.

## Options

Every option is a param at the top of the spec. Change it there, or override it by name.

| Param | Default | What it changes |
|---|---|---|
| `title` | `Orders MTD (€)` | Card title, top left. Put the currency here, not on the values. |
| `comparisonLabel` | `MTD LY` | Label over the comparison value, and under the left end of the baseline. |
| `gapLabel` | `GAP` | Label over the gap. |
| `windowDays` | `30` | Days in the sparkline, today included. |
| `avgDays` | `5` | Days in the trailing moving average. |
| `windowLabel` | expression `'LAST ' + windowDays + ' DAYS'` | Sparkline header. Give it a `value` to replace the expression. |
| `dailyGapLabel` | `DAILY GAP` | Legend label for the daily gap line. |
| `avgLabel` | expression `avgDays + 'D AVG'` | Legend label for the moving average. |
| `todayLabel` | `TODAY` | Label over today's gap in the callout. |
| `valueFormat` | `.3~s` | d3 format for the MTD value, the comparison and the gap (`410M`). An SI `G` is shown as `B`. |
| `todayFormat` | `.2~s` | d3 format for today's gap in the callout (`1.8M`). |
| `pctFormat` | `.1%` | d3 format for the gap percentage. |
| `tooltipFormat` | `,.0f` | d3 format for the numbers in the tooltip. |
| `arrowUp` | `↗` | Arrow before a positive gap, in the headline and the TODAY callout. |
| `arrowDown` | `↘` | Arrow before a negative gap. |
| `arrowFlat` | `→` | Arrow before a zero gap. |
| `higherIsBetter` | `true` | `false` swaps the good and bad colours, for costs or returns. The arrows still follow the sign of the gap. |
| `drawCardFrame` | `true` | Draws the white card with its offset border. `false` leaves the background transparent. |
| `colorGood` | `pbiColor('good')` | Good colour, from the report theme. |
| `colorBad` | `pbiColor('bad')` | Bad colour, from the report theme. |
| `textPrimary` | `#323130` | Big value. |
| `textSecondary` | `#605E5C` | Title, comparison value, a zero gap. |
| `textMuted` | `#A19F9D` | Small labels, legend, baseline. |
| `avgLineColor` | `#323130` | Moving average line and its legend swatch. |
| `separatorColor` | `#E8E6E3` | Line under the headline figures. |
| `frameColor` | `#1F1F1F` | Card border: 1 px top and left, 3 px right and bottom. |
| `cardColor` | `#FFFFFF` | Card fill, the centre of the day markers and the callout plate. Set it to the page colour when `drawCardFrame` is `false`. |
| `cornerRadius` | `8` | Card corner radius in px. |
| `cardPadding` | `24` | Inner padding in px at 360 x 280. |
| `valueFontSize` | `40` | Size of the big value in px at 360 x 280. |
| `areaOpacity` | `0.3` | Opacity of the area fill next to the line. It fades to 0 at the baseline. |

The params below are worked out from the options and the visual size. Leave them alone.

| Param | What it holds |
|---|---|
| `colorAbove`, `colorBelow` | The colours for above and below the baseline, from `colorGood`, `colorBad` and `higherIsBetter`. |
| `fillAbove`, `fillBelow` | The gradient fills for the two areas. |
| `layoutScale` | `min(width / 360, height / 280)`, kept between 0.6 and 2. Fonts, padding and offsets are multiplied by it, so the card keeps its proportions at any size. |
| `layoutLeft`, `layoutRight`, `layoutTop`, `layoutBottom` | The content box inside the card padding. |
| `layoutColumn` | Left edge of the right-hand column (MTD LY and GAP). |
| `layoutSparkTop`, `layoutSparkBottom`, `layoutSparkLeft`, `layoutSparkRight` | The sparkline plot area. |
| `layoutHeaderY` | Vertical centre of the sparkline header row. |
| `layoutLegendGapWidth`, `layoutLegendAvgWidth`, `layoutLegendX`, `layoutLegendAvgX` | Legend layout. Vega cannot measure text, so the label widths are estimated at 0.6 x the font size per character. |

## Use it

In Power BI Desktop, add the Deneb visual from AppSource and put Date, Actual and Comparison in its Values well. Open the Deneb editor, choose to create a new specification from a template (import), pick `kpi-gap-sparkline-card.json`, and map Date, Actual and Comparison to your fields.

The visual needs one row per day for the last `windowDays + avgDays - 1` days, today included (34 days with the defaults), and at least back to the first day of today's month. Do not filter it to the current month, or the sparkline loses the days from last month: a relative date filter such as "in the last 2 months" works. Use a date column, not a date-time with times. Actual must be additive (orders, revenue, units), because the MTD is its sum; leave it blank for days that have not happened yet. The card was built for Deneb 1.9.1 and also runs on Deneb 2.0. It uses Segoe UI, and the arrows are the Unicode characters ↗, ↘ and → (the `arrowUp`, `arrowDown` and `arrowFlat` params).

The gap text is semibold, and neither Segoe UI Semibold nor Arial has ↗ or ↘ (both have →), so Power BI draws the two diagonal arrows from a fallback font. Set the params to ▲/▼ or ↑/↓ if you want every arrow in the card's own font.

## Credit

The design is the "full make-over" KPI card in Ruben Van de Voorde's article [Better KPI visualizations in Power BI reports: a comprehensive guide](https://tabulareditor.com/blog/kpi-card-best-practices-dashboard-design), published by Tabular Editor ApS on the Tabular Editor blog (10 March 2026). Author page: [Ruben Van de Voorde](https://tabulareditor.com/blog/author/ruben-van-de-voorde).

This card is an independent Deneb reimplementation of the design shown in the article, built from our own Vega-Lite spec and our own invented sample data. It uses no code, images or data from the article. The article and its images remain Tabular Editor ApS copyright.

Rebuilt as a Deneb template by Timothy Osborn.

What changed from the original:

- Segoe UI instead of Albert Sans, because Deneb cannot load web fonts.
- Unicode arrows (↗, ↘) instead of the article's trend icon, and → for a zero gap.
- The good and bad colours come from the report theme instead of a fixed blue and pink.
- The moving average is trailing, not centred, so the latest days are never averaged with days that have not happened yet.
- The sparkline holds exactly `windowDays` days, today included.
- Fonts, padding and offsets scale with the size of the visual.
- The daily gap line, its markers and the moving average are drawn a little heavier than in the article, so they stay legible at report size.
- The TODAY callout moves to the bottom right when today's gap sits high in the chart, and sits on a card-coloured plate.
- The numbers are our own: a made-up June 2026 of daily orders in euros, not the figures in the article.

## Licence

MIT, see [LICENSE](../../../LICENSE). The design credit above stays with its author.
