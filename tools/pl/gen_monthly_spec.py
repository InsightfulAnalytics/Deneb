"""Generate the Monthly P&L Grid template:
templates/financial/pl-monthly-grid/pl-monthly-grid.json

A monthly P&L statement grid: 28 rows (seven sections of a caption and three lines) by 15
columns (Jan to Dec, YTD, YTG, FY). The usual native build is a matrix with a calculation group
on columns and 28 measures on rows, which dispatches every cell separately and re-evaluates each
measure again for its dynamic format string. This grid asks the model for the irreducible
dataset instead: Year x Month grouped natively with 10 base measures, one scan shape. The spec
derives everything else:

  Jan to Dec  the month columns, straight from the group-by
  FY          sum of the months
  YTD, YTG    sum of the months up to, and after, the current month
  ratios      Gross Margin %, Opex % of Income, every Var % and percentage-point row
  formats     $M, $K and $ thresholds and the percent rule, as Vega format() calls

The current month comes out of the data with no extra DAX. MonthOffset is
(12*Y + M) - (12*todayY + todayM) upstream, so 12*Y + M - MonthOffset is today's absolute
month index on every row, and its month of year is the current month.

The highlight flag does not filter the grid. It arrives as a 0/1 field (in the source model,
from a disconnected month table behind a slicer), so a selection fades the other eleven months
instead of deleting their columns: all fifteen columns stay on screen and stay comparable.

Run:

    python tools/pl/gen_monthly_spec.py
    node tools/pl/verify_monthly.mjs

Writes the template, plus the numeric gate's inputs beside this file: a 12-row edge-case
dataset (monthly-pl.sample-rows.json) and the expected value of every cell computed here in
Python straight from the DAX rules (monthly-pl.expected.json), and the same for the template's
sample-data.csv (monthly-pl.sample-data.expected.json). verify_monthly.mjs runs the template
over both datasets: two implementations of the same rules, one gate.
"""
import csv
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
FOLDER = REPO / "templates" / "financial" / "pl-monthly-grid"
OUT = FOLDER / "pl-monthly-grid.json"

# ---------------------------------------------------------------- layout constants
HEADER_H = 34
LABEL_W = 160           # the longest line label is "Opex % Var pts"; the section captions
                        # carry the full names, so nothing is lost
MIN_ROW_H = 21          # a FLOOR for a squeezed container, not the row height. Deneb's own
                        # chrome takes about 28px, so a 740px visual gives the view about 712px
                        # and rows land at (712-34)/28 = 24px. Below the floor the view keeps
                        # NEED_H and Deneb shows a scrollbar instead of crushing the rows.
SCROLL_W = 12
N_COLS = 15
N_ROWS = 28
NEED_H = HEADER_H + N_ROWS * MIN_ROW_H

# Vega ignores a top-level config "font"; text marks take theirs from config.text.font.
CONFIG = {
    "autosize": {"type": "fit", "contains": "padding"},
    "view": {"stroke": "transparent"},
    "background": "transparent",
    "font": "Segoe UI",
    "text": {"font": "Segoe UI"},
}

