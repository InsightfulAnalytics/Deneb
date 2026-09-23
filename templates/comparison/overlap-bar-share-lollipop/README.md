# Overlapping Bars with Share Lollipop

For each category, a dark current bar sits in front of a grey total bar, and a lollipop on the right shows the current value as a share of the total.

![Overlapping Bars with Share Lollipop](preview.png)

## Fields

| Name | Kind | Type | Description |
|---|---|---|---|
| Category | column | text | One row per category, for example customer or product. Keep it to a short top-N list; long names wrap onto two lines. |
| Current | measure | numeric | The current value, for example reporting month revenue. Drawn as the dark front bar and used as the top of the share. |
| Total | measure | numeric | The total the current value is part of, for example reporting year revenue. Drawn as the grey back bar; the share is Current / Total. |

## Options

Each option is a named param at the top of the spec. Change its `value` (or `expr` for the theme colours).

| Option | Default | What it changes |
|---|---|---|
| `title` | `""` | Optional title above the chart. Empty (the default) draws none and leaves the heading to the Power BI visual title. |
| `subtitle` | `""` | Optional smaller grey line under the title. Empty draws none. |
| `currentBarColor` | `pbiColor(1)` | Fill of the current bar, and the stem colour through `lollipopStemColor`. |
| `currentBarStroke` | `pbiColor(1, -0.3)` | Outline of the current bar. |
| `totalBarColor` | `#E1E1E1` | Fill of the total bar. |
| `totalBarStroke` | `#A6A6A6` | Outline of the total bar. |
| `barStrokeWidth` | `1` | Outline width of both bars, in pixels. |
| `lollipopStemColor` | `currentBarColor` | Stem colour. |
| `lollipopHeadColor` | `pbiColor(1, 0.8)` | Fill of the circle head, a light tint of the accent. |
| `lollipopHeadStroke` | `pbiColor(1, 0.3)` | Outline of the circle head. |
| `lollipopHeadStrokeWidth` | `1.5` | Outline width of the circle head, in pixels. |
| `textColor` | `#252423` | Category names, total labels, current labels placed outside their bar, and share labels. |
| `currentLabelColor` | `#FFFFFF` | Current labels placed inside their bar. |
| `subtitleColor` | `#605E5C` | Subtitle colour. |
| `valueFormat` | `$,.1f` | d3 format for the bar labels, applied after dividing by `valueDivisor`. |
| `valueDivisor` | `1000` | Bar labels show the value divided by this. Use `1` for raw values. |
| `valueSuffix` | `K` | Text after each bar label. Use `""` for none. |
| `shareFormat` | `.1%` | d3 format for the share labels. |
| `tooltipValueFormat` | `$,.0f` | d3 format for Current and Total in the tooltip (not divided). |
| `sortBy` | `current` | Row order: `current`, `total` or `share`. |
| `sortDescending` | `true` | Largest first when true. |
| `titleFontSize` | `13` | Title size. |
| `subtitleFontSize` | `10` | Subtitle size. |
| `categoryFontSize` | `12` | Size of the category names. |
| `categoryWrapChars` | `10` | Names longer than this wrap onto two lines at the space nearest the middle. |
| `categoryLabelLimit` | `140` | Widest a category line may be, in pixels; longer lines end in an ellipsis. |
| `categoryGap` | `10` | Pixels between the category names and the bars. |
| `labelFontSize` | `11` | Size of the bar labels. |
| `shareFontSize` | `12` | Size of the share labels. |
| `labelGap` | `4` | Pixels between a label and its bar end or circle. |
| `labelCharWidth` | `0.55` | Average character width as a share of the font size. Used to decide whether a label fits inside its bar and how much room the share labels need. Raise it for a wider font. |
| `totalBarHeight` | `0.44` | Thickness of the total bar, as a share of the row height. |
| `totalBarOffset` | `-0.08` | Shift of the total bar from the row centre, as a share of the row height. Negative moves it up. |
| `currentBarHeight` | `0.34` | Thickness of the current bar, as a share of the row height. |
| `currentBarOffset` | `0.13` | Shift of the current bar from the row centre, as a share of the row height. Positive moves it down. |
| `lollipopGap` | `0.07` | Space between the bar area and the stems, as a share of the plot width. |
| `lollipopLength` | `0.18` | Length of the longest stem, as a share of the plot width. |
| `lollipopOffset` | `0` | Shift of the lollipop from the row centre, as a share of the row height. |
| `lollipopStemWidth` | `3` | Stem width in pixels. |
| `lollipopHeadSize` | `160` | Area of the circle head in square pixels. |
| `shareAxisMax` | `0` | The share that fills a whole stem. `0` uses the largest share in the data, as the original does; `1` draws every stem against 100%. |

How the space is shared: the category names take what they need on the left, the share labels get just enough room on the right, the stems take `lollipopLength`, and the bars get the rest. A bar label sits inside the end of its bar when it fits. Otherwise it sits just past the bar end in dark text (a current label drops just below the total bar's outline, so the line never runs through it), or is hidden when there is no room before the stems. The tooltip always has the values.

## Use it

In Power BI Desktop, add a Deneb visual and put your category column and the two measures in its Values well. Open the Deneb editor, choose to create a new specification from a template (import), pick `overlap-bar-share-lollipop.json`, map Category, Current and Total to your fields, and create. The tooltip titles use your field names.

The data should be one row per category, already cut to the rows you want to show (a TOPN filter or a visual-level Top N filter on the category). Current and Total share one bar scale, so they should be non-negative values in the same unit. The template sorts the rows itself, by Current, largest first.

## Credit

Design by Gerard Duggan ([dg-analysis.com](https://dg-analysis.com)). These are his "RM Top 3 customers by revenue" and "RM Top 3 products by revenue" charts from his Northwind "KPI Dashboard | 2015", shown in his video [Next Level KPIs in Power BI](https://youtu.be/ZVknC7YEMB4) (2023) and his Medium article [Next level KPI in Power BI](https://medium.com/@duggangerard/next-level-kpi-in-power-bi-6d9dc7825ee4). More of his work is on his YouTube channel, [@dganalysis](https://www.youtube.com/@dganalysis).

His original charts were built with Deneb; the KPI cards on the same dashboard are native visuals. His spec is not published. This template is an independent Deneb (Vega-Lite) reimplementation of the design, with its own spec.

Rebuilt as a Deneb template by Timothy Osborn.

What changed from the original:

- Colours follow the report theme: the accent is theme colour 2 (`pbiColor(1)`) instead of his fixed dark teal. The total bar keeps fixed greys.
- Segoe UI instead of Trebuchet MS.
- No column headings: his "RM revenue vs RY revenue | RM:RY % value" key sat over the bar and lollipop columns. Here the heading is left to the Power BI visual title by default, or to the optional `title` and `subtitle` params as one plain line each.
- The lollipop head is a flat tint with an outline, not a shaded ball.
- Bar labels go inside when they fit and outside when they do not, decided per label from its width, and are hidden when there is no room at all. A current label placed outside drops just below the total bar's outline; in the original the outline ran through those labels.
- Long names wrap at the space nearest the middle, so "Côte de Blaye" breaks as "Côte de / Blaye".
- Adds a tooltip, and options for sorting and number formats.

## Licence

MIT, see [LICENSE](../../../LICENSE). The design credit above stays with its author.
