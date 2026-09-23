# Showcase generator

`build_showcase.py` turns the templates and their showcase parts into one Power BI project,
`showcase/Deneb Template Showcase.pbip`. Open it in Power BI Desktop to review every template
bound to sample data, and to take the README previews.

It is Python 3 with the standard library only. The output is deterministic: every page, visual,
table and lineage id is derived from a name, so a rerun over unchanged inputs writes nothing and a
change shows up as a small diff.

## Commands

Run from the repo root:

```bash
py tools/showcase/make_background.py          # after editing showcase/dashboard.json "background"
py tools/showcase/build_showcase.py           # regenerate the project
py tools/showcase/build_showcase.py --check   # write nothing; exit 1 if the project is out of date
py tools/showcase/build_showcase.py --repo <copy of the repo>   # build a copy, for testing
```

`--quiet` prints only warnings and the summary line. Problems in the inputs (a missing template,
CSV or part, an unknown param name, a dashboard slot with no instance yet) are printed as
`WARNING:` lines and skipped. They never stop the build, because parts can arrive late.

## What it reads and what it writes

| Reads | Writes (owned, fully regenerated) |
|---|---|
| `showcase/parts/*.json` | `showcase/Deneb Template Showcase.pbip` |
| the templates and CSVs the parts name | `showcase/Deneb Template Showcase.SemanticModel/` |
| `showcase/dashboard.json` | `showcase/Deneb Template Showcase.Report/` |
| `showcase/theme/` (theme, logo, background) | `tools/showcase/out/capture-map.json` |
| `tools/showcase/assets/BaseThemes/` | |

