# Standard library imports
import argparse
import json
import os
import shutil
import sys
import uuid
import traceback
from datetime import datetime


def setup_environment():
    """Setup environment for PyInstaller (Windows and Mac)"""
    # Check if running from PyInstaller
    if getattr(sys, "frozen", False):
        bundle_dir = sys._MEIPASS

        # Set for Fiona/GDAL
        os.environ["GDAL_DATA"] = os.path.join(bundle_dir, "gdal_data")
        os.environ["PROJ_LIB"] = os.path.join(bundle_dir, "proj_data")

        if sys.platform == "darwin":
            lib_path = os.path.join(bundle_dir, ".dylibs")
            if os.path.exists(lib_path):
                os.environ["DYLD_LIBRARY_PATH"] = lib_path


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

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../")))

from src.E001_DataMatching.E012 import normalize_address as E012  # noqa: E402
from src.E001_DataMatching.E017 import lev_match as E017  # noqa: E402


def main():
    parser = argparse.ArgumentParser(description="IF005 事前結合チェック")
    parser.add_argument("--parameters", type=str)
    args = parser.parse_args()

    json_dict = json.loads(args.parameters)
    if isinstance(json_dict, str):
        json_dict = json.loads(json_dict)
    job_id = None
    logs_dir = os.path.dirname(os.path.abspath(sys.argv[0]))
    output_directory = None
    logger = None
    if005_start = None

    try:
        if005_start = datetime.now()
        database_path = json_dict.get("database_path", None)
        job_id = json_dict.get("job_id", None)
        if not database_path:
            raise Exception("Error: database_path field is required")

        connect_sqllite(database_path)
        job_id = create_or_update_job(
            job_id,
            "",
            "result",
            os.getpid(),
            0,
            json.dumps(json_dict, ensure_ascii=False),
            True,
        )

        # Extract and organize parameters from input JSON
        data_dict = json_dict.get("data", {})
        settings_dict = json_dict.get("settings", {})

        params = {
            "db_path": database_path,
            "output_path": json_dict.get("output_path", "."),
            # 住民基本台帳 DT106
            "juki": (data_dict.get("resident_registry", {}).get("path", None)),
            "juki_columns": (data_dict.get("resident_registry", {}).get("columns", {})),
            # 水道栓 DT105
            "suido_status": (data_dict.get("water_status", {}).get("path", None)),
            "suido_status_columns": (
                data_dict.get("water_status", {}).get("columns", {})
            ),
            # 登記簿 DT107
            "touki": (data_dict.get("building_registry", {}).get("path", None)),
            "touki_columns": (
                data_dict.get("building_registry", {}).get("columns", {})
            ),
            "threshold": (settings_dict.get("threshold", "0.8")),
            "max_number": settings_dict.get("max_number", "5"),
            "municipality": settings_dict.get("municipality"),
            # 建物種別判定用データ DT119
            "building_type_determination": (
                data_dict.get("building_type_determination", {}).get("path", None)
            ),
            "building_type_determination_columns": (
                data_dict.get("building_type_determination", {}).get("columns", {})
            ),
            # ジオコーディング済データ DT213
            "geocoding": (data_dict.get("geocoding", {}).get("path", None)),
            "geocoding_columns": (data_dict.get("geocoding", {}).get("columns", {})),
        }

        threshold = params.get("threshold", "0.8")
        threshold = float(threshold)
        max_number = params.get("max_number", "5")
        max_number = int(max_number)

        # Map column names for each data source
        suido_status_cols = params.get("suido_status_columns", {})
        juki_cols = params.get("juki_columns", {})
        touki_cols = params.get("touki_columns", {})
        building_type_determination_cols = params.get(
            "building_type_determination_columns", {}
        )
        geocoding_cols = params.get("geocoding_columns", {})

        columns = {
            "suido_status": {
                "suido_status_address": suido_status_cols.get("address"),
            },
            "juki": {
                "juki_address": juki_cols.get("address"),
            },
            "touki": {
                "touki_address": touki_cols.get("address"),
            },
            "geocoding": {
                "geocoding_address": geocoding_cols.get("address"),
            },
            "building_type_determination": {
                "building_type_determination_address": (
                    building_type_determination_cols.get("address")
                ),
            },
        }
        # Initialize job progress
        create_or_update_job(job_id, "2")

        logs_dir = concatenate(params.get("output_path"), "logs")
        os.makedirs(logs_dir, exist_ok=True)
        logger = get_rotating_logger(logs_dir, logger_name="IF005")

        logger.info(f"IF005 START: {if005_start.strftime('%Y-%m-%d %H:%M:%S')}")

        # Setup output directory with unique identifier
        random_str = str(uuid.uuid4())
        output_directory = concatenate(params.get("output_path"), random_str)

        # Track input data sources
        input_source = []

        # Build input files dictionary with required data sources
        output_path_base = params.get("output_path")

        input_files = {}
        # Add optional data sources if provided
        if params.get("suido_status"):
            input_files["suido_status"] = concatenate(
                output_path_base, params.get("suido_status")
            )

        if params.get("juki"):
            input_files["juki"] = concatenate(output_path_base, params.get("juki"))
            input_source.append("juki")

        if params.get("touki"):
            input_files["touki"] = concatenate(output_path_base, params.get("touki"))
            input_source.append("touki")

        if params.get("building_type_determination"):
            input_files["building_type_determination"] = concatenate(
                output_path_base, params.get("building_type_determination")
            )
            input_source.append("building_type_determination")

        if params.get("geocoding"):
            input_files["geocoding"] = concatenate(
                output_path_base, params.get("geocoding")
            )
            input_source.append("geocoding")

        # Validate: at least one input file must be provided
        if not input_files:
            create_or_update_job_task(
                job_id,
                progress_percent="",
                preprocess_type=None,
                error_code=ERROR_50001["code"],
                error_msg=ERROR_50001["message"],
                result=json.dumps({}),
                is_finish=True,
            )
            raise Exception(ERROR_50001["message"])

        # 市区町村名のバリデーション
        municipality = params.get("municipality")
        if not municipality:
            raise ValueError("市区町村名が指定されていません。設定画面で市区町村名を入力してください。")

        # Process and clean data (E012)
        e012_start = datetime.now()
        logger.info(f"E012 START: {e012_start.strftime('%Y-%m-%d %H:%M:%S')}")

        E012(
            input_files,
            output_directory,
            job_id,
            columns,
            params.get("db_path"),
            logs_dir,
            municipality=municipality,
        )

        e012_end = datetime.now()
        e012_duration = (e012_end - e012_start).total_seconds()
        logger.info(
            f"E012 END: {e012_end.strftime('%Y-%m-%d %H:%M:%S')} (Duration: {e012_duration:.2f}s) ({e012_duration/60:.2f}m)"
        )

        create_or_update_job(job_id, "50")
        suido_status_file = f"{output_directory}/suido_status_cleaned.csv"
        debug = False

        e017_start = datetime.now()
        logger.info(f"E017 START: {e017_start.strftime('%Y-%m-%d %H:%M:%S')}")

        E017(
            suido_status_file,
            input_source,
            output_directory,
            job_id,
            params.get("db_path"),
            logs_dir,
            output_directory,
            threshold,
            max_number,
            debug,
        )

        create_or_update_job(job_id, "90")
        e017_end = datetime.now()
        e017_duration = (e017_end - e017_start).total_seconds()
        logger.info(
            f"E017 END: {e017_end.strftime('%Y-%m-%d %H:%M:%S')} (Duration: {e017_duration:.2f}s) ({e017_duration/60:.2f}m)"
        )

        # Complete job and save results
        create_or_update_job(job_id, "complete")

        # End timing for total IF005
        if005_end = datetime.now()
        if005_duration = (if005_end - if005_start).total_seconds()
        logger.info(
            f"IF005 END: {if005_end.strftime('%Y-%m-%d %H:%M:%S')} (Total Duration: {if005_duration:.2f}s) ({if005_duration/60:.2f}m)"
        )

        # Log summary
        logger.info("=" * 60)
        logger.info("TIMING SUMMARY:")
        logger.info(f"  E012: {e012_duration:.2f}s ({e012_duration/60:.2f}m)")
        logger.info(f"  E017: {e017_duration:.2f}s ({e017_duration/60:.2f}m)")
        logger.info(f"  TOTAL: {if005_duration:.2f}s ({if005_duration/60:.2f}m)")
        logger.info("=" * 60)

    except Exception:
        # Log error timing
        if005_end = datetime.now()
        if if005_start:
            if005_duration = (if005_end - if005_start).total_seconds()

        if job_id:
            create_or_update_job(job_id, "error")
        if logger:
            logger.error("IF005 failed:\n%s", traceback.format_exc())
            if if005_duration:
                logger.info(
                    f"IF005 ERROR END: {if005_end.strftime('%Y-%m-%d %H:%M:%S')} "
                    f"(Duration before error: {if005_duration:.2f}s) ({if005_duration/60:.2f}m)"
                )
    finally:
        # Cleanup: Remove temporary output directory
        if output_directory and os.path.isdir(output_directory):
            shutil.rmtree(output_directory)


if __name__ == "__main__":
    # Required for multiprocessing on Windows and PyInstaller
    import multiprocessing as mp

    mp.freeze_support()
    main()
