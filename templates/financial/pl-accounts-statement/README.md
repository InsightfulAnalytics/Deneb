# P&L Accounts Statement

A classic account-level P&L statement table: detail accounts, subtotals and totals as rows, with
the current period and year to date against budget and last year.

![P&L Accounts Statement](preview.png)

## Fields

| Name | Kind | Type | Description |
|---|---|---|---|
| Line | column | text | Statement line label, one row per line. A leading indent (spaces or non-breaking spaces) is stripped; LineClass sets the indent. |
| LineKey | column | numeric | Sort key, ascending. Any increasing numbers work: the spec ranks them. |
| LineClass | column | text | `Detail` for an account line, drawn indented. Any other value (`Subtotal`, `Total`) is drawn bold with a rule above. |
| Actual | measure | numeric | Actual amount for the current period. |
| Budget | measure | numeric | Budget amount for the current period. |
| LY | measure | numeric | Last year's actual for the same period. |
| YTD Actual | measure | numeric | Actual amount, year to date. |
| YTD Budget | measure | numeric | Budget amount, year to date. |
| YTD LY | measure | numeric | Last year's actual, year to date. |

The spec derives the other eight columns (Var, Var %, vs LY, vs LY % and their YTD forms) and
formats every number, so you need no variance measures and no format strings.

### Conventions the spec relies on

- **One row per statement line**, in any number: the row count comes from the data. Subtotal and
  total lines are rows of their own, with their own amounts (the model sums them; the spec does
  not add lines up).
- **LineClass** `Detail` marks an account line: indented by `indentWidth` pixels, regular weight.
  Every other value is a subtotal or total: flush left, bold, with a rule above. Set
  `detailLineClass` if your model uses another word.
- **LineKey** sets the order, smallest first. A bridge table numbered 10, 20, 30 works as well
  as 1, 2, 3.
- **Costs are negative.** A cost line over budget then has a negative variance, which is what
  paints it red. Percent variances divide by the budget or last-year amount as stored, so a
  cost line that grew shows a positive %.

## Options

Every option is a param at the top of the spec. Change the value there.

| Param | Default | What it changes |
|---|---|---|
| `accentColor` | `pbiColor(0)` | The rule under the column headers and the CURRENT PERIOD and YEAR TO DATE captions. |
| `negativeColor` | `pbiColor('bad')` | Negative numbers in the variance columns. |
| `textColor` | `#1F252D` | Numbers and detail line labels. |
| `strongTextColor` | `#000000` | Subtotal and total rows, the two Actual columns and their headers. |
| `mutedTextColor` | `#4A5361` | Column headers and the STATEMENT LINE caption. |
| `ruleColor` | `#9AA3AF` | Rules above each subtotal and total, and under the last row. |
| `dividerColor` | `#D3D8DF` | Vertical dividers after the label gutter and between the period and YTD halves. |
| `bandColor` | `#161C24` | Tint of the zebra band on every second row. |
| `bandOpacity` | `0.045` | Opacity of the zebra band. |
| `labelWidth` | `280` | Width in pixels of the line-label gutter. |
| `indentWidth` | `16` | Indent in pixels of a detail line label. |
| `fontSize` | `14` | Numbers and line labels. |
| `headerFontSize` | `12` | Column headers. |
| `captionFontSize` | `11.5` | The three captions above the headers. |
| `labelCaption` | `STATEMENT LINE` | Caption over the label gutter. |
| `periodCaption` | `CURRENT PERIOD` | Caption over the first seven columns. |
| `ytdCaption` | `YEAR TO DATE` | Caption over the last seven columns. |
| `currencySymbol` | `$` | Prefix of every money value. Money is auto-scaled to M, K or whole units. |
| `percentFormat` | `.1%` | d3 format of the four % columns. |
| `detailLineClass` | `Detail` | The LineClass value that marks an account line. |

`rowCount` is also a param, but it is derived (`length(data('dataset'))`), not an option.

## Use it

1. In Power BI Desktop, add a Deneb visual and put Line, LineKey and LineClass from your P&L
   lines table and the six measures in its Values well.
2. Open the Deneb editor, choose to create a new specification from a template (Import template),
   pick `pl-accounts-statement.json`, and map the nine fields to yours.
3. Filter the page to one month (a Year and a Month slicer): the current-period columns show that
   month and the YTD columns the year up to it.

The spec sorts the rows by LineKey itself. It is designed for about 1600 x 740 px with 27 lines:
give it about 26 px of height per line, and below about 1300 px wide the bold rows start to crowd.

### The dataset query

The model is a generic P&L bridge: a `P&L Lines` table (LineKey, Line, LineClass, AccountKey) with
one row per line and member account, so a subtotal line repeats once per account, filtering a
`Financials` fact (Date, AccountKey, Scenario, Amount) through a many-to-many relationship on
AccountKey; and a marked `Date` table. The query the visual sends looks like this (September 2025
selected):

```dax
DEFINE
    MEASURE Financials[Total Amount] = SUM ( Financials[Amount] )
    MEASURE Financials[Actual] = CALCULATE ( [Total Amount], Financials[Scenario] = "Actual" )
    MEASURE Financials[Budget] = CALCULATE ( [Total Amount], Financials[Scenario] = "Budget" )
    MEASURE Financials[LY] = CALCULATE ( [Actual], DATEADD ( 'Date'[Date], -1, YEAR ) )
    MEASURE Financials[YTD Actual] = CALCULATE ( [Actual], DATESYTD ( 'Date'[Date] ) )
    MEASURE Financials[YTD Budget] = CALCULATE ( [Budget], DATESYTD ( 'Date'[Date] ) )
    MEASURE Financials[YTD LY] = CALCULATE ( [LY], DATESYTD ( 'Date'[Date] ) )
EVALUATE
SUMMARIZECOLUMNS (
    'P&L Lines'[Line],
    'P&L Lines'[LineKey],
    'P&L Lines'[LineClass],
    TREATAS ( { ( 2025, 9 ) }, 'Date'[Year], 'Date'[MonthOfYear] ),
    "Actual", [Actual],
    "Budget", [Budget],
    "LY", [LY],
    "YTD Actual", [YTD Actual],
    "YTD Budget", [YTD Budget],
    "YTD LY", [YTD LY]
)
ORDER BY 'P&L Lines'[LineKey]
```

Why this shape: a native statement usually dispatches every cell through a SWITCH on the line,
378 times, plus a dynamic format string per cell; here the model answers one grouped query (the
lines on a grouped column, six plain measures) and the spec derives the variances and formats.

The sample data is a fictional 28-store retailer, September 2025, with costs stored as negatives.

## Credit

Design and original spec: Timothy Osborn, built for a P&L matrix performance study on a synthetic
retail model. Rebuilt as a Deneb template by Timothy Osborn.

Changed from the original spec: the row count comes from the data instead of a fixed 27 lines;
the fields are template placeholders copied into the original names by an alias block, so the
transform chain is unchanged and still passes its 378-cell numeric check; colours, captions,
sizes, the indent, the detail class and number formats are params; the negative variance colour
is the theme's bad colour instead of a fixed red; the near-blacks (`#05070A`, `#101418`) are
merged into one strong text colour and the caption grey (`#5A6472`) into the header grey; and the
column headers have a width limit.

## Licence

MIT, see [LICENSE](../../../LICENSE). The design credit above stays with its author.
