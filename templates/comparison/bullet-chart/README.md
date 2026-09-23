# Bullet Chart

Horizontal bullets, one row per category, that compare Actual with a Budget tick and a wide Last Year bar,
with the bar coloured good or bad against Budget.

![Bullet Chart](preview.png)

## Fields

| Name | Kind | Type | Description |
|---|---|---|---|
| Category | column | text | One row per category, for example a product. Labels each row. |
| Actual | measure | numeric | The main bar and its value label. Rows sort by it, largest first. |
| Budget | measure | numeric | The target tick. Actual at or above it colours the bar good, below it bad. |
| Last Year | measure | numeric | The wide light bar behind the Actual bar, and the second variance in the tooltip. |

The variances are calculated in the spec, so you do not need variance measures.

## Options

Every option is a param at the top of the spec. Change the value there.

| Param | Default | What it changes |
|---|---|---|
| `colorGood` | `pbiColor('good')` | Actual bar and variance label when Actual is at or above Budget. |
| `colorBad` | `pbiColor('bad')` | Actual bar and variance label when Actual is below Budget. |
| `colorNoBudget` | `pbiColor('neutral')` | Actual bar for a row with no Budget. Its value label is dark, and it has no variance label. |
| `colorLastYear` | `#C8C6C4` | Fill of the Last Year bar. |
| `lastYearOpacity` | `0.6` | Opacity of the Last Year bar, so it stays in the background on any page colour. |
| `colorTarget` | `#252423` | The Budget tick. |
| `colorValueInside` | `#FFFFFF` | Actual value label when it sits inside the bar. |
| `colorValueOutside` | `#252423` | Actual value label when it sits past the bar end. |
| `colorCategoryText` | `#252423` | Category labels. |
| `colorAxisText` | `#605E5C` | Value axis labels. |
| `colorGrid` | `#C8C6C4` | Dotted gridlines and the baseline. |
| `valueFormat` | `.3s` | d3 format of the Actual label, e.g. `29.6k`. Use `$.3s` for currency. |
| `varianceFormat` | `.1%` | d3 format of the variance label. Leave the sign out: the spec adds `+` or `-`. |
| `axisFormat` | `~s` | d3 format of the value axis labels. |
| `tooltipValueFormat` | `,.0f` | d3 format of the values and absolute variances in the tooltip. |
| `tooltipPercentFormat` | `.1%` | d3 format of the % variances in the tooltip. The spec adds the sign. |
| `valueLabelPosition` | `end` | `end` puts the Actual label inside the bar end; `base` puts it inside the bar start, as the 2023 version did. |
| `labelFontSize` | `12` | Size of the Actual and variance labels. |
| `labelPadding` | `5` | Space in pixels between a label and the bar end, the tick or the other label. |
| `categoryFontSize` | `12` | Size of the category labels. |
| `categoryLabelLimit` | `200` | Widest category label in pixels. Longer names end in an ellipsis. |
| `axisFontSize` | `11` | Size of the value axis labels. |
| `actualBarBand` | `0.5` | Height of the Actual bar as a share of the row. |
| `lastYearBand` | `0.9` | Height of the Last Year bar and the Budget tick as a share of the row. |
| `rowPadding` | `0.1` | Gap between rows as a share of the row step. |
| `barCornerRadius` | `4` | Rounding of the Actual bar end. |
| `targetThickness` | `3` | Width of the Budget tick in pixels. |
| `labelGutter` | an expression | Pixels kept free right of the value axis for the labels. Calculated from the label font size, and wider when rows are too thin for labels inside the bars. Set a number to fix it. |

## Use it

1. In Power BI Desktop, add a Deneb visual and put your category column and the three measures in
   its Values well.
2. Open the Deneb editor, choose to create a new specification from a template (Import template),
   and pick `bullet-chart.json`.
3. Map Category, Actual, Budget and Last Year to your fields, then create.

The visual expects one row per category, with positive values. The spec sorts the rows itself.
Each row fills an equal share of the visual's height, so size the visual to the number of
categories: at about 20 rows or more in a 480 px tall visual, the labels move past the bar ends, and
they hide when a row is thinner than the label font.

The Actual label sits inside the bar when it fits. On a short bar it moves past the bar end in dark
text, clear of the Budget tick, and the variance label moves along with it. The variance label takes
its sign from the same Actual versus Budget test as the bar colour, so a small shortfall reads
`-0.2%` on a bad bar, never `0%`. The tooltip shows all three values and both variances,
absolute and %.

## Credit

- Design: Robert Mundigl, [Variations of alternative bullet graphs in Excel](https://www.clearlyandsimply.com/clearly_and_simply/2017/07/variations-of-alternative-bullet-graphs-in-excel.html) (Clearly and Simply, 2017).
- First Deneb version: Daniel Marsh-Patrick, [Making "The Mundigl Bullets" with Deneb](https://coacervo.co/deneb_mundigl) (2022), with his template in [this gist](https://gist.github.com/dm-p/3a4c154a61bb54599b7c7a7c00dff562).
- This version: Timothy Osborn (2023). It keeps Daniel's layout (sorted rows, bar, full-height
  target tick, value label) and drops his gap arrows. It adds the Last Year bar, colours the bar by
  its variance to Budget, and adds the variance label and the tooltip.

Rebuilt as a Deneb template by Timothy Osborn. This template replaces `Bullet Chart.jsonc`, which
used to sit in the root of this repo ([last version](https://github.com/InsightfulAnalytics/Deneb/blob/30881523d170322671b10e0bdd84d8646390d0ae/Bullet%20Chart.jsonc)).
Changes from the 2023 version:

- Four fields instead of eight. The four variance measures are now calculated in the spec.
- The variance label carries a sign and one decimal, and takes its colour and sign from the bar's
  test. The old label printed `0%` on a red bar for a -0.2% shortfall.
- The Actual label sits inside the bar end and moves outside in dark text on a short bar. The old
  label was white at the bar start and vanished on short bars.
- The rows fill the visual's height. The old spec used a fixed 50 px row, so it overflowed or left
  space.
- Colours come from the report theme (good, bad, neutral), and every colour, format and size is a
  param.
- The config was cleaned up: the invalid `fontSize` of `"1"` and the unused line, area, point,
  symbol, legend and header settings are gone.

## Licence

MIT, see [LICENSE](../../../LICENSE). The design credit above stays with its author.
