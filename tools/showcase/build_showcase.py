#!/usr/bin/env python3
"""Build the Deneb Template Showcase PBIP from the templates and their showcase parts.

Run from the repo root:

    py tools/showcase/build_showcase.py            # regenerate showcase/*.pbip, *.SemanticModel, *.Report
    py tools/showcase/build_showcase.py --check    # exit 1 if the generated files are out of date
    py tools/showcase/build_showcase.py --repo <path to a copy of the repo>

Standard library only. The output is deterministic: every id is derived from a name, so a
rerun over unchanged inputs writes nothing. See tools/showcase/README.md for the formats.
"""
from __future__ import annotations

import argparse
import copy
import csv
import hashlib
import json
import math
import re
import shutil
import sys
import uuid
from dataclasses import dataclass, field, replace
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path

PROJECT = "Deneb Template Showcase"
DENEB_VISUAL = "deneb7E15AEF80B9E4D4F8E12924291ECE89A"
CATEGORY_ORDER = ["kpi", "comparison", "financial", "gauge", "map"]
BASE_THEME = "Fluent2-CY26SU07"
THEME_FILE = "bi-nexus.json"
DASHBOARD_FILE = "dashboard.json"
FONT = "Arial"
COMPATIBILITY_LEVEL = 1606
NAMESPACE = uuid.UUID("6f1d2c1e-3a5b-4c7d-9e8f-0a1b2c3d4e5f")

SCHEMA = {
    "pbip": "https://developer.microsoft.com/json-schemas/fabric/pbip/pbipProperties/1.0.0/schema.json",
    "platform": "https://developer.microsoft.com/json-schemas/fabric/gitIntegration/platformProperties/2.0.0/schema.json",
    "pbir": "https://developer.microsoft.com/json-schemas/fabric/item/report/definitionProperties/2.0.0/schema.json",
    "pbism": "https://developer.microsoft.com/json-schemas/fabric/item/semanticModel/definitionProperties/1.0.0/schema.json",
    "version": "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/versionMetadata/1.0.0/schema.json",
    "report": "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/report/3.3.0/schema.json",
    "pages": "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/pagesMetadata/1.1.0/schema.json",
    "page": "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/page/2.1.0/schema.json",
    "visual": "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/visualContainer/2.12.0/schema.json",
}
REPORT_VERSION_AT_IMPORT = {"visual": "2.11.0", "report": "3.4.0", "page": "2.3.1"}

# Template page layout, in page pixels.
MARGIN = 24
TITLE_GAP = 12
VISUAL_GAP = 24
MIN_CONTENT_WIDTH = 320
TEXT_INK = "#0B1E3F"
TEXT_BODY = "#475569"

TOKEN = re.compile(r"__(\d+)__")
DASHES = (chr(0x2013), chr(0x2014))
WARNINGS: list[str] = []


def warn(msg: str) -> None:
    if msg not in WARNINGS:
        WARNINGS.append(msg)


# ---------------------------------------------------------------------------- ids

def hex_id(*parts: str) -> str:
    """20 hex characters, the shape Power BI Desktop gives page and visual folders."""
    return hashlib.sha1("|".join(parts).encode("utf-8")).hexdigest()[:20]


def det_uuid(*parts: str) -> str:
    return str(uuid.uuid5(NAMESPACE, "|".join(parts)))


# ---------------------------------------------------------------------------- json helpers

def strip_jsonc(text: str) -> str:
    """Blank // and /* */ comments outside strings (Deneb accepts JSONC)."""
    out, i, n, in_str = [], 0, len(text), False
    while i < n:
        ch = text[i]
        if in_str:
            out.append(ch)
            if ch == "\\" and i + 1 < n:
                out.append(text[i + 1])
                i += 2
                continue
            if ch == '"':
                in_str = False
            i += 1
            continue
        if ch == '"':
            in_str = True
            out.append(ch)
            i += 1
        elif text.startswith("//", i):
            j = text.find("\n", i)
            i = n if j < 0 else j
        elif text.startswith("/*", i):
            j = text.find("*/", i + 2)
            i = n if j < 0 else j + 2
        else:
            out.append(ch)
            i += 1
    return "".join(out)


def load_json(path: Path):
    text = path.read_text(encoding="utf-8-sig")
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return json.loads(strip_jsonc(text))


def dump_json(doc) -> bytes:
    return (json.dumps(doc, indent=2, ensure_ascii=False) + "\n").encode("utf-8")


def lit(value) -> dict:
    """A PBIR literal expression."""
    if isinstance(value, bool):
        text = "true" if value else "false"
    elif isinstance(value, (int, float)):
        text = f"{num(value)}D"
    else:
        text = "'" + str(value).replace("'", "''") + "'"
    return {"expr": {"Literal": {"Value": text}}}


def num(value) -> str:
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value)


def show(flag: bool) -> list:
    return [{"properties": {"show": lit(flag)}}]


def solid(color: str) -> dict:
    return {"solid": {"color": lit(color)}}


# ---------------------------------------------------------------------------- inputs

@dataclass
class Field:
    key: str
    name: str
    type: str
    kind: str
    description: str = ""

    @property
    def deneb_name(self) -> str:
        # Deneb rewrites these characters to "_" in dataset field names.
        return re.sub(r'[.\[\]\\"]', "_", self.name)


@dataclass
class Template:
    path: Path
    rel: str
    slug: str
    category: str
    doc: dict
    name: str
    author: str
    description: str
    provider: str
    build: str
    provider_version: str
    fields: list[Field]
    render_size: tuple[int, int] | None


@dataclass
class Instance:
    id: str
    page: str
    template: Template
    data_rel: str
    size: tuple[int, int]
    params: dict
    part: str
    rows: list[dict] = field(default_factory=list)
    mtypes: dict = field(default_factory=dict)