The three generated items are rebuilt from scratch on every run: a page, visual or table whose part
is gone disappears. The `.pbi/` folders inside them (Desktop's local settings and data cache) are
left alone. The generator never writes to `showcase/theme`, `showcase/parts`, `showcase/data` or
`showcase/dashboard.json`. `make_background.py` writes one file, the background SVG in
`showcase/theme`.

### Semantic model

- One table per instance, named after the instance id (`dash-revenue`). It is a DAX calculated
  table, a `DATATABLE` typed from the template's `usermeta.dataset`, so the project needs no
  external file and a refresh starts no Power Query mashup container: `text` becomes `STRING`,
  `numeric` becomes `DOUBLE`, `dateTime` becomes `DATETIME` (shown as a date unless a value
  carries a time), `bool` becomes `BOOLEAN`, and an empty cell becomes `BLANK ()`.
- A `measure` field gets an explicit measure, `SUM` of its column, named `<field> (<instance id>)`
  so the name is unique in the model. The raw column is hidden.
- A `column` field binds the column itself, with `summarizeBy: none`.
- Compatibility level 1606, culture en-US, auto date/time off, implicit measures discouraged, no
  date table, no relationships.

### Report

- The BI Nexus theme (`showcase/theme/bi-nexus.json`) registered as the custom theme over the
  Fluent 2 base theme, and Deneb (`deneb7E15AEF80B9E4D4F8E12924291ECE89A`) registered as a public
  custom visual.
- Page 1 is the dashboard recreation. Then one page per template, in the category order kpi,
  comparison, financial, gauge, map (then any other category), and by slug within a category. Each
  page is named after the template.
- A template page holds the template's `"page": "template"` instances left to right, 24 px apart,
  with a 24 px margin, and a small title box above them: the template name and its credit line (the
  last sentence of the template description when it is a credit, otherwise "Design by
  <author>."). The page is sized to fit, so the visuals sit in a clean rectangle below the title.

### Each Deneb visual

1. The template body, with `$schema` and `usermeta` removed and the top-level `config` moved into
   Deneb's config (`jsonConfig`), with its font set to Arial. Any other Segoe UI font value (a mark
   `font`, a font param or signal) is also swapped for Arial.
2. The instance params applied by name: a plain value sets the param's `value`; `{"expr": "..."}`
   sets its `expr`. For a Vega template the same names are top-level signals, and an expression
   sets the signal's `update`.
3. Every `__n__` token replaced by that field's dataset name, which is the Deneb field name.
4. Projections bind each dataset field to its column or measure, with `displayName` set to the
   dataset name, so the spec sees the names it expects.
5. Provider and version stamps from `usermeta.deneb`; tooltips and the context menu on, selection
   and highlight off; SVG render mode. The literal is encoded the way
   `deneb_spec.py embed` encodes it (indent 2, embedded `'` doubled).
6. No title, background, border, shadow or padding on the visual container, because the templates
   draw their own chrome. The dashboard layout can turn a background, border or shadow on.

## The parts format

One file per template in `showcase/parts/<slug>.json`, owned by that template's author:

```json
{
  "template": "templates/kpi/kpi-line-card/kpi-line-card.json",
  "instances": [
    { "id": "kpi-line-card", "page": "template", "data": "templates/kpi/kpi-line-card/sample-data.csv",
      "size": [300, 320], "params": {} },
    { "id": "dash-revenue", "page": "dashboard", "data": "showcase/data/dash-revenue.csv",
      "size": [264, 235], "params": { "title": "REVENUE", "headerColor": { "expr": "pbiColor(0)" } } }
  ]
}
```

- `id`: unique across all parts; letters, digits, `-` and `_`. It names the table and the visual.
- `page`: `template` (the template's own page) or `dashboard` (the dashboard recreation).
- `data`: a CSV, relative to the repo root. Its header row must contain every dataset `name`.
- `size`: `[width, height]` in pixels. It is used as given on a template page; the dashboard layout
  decides dashboard sizes. When it is missing the template's `render.json` is used.
- `params`: overrides by param (or signal) name, as above.

## The dashboard layout file: `showcase/dashboard.json`

Everything on the dashboard page except the Deneb visuals themselves.

- `page`: display name, size (1600 x 900) and the background image file in `showcase/theme`.
- `background`: the geometry `make_background.py` draws: the navy band and its curved bottom edge
  (`edgeY` at the sides, `centerY` in the middle), the band dividers, the lower grid dividers, and
  the footer band with its accent line.
- `colors` and `styles`: named colours and text styles. A colour name resolves through `colors`,
  then the theme's `good`, `bad` and `neutral`, so `"color": "good"` follows the theme.
- `text`: native text boxes. Each has `id`, `x`, `y`, `w`, `h` and `paragraphs`. A paragraph is a
  list of runs, or `{"align": "right", "runs": [...]}`. A run is `{"text", "style"}` plus optional
  `size` (pt), `color`, `bold`, `italic`.
- `images`: image visuals (the logo), from `showcase/theme`.
- `visuals`: one slot per dashboard instance id, with `x`, `y`, `w`, `h`, optional `alt` text,
  optional `container` (`background` colour, `border` `{color, width, radius}`, `shadow`) and
  optional `params` that override the part's params for this page. The page draws the section
  titles as native text, so the slots blank any in-visual title this way. The two KPI bar card
  slots also set `cardPadding` and `borderColor`, so all four KPI cards share one inset and a
  border tinted from their header.

A slot whose instance does not exist yet is left empty with a warning.

## capture-map.json

`tools/showcase/out/capture-map.json` lists every page in order: `displayName`, `name` (the page
folder id), `width`, `height`, `rect` (for a template page, the union rectangle of its visuals in
page pixels; for the dashboard, the whole page) and `visuals` (each instance's id, visual folder
and rectangle). Template pages also carry `template` (the slug), `category` and `templatePath`.
`crop_previews.py` uses it to cut the previews out of the Desktop captures.

## Previews and thumbnails

With the showcase open in Power BI Desktop (and the "secure local APIs" preview on), capture every
page, then crop:

```bash
cd showcase
pbir desktop screenshot "Deneb Template Showcase.Report" --all --scale 2 --output-dir <shots> --settle 4000
cd ..
python tools/showcase/crop_previews.py <shots>            # writes the previews only
python tools/showcase/crop_previews.py <shots> --embed    # also embeds the thumbnails
```

- A capture is the report canvas, not the page: Desktop fits the page into the canvas and centres
  it, and the collapsed Filters pane takes a strip on the right. The script finds that strip, works
  out the zoom and the page offset, and maps each rectangle from `capture-map.json` onto the image.
- Each template gets `preview.png` in its folder: its visuals plus 16 page pixels of margin, at
  2 image pixels per page pixel (at most 2400 px on the long side), as a 256-colour PNG.
- The dashboard page is saved whole as `showcase/dashboard.png`.
- `--embed` writes a thumbnail of the first visual on each page into
  `usermeta.information.previewImageBase64PNG`: 300 px on the long side, under 30 KB. A visual wider
  than 1000 page pixels (the P&L tables) is thumbnailed by its top-left corner so the text stays
  legible. The template file is edited in place, not re-serialised.
- `--only <slug> [...]` redoes just those templates (or `dashboard`) and leaves every other
  preview and thumbnail untouched, so a one-template change makes a one-template diff.
- It needs Pillow (`pip install pillow`). Run `npm run check` in `tools/` afterwards.

## After a build, in Power BI Desktop

- The data is embedded in the model definition as DAX calculated tables, which Desktop calculates
  when it opens the project. No refresh and no data source are needed.
- Validate from inside `showcase/` with `pbir validate "Deneb Template Showcase.Report"`. Do not
  pass `showcase/Deneb Template Showcase.Report` from the repo root: pbir 0.9.31 on Windows does
  not resolve a relative path with a forward slash, and silently validates the report of its
  active profile instead (the first output line, `Validating <name>`, shows which). It reports
  `SCHEMA_DEGRADED` when the installed pbir has no copy of the visual container schema version
  Desktop writes; that is a pbir cache gap, not a report error.
- A Desktop save rewrites the generated files. Rerun the generator to put them back; change the
  inputs, not the output.