# ---------------------------------------------------------------- dataset contract
# (internal name, template field name, type, kind, description). The alias block copies
# token __i__ into the internal name before any derived field is built, so the rest of the
# spec (dot access, the prefixed s*/v* working fields) only ever sees the internal names.
FIELDS = [
    ("Year", "Year", "numeric", "column", "Calendar year. One row per year and month."),
    ("Month", "Month", "numeric", "column", "Month number, 1 to 12."),
    ("MonthOffset", "Month Offset", "numeric", "measure",
     "Months from the current month: 0 this month, -1 last month. Use the minimum over the month."),
    ("MthSel", "Month Selected", "numeric", "measure",
     "1 for a month to highlight, else 0. A measure that always returns 0 turns highlighting off."),
    ("IncAct", "Income Act", "numeric", "measure", "Total income, actual."),
    ("IncLY", "Income LY", "numeric", "measure", "Total income, last year."),
    ("CogAct", "COGS Act", "numeric", "measure", "Total cost of sales, actual, as a negative number."),
    ("CogLY", "COGS LY", "numeric", "measure", "Total cost of sales, last year, as a negative number."),
    ("GPAct", "GP Act", "numeric", "measure", "Gross profit, actual."),
    ("GPLY", "GP LY", "numeric", "measure", "Gross profit, last year."),
    ("OpxAct", "Opex Act", "numeric", "measure", "Total operating expenses, actual, as a negative number."),
    ("OpxLY", "Opex LY", "numeric", "measure", "Total operating expenses, last year, as a negative number."),
    ("NPAct", "NP Act", "numeric", "measure", "Net profit, actual."),
    ("NPLY", "NP LY", "numeric", "measure", "Net profit, last year."),
]
INTERNAL = [f[0] for f in FIELDS]
MEASURES = INTERNAL[4:]
assert MEASURES == ["IncAct", "IncLY", "CogAct", "CogLY", "GPAct", "GPLY",
                    "OpxAct", "OpxLY", "NPAct", "NPLY"]
FLAG = "MthSel"

USERMETA = {
    "deneb": {"build": "1.9.1.0", "metaVersion": 1, "provider": "vega", "providerVersion": "6.2.0"},
    "information": {
        "name": "Monthly P&L Grid",
        "description": ("A monthly P&L statement table: income, cost of sales, gross profit, margin, "
                        "operating expenses, cost ratio and net profit as actual, last year and variance "
                        "rows, across Jan to Dec, YTD, YTG and FY. All 315 cells are derived in the spec "
                        "from 12 monthly rows. Design by Timothy Osborn."),
        "author": "Timothy Osborn",
        "uuid": "c7d0beea-a444-48de-b47b-6cdc0838a2a5",
        "generated": "2026-09-23T00:00:00.000Z",
    },
    "dataset": [{"key": f"__{i}__", "name": name, "description": desc, "type": typ, "kind": kind}
                for i, (_internal, name, typ, kind, desc) in enumerate(FIELDS)],
    "interactivity": {"tooltip": True, "contextMenu": True, "selection": False, "highlight": False,
                      "dataPointLimit": 50},
}

# ---------------------------------------------------------------- row registry
# (key, label, fmt): fmt None marks a section caption row.
# 7 sections x (1 caption + 3 rows) = 28.
ROWS = [
    # Each section caption carries the full name, so the three rows under it do not repeat it.
    # At 13px that is what keeps the label gutter to 160px and gives the fifteen value columns
    # their width back.
    ("t_inc",   "Income",              None),
    ("inc_act", "Income Act",          "money"),
    ("inc_ly",  "Income LY",           "money"),
    ("inc_var", "Income Var %",        "pct"),
    ("t_cogs",  "Cost of Sales",       None),
    ("cog_act", "COGS Act",            "money"),
    ("cog_ly",  "COGS LY",             "money"),
    ("cog_var", "COGS Var %",          "pct"),
    ("t_gp",    "Gross Profit",        None),
    ("gp_act",  "GP Act",              "money"),
    ("gp_ly",   "GP LY",               "money"),
    ("gp_var",  "GP Var %",            "pct"),
    ("t_gm",    "Gross Margin",        None),
    ("gm_act",  "GM % Act",            "pct"),
    ("gm_ly",   "GM % LY",             "pct"),
    ("gm_var",  "GM Var pts",          "pct"),
    ("t_opx",   "Operating Expenses",  None),
    ("opx_act", "Opex Act",            "money"),
    ("opx_ly",  "Opex LY",             "money"),
    ("opx_var", "Opex Var %",          "pct"),
    ("t_ratio", "Cost Ratio",          None),
    ("opr_act", "Opex % Act",          "pct"),
    ("opr_ly",  "Opex % LY",           "pct"),
    ("opr_var", "Opex % Var pts",      "pct"),
    ("t_np",    "Net Profit",          None),
    ("np_act",  "NP Act",              "money"),
    ("np_ly",   "NP LY",               "money"),
    ("np_var",  "NP Var %",            "pct"),
]
assert len(ROWS) == N_ROWS
DATA_KEYS = [k for k, _, f in ROWS if f is not None]
assert len(DATA_KEYS) == 21