def rel(repo: Path, path: Path) -> str:
    try:
        return path.resolve().relative_to(repo.resolve()).as_posix()
    except ValueError:
        return path.as_posix()


_TEMPLATES: dict[Path, Template | None] = {}


def load_template(repo: Path, template_rel: str, where: str) -> Template | None:
    path = (repo / template_rel).resolve()
    if path in _TEMPLATES:
        return _TEMPLATES[path]
    tpl = None
    if not path.is_file():
        warn(f"{where}: template {template_rel} not found; its instances are skipped")
    else:
        try:
            doc = load_json(path)
        except (ValueError, OSError) as exc:
            warn(f"{where}: template {template_rel} is not valid JSON ({exc}); skipped")
            doc = None
        if isinstance(doc, dict):
            um = doc.get("usermeta") or {}
            info = um.get("information") or {}
            dm = um.get("deneb") or {}
            fields = []
            for i, f in enumerate(um.get("dataset") or []):
                if not isinstance(f, dict) or not f.get("name"):
                    warn(f"{template_rel}: dataset entry {i} has no name; ignored")
                    continue
                fields.append(Field(
                    key=f.get("key") or f"__{i}__",
                    name=str(f["name"]),
                    type=str(f.get("type") or "text"),
                    kind=str(f.get("kind") or "column"),
                    description=str(f.get("description") or ""),
                ))
            provider = dm.get("provider") or ("vega" if "/vega/" in str(doc.get("$schema", "")) else "vegaLite")
            render_size = None
            rj = path.parent / "render.json"
            if rj.is_file():
                try:
                    r = load_json(rj)
                    render_size = (int(r["width"]), int(r["height"]))
                except (ValueError, KeyError, TypeError, OSError):
                    warn(f"{rel(repo, rj)}: not a {{width, height}} object; ignored")
            parts = Path(template_rel).parts
            category = parts[1] if len(parts) >= 4 and parts[0] == "templates" else path.parent.parent.name
            tpl = Template(
                path=path, rel=Path(template_rel).as_posix(), slug=path.stem, category=category, doc=doc,
                name=str(info.get("name") or path.stem), author=str(info.get("author") or ""),
                description=str(info.get("description") or ""), provider=provider,
                build=str(dm.get("build") or "1.9.1.0"),
                provider_version=str(dm.get("providerVersion") or ("6.2.0" if provider == "vega" else "6.4.1")),
                fields=fields, render_size=render_size,
            )
        elif doc is not None:
            warn(f"{where}: template {template_rel} is not a JSON object; skipped")
    _TEMPLATES[path] = tpl
    return tpl


def parse_number(raw: str) -> str:
    """Return the value as a number literal (dax_number normalises it for DATATABLE)."""
    s = raw.strip()
    if re.fullmatch(r"-?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?", s):
        return s[:-1] if s.endswith(".") else s
    value = float(s)  # raises ValueError
    if math.isnan(value) or math.isinf(value):
        raise ValueError(f"not a finite number: {raw}")
    return repr(value)


def parse_datetime(raw: str) -> tuple[datetime, bool]:
    """Return (value, has_time)."""
    s = raw.strip()
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", s):
        d = date.fromisoformat(s)
        return datetime(d.year, d.month, d.day), False
    s = s.replace("Z", "+00:00")
    dt = datetime.fromisoformat(s)
    return dt.replace(tzinfo=None), True


BOOL_TRUE = {"true", "1", "yes", "y", "t"}
BOOL_FALSE = {"false", "0", "no", "n", "f"}


def load_rows(repo: Path, inst: Instance) -> bool:
    path = repo / inst.data_rel
    where = f"instance {inst.id}"
    if not path.is_file():
        warn(f"{where}: data {inst.data_rel} not found; skipped")
        return False
    with path.open(encoding="utf-8-sig", newline="") as fh:
        reader = csv.DictReader(fh)
        header = reader.fieldnames or []
        raw_rows = list(reader)
    missing = [f.name for f in inst.template.fields if f.name not in header]
    if missing:
        warn(f"{where}: {inst.data_rel} lacks column(s) {', '.join(missing)} named in the template dataset; skipped")
        return False
    extra = [h for h in header if h not in {f.name for f in inst.template.fields}]
    if extra:
        warn(f"{where}: {inst.data_rel} column(s) {', '.join(extra)} are not in the template dataset; not loaded")
    rows = []
    has_time = False
    try:
        for n, raw in enumerate(raw_rows, start=2):
            row = {}
            for f in inst.template.fields:
                cell = (raw.get(f.name) or "").strip()
                if cell == "":
                    row[f.name] = None
                elif f.type == "numeric":
                    row[f.name] = parse_number(cell)
                elif f.type == "dateTime":
                    value, t = parse_datetime(cell)
                    has_time = has_time or t
                    row[f.name] = value
                elif f.type == "bool":
                    low = cell.lower()
                    if low not in BOOL_TRUE | BOOL_FALSE:
                        raise ValueError(f"line {n}: {f.name} = {cell!r} is not a logical value")
                    row[f.name] = low in BOOL_TRUE
                else:
                    row[f.name] = cell
            rows.append(row)
    except ValueError as exc:
        warn(f"{where}: {inst.data_rel}: {exc}; skipped")
        return False
    inst.rows = rows
    for f in inst.template.fields:
        inst.mtypes[f.name] = {
            "numeric": "number", "bool": "logical", "text": "text",
            "dateTime": "datetime" if has_time else "date",
        }.get(f.type, "text")
        if f.type not in ("numeric", "bool", "text", "dateTime"):
            warn(f"{inst.template.rel}: field {f.name} has unknown type {f.type!r}; loaded as text")
    return True


