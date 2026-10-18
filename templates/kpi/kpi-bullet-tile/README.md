# KPI Bullet Tile

One KPI as a compact bullet: the value bar, a target tick and qualitative bands set as shares of target, with the value and its gap to target beside it. Sized for a card, where Bullet Chart draws one row per category.

![KPI Bullet Tile](preview.png)

## Fields

| Name | Kind | Type | Description |
|---|---|---|---|
| Value | measure | numeric | The KPI. |
| Target | measure | numeric | Its target. The bands are shares of it. |

All the maths happens in the spec:

- **Value and Target** are each summed over the rows that arrive. Bind measures only and Power BI sends one row.
- **The bullet** runs from zero to `scaleMax` times Target (120% by default), and stretches when Value goes past that. The qualitative bands change at `bandBreaks`, shares of Target (70% and 90% by default), and are labelled under the bullet. The target tick is labelled over it, kept inside the bullet's ends.
- **The gap** is Value minus Target, as an amount and a percentage of Target, with an arrow, coloured good or bad. A rate (`valueFormat` with a `%`) shows its gap in percentage points.
- **With `higherIsBetter` `false`** the band colours flip, so the darkest band sits at the top of the scale, where a cost is furthest over budget.

Numbers use `valueFormat`. Its default, `auto`, rounds to K, M or bn with one decimal under ten (`$4.2M`, `$816K`, `$18`), with `prefix` in front. Give it a d3 format instead for anything else: `.1%` for a rate, `,.0f` for a count, `$,.0f` for whole dollars.

Wider than 2.4 times its height, the tile is a band tile (300 by 90): title, value and gap on the left, the bullet on the right. In a taller card it stacks, drawn for 240 by 160, with the bullet under the text. Bullet Chart in this repo draws one bullet per category; this one is a single KPI sized for a card.

## Options

Every option is a parameter at the top of the spec. Change it there, or override it by name.

| Parameter | Default | What it changes |
|---|---|---|
| `title` | `Sales` | Card label, top left. |
| `targetLabel` | `Target` | Label over the target tick. |
| `bandBreaks` | `[0.7, 0.9]` | Where the qualitative bands change, as shares of Target, lowest first. Two breaks make three bands. |
| `scaleMax` | `1.2` | Where the bullet ends, as a share of Target. It stretches when Value goes past it. |
| `bandColors` | `["#C8C6C4", "#DCDAD8", "#EDEBE9"]` | Band fills from worst to best. With higherIsBetter false the worst band is the highest. |
| `axisFormat` | `.0%` | d3 format for the band labels under the bullet. |
| `barColor` | `pbiColor(0, -0.5)` | Value bar. |
| `colorBarByStatus` | `false` | `true` colours the value bar good or bad against target. |
| `targetColor` | `#252423` | Target tick. |
| `valueFormat` | `auto` | d3 format for every value. 'auto' rounds to K, M or bn with one decimal under ten, as a KPI should; use '.1%' for a rate or ',.0f' for a count. |
| `prefix` | `$` | Written before an 'auto' value. Use an empty string for counts. |
| `pctFormat` | `+.1%` | d3 format for percentages. |
| `noDataText` | `n/a` | Shown when a figure cannot be worked out. |
| `varianceUnit` | `auto` | 'percent' shows a gap as a share of the comparison, 'points' as the difference in percentage points (for rates). 'auto' uses points when valueFormat has a %. |
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
| `mutedColor` | `#A19F9D` | Axis labels and the quietest text. |

The layout scales with the visual. These parameters are worked out from the container size; change the numbers in them to restyle.

| Parameter | Default | What it changes |
|---|---|---|
| `stacked` | `width < 2.4 * height` | Side by side in a wide tile, stacked in a taller one. |
| `unit` | `stacked ? clamp(min(width / 240, height / 160), 0.5, 3) : clamp(min(width / 300, height / 90), 0.5, 3)` | Scale factor, from 300 x 90 (240 x 160 stacked). |
| `pad` | `14 * unit` | Inset of the text and the bullet from the card edge. |
| `top0` | `max(0, (height - (stacked ? 160 : 90) * unit) / 2)` | Top of the drawing, so a card taller than its scale centres it. |
| `textLimit` | `stacked ? width - 2 * pad : width * 0.44 - 1.5 * pad` | Widest the title, value and gap may be before they end in an ellipsis. |
| `titleSize` | `(stacked ? 13 : 11.5) * unit` | Title text size. |
| `titleY` | `top0 + (stacked ? 24 : 21) * unit` | Title baseline. |
| `valueSize` | `(stacked ? 36 : 26) * unit` | Value text size. |
| `valueY` | `top0 + (stacked ? 66 : 52) * unit` | Value baseline. |
| `gapSize` | `(stacked ? 12.5 : 11) * unit` | Size of the gap-to-target line. |
| `gapY` | `top0 + (stacked ? 88 : 71) * unit` | Baseline of the gap line. |
| `bulletX0` | `stacked ? pad : width * 0.44` | Left end of the bullet: beside the text, or under it when stacked. |
| `bulletX1` | `width - pad` | Right end of the bullet. |
| `labelSize` | `9.5 * unit` | Size of the target label and the band labels. |
| `targetLabelY` | `top0 + (stacked ? 106 : 22) * unit` | Baseline of the target label over the tick. |
| `bandY0` | `top0 + (stacked ? 112 : 29) * unit` | Top of the bands. |
| `bandY1` | `top0 + (stacked ? 136 : 61) * unit` | Bottom of the bands. |
| `barY0` | `top0 + (stacked ? 119 : 39) * unit` | Top of the value bar. |
| `barY1` | `top0 + (stacked ? 129 : 51) * unit` | Bottom of the value bar. |
| `tickY0` | `top0 + (stacked ? 108 : 25) * unit` | Top of the target tick. |
| `tickY1` | `top0 + (stacked ? 140 : 65) * unit` | Bottom of the target tick. |
| `axisY` | `top0 + (stacked ? 153 : 78) * unit` | Baseline of the band labels. |

## Use it

1. In Power BI, add a Deneb visual and add the two fields to its Values well.
2. Open the Deneb editor, choose to create a new specification from a template (Import), and pick `kpi-bullet-tile.json`.
3. Map Value and Target to your fields, then create.
4. Turn off the Power BI visual border and background: the card draws its own.

Bind measures only, no columns, so the tile gets one row. Set `bandBreaks` to the shares of target where your bands change: `[0.5, 0.8]` gives three bands, `[0.6, 0.8, 0.95]` four (add a fourth colour to `bandColors`). For a cost against a budget, set `higherIsBetter` to `false` and `targetLabel` to `Budget`.

This template and seven other KPI templates are generated by [`tools/kpi/build.mjs`](../../../tools/kpi/build.mjs), which they share their number formatting and layout rules through: change the generator rather than the JSON.

## Credit

Design by Timothy Osborn.

## Licence

MIT, see [LICENSE](../../../LICENSE).
