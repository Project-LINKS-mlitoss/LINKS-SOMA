"""Adapter: convert UI --parameters JSON to the runtime city_cfg dict
expected by the experimental record linkage pipeline.

The Electron app sends column mappings dynamically (user picks column names
in the wizard UI).  The experimental pipeline expects a city_cfg dict with
a fixed schema (see preprocessing/record_linkage/city_config.py in the
experiment repo).  This module bridges the two.

Usage in IF001.py:
    from preprocessing.param_adapter import build_runtime_config
    cfg = build_runtime_config(params, output_path)
"""

from __future__ import annotations

import os
from pathlib import Path


def _resolve_path(output_path: str, relative: str | None) -> str | None:
    """Resolve a relative path from the UI against output_path.

    The UI stores uploaded files under output_path (= dbDirectory).
    Returns an absolute path string, or None if relative is falsy.
    """
    if not relative:
        return None
    full = os.path.join(output_path, relative).replace("//", "/")
    return full


def build_runtime_config(params: dict, output_path: str) -> dict:
    """Convert UI parameters into a runtime city_cfg dict.

    Args:
        params: The decoded --parameters JSON dict from IF001.
        output_path: Base directory for resolving relative file paths.

    Returns:
        A dict compatible with the city_cfg schema used by
        water.load_water_status(), juki.load_juki(), etc.
    """
    data = params.get("data", {})
    settings = params.get("settings", {})

    # ── Water status ─────────────────────────────────────────────────────
    ws = data.get("water_status", {})
    ws_cols = ws.get("columns", {})
    suido_status_cfg = {
        "file": os.path.basename(_resolve_path(output_path, ws.get("path")) or ""),
        "columns": {
            "water_supply_number": ws_cols.get("water_supply_number"),
            "address": ws_cols.get("address"),
            "usage_start_date": ws_cols.get("water_connection_date"),
            "usage_end_date": ws_cols.get("water_disconnection_date"),
        },
        # Safe default: dedup by latest start date per address
        "dedup_by_latest_start_date_per_address": True,
    }

    # ── Water usage ──────────────────────────────────────────────────────
    wu = data.get("water_usage", {})
    wu_cols = wu.get("columns", {})
    wu_path = _resolve_path(output_path, wu.get("path"))
    suido_use_cfg = {
        "files": [os.path.basename(wu_path)] if wu_path else [],
        "columns": {
            "water_supply_number": wu_cols.get("water_supply_number"),
            "meter_reading_date": wu_cols.get("water_recorded_date"),
            "suido_usage": wu_cols.get("water_usage"),
        },
    }

    # ── Juki (住民基本台帳) ──────────────────────────────────────────────
    rr = data.get("resident_registry", {})
    rr_cols = rr.get("columns", {})
    juki_cfg = {
        "file": os.path.basename(_resolve_path(output_path, rr.get("path")) or ""),
        "columns": {
            "household_code": rr_cols.get("household_code"),
            "address": rr_cols.get("address"),
            "birth_date": rr_cols.get("birth_date"),
            "move_date": rr_cols.get("resident_date"),
            "reason_transfer": rr_cols.get("reason_transfer"),
            "date_transfer": rr_cols.get("date_transfer"),
        },
    }

    # ── Touki (登記簿) ───────────────────────────────────────────────────
    br = data.get("building_registry", {})
    br_cols = br.get("columns", {})
    has_touki = bool(br.get("path"))
    touki_cfg = {
        "file": os.path.basename(_resolve_path(output_path, br.get("path")) or ""),
        "columns": {
            "address": br_cols.get("address"),
            "registration_reason": br_cols.get("registration_reason"),
            "structure": br_cols.get("structure_name"),
            "registration_date": br_cols.get("registration_date"),
        },
    } if has_touki else None

    # ── Geocoding ────────────────────────────────────────────────────────
    geo = data.get("geocoding", {})
    geo_cols = geo.get("columns", {})
    geocoding_cfg = {
        "file": os.path.basename(_resolve_path(output_path, geo.get("path")) or ""),
        "columns": {
            "address": geo_cols.get("address"),
            "latitude": geo_cols.get("latitude"),
            "longitude": geo_cols.get("longitude"),
        },
    }

    # ── Labels (空き家調査結果) ─────────────────────────────────────────
    # FEは "vacant_house" キーで送信する。CLIテスト用に "labels" もフォールバック。
    labels_data = data.get("vacant_house") or data.get("labels") or {}
    labels_cols = labels_data.get("columns", {})
    labels_cfg = None
    if labels_data.get("path"):
        labels_cfg = {
            "file": os.path.basename(
                _resolve_path(output_path, labels_data.get("path")) or ""
            ),
            "address_col": labels_cols.get("address") or labels_data.get("address_col", "住所"),
            "vacant_type_val": labels_data.get("vacant_type_val", "空き家"),
            "vacant_source_val": labels_data.get("vacant_source_val", ""),
        }

    # ── Optional data source (説明変数追加用データ) ─────────────────────
    ods = data.get("optional_data_source", {})
    ods_cols = ods.get("columns", {})
    optional_data_source_cfg = None
    if ods.get("path") and ods_cols.get("address"):
        optional_data_source_cfg = {
            "file": os.path.basename(
                _resolve_path(output_path, ods.get("path")) or ""
            ),
            "columns": {
                "address": ods_cols.get("address"),
            },
        }

    # ── Data directory ───────────────────────────────────────────────────
    # All file paths are relative to output_path; resolve the data_dir
    # as the directory containing the first available file.
    data_dir = output_path
    for src_key in ["water_status", "geocoding", "water_usage"]:
        src = data.get(src_key, {})
        p = _resolve_path(output_path, src.get("path"))
        if p:
            data_dir = str(Path(p).parent)
            break

    cfg = {
        "standard_date": settings.get("reference_date"),
        "municipality": settings.get("municipality"),
        "suido_status": suido_status_cfg,
        "suido_use": suido_use_cfg,
        "juki": juki_cfg,
        "touki": touki_cfg,
        "geocoding": geocoding_cfg,
        "has_touki": has_touki,
        "labels": labels_cfg,
        "optional_data_source": optional_data_source_cfg,
        "data_dir": data_dir,
    }

    return cfg