def load_instances(repo: Path) -> list[Instance]:
    parts_dir = repo / "showcase" / "parts"
    if not parts_dir.is_dir():
        warn("showcase/parts not found; no templates are placed")
        return []
    seen: dict[str, str] = {}
    instances: list[Instance] = []
    for part_path in sorted(parts_dir.glob("*.json")):
        prel = rel(repo, part_path)
        try:
            part = load_json(part_path)
        except (ValueError, OSError) as exc:
            warn(f"{prel}: not valid JSON ({exc}); skipped")
            continue
        if not isinstance(part, dict) or not part.get("template"):
            warn(f"{prel}: no \"template\" path; skipped")
            continue
        tpl = load_template(repo, str(part["template"]), prel)
        if tpl is None:
            continue
        for idx, raw in enumerate(part.get("instances") or []):
            where = f"{prel} instance {idx}"
            if not isinstance(raw, dict) or not raw.get("id"):
                warn(f"{where}: no id; skipped")
                continue
            iid = str(raw["id"])
            if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]*", iid):
                warn(f"{where}: id {iid!r} must be letters, digits, '-' or '_'; skipped")
                continue
            if iid in seen:
                warn(f"{where}: id {iid} already used in {seen[iid]}; skipped")
                continue
            page = str(raw.get("page") or "template")
            if page not in ("template", "dashboard"):
                warn(f"{where}: page {page!r} is not \"template\" or \"dashboard\"; skipped")
                continue
            size = raw.get("size")
            try:
                size = (int(size[0]), int(size[1])) if size else (tpl.render_size or (400, 300))
            except (TypeError, ValueError, IndexError):
                warn(f"{where}: size {size!r} is not [width, height]; using the template size")
                size = tpl.render_size or (400, 300)
            params = raw.get("params") or {}
            if not isinstance(params, dict):
                warn(f"{where}: params is not an object; ignored")
                params = {}
            data_rel = str(raw.get("data") or "")
            if not data_rel:
                warn(f"{where}: no data path; skipped")
                continue
            inst = Instance(id=iid, page=page, template=tpl, data_rel=data_rel, size=size, params=params, part=prel)
            if not load_rows(repo, inst):
                continue
            seen[iid] = prel
            instances.append(inst)
    return instances


# ---------------------------------------------------------------------------- spec

FONT_KEY = re.compile(r"font$", re.IGNORECASE)


def to_arial(node, counter: list) -> object:
    """Swap Segoe UI font values (config, mark font properties, font params) for Arial."""
    if isinstance(node, dict):
        out = {}
        font_param = isinstance(node.get("name"), str) and "font" in node["name"].lower()
        for k, v in node.items():
            if isinstance(v, str) and "segoe" in v.lower() and (FONT_KEY.search(k) or (font_param and k == "value")):
                out[k] = FONT
                counter[0] += 1
            else:
                out[k] = to_arial(v, counter)
        return out
    if isinstance(node, list):
        return [to_arial(v, counter) for v in node]
    return node


def replace_tokens(node, mapping: dict, unknown: set):
    if isinstance(node, str):
        def sub(m):
            if m.group(0) in mapping:
                return mapping[m.group(0)]
            unknown.add(m.group(0))
            return m.group(0)
        return TOKEN.sub(sub, node)
    if isinstance(node, dict):
        return {replace_tokens(k, mapping, unknown): replace_tokens(v, mapping, unknown) for k, v in node.items()}
    if isinstance(node, list):
        return [replace_tokens(v, mapping, unknown) for v in node]
    return node


def apply_params(spec: dict, provider: str, params: dict, where: str) -> None:
    pool = spec.get("signals" if provider == "vega" else "params") or []
    index = {p.get("name"): p for p in pool if isinstance(p, dict)}
    for name, value in params.items():
        p = index.get(name)
        if p is None:
            kind = "signal" if provider == "vega" else "param"
            warn(f"{where}: no top-level {kind} named {name!r} in the template; override ignored")
            continue
        if isinstance(value, dict) and set(value) == {"expr"}:
            if provider == "vega":
                p.pop("value", None)
                p.pop("init", None)
                p["update"] = value["expr"]
            else:
                p.pop("value", None)
                p["expr"] = value["expr"]
        else:
            if isinstance(value, dict) and set(value) == {"value"}:
                value = value["value"]
            if provider == "vega":
                p.pop("update", None)
                p.pop("init", None)
            else:
                p.pop("expr", None)
            p["value"] = value


def build_spec(inst: Instance) -> tuple[dict, dict]:
    tpl = inst.template
    where = f"instance {inst.id}"
    spec = copy.deepcopy(tpl.doc)
    spec.pop("$schema", None)
    spec.pop("usermeta", None)
    config = spec.pop("config", None)
    config = copy.deepcopy(config) if isinstance(config, dict) else {}
    apply_params(spec, tpl.provider, inst.params, where)
    mapping = {f.key: f.deneb_name for f in tpl.fields}
    unknown: set = set()
    spec = replace_tokens(spec, mapping, unknown)
    config = replace_tokens(config, mapping, unknown)
    if unknown:
        warn(f"{where}: token(s) {', '.join(sorted(unknown))} are not declared in the template dataset")
    counter = [0]
    spec = to_arial(spec, counter)
    config = to_arial(config, counter)
    config["font"] = FONT
    text = json.dumps(spec)
    if "denebContainer" in text:
        warn(f"{where}: the spec references denebContainer, which Deneb 1.9.1 cannot parse")
    for f in tpl.fields:
        if "'" in f.name or "\\" in f.name:
            warn(f"{where}: field name {f.name!r} contains a quote or backslash and will break expressions")
    if not tpl.fields:
        warn(f"{tpl.rel}: usermeta.dataset is empty; the visual gets no fields")
    return spec, config


# ---------------------------------------------------------------------------- semantic model

def tmdl_name(name: str) -> str:
    if re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", name):
        return name
    return "'" + name.replace("'", "''") + "'"


