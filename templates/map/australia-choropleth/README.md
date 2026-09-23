# Australia Choropleth

A map of Australia's eight states and territories, each shaded by one measure on the report theme's sequential colours, with a label and a legend.

![Australia Choropleth](preview.png)

## Fields

| Name | Kind | Type | Description |
|---|---|---|---|
| State | column | text | The state or territory. A full name (`New South Wales`), an abbreviation (`NSW`) or an ISO code (`AU-NSW`). Case and anything that is not a letter are ignored, so `n.s.w.` works too. |
| Value | measure | numeric | The number that colours each state and appears in its label. |

## Options

Every option is a signal at the top of the spec. Change its `value` (or its `update` expression for the theme colours).

| Signal | Default | What it changes |
|---|---|---|
| `numberFormat` | `.0%` | d3 format for the labels, legend and tooltip. Use `,.0f` for counts, `$,.0f` for currency. |
| `legendTitle` | `Value` | Legend title, and the name of the value in the tooltip. |
| `noDataLabel` | `No data` | Legend key and tooltip text for a state with no row. |
| `unmatchedLabel` | `Not on the map:` | Prefix of the note that lists State values the map could not place. |
| `colorLow` | `pbiColor('min')` | Colour of the lowest value (the theme's diverging minimum). |
| `colorHigh` | `pbiColor('max')` | Colour of the highest value (the theme's diverging maximum). |
| `colorNoData` | `#E1DFDD` | Fill of a state with no data. |
| `highlightFiltered` | `false` | When `true` and fewer than 8 states arrive (a slicer or filter is on), paint the states present in `colorHighlight` and the rest in `colorNoData`, instead of the scale. This was the original map's behaviour. |
| `colorHighlight` | `pbiColor(0)` | Fill of the states present in highlight mode. |
| `scaleMin` | `null` | Fix the low end of the colour scale (for example `0.75`). `null` uses the lowest value. |
| `scaleMax` | `null` | Fix the high end of the colour scale (for example `1`). `null` uses the highest value. |
| `borderColor` | `#FFFFFF` | Colour of the state borders. |
| `borderWidth` | `1` | Width of the state borders, in pixels. |
| `showLabels` | `true` | Show the state labels. |
| `showValues` | `true` | Add the formatted value under each abbreviation. |
| `showLegend` | `true` | Show the colour legend and the no-data key. |
| `labelFontSize` | `12` | Label size at the design width. Labels scale with the map, between 70% and 120% of this. |
| `legendFontSize` | `10` | Size of the legend labels, the no-data key and the note of unplaced rows. The legend title is one pixel larger. |
| `fontFamily` | `Segoe UI` | Font of every text mark. Set it to your theme font. |
| `textColor` | `#252423` | Label text on light fills. |
| `textColorMuted` | `#605E5C` | Legend text, leader lines and labels of states with no data. |
| `textColorOnDark` | `#FFFFFF` | Label text on dark fills. Each label picks whichever of the two has more contrast. |

The signals after `textColorOnDark` are internal: map bounds, label size, legend position and the colour domain. Leave them alone.

## Use it

In Power BI, add the Deneb visual and open its editor. Choose to create a new specification from a template, import `australia-choropleth.json`, and map State and Value to your fields.

Send one row per state or territory. Rows that resolve to the same state are added together. A row whose State matches none of the eight (for example `Jervis Bay Territory` or `Norfolk Island`) is left off the map and named in a small note above the legend. The map needs no sorting and fits itself to the visual, keeping its proportions.

Small states move their label outside the shape, with a leader line, when it does not fit: the ACT always, Tasmania on a small visual or with long values, and Victoria only with long values on a small visual.

This template is Vega, not Vega-Lite, because the original was Vega and because the labels need Vega: they are placed from projected anchor points, measured against each state's projected area to decide inside or outside, and the tooltip names the value after the legend title.

## Credit

Designed by Timothy Osborn. Rebuilt as a Deneb template by Timothy Osborn.

Boundaries: [Natural Earth](https://www.naturalearthdata.com/) 1:10m Admin 1 states and provinces (public domain), from [nvkelso/natural-earth-vector](https://github.com/nvkelso/natural-earth-vector) (version 5.2.0-pre, downloaded 2026-09-23). Credited as a courtesy; Natural Earth asks for none.

This template replaces `map_australia_by_state.json`, which used to sit in the root of this repo ([last version](https://github.com/InsightfulAnalytics/Deneb/blob/30881523d170322671b10e0bdd84d8646390d0ae/map_australia_by_state.json)). What changed from it:

- **Boundaries replaced.** The original embedded a verbatim copy of [rowanhogan/australian-states](https://github.com/rowanhogan/australian-states), which states no licence. This template uses Natural Earth instead, simplified with mapshaper 0.7.66 (weighted Visvalingam, 25% of points kept, islands under 150 km² removed) and stored inline as TopoJSON. The file went from 2.5 MB to about 53 KB.
- **Jervis Bay Territory, Lord Howe Island and Macquarie Island are dropped.** Jervis Bay is about 70 km², a pixel or two at normal sizes; the two islands are far offshore and would shrink the mainland to fit them.
- **A true choropleth.** Colour now encodes the value on a theme-driven sequential scale with a legend. The original drew every state grey and turned the states present yellow when fewer than 7 rows arrived; that behaviour is kept behind `highlightFiltered`, which now counts matched states rather than rows.
- **The ACT is drawn and labelled.** The original filtered it out.
- **Full names, abbreviations and ISO codes all match.** The original matched abbreviations only, so full names gave a blank map.
- **Equal-area projection.** An Albers conic with standard parallels 18°S and 36°S (the parallels of the Australian Albers grid, EPSG:3577) replaces Mercator, so state areas compare fairly.
- **Removed:** the title (use the Power BI visual title), the image field, the field name `rsp_spp Compliance Score` (now Value), the unused colour scale, the leader-line mark that never showed and the empty footnote.

## Licence

MIT, see [LICENSE](../../../LICENSE). The design credit above stays with its author. The Natural Earth boundaries are in the public domain.
