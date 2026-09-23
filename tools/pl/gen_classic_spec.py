"""Generate the P&L Accounts Statement template:
templates/financial/pl-accounts-statement/pl-accounts-statement.json

A classic account-level P&L statement: one row per statement line (detail accounts, subtotals
and totals), 14 columns (current period and year to date, each against budget and last year).
Edit this generator, not the JSON, then run:

    python tools/pl/gen_classic_spec.py
    node tools/pl/verify_classic.mjs

Dataset contract (the template's field names; Deneb maps the user's own fields onto them):
  Line        text     one row per statement line; a leading indent (spaces or U+00A0) is stripped
  LineKey     number   sort key, ascending; any increasing numbers work (they are ranked)
  LineClass   text     "Detail" for account lines; any other value is a subtotal or total
  Actual, Budget, LY, YTD Actual, YTD Budget, YTD LY   the six base measures

The eight variance columns (Var, Var %, vs LY, vs LY %, and their YTD forms) and all number
formatting are derived in the spec, so the model sends one grouped query with no per-cell
format strings.

The row count comes from the data (the number of dataset rows), so the statement can have any
number of lines. Red marks a negative variance, which assumes costs are stored as negative
numbers: a cost line over budget then has a negative variance.
"""
import json
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
OUT = REPO / "templates" / "financial" / "pl-accounts-statement" / "pl-accounts-statement.json"

COLS = ["Actual", "Budget", "Var", "Var %", "LY", "vs LY", "vs LY %",
        "YTD Actual", "YTD Budget", "YTD Var", "YTD Var %", "YTD LY",
        "YTD vs LY", "YTD vs LY %"]
VAR_COLS = ["Var", "Var %", "vs LY", "vs LY %",
            "YTD Var", "YTD Var %", "YTD vs LY", "YTD vs LY %"]
N_COLS = len(COLS)

# ---------------------------------------------------------------- dataset contract
# (internal name, type, kind, description). The alias block copies token __i__ into the
# internal name, so the transform chain below never sees the user's own field names.
FIELDS = [
    ("Line", "text", "column",
     "Statement line label, one row per line. A leading indent is stripped; LineClass sets the indent."),
    ("LineKey", "numeric", "column",
     "Sort key for the lines, ascending. Any increasing numbers work."),
    ("LineClass", "text", "column",
     "Detail for an account line. Any other value (Subtotal, Total) is drawn bold with a rule above."),
    ("Actual", "numeric", "measure", "Actual amount for the current period. Costs are negative."),
    ("Budget", "numeric", "measure", "Budget amount for the current period. Costs are negative."),
    ("LY", "numeric", "measure", "Last year's actual for the same period. Costs are negative."),
    ("YTD Actual", "numeric", "measure", "Actual amount, year to date. Costs are negative."),
    ("YTD Budget", "numeric", "measure", "Budget amount, year to date. Costs are negative."),
    ("YTD LY", "numeric", "measure", "Last year's actual, year to date. Costs are negative."),
]

# ---------------------------------------------------------------- options
# Colours follow the report theme where the design has a theme role; text greys stay hex
# because Deneb does not expose the theme's text colours.
PARAMS = [
    {"name": "accentColor", "expr": "pbiColor(0)"},
    {"name": "negativeColor", "expr": "pbiColor('bad')"},
    {"name": "textColor", "value": "#1F252D"},
    {"name": "strongTextColor", "value": "#000000"},
    {"name": "mutedTextColor", "value": "#4A5361"},
    {"name": "ruleColor", "value": "#9AA3AF"},
    {"name": "dividerColor", "value": "#D3D8DF"},
    {"name": "bandColor", "value": "#161C24"},
    {"name": "bandOpacity", "value": 0.045},
    {"name": "labelWidth", "value": 280},
    {"name": "indentWidth", "value": 16},
    {"name": "fontSize", "value": 14},
    {"name": "headerFontSize", "value": 12},
    {"name": "captionFontSize", "value": 11.5},
    {"name": "labelCaption", "value": "STATEMENT LINE"},
    {"name": "periodCaption", "value": "CURRENT PERIOD"},
    {"name": "ytdCaption", "value": "YEAR TO DATE"},
    {"name": "currencySymbol", "value": "$"},
    {"name": "percentFormat", "value": ".1%"},
    {"name": "detailLineClass", "value": "Detail"},
    # Derived, not an option: one dataset row per statement line.
    {"name": "rowCount", "expr": "length(data('dataset'))"},
]