def dax_table(name: str) -> str:
    return "'" + name.replace("'", "''") + "'"


def dax_column(name: str) -> str:
    return "[" + name.replace("]", "]]") + "]"


def dax_text(value: str) -> str:
    return '"' + value.replace('"', '""') + '"'


def dax_number(value: str) -> str:
    """Plain decimal form: no exponent and no bare leading point in a DATATABLE row."""
    text = format(Decimal(value).normalize(), "f")
    return "0" if text == "-0" else text


def dax_value(value, mtype: str) -> str:
    """One constant for a DATATABLE row."""
    if value is None:
        return "BLANK ()"
    if mtype == "number":
        return dax_number(value)
    if mtype == "logical":
        return "TRUE" if value else "FALSE"
    if mtype == "date":
        return dax_text(value.strftime("%Y-%m-%d"))
    if mtype == "datetime":
        return dax_text(value.strftime("%Y-%m-%d %H:%M:%S"))
    return dax_text(str(value))


def one_line(text: str) -> str:
    return " ".join(text.split())


def measure_name(inst: Instance, f: Field) -> str:
    return f"{f.name} ({inst.id})"


def binds_as_measure(inst: Instance, f: Field) -> bool:
    if f.kind != "measure":
        return False
    if f.type != "numeric":
        warn(f"{inst.template.rel}: field {f.name} is a {f.type} measure; bound as a column instead")
        return False
    return True


def table_tmdl(inst: Instance) -> str:
    t = inst.id
    tpl = inst.template
    L = [f"/// Sample data for the {one_line(tpl.name)} template, showcase instance {t} ({inst.data_rel}).",
         f"table {tmdl_name(t)}",
         f"\tlineageTag: {det_uuid('table', t)}",
         ""]
    for f in tpl.fields:
        if not binds_as_measure(inst, f):
            continue
        if f.description:
            L.append(f"\t/// {one_line(f.description)}")
        L.append(f"\tmeasure {tmdl_name(measure_name(inst, f))} = SUM ( {dax_table(t)}{dax_column(f.name)} )")
        L.append(f"\t\tlineageTag: {det_uuid('measure', t, f.name)}")
        L.append("")
    for f in tpl.fields:
        measure = binds_as_measure(inst, f)
        mtype = inst.mtypes[f.name]
        dtype = {"number": "double", "logical": "boolean", "date": "dateTime", "datetime": "dateTime"}.get(mtype, "string")
        if f.description and not measure:
            L.append(f"\t/// {one_line(f.description)}")
        L.append(f"\tcolumn {tmdl_name(f.name)}")
        L.append(f"\t\tdataType: {dtype}")
        if measure:
            L.append("\t\tisHidden")
        if mtype == "date":
            L.append("\t\tformatString: yyyy-mm-dd")
        elif mtype == "datetime":
            L.append("\t\tformatString: yyyy-mm-dd hh:nn:ss")
        L.append(f"\t\tlineageTag: {det_uuid('column', t, f.name)}")
        L.append("\t\tsummarizeBy: none")
        L.append("\t\tisNameInferred")
        L.append(f"\t\tsourceColumn: {dax_column(f.name)}")
        L.append("")
        L.append("\t\tannotation SummarizationSetBy = User")
        if mtype == "date":
            L.append("")
            L.append("\t\tannotation UnderlyingDateTimeDataType = Date")
        L.append("")
    # A DAX calculated table, not an M partition: a refresh then starts no mashup
    # container, so the showcase loads even on a machine short of memory.
    dax_types = {"number": "DOUBLE", "logical": "BOOLEAN", "date": "DATETIME", "datetime": "DATETIME"}
    body = ["DATATABLE ("]
    body += [f"    {dax_text(f.name)}, {dax_types.get(inst.mtypes[f.name], 'STRING')}," for f in tpl.fields]
    body.append("    {")
    for i, row in enumerate(inst.rows):
        vals = ", ".join(dax_value(row[f.name], inst.mtypes[f.name]) for f in tpl.fields)
        body.append(f"        {{ {vals} }}" + ("," if i < len(inst.rows) - 1 else ""))
    body += ["    }", ")"]
    L.append(f"\tpartition {tmdl_name(t)} = calculated")
    L.append("\t\tmode: import")
    L.append("\t\tsource =")
    L.extend("\t\t\t\t" + line for line in body)
    L.append("")
    return "\n".join(L)


def model_files(instances: list[Instance]) -> dict[str, bytes]:
    files: dict[str, bytes] = {}
    tables = [i.id for i in instances]
    files[".platform"] = dump_json({
        "$schema": SCHEMA["platform"],
        "metadata": {"type": "SemanticModel", "displayName": PROJECT},
        "config": {"version": "2.0", "logicalId": det_uuid("semanticModel", PROJECT)},
    })
    files["definition.pbism"] = dump_json({"$schema": SCHEMA["pbism"], "version": "4.2", "settings": {}})
    files["definition/database.tmdl"] = f"database\n\tcompatibilityLevel: {COMPATIBILITY_LEVEL}\n\n".encode("utf-8")
    m = ["model Model",
         "\tculture: en-US",
         "\tdefaultPowerBIDataSourceVersion: powerBI_V3",
         "\tdiscourageImplicitMeasures",
         "\tsourceQueryCulture: en-US",
         "\tdataAccessOptions",
         "\t\tlegacyRedirects",
         "\t\treturnErrorValuesAsNull",
         "",
         "annotation __PBI_TimeIntelligenceEnabled = 0",
         "",
         'annotation PBI_ProTooling = ["DevMode"]',
         ""]
    m += [f"ref table {tmdl_name(t)}" for t in tables]
    m.append("")
    files["definition/model.tmdl"] = "\n".join(m).encode("utf-8")
    for inst in instances:
        files[f"definition/tables/{inst.id}.tmdl"] = table_tmdl(inst).encode("utf-8")
    return files