# Variance rows where UP IS BAD: costs and cost ratios rising. Colouring these by raw sign
# paints an overspend green, which is the one thing a P&L reader cannot be allowed to misread.
COST_VAR = {"cog_var", "opx_var", "opr_var"}

# The labels are not stored here: they come from the lineLabels signal (one entry per row, in
# row order), so renaming or translating a row is a one-place edit at the top of the spec.
ROWS_REG = [{"key": k, "rowIdx": i,
             "kind": "title" if f is None else "data",
             "fmt": f or "", "isVar": k.endswith("_var"), "badUp": k in COST_VAR}
            for i, (k, _lbl, f) in enumerate(ROWS)]
ROW_EDGES = [{"edge": i} for i in range(N_ROWS + 1)]
COLS_REG = [{"colIdx": i} for i in range(N_COLS)]   # 0-11 months, 12 YTD, 13 YTG, 14 FY

# ---------------------------------------------------------------- options (top-level signals)
OPTION_SIGNALS = [
    {"name": "headerColor", "update": "pbiColor(1)"},
    {"name": "headerTextColor", "value": "#FFFFFF"},
    {"name": "sectionColor", "value": "#F1F1F1"},
    {"name": "gridColor", "value": "#E6E6E6"},
    {"name": "textColor", "value": "#231F20"},
    {"name": "colorGood", "update": "pbiColor('good')"},
    {"name": "colorBad", "update": "pbiColor('bad')"},
    {"name": "highlightColor", "update": "pbiColor(3, 0.7)"},
    {"name": "highlightOpacity", "value": 0.13},
    {"name": "dimOpacity", "value": 0.4},
    {"name": "fontSize", "value": 13},
    {"name": "headerHeight", "value": HEADER_H},
    {"name": "labelWidth", "value": LABEL_W},
    {"name": "monthNames", "value": ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                                     "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]},
    {"name": "ytdLabel", "value": "YTD"},
    {"name": "ytgLabel", "value": "YTG"},
    {"name": "fyLabel", "value": "FY"},
    {"name": "lineLabels", "value": [lbl for _k, lbl, _f in ROWS]},
    {"name": "currencySymbol", "value": "$"},
]
LAYOUT_SIGNALS = [
    {"name": "colWidth", "update": f"(width - labelWidth) / {N_COLS}"},
    {"name": "rowHeight", "update": f"(height - headerHeight) / {N_ROWS}"},
    # No selection means no emphasis: every column renders at full strength.
    {"name": "hasSel", "update": "length(data('selCols')) > 0"},
]


# ---------------------------------------------------------------- row arithmetic
# DAX semantics, reproduced exactly:
#   DIVIDE(n, d) -> BLANK when d is BLANK or 0, and when n is BLANK
#   a - b        -> BLANK only when BOTH are BLANK; otherwise BLANK acts as 0
#   x * BLANK()  -> BLANK  (which is why the Opex sign flip is written -1 * [x] in DAX)
def var_pct(act, ly):
    return (f"(datum.{ly} == null || datum.{ly} == 0) ? null : "
            f"(((datum.{act} == null ? 0 : datum.{act}) - datum.{ly}) / datum.{ly})")


def ratio(n, d):
    return (f"(datum.{d} == null || datum.{d} == 0 || datum.{n} == null) ? null : "
            f"(datum.{n} / datum.{d})")


def neg_ratio(n, d):
    """DIVIDE ( -1 * [n], [d] ): the sign flip preserves the blank, so the guard is the same
    as ratio()."""
    return (f"(datum.{d} == null || datum.{d} == 0 || datum.{n} == null) ? null : "
            f"(-datum.{n} / datum.{d})")


def sub(a, b):
    return ("(datum.{a} == null && datum.{b} == null) ? null : "
            "((datum.{a} == null ? 0 : datum.{a}) - (datum.{b} == null ? 0 : datum.{b}))"
            ).format(a=a, b=b)


ROW_FORMULAS = {
    "inc_act": "datum.IncAct",
    "inc_ly":  "datum.IncLY",
    "inc_var": var_pct("IncAct", "IncLY"),
    "cog_act": "datum.CogAct",
    "cog_ly":  "datum.CogLY",
    "cog_var": var_pct("CogAct", "CogLY"),
    "gp_act":  "datum.GPAct",
    "gp_ly":   "datum.GPLY",
    "gp_var":  var_pct("GPAct", "GPLY"),
    "gm_act":  ratio("GPAct", "IncAct"),
    "gm_ly":   ratio("GPLY", "IncLY"),
    # sequential: reads the two gm fields calculated immediately above
    "gm_var":  sub("gm_act", "gm_ly"),
    "opx_act": "datum.OpxAct",
    "opx_ly":  "datum.OpxLY",
    "opx_var": var_pct("OpxAct", "OpxLY"),
    "opr_act": neg_ratio("OpxAct", "IncAct"),
    "opr_ly":  neg_ratio("OpxLY", "IncLY"),
    "opr_var": sub("opr_act", "opr_ly"),
    "np_act":  "datum.NPAct",
    "np_ly":   "datum.NPLY",
    "np_var":  var_pct("NPAct", "NPLY"),
}
assert list(ROW_FORMULAS) == DATA_KEYS

# ---------------------------------------------------------------- number formats
# Money: >= 999950 as $x.xM, >= 999.5 as $x.xK, else $x. Percent: ABS(v) >= 1 as "0%",
# else "0.0%". Negatives render as accounting brackets.
MONEY_BODY = ("currencySymbol + (datum.av >= 999950 ? format(datum.av / 1e6, ',.1f') + 'M'"
              " : datum.av >= 999.5 ? format(datum.av / 1e3, ',.1f') + 'K'"
              " : format(datum.av, ',.0f'))")
PCT_BODY = "(datum.av >= 1 ? format(datum.av, '.0%') : format(datum.av, '.1%'))"
BODY_EXPR = f"datum.fmt == 'pct' ? {PCT_BODY} : {MONEY_BODY}"


def aggregate(groupby=None):
    """sum + valid per base measure. sum ignores nulls and returns 0 over nothing, which DAX
    would call BLANK; the valid count is what lets null_guards() put the blank back."""
    agg = {
        "type": "aggregate",
        "fields": MEASURES + MEASURES + ["todayIdx", FLAG],
        "ops": ["sum"] * len(MEASURES) + ["valid"] * len(MEASURES) + ["max", "max"],
        "as": [f"s{m}" for m in MEASURES] + [f"v{m}" for m in MEASURES]
              + ["todayIdx", "selMonth"],
    }
    if groupby:
        agg["groupby"] = groupby
    return agg


def null_guards():
    return [{"type": "formula", "as": m,
             "expr": f"datum.v{m} > 0 ? datum.s{m} : null"} for m in MEASURES]


def totals(name, filter_expr, label_signal, col_idx):
    entry = {"name": name, "source": "months", "transform": []}
    if filter_expr:
        entry["transform"].append({"type": "filter", "expr": filter_expr})
    entry["transform"].append(aggregate())
    entry["transform"] += null_guards()
    entry["transform"] += [
        {"type": "formula", "as": "colLabel", "expr": label_signal},
        {"type": "formula", "as": "colIdx", "expr": str(col_idx)},
    ]
    return entry


def build_data():
    alias = [{"type": "formula", "as": internal, "expr": f"datum['__{i}__']"}
             for i, internal in enumerate(INTERNAL)]
    dataset = {"name": "dataset", "transform": alias + [
        # Today's absolute month index; constant across rows by construction of MonthOffset.
        # Guard every input: a null MonthOffset would coerce to 0 and give a plausible but
        # entirely wrong current month.
        {"type": "formula", "as": "todayIdx",
         "expr": ("isValid(datum.MonthOffset) && isValid(datum.Year) && isValid(datum.Month)"
                  " ? 12 * datum.Year + datum.Month - datum.MonthOffset"
                  " : null")},
    ]}
    return [
        dataset,
        {"name": "rowsReg", "values": ROWS_REG,
         "transform": [{"type": "formula", "as": "label", "expr": "lineLabels[datum.rowIdx]"}]},
        {"name": "rowEdges", "values": ROW_EDGES},
        {"name": "colsReg", "values": COLS_REG},
        {"name": "titleRows", "source": "rowsReg",
         "transform": [{"type": "filter", "expr": "datum.kind == 'title'"}]},
        # One datum per month, summed across any extra grouping: two selected years land in
        # the same month bucket.
        {"name": "months", "source": "dataset", "transform":
            [aggregate(groupby=["Month"])] + null_guards() + [
                # No usable MonthOffset anywhere: curP is null and BOTH cumulative filters
                # below fail closed, blanking YTD and YTG. Deliberate: a blank column gets
                # reported, whereas curP = 0 would render YTG as the full year and look fine.
                {"type": "formula", "as": "curP",
                 "expr": "isFinite(datum.todayIdx) ? ((datum.todayIdx - 1) % 12) + 1 : null"},
            ]},
        {"name": "monthCols", "source": "months", "transform": [
            # A month 13, if a calendar ever carries one, has no column. It still lands in FY
            # and YTG.
            {"type": "filter", "expr": "datum.Month >= 1 && datum.Month <= 12"},
            {"type": "formula", "as": "colIdx", "expr": "datum.Month - 1"},
            {"type": "formula", "as": "colLabel", "expr": "monthNames[datum.Month - 1]"},
            {"type": "formula", "as": "isSel", "expr": "datum.selMonth > 0"},
        ]},
        # Empty while nothing is highlighted, which is what hasSel reads to leave the grid alone.
        {"name": "selCols", "source": "monthCols",
         "transform": [{"type": "filter", "expr": "datum.isSel"}]},
        # The isValid guards are load-bearing: JS coerces null to 0, so a bare
        # `datum.Month > datum.curP` is TRUE for every month when curP is null.
        totals("totYTD", "isValid(datum.curP) && datum.Month <= datum.curP", "ytdLabel", 12),
        totals("totYTG", "isValid(datum.curP) && datum.Month > datum.curP", "ytgLabel", 13),
        totals("totFY", None, "fyLabel", 14),
        {"name": "cells", "source": ["monthCols", "totYTD", "totYTG", "totFY"],
         "transform":
            [{"type": "formula", "as": k, "expr": ROW_FORMULAS[k]} for k in DATA_KEYS]
            + [
                {"type": "fold", "fields": DATA_KEYS, "as": ["key", "value"]},
                {"type": "lookup", "from": "rowsReg", "key": "key",
                 "fields": ["key"], "values": ["rowIdx", "label", "fmt", "isVar", "badUp"],
                 "as": ["rowIdx", "rowLabel", "fmt", "isVar", "badUp"]},
                {"type": "formula", "as": "av", "expr": "abs(datum.value)"},
                {"type": "formula", "as": "body", "expr": BODY_EXPR},
                {"type": "formula", "as": "fmtd",
                 "expr": ("datum.value == null ? '' : "
                          "(datum.value < 0 ? '(' + datum.body + ')' : datum.body)")},
            ]},
    ]


MARKS = [
    {"type": "rect", "name": "headerBand", "interactive": False,
     "encode": {"update": {
         "x": {"value": 0}, "x2": {"signal": "width"},
         "y": {"value": 0}, "y2": {"signal": "headerHeight"},
         "fill": {"signal": "headerColor"}}}},
    {"type": "text", "name": "headerLabels", "from": {"data": "colsReg"},
     "interactive": False,
     "encode": {"update": {
         "x": {"signal": "labelWidth + (datum.colIdx + 0.5) * colWidth"},
         "y": {"signal": "headerHeight / 2"},
         "align": {"value": "center"}, "baseline": {"value": "middle"},
         "text": {"signal": "datum.colIdx < 12 ? monthNames[datum.colIdx]"
                            " : [ytdLabel, ytgLabel, fyLabel][datum.colIdx - 12]"},
         "fontSize": {"signal": "fontSize"},
         "fontWeight": {"value": "bold"}, "fill": {"signal": "headerTextColor"},
         "limit": {"signal": "colWidth - 4"}}}},
    {"type": "rect", "name": "titleBands", "from": {"data": "titleRows"},
     "interactive": False,
     "encode": {"update": {
         "x": {"value": 0}, "x2": {"signal": "width"},
         "y": {"signal": "headerHeight + datum.rowIdx * rowHeight"},
         "height": {"signal": "rowHeight"},
         "fill": {"signal": "sectionColor"}}}},
    {"type": "rule", "name": "gridRules", "from": {"data": "rowEdges"},
     "interactive": False,
     "encode": {"update": {
         "x": {"value": 0}, "x2": {"signal": "width"},
         # the last edge lands exactly on `height`, where a centred 1px stroke would render
         # half off-canvas, so pull it inside
         "y": {"signal": "min(headerHeight + datum.edge * rowHeight, height - 0.5)"},
         "stroke": {"signal": "gridColor"}, "strokeWidth": {"value": 1}}}},
    # Under the labels and the numbers, over the section bands: the selected column reads as one
    # continuous block. YTD, YTG and FY are never washed; they are not months.
    {"type": "rect", "name": "monthWash", "from": {"data": "selCols"},
     "interactive": False,
     "encode": {"update": {
         "x": {"signal": "labelWidth + datum.colIdx * colWidth"},
         "width": {"signal": "colWidth"},
         "y": {"signal": "headerHeight"}, "y2": {"signal": "height"},
         "fill": {"signal": "highlightColor"}, "fillOpacity": {"signal": "highlightOpacity"}}}},
    {"type": "text", "name": "rowLabels", "from": {"data": "rowsReg"},
     "interactive": False,
     "encode": {"update": {
         "x": {"signal": "datum.kind == 'title' ? 10 : 24"},
         "y": {"signal": "headerHeight + (datum.rowIdx + 0.5) * rowHeight"},
         "baseline": {"value": "middle"},
         "text": {"field": "label"},
         "fontSize": {"signal": "fontSize"},
         "fontWeight": {"signal": "datum.kind == 'title' ? 'bold' : 'normal'"},
         "fill": {"signal": "textColor"},
         "limit": {"signal": "labelWidth - (datum.kind == 'title' ? 10 : 24) - 6"}}}},
    {"type": "text", "name": "cellText", "from": {"data": "cells"},
     "encode": {"update": {
         "x": {"signal": "labelWidth + (datum.colIdx + 1) * colWidth - 6"},
         "y": {"signal": "headerHeight + (datum.rowIdx + 0.5) * rowHeight"},
         "align": {"value": "right"}, "baseline": {"value": "middle"},
         "text": {"field": "fmtd"},
         "fontSize": {"signal": "fontSize"},
         # Variance rows only: good colour when the movement is good, bad colour when it is not.
         # On the three cost rows good means DOWN, so the sign flips first. Exactly zero and
         # BLANK stay in the text colour.
         "fill": {"signal": "datum.isVar && datum.value != null && datum.value != 0"
                            " ? ((datum.badUp ? -datum.value : datum.value) > 0"
                            " ? colorGood : colorBad) : textColor"},
         # Emphasis by subtraction: the unselected months fade, the totals never do.
         "fillOpacity": {"signal": "!hasSel || datum.colIdx > 11 || datum.isSel ? 1 : dimOpacity"},
         "limit": {"signal": "colWidth - 8"},
         "tooltip": {"signal":
                     "{'Line': datum.rowLabel, 'Column': datum.colLabel,"
                     " 'Value': datum.fmtd == '' ? 'blank' : datum.fmtd}"}}}},
]


def build_template():
    return {
        "$schema": "https://vega.github.io/schema/vega/v6.json",
        "usermeta": USERMETA,
        "config": CONFIG,
        "description": "Monthly P&L statement grid: 28 rows by 15 columns from one flat monthly query.",
        "padding": 0,
        "autosize": {"type": "none", "resize": True},
        # Height floors at NEED_H: a shorter container scrolls rather than crushing rows.
        # Width tracks the container, less the scrollbar gutter when that happens.
        "width": {"signal": f"pbiContainerWidth - (pbiContainerHeight < {NEED_H} ? {SCROLL_W} : 0)"},
        "height": {"signal": f"max(pbiContainerHeight, {NEED_H})"},
        "signals": OPTION_SIGNALS + LAYOUT_SIGNALS,
        "data": build_data(),
        "marks": MARKS,
    }


# ---------------------------------------------------------------- edge-case rows for the gate
# Year 2026, current month = 8 (MonthOffset 0 in Aug 2026). Actuals stop after month 8 so the
# gate exercises the future-month "(100.0%)" pattern; month 4 has CogLY = 0 (zero-denominator
# guard) and month 5 has OpxAct = null (blank-vs-0 guard). Keyed by the internal names.
def edge_rows():
    today_idx = 12 * 2026 + 8
    rows = []
    for m in range(1, 13):
        actual = m <= 8
        inc_ly = 6.5e8 + m * 4.0e7
        cog_ly = 0.0 if m == 4 else -inc_ly * 0.735
        gp_ly = inc_ly + cog_ly
        opx_ly = -inc_ly * 0.305
        np_ly = gp_ly + opx_ly
        inc_a = inc_ly * (1.04 + 0.002 * m) if actual else None
        cog_a = -inc_a * 0.729 if actual else None
        gp_a = (inc_a + cog_a) if actual else None
        opx_a = None if m == 5 else (-inc_a * 0.301 if actual else None)
        np_a = (gp_a + (opx_a or 0.0)) if actual else None
        rows.append({
            "Year": 2026, "Month": m, "MonthOffset": 12 * 2026 + m - today_idx,
            # June stands in for a highlight selection.
            FLAG: 1 if m == 6 else 0,
            "IncAct": inc_a, "IncLY": inc_ly,
            "CogAct": cog_a, "CogLY": cog_ly,
            "GPAct": gp_a, "GPLY": gp_ly,
            "OpxAct": opx_a, "OpxLY": opx_ly,
            "NPAct": np_a, "NPLY": np_ly,
        })
    return rows


def sample_csv_rows():
    """The template's sample-data.csv, re-keyed from the template field names to the internal
    names. None when the file is not there yet."""
    path = FOLDER / "sample-data.csv"
    if not path.exists():
        return None
    by_name = {name: internal for internal, name, *_ in FIELDS}
    rows = []
    with open(path, encoding="utf-8", newline="") as f:
        for raw in csv.DictReader(f):
            rows.append({by_name[k]: (None if v == "" else float(v)) for k, v in raw.items()})
    return rows


# ------------------------------------------------- expected cells (independent)
# Recomputes every cell in Python straight from the DAX rules, NOT from the Vega transforms,
# so verify_monthly.mjs is a genuine two-implementation diff.
def expected_cells(rows):
    def dsum(vals):
        vals = [v for v in vals if v is not None]
        return sum(vals) if vals else None

    def div(n, d):
        if d is None or d == 0 or n is None:
            return None
        return n / d

    def ndiv(n, d):
        r = div(n, d)
        return None if r is None else -r

    def dsub(a, b):
        if a is None and b is None:
            return None
        return (a or 0.0) - (b or 0.0)

    def var_pct_py(act, ly):
        if ly is None or ly == 0:
            return None
        return ((act or 0.0) - ly) / ly

    today_idx = {12 * r["Year"] + r["Month"] - r["MonthOffset"] for r in rows}
    assert len(today_idx) == 1
    cur_p = ((int(today_idx.pop()) - 1) % 12) + 1

    cols = {}
    for r in rows:
        if 1 <= r["Month"] <= 12:
            cols[int(r["Month"]) - 1] = {m: r[m] for m in MEASURES}
    for idx, sel in ((12, lambda r: r["Month"] <= cur_p),
                     (13, lambda r: r["Month"] > cur_p),
                     (14, lambda r: True)):
        cols[idx] = {m: dsum([r[m] for r in rows if sel(r)]) for m in MEASURES}

    def derive(c):
        gm_act = div(c["GPAct"], c["IncAct"])
        gm_ly = div(c["GPLY"], c["IncLY"])
        opr_act = ndiv(c["OpxAct"], c["IncAct"])
        opr_ly = ndiv(c["OpxLY"], c["IncLY"])
        return {
            "inc_act": c["IncAct"], "inc_ly": c["IncLY"],
            "inc_var": var_pct_py(c["IncAct"], c["IncLY"]),
            "cog_act": c["CogAct"], "cog_ly": c["CogLY"],
            "cog_var": var_pct_py(c["CogAct"], c["CogLY"]),
            "gp_act": c["GPAct"], "gp_ly": c["GPLY"],
            "gp_var": var_pct_py(c["GPAct"], c["GPLY"]),
            "gm_act": gm_act, "gm_ly": gm_ly, "gm_var": dsub(gm_act, gm_ly),
            "opx_act": c["OpxAct"], "opx_ly": c["OpxLY"],
            "opx_var": var_pct_py(c["OpxAct"], c["OpxLY"]),
            "opr_act": opr_act, "opr_ly": opr_ly, "opr_var": dsub(opr_act, opr_ly),
            "np_act": c["NPAct"], "np_ly": c["NPLY"],
            "np_var": var_pct_py(c["NPAct"], c["NPLY"]),
        }

    row_idx = {k: i for i, (k, _, f) in enumerate(ROWS) if f is not None}
    out = []
    for col_idx in sorted(cols):
        vals = derive(cols[col_idx])
        for k in DATA_KEYS:
            out.append({"rowIdx": row_idx[k], "colIdx": col_idx, "key": k, "value": vals[k]})
    return out


def write_json(path, obj):
    path.write_text(json.dumps(obj, indent=2) + "\n", encoding="utf-8", newline="\n")


if __name__ == "__main__":
    template = build_template()
    FOLDER.mkdir(parents=True, exist_ok=True)
    write_json(OUT, template)
    rows = edge_rows()
    write_json(HERE / "monthly-pl.sample-rows.json", rows)
    write_json(HERE / "monthly-pl.expected.json", expected_cells(rows))
    sample = sample_csv_rows()
    if sample is not None:
        write_json(HERE / "monthly-pl.sample-data.expected.json", expected_cells(sample))

    body = {k: v for k, v in template.items() if k not in ("$schema", "usermeta")}
    print(f"wrote     : {OUT.relative_to(REPO).as_posix()}")
    print(f"spec      : {len(json.dumps(body, separators=(',', ':')))} bytes minified")
    print(f"grid      : {N_ROWS} rows x {N_COLS} cols, {len(DATA_KEYS) * N_COLS} data cells")
    print(f"dataset   : Year and Month grouped + Month Offset + Month Selected + "
          f"{len(MEASURES)} base measures, 12 rows per selected year")
    print(f"gate data : edge-case rows and expected cells"
          f"{', plus expected cells for sample-data.csv' if sample is not None else ''}")
