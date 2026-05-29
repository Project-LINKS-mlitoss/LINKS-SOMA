# Standard library imports
import argparse
import json
import os
import shutil
import sys
import uuid
import traceback
from datetime import datetime
from pathlib import Path

import geopandas as gpd
import pandas as pd
from shapely.geometry import Point


def setup_environment():
    """Setup environment for PyInstaller (Windows and Mac)"""
    if getattr(sys, 'frozen', False):
        bundle_dir = sys._MEIPASS

        os.environ['GDAL_DATA'] = os.path.join(bundle_dir, 'gdal_data')
        os.environ['PROJ_LIB'] = os.path.join(bundle_dir, 'proj_data')

        if sys.platform == 'darwin':
            lib_path = os.path.join(bundle_dir, '.dylibs')
            if os.path.exists(lib_path):
                os.environ['DYLD_LIBRARY_PATH'] = lib_path


# Setup environment before importing modules that use Fiona/GDAL
setup_environment()

# Local imports
from constants import *
from utils import (
    create_or_update_job,
    create_or_update_job_task,
    connect_sqllite,
    create_job_results,
    concatenate,
    get_rotating_logger,
    create_or_update_summarization_job_task,
)

sys.path.append(
    os.path.abspath(os.path.join(os.path.dirname(__file__), "../"))
)

# Retained production modules (E016 spatial join, E014 utilities)
from src.E001_DataMatching.E014 import (  # noqa: E402
    usage_building_flag,
    translate_column_name,
    hensu_150,
)
from src.E001_DataMatching.E016 import (  # noqa: E402
    extend_columns,
    merge_building_type_determination,
    process_data as E016,
    process_spatial_join,
)

# New experimental record linkage modules
from src.preprocessing.param_adapter import build_runtime_config  # noqa: E402
from src.preprocessing.record_linkage.water import (  # noqa: E402
    load_water_status,
    aggregate_usage,
)
from src.preprocessing.record_linkage.juki import (  # noqa: E402
    load_juki,
    aggregate_juki,
    match_juki_to_water,
)
from src.preprocessing.record_linkage.touki import (  # noqa: E402
    load_touki,
    aggregate_touki,
    match_touki_to_water,
)
from src.preprocessing.record_linkage.labels import assign_labels  # noqa: E402
from src.preprocessing.record_linkage.optional_data_source import merge_optional_data_source  # noqa: E402
from src.preprocessing.address_utils import CleanData  # noqa: E402
from src.preprocessing.features.water import add_water_features  # noqa: E402
from src.preprocessing.features.juki import add_juki_features  # noqa: E402
from src.preprocessing.features.touki import add_touki_features  # noqa: E402
from src.preprocessing.features.interactions import add_interaction_features  # noqa: E402


DROP_FROM_TRAINING_DATA = [
    "disconnected_and_no_resident",
    "years_since_closure_is_missing",
    "flag_zero_usage_over4consecutivemonths",
    "usage_recovery_flag",
    "juki_elderly_proxy_flag",
    "num_cancellations_juki_residence",
]