# ---------------------------------------------------------------------------- report

def container_objects(chrome: dict | None, alt: str | None) -> dict:
    """Visual container formatting. Off by default: templates draw their own chrome."""
    chrome = chrome or {}
    vco: dict = {"title": show(False)}
    bg = chrome.get("background")
    if bg:
        vco["background"] = [{"properties": {"show": lit(True), "color": solid(bg), "transparency": lit(0)}}]
    else:
        vco["background"] = show(False)
    border = chrome.get("border")
    if border:
        props = {"show": lit(True), "color": solid(border.get("color", "#E2E8F0")),
                 "width": lit(border.get("width", 1)), "radius": lit(border.get("radius", 0))}
        vco["border"] = [{"properties": props}]
    else:
        vco["border"] = show(False)
    vco["dropShadow"] = show(bool(chrome.get("shadow")))
    vco["padding"] = [{"properties": {k: lit(0) for k in ("top", "bottom", "left", "right")}}]
    if alt:
        vco["general"] = [{"properties": {"altText": lit(alt)}}]
    return vco


def position(x, y, w, h, z, tab) -> dict:
    return {"x": x, "y": y, "z": z, "height": h, "width": w, "tabOrder": tab}


def deneb_visual(inst: Instance, name: str, rect: tuple, z: int, chrome: dict | None, alt: str | None) -> dict:
    tpl = inst.template
    spec, config = build_spec(inst)
    projections = []
    for f in tpl.fields:
        if binds_as_measure(inst, f):
            prop, kind = measure_name(inst, f), "Measure"
        else:
            prop, kind = f.name, "Column"
        projections.append({
            "field": {kind: {"Expression": {"SourceRef": {"Entity": inst.id}}, "Property": prop}},
            "queryRef": f"{inst.id}.{prop}",
            "nativeQueryRef": prop,
            "displayName": f.name,
        })
    x, y, w, h = rect
    return {
        "$schema": SCHEMA["visual"],
        "name": name,
        "position": position(x, y, w, h, z, z),
        "visual": {
            "visualType": DENEB_VISUAL,
            "query": {"queryState": {"dataset": {"projections": projections}}},
            "objects": {
                "vega": [{"properties": {
                    "provider": lit(tpl.provider),
                    "jsonSpec": lit(json.dumps(spec, indent=2, ensure_ascii=False)),
                    "jsonConfig": lit(json.dumps(config, separators=(",", ":"), ensure_ascii=False)),
                    "renderMode": lit("svg"),
                    "enableTooltips": lit(True),
                    "enableContextMenu": lit(True),
                    "enableSelection": lit(False),
                    "enableHighlight": lit(False),
                    "version": lit(tpl.provider_version),
                }}],
                "developer": [{"properties": {"version": lit(tpl.build)}}],
            },
            "visualContainerObjects": container_objects(chrome, alt or tpl.name),
            "drillFilterOtherVisuals": True,
        },
    }


def text_run(run: dict, styles: dict, colors: dict) -> dict:
    style = dict(styles.get(run.get("style"), {})) if run.get("style") else {}
    for k in ("size", "color", "bold", "italic", "font"):
        if k in run:
            style[k] = run[k]
    color = style.get("color", TEXT_INK)
    color = colors.get(color, color)
    ts = {"fontFamily": style.get("font", FONT), "fontSize": f"{num(style.get('size', 10))}pt", "color": color}
    if style.get("bold"):
        ts["fontWeight"] = "bold"
    if style.get("italic"):
        ts["fontStyle"] = "italic"
    return {"value": str(run.get("text", "")), "textStyle": ts}


def textbox_visual(name: str, rect: tuple, z: int, paragraphs: list, styles: dict, colors: dict) -> dict:
    paras = []
    for p in paragraphs:
        if isinstance(p, dict):
            runs, align = p.get("runs") or [], p.get("align")
        else:
            runs, align = p, None
        para = {"textRuns": [text_run(r, styles, colors) for r in runs]}
        if align:
            para["horizontalTextAlignment"] = align
        paras.append(para)
    x, y, w, h = rect
    return {
        "$schema": SCHEMA["visual"],
        "name": name,
        "position": position(x, y, w, h, z, z),
        "visual": {
            "visualType": "textbox",
            "objects": {"general": [{"properties": {"paragraphs": paras}}]},
            "visualContainerObjects": {
                "title": show(False), "background": show(False), "border": show(False),
                "dropShadow": show(False),
                "padding": [{"properties": {k: lit(0) for k in ("top", "bottom", "left", "right")}}],
            },
            "drillFilterOtherVisuals": True,
        },
    }


def image_visual(name: str, rect: tuple, z: int, resource: str, alt: str | None) -> dict:
    x, y, w, h = rect
    vco = {"title": show(False), "background": show(False), "border": show(False), "dropShadow": show(False),
           "padding": [{"properties": {k: lit(0) for k in ("top", "bottom", "left", "right")}}]}
    if alt:
        vco["general"] = [{"properties": {"altText": lit(alt)}}]
    return {
        "$schema": SCHEMA["visual"],
        "name": name,
        "position": position(x, y, w, h, z, z),
        "visual": {
            "visualType": "image",
            "objects": {"image": [{"properties": {"sourceFile": {"image": {
                "name": lit(resource),
                "url": {"expr": {"ResourcePackageItem": {
                    "PackageName": "RegisteredResources", "PackageType": 1, "ItemName": resource}}},
                "scaling": lit("Fit"),
            }}}}]},
            "visualContainerObjects": vco,
            "drillFilterOtherVisuals": True,
        },
    }


