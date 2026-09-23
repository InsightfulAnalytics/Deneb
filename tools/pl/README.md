# P&L template tooling

Generators and numeric gates for the three P&L statement templates in `templates/financial/`.
A P&L template can render cleanly and still be arithmetically wrong (a ratio of differences where
a difference of ratios belongs gives plausible numbers, not an error), so each template has a gate
that runs the template file itself and checks every cell.

## Setup

Once, from `tools/`:

```bash
npm install        # vega and vega-lite, pinned to the Deneb bundle
```

The gates import vega and vega-lite from `tools/node_modules`. The generators need Python 3.9 or
later and nothing else.

## Commands

From the repo root:

```bash
# regenerate a template after editing its generator
python tools/pl/gen_classic_spec.py      # P&L Accounts Statement
python tools/pl/gen_monthly_spec.py      # Monthly P&L Grid (also rewrites its expected-cell files)

# the numeric gates
node tools/pl/verify_spec.mjs            # Odd Rows P&L Statement: 182/182 against the golden file
node tools/pl/verify_classic.mjs         # P&L Accounts Statement: 378/378 per dataset
node tools/pl/verify_monthly.mjs         # Monthly P&L Grid: 315 cells, 0 differences per dataset

# schema, tokens, sample data and a render, for all three
node tools/check-templates.mjs templates/financial
```

Every gate exits 1 on any difference. Each one runs twice: once with the tokens resolved to the
template's own field names, and once with deliberately awkward names (spaces, an ampersand,
brackets), which proves the alias block keeps the transform chain independent of what the user's
fields are called.

## Files

| File | What it does |
|---|---|
| `gen_classic_spec.py` | Writes `templates/financial/pl-accounts-statement/pl-accounts-statement.json`: usermeta, config, params, the alias block, the transform chain and the 11 layers. Edit this, not the JSON. |
| `gen_monthly_spec.py` | Writes `templates/financial/pl-monthly-grid/pl-monthly-grid.json` the same way, plus the gate inputs below: the 12 edge-case rows, and the expected value of every cell for those rows and for the template's `sample-data.csv`, computed in Python straight from the DAX rules. Edit this, not the JSON. |
| `harness.mjs` | Shared by the three gates: loads a template, reads its alias block, resolves the tokens, re-keys rows and runs the view headless with Deneb's expression functions stubbed. |
| `verify_spec.mjs` | Odd Rows gate. Runs the template over `_deneb_base.csv` (30 rows extracted from the synthetic model the design was built on) and diffs all 182 cells against `_golden_182.csv`, the same statement as the native matrix computed it. |
| `verify_classic.mjs` | Accounts gate. Runs the template over `classic_real_rows.json` (27 lines extracted from the same model), `classic_synth_rows.json` (27 made-up lines with a zero budget) and the template's `sample-data.csv`, and diffs every cell against an independent JS calculation. A cut-down 5-line run proves the row count comes from the data. |
| `verify_monthly.mjs` | Monthly gate. Runs the template over `monthly-pl.sample-rows.json` and the template's `sample-data.csv`, and diffs all 315 cells of each against `monthly-pl.expected.json` and `monthly-pl.sample-data.expected.json`. Also checks that YTD and YTG go blank when the month offset is missing, and spot-checks the number formats. |
| `_deneb_base.csv`, `_golden_182.csv` | Odd Rows gate data. |
| `classic_real_rows.json`, `classic_synth_rows.json` | Accounts gate data. Line labels in the real rows carry a non-breaking-space indent, as a bridge table built for a native matrix does. |
| `monthly-pl.sample-rows.json` | Monthly edge cases: actuals stop after August, April has a zero last-year cost of sales, May has a blank operating expense, June is highlighted. |
| `monthly-pl.expected.json`, `monthly-pl.sample-data.expected.json` | Expected cells, written by `gen_monthly_spec.py`. |

The Odd Rows template has no generator. It was converted once from its original spec by a
throwaway script (alias block, params, usermeta), and the template JSON is now its source: edit
it directly, then run `verify_spec.mjs`.

All the data here is synthetic.