def main():
    parser = argparse.ArgumentParser(description="IF001 名寄せ処理")
    parser.add_argument("--parameters", type=str)
    args = parser.parse_args()

    json_dict = json.loads(args.parameters)
    if isinstance(json_dict, str):
        json_dict = json.loads(json_dict)
    job_id = None
    logs_dir = os.path.dirname(os.path.abspath(sys.argv[0]))
    output_directory = None
    logger = None
    if001_start = None

    try:
        if001_start = datetime.now()
        database_path = json_dict.get("database_path", None)
        job_id = json_dict.get("job_id", None)
        if not database_path:
            raise Exception("Error: database_path field is required")

        connect_sqllite(database_path)
        job_id = create_or_update_job(
            job_id,
            "",
            "preprocess",
            os.getpid(),
            0,
            json.dumps(json_dict, ensure_ascii=False),
            True,
        )

        # Extract parameters
        data_dict = json_dict.get("data", {})
        settings_dict = json_dict.get("settings", {})
        advanced_dict = settings_dict.get("advanced", {})
        output_path_base = json_dict.get("output_path", ".")

        # 必須パラメータのバリデーション: 市区町村名が未指定ならエラー
        municipality = settings_dict.get("municipality")
        if not municipality:
            raise ValueError("市区町村名が指定されていません。設定画面で市区町村名を入力してください。")

        # 必須データのバリデーション: 水道栓データが未指定ならエラー
        has_water_status = bool(data_dict.get("water_status", {}).get("path"))
        if not has_water_status:
            create_or_update_job_task(
                job_id,
                progress_percent="",
                preprocess_type=None,
                error_code=ERROR_00051["code"],
                error_msg=ERROR_00051["message"],
                result=json.dumps({}),
                is_finish=True,
            )
            raise Exception(ERROR_00051["message"])

        # Build runtime config for experimental pipeline
        runtime_cfg = build_runtime_config(json_dict, output_path_base)
        data_dir = Path(runtime_cfg["data_dir"])

        # Build legacy params dict (still needed for E016, E015, translate)
        params = {
            "db_path": database_path,
            "output_path": output_path_base,
            "geocoding": data_dict.get("geocoding", {}).get("path", None) or None,
            "geocoding_columns": data_dict.get("geocoding", {}).get("columns", {}),
            "building_polygon": data_dict.get("building_polygon", {}).get("path", None),
            "building_polygon_column": "geometry",
            "building_polygon_file_type": data_dict.get("building_polygon", {}).get("input_file_type", None),
            "building_polygon_data_type": data_dict.get("building_polygon", {}).get("data_type", "plateau"),
            "census": data_dict.get("census", {}).get("path", None),
            "joining_method": advanced_dict.get("joining_method", ""),
            "reference_date": settings_dict.get("reference_date", ""),
            "building_type_determination": data_dict.get("building_type_determination", {}).get("path", None),
            "building_type_determination_columns": data_dict.get("building_type_determination", {}).get("columns", {}),
            "building_type_determination_values": data_dict.get("building_type_determination", {}).get("residential_values", []),
            "building_type_determination_type_file": data_dict.get("building_type_determination", {}).get("input_file_type", "csv"),
            "optional_data_source": data_dict.get("optional_data_source"),
            "vacant_house": data_dict.get("vacant_house"),
        }

        # Build geocoding columns mapping (used by E016)
        geocoding_columns_raw = data_dict.get("geocoding", {}).get("columns", {})
        columns = {
            "geocoding": {
                "geocoding_address": geocoding_columns_raw.get("address", "ジオコーディング住所"),
                "geocoding_latitude": geocoding_columns_raw.get("latitude", "ジオコーディング緯度"),
                "geocoding_longitude": geocoding_columns_raw.get("longitude", "ジオコーディング経度"),
                "level_geocoding": geocoding_columns_raw.get("level_geocoding", "空間レベル"),
                "confidency_geocoding": geocoding_columns_raw.get("confidency_geocoding", "空間精度"),
            },
        }

        # Determine spatial join option
        option = 0  # intersection
        if params.get("joining_method") == "nearest":
            option = 1  # nearest neighbor

        # Initialize job progress
        create_or_update_job(job_id, "2")
        task_id_summarization, result_summarization = create_or_update_summarization_job_task(
            job_id,
            "0",
            "preprocess_summary",
            json.dumps(DEFAULT_RESULT_SUMMARIZATION),
            id=None,
            is_finish=False,
        )

        logs_dir = concatenate(output_path_base, "logs")
        os.makedirs(logs_dir, exist_ok=True)
        logger = get_rotating_logger(logs_dir, logger_name="IF001")
        logger.info(f"IF001 START: {if001_start.strftime('%Y-%m-%d %H:%M:%S')}")

        # Setup output directory with unique identifier
        random_str = str(uuid.uuid4())
        output_directory = concatenate(output_path_base, random_str)
        os.makedirs(output_directory, exist_ok=True)

        # Parse standard_date
        standard_date = None
        ref_date_str = settings_dict.get("reference_date", "")
        if ref_date_str:
            standard_date = pd.Timestamp(ref_date_str)

        # ══════════════════════════════════════════════════════════════════
        # Record Linkage — replaces E012 + E013 + E014.embedding_address
        # ══════════════════════════════════════════════════════════════════

        # Step 1: Water meter status
        rl_start = datetime.now()
        logger.info(f"Record Linkage START: {rl_start.strftime('%Y-%m-%d %H:%M:%S')}")

        df = load_water_status(runtime_cfg, data_dir, standard_date=standard_date)
        logger.info(f"[water_status] Output: {len(df):,} rows x {len(df.columns)} cols")
        logger.info(f"[water_status] Columns: {list(df.columns)}")
        create_or_update_job(job_id, "10")

        # Step 2: Water usage
        cols_before = set(df.columns)
        df = aggregate_usage(runtime_cfg, data_dir, df, standard_date=standard_date)
        new_cols = sorted(set(df.columns) - cols_before)
        logger.info(f"[usage_aggregation] Output: {len(df):,} rows x {len(df.columns)} cols")
        if new_cols:
            logger.info(f"[usage_aggregation] New columns added: {new_cols}")
        create_or_update_job(job_id, "20")

        # Step 3: Juki (住民基本台帳)
        # 結合結果のラベル用: 直前の結合結果を示す文字（A, B, C...）
        last_join_label = None

        juki_cfg = runtime_cfg.get("juki", {})
        if juki_cfg.get("file"):
            juki_raw = load_juki(runtime_cfg, data_dir)
            juki_agg = aggregate_juki(juki_raw, standard_date=standard_date)
            df = match_juki_to_water(df, juki_agg)
            logger.info(f"[juki_match] Output: {len(df):,} rows x {len(df.columns)} cols")

            # 結合率をjob_taskに記録（旧E014互換）
            if job_id:
                juki_sub_rows = len(juki_agg)
                juki_matched = df.loc[df["juki_residence_flag"] == 1, "normalized_address"].nunique()
                juki_rate = round(juki_matched / juki_sub_rows * 100, 2) if juki_sub_rows > 0 else 0
                create_or_update_job_task(
                    job_id,
                    progress_percent="100",
                    preprocess_type="e014",
                    error_code=None,
                    error_msg=None,
                    result=json.dumps({
                        "joining_rate": juki_rate,
                        "input_source": "「水道閉開栓状況」に「住民基本台帳」を住所で結合（A）",
                        "success_rate": f"{juki_matched}件/{juki_sub_rows}件中",
                    }, ensure_ascii=False),
                    is_finish=True,
                )
            last_join_label = "A"
        else:
            df["juki_residence_flag"] = 0
            logger.info("  Juki: no data provided — skipped")
        create_or_update_job(job_id, "35")

        # Step 4: Touki (登記簿)
        if runtime_cfg.get("has_touki"):
            touki_raw = load_touki(runtime_cfg, data_dir)
            touki_agg = aggregate_touki(touki_raw) if touki_raw is not None else None
            df = match_touki_to_water(df, touki_agg)
            logger.info(f"[touki_match] Output: {len(df):,} rows x {len(df.columns)} cols")

            # 結合率をjob_taskに記録（旧E014互換）
            if job_id and touki_agg is not None:
                touki_sub_rows = len(touki_agg)
                touki_matched = df.loc[df["touki_residence_flag"] == 1, "normalized_address"].nunique()
                touki_rate = round(touki_matched / touki_sub_rows * 100, 2) if touki_sub_rows > 0 else 0
                prev = last_join_label or "水道閉開栓状況"
                cur = chr(ord(last_join_label) + 1) if last_join_label else "A"
                create_or_update_job_task(
                    job_id,
                    progress_percent="100",
                    preprocess_type="e014",
                    error_code=None,
                    error_msg=None,
                    result=json.dumps({
                        "joining_rate": touki_rate,
                        "input_source": f"{prev}に「登記情報」を住所で結合（{cur}）",
                        "success_rate": f"{touki_matched}件/{touki_sub_rows}件中",
                    }, ensure_ascii=False),
                    is_finish=True,
                )
                last_join_label = cur
        else:
            df["touki_residence_flag"] = 0
            logger.info("  Touki: no data provided — skipped")
        create_or_update_job(job_id, "45")

        # Step 4.5: Geocoding (ジオコーディング済データの結合)
        geocoding_path = params.get("geocoding")
        if geocoding_path:
            geo_file = concatenate(output_path_base, geocoding_path)
            geo_cols = params.get("geocoding_columns", {})
            addr_col = geo_cols.get("address", "住所")
            lat_col = geo_cols.get("latitude", "緯度")
            lon_col = geo_cols.get("longitude", "経度")

            geo_df = pd.read_csv(geo_file, dtype=str)
            geo_df["normalized_address"] = CleanData.normalize_series(geo_df[addr_col], municipality=municipality)

            # E012互換のカラム名にリネーム（E016が latitude_geocoding_cleaned を期待）
            rename_map = {
                lat_col: "latitude",
                lon_col: "longitude",
            }
            # level_geocoding / confidency_geocoding があれば追加
            level_col = geo_cols.get("level_geocoding")
            if level_col and level_col in geo_df.columns:
                rename_map[level_col] = "level_geocoding"
            conf_col = geo_cols.get("confidency_geocoding")
            if conf_col and conf_col in geo_df.columns:
                rename_map[conf_col] = "confidency_geocoding"
            geo_df = geo_df.rename(columns=rename_map)

            # embedding_address互換: サフィックス _geocoding_cleaned を付与
            geo_keep = ["normalized_address"] + list(rename_map.values())
            geo_df = geo_df[[c for c in geo_keep if c in geo_df.columns]]
            geo_df = geo_df.drop_duplicates(subset=["normalized_address"], keep="first")
            geo_df.columns = [
                f"{c}_geocoding_cleaned" if c != "normalized_address" else c
                for c in geo_df.columns
            ]

            geo_sub_rows = len(geo_df)
            n_before = len(df)
            df = df.merge(geo_df, on="normalized_address", how="left")
            n_matched = df[[c for c in df.columns if c.endswith("_geocoding_cleaned")]].notna().any(axis=1).sum()
            logger.info(f"  Geocoding matched: {n_matched:,} / {n_before:,} ({n_matched/max(1,n_before)*100:.1f}%)")

            # 結合率をjob_taskに記録（旧E014互換）
            if job_id:
                geo_matched = int(n_matched)
                geo_rate = round(geo_matched / geo_sub_rows * 100, 2) if geo_sub_rows > 0 else 0
                prev = last_join_label or "水道閉開栓状況"
                cur = chr(ord(last_join_label) + 1) if last_join_label else "A"
                create_or_update_job_task(
                    job_id,
                    progress_percent="100",
                    preprocess_type="e014",
                    error_code=None,
                    error_msg=None,
                    result=json.dumps({
                        "joining_rate": geo_rate,
                        "input_source": f"{prev}に「ジオコーディング済データ」を住所で結合（{cur}）",
                        "success_rate": f"{geo_matched}件/{geo_sub_rows}件中",
                    }, ensure_ascii=False),
                    is_finish=True,
                )
                last_join_label = cur
        else:
            logger.info("  Geocoding: no data provided — skipped")

        # Step 4.6: Optional data source (説明変数追加用データ)
        ods_cfg = runtime_cfg.get("optional_data_source")
        if ods_cfg:
            cols_before = set(df.columns)
            df = merge_optional_data_source(df, ods_cfg, data_dir, municipality=municipality)
            new_cols = sorted(set(df.columns) - cols_before)
            logger.info(f"[optional_data_source] Merged: {len(new_cols)} columns added: {new_cols}")
            n_matched = df[new_cols].notna().any(axis=1).sum() if new_cols else 0
            logger.info(f"[optional_data_source] Matched: {n_matched:,} / {len(df):,} ({n_matched/max(1,len(df))*100:.1f}%)")
        else:
            logger.info("  Optional data source: no data provided — skipped")

        # Step 5: Labels (任意 — パラメータ提供時のみ)
        if runtime_cfg.get("labels"):
            # labels.assign_labels expects a city name; use empty string for generic
            city_name = json_dict.get("city", "")
            df = assign_labels(city_name, runtime_cfg, data_dir, df)
            n_pos = int(df.get("is_vacant", pd.Series([0])).sum())
            n_total = len(df)
            logger.info(f"[labels] Positive count: {n_pos:,} / {n_total:,} ({n_pos/max(1,n_total):.2%})")

        # Step 6: Derived features (average_waterusage_person)
        if "avg_water_usage" in df.columns and "household_size_juki_residence" in df.columns:
            hsize = df["household_size_juki_residence"].fillna(1).clip(lower=1)
            df["average_waterusage_person"] = df["avg_water_usage"] / hsize
        df["suido_residence_flag"] = 1  # 全レコードが水道データ起点

        # Step 7: Feature engineering は building_filter(E015) 後に移動
        # 理由: 99パーセンタイルクリップの母集団を住宅のみにするため

        drop_cols = [c for c in DROP_FROM_TRAINING_DATA if c in df.columns]
        if drop_cols:
            df = df.drop(columns=drop_cols)
            logger.info(f"  Dropped unused columns: {', '.join(drop_cols)}")

        rl_end = datetime.now()
        rl_duration = (rl_end - rl_start).total_seconds()
        logger.info(f"Record Linkage END: {rl_end.strftime('%Y-%m-%d %H:%M:%S')} "
                     f"(Duration: {rl_duration:.2f}s) ({rl_duration/60:.2f}m)")

        # ── Final output summary ──────────────────────────────────────────
        logger.info(f"[output_summary] Total rows: {len(df):,}, Total columns: {len(df.columns)}")
        feature_cols_present = [c for c in df.columns if c not in [
            "water_supply_number", "normalized_address", "reference_date_juki_residence",
            "is_vacant", "vacant_type", "vacant_source", "vacant_year",
        ]]
        logger.info(f"[output_summary] Feature columns: {len(feature_cols_present)}")
        logger.info(f"[output_summary] All columns: {list(df.columns)}")

        # ══════════════════════════════════════════════════════════════════
        # Save intermediate CSV for hensu_150 and E016
        # ══════════════════════════════════════════════════════════════════
        intermediate_csv = f"{output_directory}/record_linkage_output.csv"
        df["reference_date_juki_residence"] = params.get("reference_date", "")
        df.to_csv(intermediate_csv, index=False)

        # hensu_150: add structure flags and derived columns
        hensu_start = datetime.now()
        output_path_with_new_columns = hensu_150(
            intermediate_csv,
            f"{output_directory}/matched_data_with_new_columns.csv",
            params.get("reference_date"),
        )
        hensu_end = datetime.now()
        logger.info(f"hensu_150: {(hensu_end - hensu_start).total_seconds():.2f}s")
        create_or_update_job(job_id, "55")

        # ══════════════════════════════════════════════════════════════════
        # E016: Spatial join with building polygons (retained as-is)
        # ══════════════════════════════════════════════════════════════════
        output_path_e016 = f"{output_directory}/E016.csv"
        has_geocoding = params.get("geocoding") is not None

        building_type_determination = params.get("building_type_determination", None)
        is_building_type_determination = bool(building_type_determination)

        # Track input sources for label generation
        input_source = []
        if data_dict.get("resident_registry", {}).get("path"):
            input_source.append("juki")
        if data_dict.get("building_registry", {}).get("path"):
            input_source.append("touki")
        if data_dict.get("geocoding", {}).get("path"):
            input_source.append("geocoding")

        if has_geocoding:
            gpkg_path = concatenate(output_path_base, params.get("census", None))

            if params.get("building_polygon"):
                tatemono_path = concatenate(output_path_base, params.get("building_polygon"))
                if len(input_source) > 2:
                    label_E016 = "Cに「建物ポリゴンデータ」を緯度・経度で結合（D）" if is_building_type_determination else "Cに「建物ポリゴンデータ」を緯度・経度で結合"
                else:
                    label_E016 = "Bに「建物ポリゴンデータ」を緯度・経度で結合（C）" if is_building_type_determination else "Bに「建物ポリゴンデータ」を緯度・経度で結合"
            else:
                tatemono_path = None
                label_E016 = "ジオコーディング座標からポイントを生成"

            e016_start = datetime.now()
            logger.info(f"E016 START: {e016_start.strftime('%Y-%m-%d %H:%M:%S')}")

            output_path, result_summarization_updated = E016(
                tatemono_path,
                output_path_with_new_columns,
                gpkg_path,
                option,
                "csv",
                output_path_e016,
                job_id,
                params.get("db_path"),
                params.get("building_polygon_column", "geometry"),
                label_E016,
                params.get("building_polygon_file_type"),
                params.get("building_polygon_data_type"),
                columns.get("geocoding", {}),
                logs_dir,
                task_id_summarization,
                result_summarization,
                municipality=municipality,
            )

            e016_end = datetime.now()
            e016_duration = (e016_end - e016_start).total_seconds()
            logger.info(f"E016 END: {e016_end.strftime('%Y-%m-%d %H:%M:%S')} "
                         f"(Duration: {e016_duration:.2f}s) ({e016_duration/60:.2f}m)")
        else:
            logger.info("geocoding が未指定のため E016（空間結合）をスキップ")
            e016_substitute_columns = [
                "building_id",
                "residenceID",
                "KEY_CODE",
                "S_NAME",
                "geometry_plateau",
            ]
            extend_columns(output_path_with_new_columns, e016_substitute_columns)
            output_path = output_path_with_new_columns
            result_summarization_updated = result_summarization
            e016_duration = 0
            create_or_update_job(job_id, "90")

        # ══════════════════════════════════════════════════════════════════
        # E015: Building type determination (retained as-is)
        # ══════════════════════════════════════════════════════════════════
        e015_start = datetime.now()
        logger.info(f"E015 START: {e015_start.strftime('%Y-%m-%d %H:%M:%S')}")

        output_e015, task_id, result_summarization_updated_e015 = e015(
            output_path,
            option,
            params,
            output_directory,
            job_id,
            columns,
            params.get("db_path"),
            task_id_summarization,
            result_summarization_updated,
            logs_dir,
            len(input_source),
            municipality=municipality,
        )

        # ══════════════════════════════════════════════════════════════════
        # Feature engineering — building_filter後に実行
        # 99パーセンタイルクリップの母集団を住宅のみにするため
        # (実験リポと同じ順序: building_filter → feature engineering)
        # ══════════════════════════════════════════════════════════════════
        feat_start = datetime.now()
        logger.info(f"Feature engineering START: {feat_start.strftime('%Y-%m-%d %H:%M:%S')}")

        df_feat = pd.read_csv(output_e015, low_memory=False)
        logger.info(f"[feature_engineering] Loaded {len(df_feat):,} rows from E015 output")

        if standard_date is not None:
            cols_before_water = set(df_feat.columns)
            df_feat = add_water_features(df_feat, standard_date)
            water_feats = sorted(set(df_feat.columns) - cols_before_water)
            logger.info(f"[water_features] Added {len(water_feats)} features: {water_feats}")
            for feat in water_feats:
                non_null_rate = df_feat[feat].notna().mean()
                logger.info(f"[water_features]   {feat}: non-null={non_null_rate:.2%}")

            cols_before_juki = set(df_feat.columns)
            df_feat = add_juki_features(df_feat, standard_date)
            juki_feats = sorted(set(df_feat.columns) - cols_before_juki)
            logger.info(f"[juki_features] Added {len(juki_feats)} features: {juki_feats}")
            for feat in juki_feats:
                non_null_rate = df_feat[feat].notna().mean()
                logger.info(f"[juki_features]   {feat}: non-null={non_null_rate:.2%}")

            cols_before_touki = set(df_feat.columns)
            df_feat = add_touki_features(df_feat, standard_date)
            touki_feats = sorted(set(df_feat.columns) - cols_before_touki)
            if touki_feats:
                logger.info(f"[touki_features] Added {len(touki_feats)} features: {touki_feats}")
                for feat in touki_feats:
                    non_null_rate = df_feat[feat].notna().mean()
                    logger.info(f"[touki_features]   {feat}: non-null={non_null_rate:.2%}")
        else:
            logger.info("[feature_engineering] Skipped — no reference_date")

        cols_before_inter = set(df_feat.columns)
        df_feat = add_interaction_features(df_feat)
        inter_feats = sorted(set(df_feat.columns) - cols_before_inter)
        logger.info(f"[interaction_features] Added {len(inter_feats)} features: {inter_feats}")
        for feat in inter_feats:
            non_null_rate = df_feat[feat].notna().mean()
            logger.info(f"[interaction_features]   {feat}: non-null={non_null_rate:.2%}")

        df_feat.to_csv(output_e015, index=False)

        feat_end = datetime.now()
        feat_duration = (feat_end - feat_start).total_seconds()
        logger.info(f"Feature engineering END: {feat_end.strftime('%Y-%m-%d %H:%M:%S')} "
                     f"(Duration: {feat_duration:.2f}s)")

        output_path_usage_building_flag = f"{output_directory}/usage_building_flag.csv"

        usage_building_flag(
            output_e015,
            output_path_usage_building_flag,
            str(job_id),
            params.get("db_path"),
            task_id,
            task_id_summarization,
            result_summarization_updated_e015,
        )

        e015_end = datetime.now()
        e015_duration = (e015_end - e015_start).total_seconds()
        logger.info(f"E015 END: {e015_end.strftime('%Y-%m-%d %H:%M:%S')} "
                     f"(Duration: {e015_duration:.2f}s) ({e015_duration/60:.2f}m)")

        create_or_update_job(job_id, "95")

        # ══════════════════════════════════════════════════════════════════
        # Translate column names to Japanese
        # ══════════════════════════════════════════════════════════════════
        keep_original_suffixes = []
        if params.get("optional_data_source"):
            keep_original_suffixes.append("_optional_data_source_cleaned")
        if params.get("vacant_house"):
            keep_original_suffixes.append("_vacant_house_cleaned")
        # _odsサフィックスはサフィックス除去せずそのまま保持
        keep_suffix_intact = ("_ods",) if runtime_cfg.get("optional_data_source") else None
        translate_column_name(
            output_path_usage_building_flag,
            f"{output_directory}.csv",
            keep_original_suffixes=tuple(keep_original_suffixes) if keep_original_suffixes else None,
            keep_suffix_intact=keep_suffix_intact,
        )

        # Complete job and save results
        create_or_update_job(job_id, "complete")
        create_job_results(job_id, f"{random_str}.csv")

        # Timing summary
        if001_end = datetime.now()
        if001_duration = (if001_end - if001_start).total_seconds()
        logger.info(f"IF001 END: {if001_end.strftime('%Y-%m-%d %H:%M:%S')} "
                     f"(Total Duration: {if001_duration:.2f}s) ({if001_duration/60:.2f}m)")
        logger.info("=" * 60)
        logger.info("TIMING SUMMARY:")
        logger.info(f"  Record Linkage: {rl_duration:.2f}s ({rl_duration/60:.2f}m)")
        logger.info(f"  E015: {e015_duration:.2f}s ({e015_duration/60:.2f}m)")
        logger.info(f"  E016: {e016_duration:.2f}s ({e016_duration/60:.2f}m)")
        logger.info(f"  TOTAL: {if001_duration:.2f}s ({if001_duration/60:.2f}m)")
        logger.info("=" * 60)

    except Exception:
        if001_end = datetime.now()
        if001_duration = None
        if if001_start:
            if001_duration = (if001_end - if001_start).total_seconds()

        if job_id:
            create_or_update_job(job_id, "error")
        if logger:
            logger.error("IF001 failed:\n%s", traceback.format_exc())
            if if001_duration:
                logger.info(
                    f"IF001 ERROR END: {if001_end.strftime('%Y-%m-%d %H:%M:%S')} "
                    f"(Duration before error: {if001_duration:.2f}s) ({if001_duration/60:.2f}m)"
                )
    finally:
        if output_directory and os.path.isdir(output_directory):
            shutil.rmtree(output_directory)