def page_doc(name: str, display: str, w: int, h: int, background: str | None) -> dict:
    doc = {"$schema": SCHEMA["page"], "name": name, "displayName": display, "displayOption": "FitToPage",
           "height": h, "width": w}
    if background:
        doc["objects"] = {"background": [{"properties": {
            "image": {"image": {
                "name": lit(background),
                "url": {"expr": {"ResourcePackageItem": {
                    "PackageName": "RegisteredResources", "PackageType": 1, "ItemName": background}}},
                "scaling": lit("Fill"),
            }},
            "transparency": lit(0),
        }}]}
    return doc


def credit_line(tpl: Template) -> str:
    sentences = [s for s in re.split(r"(?<=[.!?])\s+(?=[A-Z(])", tpl.description.strip()) if s]
    if len(sentences) >= 2 and re.search(r"\b(after|design|designed|credit|based on|inspired|original)\b",
                                          sentences[-1], re.IGNORECASE):
        return sentences[-1]
    return f"Design by {tpl.author}." if tpl.author else ""


def text_lines(text: str, px_per_char: float, width: int) -> int:
    return max(1, math.ceil(len(text) * px_per_char / max(width, 1)))


@dataclass
class PageOut:
    key: str
    name: str
    display: str
    width: int
    height: int
    kind: str
    background: str | None = None
    visuals: dict = field(default_factory=dict)  # folder name -> visual doc
    capture: dict = field(default_factory=dict)


def template_pages(instances: list[Instance]) -> list[PageOut]:
    by_template: dict[str, list[Instance]] = {}
    for inst in instances:
        if inst.page == "template":
            by_template.setdefault(inst.template.rel, []).append(inst)

    def order(key):
        tpl = by_template[key][0].template
        rank = CATEGORY_ORDER.index(tpl.category) if tpl.category in CATEGORY_ORDER else len(CATEGORY_ORDER)
        return (rank, tpl.category, tpl.slug, key)

    pages = []
    for key in sorted(by_template, key=order):
        insts = by_template[key]
        tpl = insts[0].template
        pkey = f"template:{key}"
        content_w = sum(i.size[0] for i in insts) + VISUAL_GAP * (len(insts) - 1)
        inner_w = max(content_w, MIN_CONTENT_WIDTH)
        credit = credit_line(tpl)
        title_h = 23 * text_lines(tpl.name, 10.5, inner_w) + (16 * text_lines(credit, 6.3, inner_w) if credit else 0) + 6
        top = MARGIN + title_h + TITLE_GAP
        page_w = inner_w + 2 * MARGIN
        page_h = top + max(i.size[1] for i in insts) + MARGIN
        page = PageOut(key=pkey, name=hex_id("page", pkey), display=tpl.name, width=page_w, height=page_h,
                       kind="template")
        styles = {"name": {"size": 14, "bold": True, "color": TEXT_INK}, "credit": {"size": 9, "color": TEXT_BODY}}
        paras = [[{"text": tpl.name, "style": "name"}]]
        if credit:
            paras.append([{"text": credit, "style": "credit"}])
        z = 1000
        tb = hex_id("text", pkey, "title")
        page.visuals[tb] = textbox_visual(tb, (MARGIN, MARGIN, inner_w, title_h), z, paras, styles, {})
        x = MARGIN
        rects = []
        for inst in insts:
            z += 1000
            vname = hex_id("visual", inst.id)
            rect = (x, top, inst.size[0], inst.size[1])
            page.visuals[vname] = deneb_visual(inst, vname, rect, z, None, None)
            rects.append({"id": inst.id, "name": vname, "x": rect[0], "y": rect[1], "w": rect[2], "h": rect[3]})
            x += inst.size[0] + VISUAL_GAP
        ux0 = min(r["x"] for r in rects)
        uy0 = min(r["y"] for r in rects)
        ux1 = max(r["x"] + r["w"] for r in rects)
        uy1 = max(r["y"] + r["h"] for r in rects)
        page.capture = {"template": tpl.slug, "category": tpl.category, "templatePath": tpl.rel,
                        "rect": {"x": ux0, "y": uy0, "w": ux1 - ux0, "h": uy1 - uy0}, "visuals": rects}
        pages.append(page)
    return pages


def dashboard_page(repo: Path, instances: list[Instance], theme: dict) -> PageOut | None:
    path = repo / "showcase" / DASHBOARD_FILE
    if not path.is_file():
        warn(f"showcase/{DASHBOARD_FILE} not found; no dashboard page")
        return None
    try:
        layout = load_json(path)
    except (ValueError, OSError) as exc:
        warn(f"showcase/{DASHBOARD_FILE} is not valid JSON ({exc}); no dashboard page")
        return None
    pg = layout.get("page") or {}
    w, h = int(pg.get("width", 1600)), int(pg.get("height", 900))
    background = pg.get("background")
    if background and not (repo / "showcase" / "theme" / background).is_file():
        warn(f"showcase/theme/{background} not found; the dashboard page has no background")
        background = None
    pkey = "dashboard"
    page = PageOut(key=pkey, name=hex_id("page", pkey), display=str(pg.get("displayName") or "Dashboard"),
                   width=w, height=h, kind="dashboard", background=background)
    colors = {k: theme[k] for k in ("good", "bad", "neutral") if isinstance(theme.get(k), str)}
    colors.update(layout.get("colors") or {})
    styles = layout.get("styles") or {}
    z = 0
    for t in layout.get("text") or []:
        z += 1000
        vname = hex_id("text", pkey, str(t.get("id")))
        rect = (int(t["x"]), int(t["y"]), int(t["w"]), int(t["h"]))
        page.visuals[vname] = textbox_visual(vname, rect, z, t.get("paragraphs") or [], styles, colors)
    for im in layout.get("images") or []:
        file = str(im.get("file") or "")
        if not (repo / "showcase" / "theme" / file).is_file():
            warn(f"dashboard image showcase/theme/{file} not found; skipped")
            continue
        z += 1000
        vname = hex_id("image", pkey, str(im.get("id")))
        rect = (int(im["x"]), int(im["y"]), int(im["w"]), int(im["h"]))
        page.visuals[vname] = image_visual(vname, rect, z, file, im.get("alt"))
    by_id = {i.id: i for i in instances}
    placed = []
    for iid, spot in (layout.get("visuals") or {}).items():
        inst = by_id.get(iid)
        if inst is None:
            warn(f"dashboard: instance {iid} is not in any showcase part yet; its slot is left empty")
            continue
        if inst.page != "dashboard":
            warn(f"dashboard: instance {iid} is declared page {inst.page!r}; placed anyway")
        z += 1000
        vname = hex_id("visual", iid)
        rect = (int(spot["x"]), int(spot["y"]), int(spot["w"]), int(spot["h"]))
        if isinstance(spot.get("params"), dict):
            # The layout may override presentation params, e.g. blank a title the page draws natively.
            inst = replace(inst, params={**inst.params, **spot["params"]})
        page.visuals[vname] = deneb_visual(inst, vname, rect, z, spot.get("container"), spot.get("alt"))
        placed.append({"id": iid, "name": vname, "x": rect[0], "y": rect[1], "w": rect[2], "h": rect[3]})
    for inst in instances:
        if inst.page == "dashboard" and inst.id not in (layout.get("visuals") or {}):
            warn(f"dashboard: instance {inst.id} has no slot in showcase/{DASHBOARD_FILE}; not placed")
    page.capture = {"rect": {"x": 0, "y": 0, "w": w, "h": h}, "visuals": placed}
    return page