CONFIG = {
    "autosize": {"type": "fit", "contains": "padding"},
    "view": {"stroke": "transparent"},
    "background": "transparent",
    "font": "Segoe UI",
    "rule": {"strokeCap": "butt"},
}

USERMETA = {
    "deneb": {"build": "1.9.1.0", "metaVersion": 1, "provider": "vegaLite", "providerVersion": "6.4.1"},
    "information": {
        "name": "P&L Accounts Statement",
        "description": ("A classic account-level P&L statement table: detail accounts, subtotals and totals "
                        "as rows, for the current period and year to date against budget and last year. The "
                        "row count comes from the data; variances and formats are derived in the spec. "
                        "Design by Timothy Osborn."),
        "author": "Timothy Osborn",
        "uuid": "b94aece1-6c9f-4726-bfb4-c0056b32f21c",
        "generated": "2026-09-23T00:00:00.000Z",
    },
    "dataset": [{"key": f"__{i}__", "name": name, "description": desc, "type": typ, "kind": kind}
                for i, (name, typ, kind, desc) in enumerate(FIELDS)],
    "interactivity": {"tooltip": True, "contextMenu": True, "selection": False, "highlight": False,
                      "dataPointLimit": 50},
}


def E(expr):
    return {"expr": expr}


def yscale():
    return {"domain": [E("rowCount"), 0], "nice": False, "zero": False, "clamp": False}


def xscale():
    return {"domain": [0, N_COLS], "nice": False, "zero": False, "clamp": False}


def yq(field):
    return {"field": field, "type": "quantitative", "scale": yscale(), "axis": None, "title": None}


def xq(field):
    return {"field": field, "type": "quantitative", "scale": xscale(), "axis": None, "title": None}


STRONG_COL = "datum.column === 'Actual' || datum.column === 'YTD Actual'"

transform = (
    # alias block: every token into the internal name the rest of the chain reads
    [{"calculate": f"datum['__{i}__']", "as": name} for i, (name, *_rest) in enumerate(FIELDS)]
    + [
        # row order comes from LineKey, ranked so the spec does not assume a key convention
        {"window": [{"op": "rank", "as": "rowRank"}],
         "sort": [{"field": "LineKey", "order": "ascending"}]},
        {"calculate": "datum.rowRank - 1", "as": "rowIdx"},
        # the 8 derived columns: differences and ratios of the 6 base fields
        {"calculate": "datum['Actual'] - datum['Budget']", "as": "Var"},
        {"calculate": "(datum['Actual'] - datum['Budget']) / datum['Budget']", "as": "Var %"},
        {"calculate": "datum['Actual'] - datum['LY']", "as": "vs LY"},
        {"calculate": "(datum['Actual'] - datum['LY']) / datum['LY']", "as": "vs LY %"},
        {"calculate": "datum['YTD Actual'] - datum['YTD Budget']", "as": "YTD Var"},
        {"calculate": "(datum['YTD Actual'] - datum['YTD Budget']) / datum['YTD Budget']", "as": "YTD Var %"},
        {"calculate": "datum['YTD Actual'] - datum['YTD LY']", "as": "YTD vs LY"},
        {"calculate": "(datum['YTD Actual'] - datum['YTD LY']) / datum['YTD LY']", "as": "YTD vs LY %"},
        {"fold": COLS, "as": ["column", "value"]},
        {"calculate": "indexof(datum.column, '%') >= 0", "as": "isPctCol"},
        {"calculate": f"indexof({json.dumps(VAR_COLS)}, datum.column) >= 0", "as": "isVarCol"},
        {"calculate": "datum.LineClass !== detailLineClass", "as": "isSubtotal"},
        {"calculate": f"indexof({json.dumps(COLS)}, datum.column)", "as": "colIdx"},
        {"calculate": "datum.rowIdx + 0.5", "as": "rowMid"},
        {"calculate": "datum.rowIdx + 1", "as": "rowEnd"},
        {"calculate": "datum.colIdx + 1", "as": "colEnd"},
        {"calculate": "abs(datum.value)", "as": "absValue"},
        # money auto-scaled ($M, $K, $), percent columns percentFormat; every row is money
        {"calculate": "datum.isPctCol ? format(datum.absValue, percentFormat) : "
                      "(datum.absValue >= 999950 ? currencySymbol + format(datum.absValue / 1000000, ',.1f') + 'M' : "
                      "(datum.absValue >= 999.5 ? currencySymbol + format(datum.absValue / 1000, ',.1f') + 'K' : "
                      "currencySymbol + format(datum.absValue, ',.0f')))",
         "as": "body"},
        {"calculate": "(!isValid(datum.value) || !isFinite(datum.value)) ? '' : "
                      "(datum.value < 0 ? '(' + datum.body + ')' : datum.body)",
         "as": "cell"},
        {"calculate": "-0.11", "as": "headerRuleY"},
    ]
)

