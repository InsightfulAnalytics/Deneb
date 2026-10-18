# Deneb Templates for Power BI

Twenty-one ready-to-import [Deneb](https://deneb-viz.github.io/) templates for Power BI: KPI cards
and tiles, a KPI scorecard and small multiples, bullet and comparison charts,
[performant P&L statements](#performant-pl-statements) that render far faster than a Power BI
matrix or table, a gauge, a map of Australia and a calendar heatmap. Each one comes with sample
data, a preview and a README that lists its fields and options, and all of them sit bound to
sample data in one Power BI project you can open and explore.

![KPI Dashboard 2015, rebuilt with these templates](showcase/dashboard.png)

*Gerard Duggan's Northwind KPI dashboard, rebuilt with the KPI and comparison templates below in
the BI Nexus theme. It is the first page of the [showcase](#the-showcase). Dashboard design:
[Gerard Duggan](https://dg-analysis.com).*

## Master list

Every Deneb template I have published is here, and this is the list of them. A template built for
a project of its own is copied in when it is finished, and its README says where it is developed.

| Template | Category | Built with | Fields | What it draws | Design |
|---|---|---|---|---|---|
| [Hit or Miss Strip](templates/kpi/kpi-hit-miss-strip/) | KPI | Vega-Lite | 3 | The last twelve periods as columns or dots coloured hit or miss, with the hit count written large | Timothy Osborn |
| [KPI Bar Card](templates/kpi/kpi-bar-card/) | KPI | Vega | 5 | A top performer card: month-over-month change, reporting month and year, labelled monthly columns | After Gerard Duggan |
| [KPI Bullet Tile](templates/kpi/kpi-bullet-tile/) | KPI | Vega-Lite | 2 | One KPI as a compact bullet: value bar, target tick and qualitative bands, with the gap to target | Timothy Osborn |
| [KPI Delta Tile](templates/kpi/kpi-delta-tile/) | KPI | Vega-Lite | 2 | The value, its change against a benchmark as an amount and a percentage, and a coloured arrow | Timothy Osborn |
| [KPI Gap Sparkline Card](templates/kpi/kpi-gap-sparkline-card/) | KPI | Vega-Lite | 3 | Month-to-date value, its gap to last year or a target, and a daily gap sparkline | After Ruben Van de Voorde (Tabular Editor) |
| [KPI Line Card](templates/kpi/kpi-line-card/) | KPI | Vega-Lite | 4 | Value, three status lines coloured by the gap to target, and a monthly line against target | After Gerard Duggan |
| [KPI Progress Card](templates/kpi/kpi-progress-card/) | KPI | Vega-Lite | 3 | Value against target as a progress bar, with a pace marker for the share of the period gone | Timothy Osborn |
| [KPI Scorecard](templates/kpi/kpi-scorecard/) | KPI | Vega-Lite | 4 | Several KPIs in one table: actual, target, variance and a mini bar or status dot, formatted per row | Timothy Osborn |
| [KPI Small Multiples](templates/kpi/kpi-small-multiples/) | KPI | Vega-Lite | 3 | One panel per category: the latest value, its change and a sparkline, in a grid that reflows | Timothy Osborn |
| [Ring Progress Card](templates/kpi/kpi-ring-progress-card/) | KPI | Vega-Lite | 2 | Value against target as a full ring, the percentage in the centre, a second lap past 100% | Timothy Osborn |
| [Run-rate Projection Card](templates/kpi/kpi-run-rate-card/) | KPI | Vega-Lite | 3 | Period to date against target, with a dashed projection to the period end at the run rate so far | Timothy Osborn |
| [Bullet Chart](templates/comparison/bullet-chart/) | Comparison | Vega-Lite | 4 | Sorted bullets: actual against a budget tick and a last year bar, with variance labels | After Daniel Marsh-Patrick and Robert Mundigl |
| [Bullet with Prior Period](templates/comparison/bullet-prior-period/) | Comparison | Vega-Lite | 6 | One bullet per row with a prior-period band, each row on its own axis | After Gerard Duggan |
| [Overlapping Bars with Share Lollipop](templates/comparison/overlap-bar-share-lollipop/) | Comparison | Vega-Lite | 3 | Current in front of total, and current as a share of total | After Gerard Duggan |
| [Overlapping Bars with Variance Lollipop](templates/comparison/overlap-bar-variance-lollipop/) | Comparison | Vega-Lite | 3 | Current in front of a comparison, and the % difference | After Gerard Duggan |
| [P&L Accounts Statement](templates/financial/pl-accounts-statement/) | Financial | Vega-Lite | 9 | Account-level P&L, current period and year to date against budget and last year | Timothy Osborn |
| [Monthly P&L Grid](templates/financial/pl-monthly-grid/) | Financial | Vega | 14 | Actual, last year and variance across January to December, YTD, YTG and FY | Timothy Osborn |
| [Odd Rows P&L Statement](templates/financial/pl-odd-rows/) | Financial | Vega-Lite | 5 | Headline lines, margins, cost ratios and per-store and per-product results | Timothy Osborn |
| [Half-Donut Gauge](templates/gauge/half-donut-gauge/) | Gauge | Vega-Lite | 2 | One ratio on a half ring, with a target tick | Timothy Osborn |
| [Australia Choropleth](templates/map/australia-choropleth/) | Map | Vega | 2 | The eight states and territories shaded by one measure | Timothy Osborn, boundaries from Natural Earth |
| [Calendar Heatmap](templates/time/calendar-heatmap/) | Time | Vega | 2 | A year of daily values as weeks by weekdays, the peak day ringed, a drag to cross-filter a date range | After Lumeric Visuals |

The Calendar Heatmap is developed in its own repo,
[InsightfulAnalytics/calendar-heatmap](https://github.com/InsightfulAnalytics/calendar-heatmap), beside
Daily Sales, a five-page Power BI report built on it.

## Gallery

Click a preview for the template's fields, options and credits.

<table>
<tr>
<td width="50%" valign="top"><a href="templates/kpi/kpi-gap-sparkline-card/"><img src="templates/kpi/kpi-gap-sparkline-card/preview.png" alt="KPI Gap Sparkline Card"></a><br><b>KPI Gap Sparkline Card</b><br>Month-to-date value, gap to last year and a daily gap sparkline. After Ruben Van de Voorde (Tabular Editor).</td>
<td width="50%" valign="top"><a href="templates/kpi/kpi-line-card/"><img src="templates/kpi/kpi-line-card/preview.png" alt="KPI Line Card"></a><br><b>KPI Line Card</b><br>A whole KPI card: value, status lines and a monthly line against target. After Gerard Duggan.</td>
</tr>
<tr>
<td valign="top"><a href="templates/kpi/kpi-bar-card/"><img src="templates/kpi/kpi-bar-card/preview.png" alt="KPI Bar Card"></a><br><b>KPI Bar Card</b><br>A top performer card with month-over-month change and labelled monthly columns. After Gerard Duggan.</td>
<td valign="top"><a href="templates/kpi/kpi-delta-tile/"><img src="templates/kpi/kpi-delta-tile/preview.png" alt="KPI Delta Tile"></a><br><b>KPI Delta Tile</b><br>The value, its change against a benchmark as an amount and a percentage, and a coloured arrow. By Timothy Osborn.</td>
</tr>
<tr>
<td valign="top"><a href="templates/kpi/kpi-progress-card/"><img src="templates/kpi/kpi-progress-card/preview.png" alt="KPI Progress Card"></a><br><b>KPI Progress Card</b><br>Value against target as a progress bar, with a pace marker for where it should be by now. By Timothy Osborn.</td>
<td valign="top"><a href="templates/kpi/kpi-bullet-tile/"><img src="templates/kpi/kpi-bullet-tile/preview.png" alt="KPI Bullet Tile"></a><br><b>KPI Bullet Tile</b><br>One KPI as a compact bullet: value bar, target tick and bands set as shares of target. By Timothy Osborn.</td>
</tr>
<tr>
<td valign="top"><a href="templates/kpi/kpi-scorecard/"><img src="templates/kpi/kpi-scorecard/preview.png" alt="KPI Scorecard"></a><br><b>KPI Scorecard</b><br>Several KPIs in one visual, one row each, each in its own format, with a mini bar or a status dot. By Timothy Osborn.</td>
<td valign="top"><a href="templates/kpi/kpi-hit-miss-strip/"><img src="templates/kpi/kpi-hit-miss-strip/preview.png" alt="Hit or Miss Strip"></a><br><b>Hit or Miss Strip</b><br>The last twelve periods coloured hit or miss against target, and how many were on target. By Timothy Osborn.</td>
</tr>
<tr>
<td valign="top"><a href="templates/kpi/kpi-run-rate-card/"><img src="templates/kpi/kpi-run-rate-card/preview.png" alt="Run-rate Projection Card"></a><br><b>Run-rate Projection Card</b><br>Period to date, and a dashed projection to the period end coloured by whether it reaches target. By Timothy Osborn.</td>
<td valign="top"><a href="templates/kpi/kpi-small-multiples/"><img src="templates/kpi/kpi-small-multiples/preview.png" alt="KPI Small Multiples"></a><br><b>KPI Small Multiples</b><br>One panel per category with its latest value, change and sparkline, in a grid that reflows. By Timothy Osborn.</td>
</tr>
<tr>
<td valign="top"><a href="templates/kpi/kpi-ring-progress-card/"><img src="templates/kpi/kpi-ring-progress-card/preview.png" alt="Ring Progress Card"></a><br><b>Ring Progress Card</b><br>Value against target as a full ring with the percentage in the centre. By Timothy Osborn.</td>
<td valign="top"><a href="templates/comparison/bullet-chart/"><img src="templates/comparison/bullet-chart/preview.png" alt="Bullet Chart"></a><br><b>Bullet Chart</b><br>Actual against a Budget tick and a Last Year bar, sorted, with variance labels. After Daniel Marsh-Patrick and Robert Mundigl.</td>
</tr>
<tr>
<td valign="top"><a href="templates/comparison/bullet-prior-period/"><img src="templates/comparison/bullet-prior-period/preview.png" alt="Bullet with Prior Period"></a><br><b>Bullet with Prior Period</b><br>One bullet per row with a prior-period band, each row on its own axis. After Gerard Duggan.</td>
<td valign="top"><a href="templates/gauge/half-donut-gauge/"><img src="templates/gauge/half-donut-gauge/preview.png" alt="Half-Donut Gauge"></a><br><b>Half-Donut Gauge</b><br>One ratio on a half ring, with a target tick. By Timothy Osborn.</td>
</tr>
<tr>
<td valign="top"><a href="templates/comparison/overlap-bar-share-lollipop/"><img src="templates/comparison/overlap-bar-share-lollipop/preview.png" alt="Overlapping Bars with Share Lollipop"></a><br><b>Overlapping Bars with Share Lollipop</b><br>Current in front of total, and current as a share of total. After Gerard Duggan.</td>
<td valign="top"><a href="templates/comparison/overlap-bar-variance-lollipop/"><img src="templates/comparison/overlap-bar-variance-lollipop/preview.png" alt="Overlapping Bars with Variance Lollipop"></a><br><b>Overlapping Bars with Variance Lollipop</b><br>Current in front of a comparison, and the % difference. After Gerard Duggan.</td>
</tr>
<tr>
<td valign="top"><a href="templates/map/australia-choropleth/"><img src="templates/map/australia-choropleth/preview.png" alt="Australia Choropleth"></a><br><b>Australia Choropleth</b><br>The eight states and territories shaded by one measure. By Timothy Osborn, boundaries from Natural Earth.</td>
<td valign="top"><a href="templates/time/calendar-heatmap/"><img src="templates/time/calendar-heatmap/preview.png" alt="Calendar Heatmap"></a><br><b>Calendar Heatmap</b><br>A year of daily values, the peak day ringed, and a drag to cross-filter a date range. After Lumeric Visuals.</td>
</tr>
</table>

### Performant P&L statements

Three P&L statements built for speed: each one renders far faster than the same statement in a
Power BI matrix or table. A matrix builds a statement one cell at a time, dispatching every row
through `SWITCH` or a calculation group and then paying for a format string and colour rules per
cell. These templates ask the model for the base measures only, in one small query, and work out
every variance, subtotal, ratio, format and colour inside the visual. The visual only ever receives
the statement's own rows, 12 to 30 of them, however large the model is, so it stays fast as the
data grows. By Timothy Osborn.

| Statement | Deneb template | The same statement as a matrix or table |
|---|---|---|
| Monthly P&L Grid | **206 ms** | 11,065 ms (calculation group) |
| Odd Rows P&L Statement | **344 ms** | 1,484 ms (`SWITCH`) to 7,746 ms (calculation groups) |
| P&L Accounts Statement | **165 ms** | 4,978 ms (`SWITCH`), or 407 ms with a bridge table in the model |

*Performance Analyzer in Power BI Desktop, over a fact table of 74.9 million rows, median of three
runs. The Deneb times are for the builds these templates come from.*

- **The full story**, with all nine builds side by side and when not to use Deneb:
  [The Ultimate Guide to the Power BI P&L Style Matrix & Deneb's Flawless Victory](https://binexus.net/blog/power-bi-pl-matrix-guide/).
- **Make one fit your model** with a coding agent and the
  [performant-matrix](https://github.com/InsightfulAnalytics/PBI_Agentic_Dev/blob/main/plugins/custom-visuals/skills/performant-matrix/SKILL.md)
  skill from [PBI_Agentic_Dev](https://github.com/InsightfulAnalytics/PBI_Agentic_Dev). The skill
  measures your slow matrix first, then builds the grid against your model's measures, with the
  row registry, the format rules and a tie-out query that proves the numbers match.

**[P&L Accounts Statement](templates/financial/pl-accounts-statement/)**: account-level rows,
subtotals and totals for the current period and year to date, against budget and last year.

[![P&L Accounts Statement](templates/financial/pl-accounts-statement/preview.png)](templates/financial/pl-accounts-statement/)

**[Monthly P&L Grid](templates/financial/pl-monthly-grid/)**: actual, last year and variance rows
across January to December, YTD, YTG and FY, all 315 cells derived from 12 monthly rows.

[![Monthly P&L Grid](templates/financial/pl-monthly-grid/preview.png)](templates/financial/pl-monthly-grid/)

**[Odd Rows P&L Statement](templates/financial/pl-odd-rows/)**: the headline lines, then margins,
cost ratios and per-store and per-product results, derived from 30 rows.

[![Odd Rows P&L Statement](templates/financial/pl-odd-rows/preview.png)](templates/financial/pl-odd-rows/)

## Use a template

1. In Power BI Desktop, add the Deneb visual from AppSource and put your fields in its Values well.
2. Open the Deneb editor, create a new specification, and import the template's `.json` file.
3. Map each of the template's fields to one of yours, then create the visual.

Each template's README lists its fields (column or measure, and type) and every option. Options are
params at the top of the spec: change them there. Colours come from the report theme through
`pbiColor`, so a template picks up your theme's good, bad and neutral colours without edits.

Every template also ships a `sample-data.csv` with the fields it expects, and a thumbnail inside the
template file, which Deneb shows when you import it.

**Deneb version.** The templates are built for Deneb 1.9.1 and also run on Deneb 2.0. They use the
`pbiContainerWidth` and `pbiContainerHeight` signals, which 2.0 still accepts, and d3 number
formats rather than `pbiFormat`, apart from the Calendar Heatmap's tooltips.

## The showcase

[`showcase/Deneb Template Showcase.pbip`](showcase/) is a Power BI project with every template bound
to its sample data: the KPI dashboard on the first page, then one page per template. Open the
`.pbip` in Power BI Desktop. The data is embedded as DAX calculated tables, so there is nothing to
connect or refresh.

The project is generated. To change it, edit the templates, the CSVs, `showcase/parts/` or
`showcase/dashboard.json`, then run `py tools/showcase/build_showcase.py`. See
[tools/showcase/README.md](tools/showcase/README.md), which also explains how the previews are
captured from Desktop and cropped.

The dashboard and the showcase pages use the BI Nexus theme in
[`showcase/theme/`](showcase/theme/).

## Repository layout

| Path | What it holds |
|---|---|
| `templates/<category>/<slug>/` | The template (`<slug>.json`), `preview.png`, `sample-data.csv`, `render.json` (offline render size) and a `README.md` |
| `showcase/` | The showcase Power BI project and its inputs: theme, parts, dashboard layout and dashboard data |
| `tools/check-templates.mjs` | Validates every template, renders it headless with its sample data, and fails a template the master list does not link |
| `tools/showcase/` | Builds the showcase project and crops the previews |
| `tools/kpi/` | The generator for the eight KPI templates that share one set of helpers: the Delta, Progress and Bullet tiles, the Scorecard, the Hit or Miss Strip, the Run-rate Projection Card, the Small Multiples and the Ring Progress Card |
| `tools/pl/` | Generators and numeric checks for the P&L templates |
| `tools/schema/` | A copy of Deneb's v1 template metadata schema |

To check the templates:

```bash
cd tools
npm ci
npm run check     # validate all templates, run them against their sample data, and check the master list
npm run render    # also write SVG and PNG renders to tools/out/
```

## Where the old files went

This repo used to hold three loose specs and a demo file. They are now templates:

| Was | Now |
|---|---|
| `Bullet Chart.jsonc` | [templates/comparison/bullet-chart/](templates/comparison/bullet-chart/) |
| `Deneb Gauge.json` | [templates/gauge/half-donut-gauge/](templates/gauge/half-donut-gauge/) |
| `map_australia_by_state.json` | [templates/map/australia-choropleth/](templates/map/australia-choropleth/) |
| `Deneb Bullet Chart.pbix` | Replaced by the [showcase](#the-showcase) |

Each template's README lists what changed from the old version, and links to it in the history.

## Credits

The templates are my own Vega and Vega-Lite specs. Several follow designs by other people, who are
credited in the template's metadata and README:

| Designer | Templates |
|---|---|
| [Gerard Duggan](https://dg-analysis.com) ([Next Level KPIs in Power BI](https://youtu.be/ZVknC7YEMB4)) | KPI Line Card, KPI Bar Card, Bullet with Prior Period, both Overlapping Bars templates, and the KPI Dashboard 2015 layout |
| [Daniel Marsh-Patrick](https://coacervo.co/deneb_mundigl) and [Robert Mundigl](https://www.clearlyandsimply.com/clearly_and_simply/2017/07/variations-of-alternative-bullet-graphs-in-excel.html) | Bullet Chart |
| [Ruben Van de Voorde](https://tabulareditor.com/blog/kpi-card-best-practices-dashboard-design), Tabular Editor ApS | KPI Gap Sparkline Card (the "full make-over" card) |
| [Lumeric Visuals](https://lumericvisuals.com/visuals/calendar-heatmap) | Calendar Heatmap (an independent reimplementation; nothing is copied from their code) |
| [Natural Earth](https://www.naturalearthdata.com/) (public domain) | The state boundaries in Australia Choropleth |

[Deneb](https://deneb-viz.github.io/) is by Daniel Marsh-Patrick. Charts are drawn with
[Vega](https://vega.github.io/vega/) and [Vega-Lite](https://vega.github.io/vega-lite/).

## Licence

MIT, see [LICENSE](LICENSE). The design credits above stay with their authors. The copy of Deneb's
template schema in `tools/schema/` is MIT licensed, copyright Daniel Marsh-Patrick.