def report_files(repo: Path, pages: list[PageOut], here: Path) -> dict[str, bytes]:
    files: dict[str, bytes] = {}
    files[".platform"] = dump_json({
        "$schema": SCHEMA["platform"],
        "metadata": {"type": "Report", "displayName": PROJECT},
        "config": {"version": "2.0", "logicalId": det_uuid("report", PROJECT)},
    })
    files["definition.pbir"] = dump_json({
        "$schema": SCHEMA["pbir"], "version": "4.0",
        "datasetReference": {"byPath": {"path": f"../{PROJECT}.SemanticModel"}},
    })
    files["definition/version.json"] = dump_json({"$schema": SCHEMA["version"], "version": "2.0.0"})
    theme_dir = repo / "showcase" / "theme"
    registered = []
    resources: dict[str, bytes] = {}
    theme_path = theme_dir / THEME_FILE
    if theme_path.is_file():
        resources[THEME_FILE] = theme_path.read_bytes()
        registered.append({"name": THEME_FILE, "path": THEME_FILE, "type": "CustomTheme"})
    else:
        warn(f"showcase/theme/{THEME_FILE} not found; the report uses the base theme only")
    images = set()
    for page in pages:
        if page.background:
            images.add(page.background)
        for v in page.visuals.values():
            if v["visual"]["visualType"] == "image":
                images.add(v["visual"]["objects"]["image"][0]["properties"]["sourceFile"]["image"]["url"]
                           ["expr"]["ResourcePackageItem"]["ItemName"])
    for img in sorted(images):
        resources[img] = (theme_dir / img).read_bytes()
        registered.append({"name": img, "path": img, "type": "Image"})
    registered.sort(key=lambda r: r["name"])
    base_theme = here / "assets" / "BaseThemes" / f"{BASE_THEME}.json"
    files[f"StaticResources/SharedResources/BaseThemes/{BASE_THEME}.json"] = base_theme.read_bytes()
    for name, data in resources.items():
        files[f"StaticResources/RegisteredResources/{name}"] = data
    theme_collection = {"baseTheme": {"name": BASE_THEME, "reportVersionAtImport": REPORT_VERSION_AT_IMPORT,
                                      "type": "SharedResources"}}
    if theme_path.is_file():
        theme_collection["customTheme"] = {"name": THEME_FILE, "reportVersionAtImport": REPORT_VERSION_AT_IMPORT,
                                           "type": "RegisteredResources"}
    packages = [{"name": "SharedResources", "type": "SharedResources",
                 "items": [{"name": BASE_THEME, "path": f"BaseThemes/{BASE_THEME}.json", "type": "BaseTheme"}]}]
    if registered:
        packages.append({"name": "RegisteredResources", "type": "RegisteredResources", "items": registered})
    files["definition/report.json"] = dump_json({
        "$schema": SCHEMA["report"],
        "themeCollection": theme_collection,
        "objects": {
            "section": [{"properties": {"verticalAlignment": lit("Top")}}],
            "outspacePane": [{"properties": {"expanded": lit(False)}}],
        },
        "publicCustomVisuals": [DENEB_VISUAL],
        "resourcePackages": packages,
        "settings": {
            "useStylableVisualContainerHeader": True,
            "exportDataMode": "AllowSummarized",
            "defaultFilterActionIsDataFilter": True,
            "defaultDrillFilterOtherVisuals": True,
            "allowChangeFilterTypes": True,
            "useEnhancedTooltips": True,
            "useDefaultAggregateDisplayName": True,
        },
    })
    order = [p.name for p in pages]
    pages_doc = {"$schema": SCHEMA["pages"], "pageOrder": order}
    if order:
        pages_doc["activePageName"] = order[0]
        pages_doc["landingPageName"] = order[0]
    files["definition/pages/pages.json"] = dump_json(pages_doc)
    for page in pages:
        base = f"definition/pages/{page.name}"
        files[f"{base}/page.json"] = dump_json(page_doc(page.name, page.display, page.width, page.height,
                                                        page.background))
        for vname, doc in page.visuals.items():
            files[f"{base}/visuals/{vname}/visual.json"] = dump_json(doc)
    return files


# ---------------------------------------------------------------------------- output sync