layer = [
    {"description": "zebra banding on odd rows, spanning the label gutter and the grid",
     "transform": [{"filter": "datum.column === 'Actual' && datum.rowIdx % 2 === 1"}],
     "mark": {"type": "rect", "fill": E("bandColor"), "fillOpacity": E("bandOpacity"),
              "x": E("-labelWidth"), "x2": "width"},
     "encoding": {"y": yq("rowIdx"), "y2": {"field": "rowEnd"}}},

    {"description": "accent rule under the column headers",
     "transform": [{"filter": "datum.column === 'Actual' && datum.rowIdx === 0"}],
     "mark": {"type": "rule", "stroke": E("accentColor"), "strokeWidth": 1.5,
              "opacity": 0.9, "x": E("-labelWidth"), "x2": "width"},
     "encoding": {"y": yq("headerRuleY")}},

    {"description": "vertical dividers: end of the label gutter, and the period and YTD split",
     "transform": [{"filter": f"datum.rowIdx === 0 && ({STRONG_COL})"}],
     "mark": {"type": "rule", "stroke": E("dividerColor"), "y": -46},
     "encoding": {"x": xq("colIdx"),
                  "strokeWidth": {"condition": {"test": "datum.column === 'YTD Actual'",
                                                "value": 1.5}, "value": 1}}},

    {"description": "rule above each subtotal and total line",
     "transform": [{"filter": "datum.column === 'Actual' && datum.isSubtotal"}],
     "mark": {"type": "rule", "stroke": E("ruleColor"), "strokeWidth": 1, "opacity": 0.8,
              "x": E("-labelWidth"), "x2": "width"},
     "encoding": {"y": yq("rowIdx")}},

    {"description": "closing rule under the last row",
     "transform": [{"filter": "datum.column === 'Actual' && datum.rowIdx === rowCount - 1"}],
     "mark": {"type": "rule", "stroke": E("ruleColor"), "strokeWidth": 1, "opacity": 0.8,
              "x": E("-labelWidth"), "x2": "width"},
     "encoding": {"y": yq("rowEnd")}},

    {"description": "half captions",
     "transform": [
         {"filter": f"datum.rowIdx === 0 && ({STRONG_COL})"},
         {"calculate": "datum.column === 'Actual' ? periodCaption : ytdCaption", "as": "groupLabel"}],
     "mark": {"type": "text", "align": "left", "baseline": "middle",
              "fontSize": E("captionFontSize"), "fontWeight": 700,
              "fill": E("accentColor"), "opacity": 0.95, "y": -38, "xOffset": 4},
     "encoding": {"x": xq("colIdx"), "text": {"field": "groupLabel", "type": "nominal"}}},

    {"description": "row-label gutter caption",
     "transform": [{"filter": "datum.rowIdx === 0 && datum.column === 'Actual'"}],
     "mark": {"type": "text", "align": "left", "baseline": "middle",
              "fontSize": E("captionFontSize"), "fontWeight": 700, "fill": E("mutedTextColor"),
              "y": -38, "x": E("4 - labelWidth"), "text": E("labelCaption")},
     "encoding": {}},

    {"description": "column headers (the leading 'YTD ' is stripped, the half caption already says it)",
     "transform": [
         {"filter": "datum.rowIdx === 0"},
         {"calculate": "indexof(datum.column, 'YTD ') === 0 ? slice(datum.column, 4) : datum.column",
          "as": "headerText"}],
     "mark": {"type": "text", "align": "right", "baseline": "middle",
              "fontSize": E("headerFontSize"), "y": -22, "xOffset": -11,
              "limit": E(f"width / {N_COLS} - 6"),
              "fontWeight": E(f"({STRONG_COL}) ? 700 : 600")},
     "encoding": {"x": xq("colEnd"), "text": {"field": "headerText", "type": "nominal"},
                  "fill": {"condition": {"test": STRONG_COL, "value": E("strongTextColor")},
                           "value": E("mutedTextColor")}}},

    {"description": "row labels in the left gutter; the indent is a pixel offset per LineClass, "
                    "because a baked-in U+00A0 indent does not reliably survive the SVG pipeline",
     "transform": [{"filter": "datum.column === 'Actual'"},
                   {"calculate": "trim(replace(datum.Line, /\\s+/g, ' '))", "as": "lineLabel"}],
     "mark": {"type": "text", "align": "left", "baseline": "middle",
              "fontSize": E("fontSize"),
              "x": E("4 - labelWidth + (datum.LineClass === detailLineClass ? indentWidth : 0)"),
              "limit": E("labelWidth + 20"),
              "fontWeight": E("datum.isSubtotal ? 700 : 400")},
     "encoding": {"y": yq("rowMid"), "text": {"field": "lineLabel", "type": "nominal"},
                  "fill": {"condition": {"test": "datum.isSubtotal", "value": E("strongTextColor")},
                           "value": E("textColor")}}},

    {"description": "the numbers, one per line and column",
     "mark": {"type": "text", "align": "right", "baseline": "middle",
              "fontSize": E("fontSize"), "xOffset": -11,
              "fontWeight": E("datum.isSubtotal ? 700 : 400")},
     "encoding": {"x": xq("colEnd"), "y": yq("rowMid"),
                  "text": {"field": "cell", "type": "nominal"},
                  "fill": {"condition": [
                      {"test": "datum.isVarCol && datum.value < 0", "value": E("negativeColor")},
                      {"test": "datum.isSubtotal", "value": E("strongTextColor")},
                      {"test": STRONG_COL, "value": E("strongTextColor")}],
                      "value": E("textColor")}}},

    {"description": "invisible full-cell rects so every cell is hoverable, blanks included",
     "mark": {"type": "rect", "fill": E("bandColor"), "fillOpacity": 0},
     "encoding": {"x": xq("colIdx"), "x2": {"field": "colEnd"},
                  "y": yq("rowIdx"), "y2": {"field": "rowEnd"},
                  "tooltip": [
                      {"field": "Line", "type": "nominal", "title": "Line"},
                      {"field": "column", "type": "nominal", "title": "Column"},
                      {"field": "cell", "type": "nominal", "title": "Value"},
                      {"field": "value", "type": "quantitative", "title": "Raw",
                       "format": ",.4f"}]}},
]

spec = {
    "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
    "usermeta": USERMETA,
    "config": CONFIG,
    "params": PARAMS,
    "data": {"name": "dataset"},
    "padding": {"left": 4, "top": 10, "right": 16, "bottom": 14},
    "transform": transform,
    "layer": layer,
}

if __name__ == "__main__":
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(spec, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")
    print(f"wrote {OUT.relative_to(REPO).as_posix()}: {len(transform)} transforms, {len(layer)} layers")
