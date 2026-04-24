# Deneb Visuals for Power BI

A collection of [Deneb](https://deneb-viz.github.io/) custom visual specifications for Power BI, built using **Vega** and **Vega-Lite** grammars.

## How to Use

- **Power BI files (`.pbix`)** — Download and open directly in Power BI Desktop. Sample data is included.
- **JSON / JSONC files** — Copy the specification content and paste it into the Deneb custom visual editor in Power BI.

---

## Charts

### 1. Bullet Chart

**File:** [`Bullet Chart.jsonc`](Bullet%20Chart.jsonc) | **Demo:** [`Deneb Bullet Chart.pbix`](Deneb%20Bullet%20Chart.pbix)  
**Grammar:** Vega-Lite

A horizontal bullet chart adapted from Daniel Marsh-Patrick's "Mundigl Bullets" design. Displays **Sales vs Budget vs Last Year** for each product, with variance labels and colour-coded bars.

**Features:**
- Coloured bars — blue for positive variance to budget, red for negative
- Semi-transparent background bar showing Last Year sales
- Target tick mark showing Budget
- Inline Sales value label and variance % label on each bar
- Full tooltip showing Sales, Budget, Sales LY, Var to Budget, Var to Budget %, Var to LY, Var to LY %
- Products sorted descending by Sales

**Required fields from Power BI dataset:**
| Field | Type |
|---|---|
| `Products` | Nominal |
| `Sales` | Quantitative |
| `Budget` | Quantitative |
| `Sales LY` | Quantitative |
| `Var To Budget` | Quantitative |
| `Var To Budget %` | Quantitative |
| `Var To LY` | Quantitative |
| `Var To LY %` | Quantitative |

**Preview:**

<!-- Add screenshot here -->
> 📷 *Add a screenshot of the bullet chart here*

---

### 2. Half-Donut Gauge

**File:** [`Deneb Gauge.json`](Deneb%20Gauge.json)  
**Grammar:** Vega-Lite v6

A half-donut (semicircle) gauge showing a **Score** against a **Target**, designed for KPI-style visuals. The gauge spans 0%–100% with the filled arc representing the score and a tick mark indicating the target.

**Features:**
- Responsive sizing — scales to the container width and height
- Score displayed as a large centred percentage label
- Target shown as a tick mark overhanging the ring, with a floating percentage label positioned radially
- 0% and 100% end labels
- Configurable colours via named params (fill, background, target, labels)
- Configurable stroke width and fill opacity

**Required fields from Power BI dataset:**
| Field | Description |
|---|---|
| `score` | Numeric ratio (0–1) — the current score value |
| `target` | Numeric ratio (0–1) — the target value |

**Configurable params:**
| Param | Default | Description |
|---|---|---|
| `fill_color` | `#F2A900` | Score arc fill colour |
| `background_color` | `#DCD8DB` | Background arc colour |
| `target_color` | `#F2A900` | Target tick colour |
| `ring_fill_opacity` | `0.6` | Arc fill opacity |
| `ring_stroke_width` | `4` | Arc stroke width |
| `label_font_size` | `14` | End label font size |

**Preview:**

<!-- Add screenshot here -->
> 📷 *Add a screenshot of the gauge here*

---

### 3. Australia Choropleth Map

**File:** [`map_australia_by_state.json`](map_australia_by_state.json)  
**Grammar:** Vega v6

A choropleth map of Australia showing a compliance or performance metric **by state and territory**. GeoJSON boundary data for all 8 states/territories is embedded directly in the spec — no external data source required for the shapes.

**Features:**
- Full Australian state and territory boundaries (GeoJSON embedded)
- State abbreviation labels (NSW, VIC, QLD, SA, WA, TAS, NT, ACT) positioned on each region
- Colour encodes the metric value per state
- Responsive sizing driven by the Power BI container dimensions
- Title and subtitle configured in the spec

**Required fields from Power BI dataset:**
| Field | Description |
|---|---|
| State/territory name | Must match full names (e.g. `New South Wales`, `Victoria`) |
| Metric value | The compliance/performance score to colour-encode |

**Preview:**

<!-- Add screenshot here -->
> 📷 *Add a screenshot of the Australia map here*

---

## Resources

- [Deneb Documentation](https://deneb-viz.github.io/)
- [Vega-Lite Documentation](https://vega.github.io/vega-lite/)
- [Vega Documentation](https://vega.github.io/vega/)
- [Vega Editor (online preview)](https://vega.github.io/editor/)