def sync(out_dir: Path, planned: dict[str, bytes], owned: list[str], check: bool) -> tuple[list, list]:
    """Make the owned files and folders under out_dir match planned. Never touches .pbi folders."""
    changed, removed = [], []
    for name in owned:
        root = out_dir / name
        if root.is_dir():
            for p in sorted(root.rglob("*"), reverse=True):
                relp = p.relative_to(out_dir).as_posix()
                if ".pbi" in p.relative_to(out_dir).parts:
                    continue
                if p.is_file() and relp not in planned:
                    removed.append(relp)
                    if not check:
                        p.unlink()
                elif p.is_dir() and not check and not any(p.iterdir()):
                    p.rmdir()
        elif root.is_file() and name not in planned:
            removed.append(name)
            if not check:
                root.unlink()
    for relp, data in sorted(planned.items()):
        target = out_dir / relp
        if target.is_file() and target.read_bytes() == data:
            continue
        changed.append(relp)
        if not check:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
    if not check:
        for name in owned:
            root = out_dir / name
            if root.is_dir():
                for p in sorted(root.rglob("*"), reverse=True):
                    if p.is_dir() and ".pbi" not in p.relative_to(out_dir).parts and not any(p.iterdir()):
                        p.rmdir()
    return changed, removed


# ---------------------------------------------------------------------------- main

def main(argv=None) -> int:
    here = Path(__file__).resolve().parent
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--repo", type=Path, default=here.parents[1],
                    help="repo root to read from and write into (default: this script's repo)")
    ap.add_argument("--check", action="store_true",
                    help="write nothing; exit 1 if the generated files are out of date")
    ap.add_argument("--quiet", action="store_true", help="print warnings and the summary line only")
    args = ap.parse_args(argv)
    repo = args.repo.resolve()
    showcase = repo / "showcase"
    if not showcase.is_dir():
        print(f"ERROR: {showcase} does not exist", file=sys.stderr)
        return 2

    theme = {}
    theme_path = showcase / "theme" / THEME_FILE
    if theme_path.is_file():
        try:
            theme = load_json(theme_path)
        except ValueError as exc:
            warn(f"showcase/theme/{THEME_FILE} is not valid JSON ({exc})")

    instances = load_instances(repo)
    pages: list[PageOut] = []
    dash = dashboard_page(repo, instances, theme)
    if dash:
        pages.append(dash)
    pages += template_pages(instances)
    if not pages:
        # A report needs at least one page; keep the project openable while parts are missing.
        page = PageOut(key="empty", name=hex_id("page", "empty"), display="Showcase", width=640, height=160,
                       kind="placeholder")
        tb = hex_id("text", "empty", "note")
        page.visuals[tb] = textbox_visual(tb, (MARGIN, MARGIN, 592, 60), 1000, [[{
            "text": "No showcase parts or dashboard layout were found. Add showcase/parts/*.json and rerun "
                    "tools/showcase/build_showcase.py.", "size": 11, "color": TEXT_BODY}]], {}, {})
        page.capture = {"visuals": []}
        pages.append(page)
    placed ={v["name"] for p in pages for v in p.capture.get("visuals", [])}
    used = [i for i in instances if hex_id("visual", i.id) in placed]

    planned: dict[str, bytes] = {}
    planned[f"{PROJECT}.pbip"] = dump_json({
        "$schema": SCHEMA["pbip"], "version": "1.0",
        "artifacts": [{"report": {"path": f"{PROJECT}.Report"}}],
        "settings": {"enableAutoRecovery": True},
    })
    for k, v in model_files(used).items():
        planned[f"{PROJECT}.SemanticModel/{k}"] = v
    for k, v in report_files(repo, pages, here).items():
        planned[f"{PROJECT}.Report/{k}"] = v

    for relp, data in planned.items():
        if relp.endswith((".json", ".tmdl", ".pbir", ".pbism", ".pbip", ".platform")) and "BaseThemes" not in relp:
            text = data.decode("utf-8")
            if any(d in text for d in DASHES):
                warn(f"{relp}: contains an en or em dash (from a template, part or layout text)")

    owned = [f"{PROJECT}.pbip", f"{PROJECT}.SemanticModel", f"{PROJECT}.Report"]
    changed, removed = sync(showcase, planned, owned, args.check)

    capture = {
        "project": f"showcase/{PROJECT}.pbip",
        "report": f"showcase/{PROJECT}.Report",
        "pages": [],
    }
    for n, p in enumerate(pages, start=1):
        entry = {"order": n, "kind": p.kind, "displayName": p.display, "name": p.name,
                 "width": p.width, "height": p.height}
        entry.update(p.capture)
        capture["pages"].append(entry)
    cap_path = repo / "tools" / "showcase" / "out" / "capture-map.json"
    cap_bytes = dump_json(capture)
    if not args.check and (not cap_path.is_file() or cap_path.read_bytes() != cap_bytes):
        cap_path.parent.mkdir(parents=True, exist_ok=True)
        cap_path.write_bytes(cap_bytes)

    for msg in WARNINGS:
        print(f"WARNING: {msg}")
    if not args.quiet:
        for p in pages:
            print(f"page {p.name}  {p.width}x{p.height}  {p.display}  ({len(p.visuals)} visuals)")
        verb = "would change" if args.check else "written"
        for relp in changed:
            print(f"{verb}: showcase/{relp}")
        for relp in removed:
            print(f"{'would remove' if args.check else 'removed'}: showcase/{relp}")
    print(f"{len(pages)} pages, {len(used)} Deneb visuals, {len(used)} tables; "
          f"{len(changed)} files {'out of date' if args.check else 'written'}, "
          f"{len(removed)} {'stale' if args.check else 'removed'}, {len(WARNINGS)} warnings")
    if args.check and (changed or removed):
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