def e015(
    input_path, option, params, output_directory, job_id, columns, db_path,
    task_id_summarization, result_summarization_updated, logs_dir, number_input,
    municipality=None,
):
    ERROR_CODE = None
    ERROR_MSG = None
    task_id = None
    logger = None
    result_summarization = result_summarization_updated
    try:
        logger = get_rotating_logger(logs_dir, logger_name="IF001")
        if job_id:
            task_id = create_or_update_job_task(
                job_id,
                progress_percent="0",
                preprocess_type="e015",
                error_code=None,
                error_msg=None,
                result=None,
            )
        building_type_determination = params.get("building_type_determination", None)
        output_path = None

        if building_type_determination:
            building_type_determination = concatenate(
                params.get("output_path"), building_type_determination
            )
            building_cols = params.get("building_type_determination_columns", {})
            column_building_type_determination = {
                "address": building_cols.get("address", "地番住所"),
                "building_type": building_cols.get("building_type", "建物種別"),
            }
            building_type_values = params.get("building_type_determination_values", [])
            type_file = params.get("building_type_determination_type_file", "csv")

            file_extension = os.path.splitext(building_type_determination)[1].lower()
            if file_extension != ".csv" and type_file == "csv":
                ERROR_CODE = ERROR_00007["code"]
                ERROR_MSG = ERROR_00007["message"]
                raise Exception(ERROR_MSG)
            elif file_extension == ".csv" and type_file != "csv":
                ERROR_CODE = ERROR_00048["code"]
                ERROR_MSG = ERROR_00048["message"]
                raise Exception(ERROR_MSG)

            if type_file == "csv":
                label_E015 = "Dに「推定対象選定用データ」を住所で結合" if number_input > 2 else "Cに「推定対象選定用データ」を住所で結合"
                output_path, result_summarization = merge_building_type_determination(
                    input_path,
                    building_type_determination,
                    output_directory,
                    column_building_type_determination,
                    building_type_values,
                    job_id,
                    task_id,
                    task_id_summarization,
                    result_summarization_updated,
                    label_E015,
                    municipality=municipality,
                )
            else:
                # GeoPackage/Shapefile: ポイント→ポリゴンのwithin判定で非住宅を除外
                # 実験リポ building_filter.py:filter_residential_plateau と同等の処理
                if not building_type_values:
                    logger.info("[building_filter] residential_values未指定のためフィルタをスキップ")
                else:
                    building_type_col = column_building_type_determination.get("building_type", "usage")
                    logger.info(f"[building_filter] Loading GeoPackage: {building_type_determination}")
                    buildings = gpd.read_file(building_type_determination)
                    buildings = buildings.to_crs(epsg=4326)
                    logger.info(f"[building_filter] Buildings loaded: {len(buildings):,} rows, "
                                 f"columns: {list(buildings.columns)[:10]}")

                    if building_type_col not in buildings.columns:
                        logger.warning(f"[building_filter] Column '{building_type_col}' not found. Skipping filter.")
                    else:
                        main_df = pd.read_csv(input_path, low_memory=False)
                        n_before = len(main_df)

                        # 座標は元のジオコーディングCSVから直接取得する
                        # （中間CSV経由のラウンドトリップによる浮動小数点精度劣化を回避）
                        geocoding_path = params.get("geocoding")
                        geo_cols_cfg = params.get("geocoding_columns", {})
                        if geocoding_path:
                            geo_file = concatenate(params.get("output_path"), geocoding_path)
                            geo_addr_col = geo_cols_cfg.get("address", "住所")
                            geo_lat_col = geo_cols_cfg.get("latitude", "緯度")
                            geo_lon_col = geo_cols_cfg.get("longitude", "経度")

                            geo_df = pd.read_csv(geo_file, low_memory=False)
                            geo_df["normalized_address"] = CleanData.normalize_series(geo_df[geo_addr_col], municipality=municipality)
                            geo_df = geo_df.rename(columns={
                                geo_lat_col: "_geo_lat",
                                geo_lon_col: "_geo_lon",
                            })
                            geo_df = geo_df[["normalized_address", "_geo_lat", "_geo_lon"]].dropna(
                                subset=["_geo_lat", "_geo_lon"]
                            )
                            geo_df = geo_df.drop_duplicates(subset=["normalized_address"], keep="first")

                            main_df = main_df.merge(geo_df, on="normalized_address", how="left")
                            lat_col = "_geo_lat"
                            lon_col = "_geo_lon"
                        else:
                            lat_col = "latitude_geocoding_cleaned"
                            lon_col = "longitude_geocoding_cleaned"

                        has_geo = main_df[lat_col].notna() & main_df[lon_col].notna()
                        logger.info(f"[building_filter] Geocoding coverage: "
                                     f"{has_geo.sum():,} / {len(main_df):,} ({has_geo.mean():.1%})")

                        # 非住宅ポリゴンを抽出（実験リポ building_filter.py と同等）
                        all_values = set(buildings[building_type_col].dropna().unique())
                        non_res_values = all_values - set(building_type_values) - {"", "不明"}
                        non_res_buildings = buildings[
                            buildings[building_type_col].isin(non_res_values)
                        ].copy()
                        logger.info(f"[building_filter] Non-residential buildings: "
                                     f"{len(non_res_buildings):,} / {len(buildings):,}")

                        # ポイント→ポリゴンのwithin判定
                        geo_rows = main_df[has_geo]
                        points_gdf = gpd.GeoDataFrame(
                            geo_rows[["water_supply_number"]].reset_index(drop=True),
                            geometry=[Point(lon, lat) for lon, lat
                                      in zip(geo_rows[lon_col], geo_rows[lat_col])],
                            crs="EPSG:4326",
                        )
                        joined = gpd.sjoin(
                            points_gdf,
                            non_res_buildings[["geometry"]],
                            how="left",
                            predicate="within",
                        )
                        non_res_ids = set(
                            joined[joined["index_right"].notna()]["water_supply_number"].tolist()
                        )
                        main_df = main_df[~main_df["water_supply_number"].isin(non_res_ids)].reset_index(drop=True)

                        n_removed = n_before - len(main_df)
                        logger.info(f"[building_filter] Removed {n_removed:,} non-residential "
                                     f"({n_removed/n_before:.1%}) → {len(main_df):,} remaining")

                        # 一時カラムを削除してから保存
                        main_df = main_df.drop(columns=["_geo_lat", "_geo_lon"], errors="ignore")
                        output_path = f"{output_directory}/DT119.csv"
                        main_df.to_csv(output_path, index=False)
                        result_summarization = result_summarization_updated

        columns_extend = [
            "address_building_type_determination",
            "latitude_building_type_determination",
            "longitude_building_type_determination",
            "usage_building_type_determination",
        ]

        if output_path is not None:
            input_path = output_path
        extend_columns(input_path, columns_extend)
        output_path = input_path

        create_or_update_job(job_id, "92")
        create_or_update_job_task(
            job_id,
            progress_percent="50",
            preprocess_type="e015",
            error_code=None,
            error_msg=None,
            result=None,
            id=task_id,
        )

        return output_path, task_id, result_summarization
    except Exception as e:
        if task_id is not None:
            create_or_update_job_task(
                job_id,
                progress_percent="",
                preprocess_type="e015",
                error_code=ERROR_CODE,
                error_msg=ERROR_MSG,
                result=json.dumps({}),
                id=task_id,
                is_finish=True,
            )
        if logger:
            logger.error("E015 failed:\n%s", traceback.format_exc())
        traceback.print_exc()
        raise Exception(e)


if __name__ == "__main__":
    import multiprocessing as mp
    mp.freeze_support()
    main()
