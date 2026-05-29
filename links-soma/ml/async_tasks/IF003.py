import argparse
import json
import os
import shutil
import sys
import traceback
import uuid
from datetime import datetime
from constants import ERROR_20018
from utils import (
    connect_sqllite,
    create_or_update_job,
    create_or_update_job_task,
    create_data_set_results,
    concatenate,
    get_rotating_logger,
)

sys.path.append(
    os.path.abspath(
        os.path.join(os.path.dirname(__file__), "../")
    )  # noqa: E501
)
from src.E002_Classification.E022 import main as E022  # noqa: E402

from src.E003_Summarization.E032 import (  # noqa: E402
    process_summarization as E032,
)  # noqa: E501

sys.stdin = open(sys.stdin.fileno(), mode="r", encoding="utf-8")
sys.stdout = open(sys.stdout.fileno(), mode="w", encoding="utf-8")

from threshold import resolve_threshold  # noqa: E402


def main():

    parser = argparse.ArgumentParser(description="E022,E032 空き家分析(推定)")
    parser.add_argument("--parameters", type=str)
    args = parser.parse_args()

    json_dict = json.loads(args.parameters)
    if isinstance(json_dict, str):
        json_dict = json.loads(json_dict)
    job_id = None
    logs_dir = os.path.dirname(os.path.abspath(sys.argv[0]))
    output_directory = None
    logger = None
    if003_start = None
    if003_duration = None

    try:
        if003_start = datetime.now()

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
        params = {
            "db_path": database_path,
            "output_path": json_dict.get("output_path", ""),
            "model_path": json_dict.get("model_path", None),
            # しきい値: UIから受け取る。未指定の場合はモデル内蔵のしきい値を使用（後段で解決）
            "threshold": json_dict.get("settings", {}).get("threshold", None),
            "area_grouping": (
                json_dict.get("area_grouping", {}).get("path", None)
            ),
            "area_grouping_columns": (
                json_dict.get("area_grouping", {}).get("columns", {})
            ),
            "normalized_dataset_paths": (
                json_dict.get("normalized_dataset_paths", [])
            ),
        }

        logs_dir = concatenate(params.get("output_path"), "logs")
        os.makedirs(logs_dir, exist_ok=True)
        logger = get_rotating_logger(logs_dir, logger_name="IF003")

        logger.info(f"IF003 START: {if003_start.strftime('%Y-%m-%d %H:%M:%S')}")
        logger.info(f"[params] model_path={params.get('model_path')}")
        logger.info(f"[params] threshold(UI)={params.get('threshold')}")
        logger.info(f"[params] normalized_dataset_paths={params.get('normalized_dataset_paths')}")
        logger.info(f"[params] area_grouping={params.get('area_grouping')}")

        random_str = str(uuid.uuid4())
        output_directory = concatenate(params.get("output_path"), random_str)

        file_path = f"{output_directory}/D902.csv"

        model_path = concatenate(
            params.get("output_path"), params.get("model_path")
        )

        # しきい値の解決: UI指定値 > モデル内蔵値 > デフォルト(0.5)
        logger.info(f"[threshold] Model path: {model_path}")
        threshold_value = resolve_threshold(params.get("threshold"), model_path, logger)
        threshold_source = "UI" if params.get("threshold") is not None else "model/default"
        logger.info(f"[threshold] Resolved: {threshold_value} (source: {threshold_source})")

        columns = params.get("area_grouping_columns", None)
        key_column = []
        if columns:
            key_column = [
                columns.get("area_group_id"),
                columns.get("area_group_name"),
            ]
        else:
            key_column = "KEY_CODE"

        spatial_file = concatenate(
            params.get("output_path"), params.get("area_grouping")
        )
        process = 0
        normalized_dataset_paths = params.get("normalized_dataset_paths", [])
        if not normalized_dataset_paths:
            create_or_update_job_task(
                job_id,
                progress_percent="",
                preprocess_type=None,
                error_code=ERROR_20018["code"],
                error_msg=ERROR_20018["message"],
                result=json.dumps({}),
                is_finish=True,
            )
            raise Exception(ERROR_20018["message"])

        total = len(normalized_dataset_paths)
        data_set_result_id = create_data_set_results(job_id=job_id)

        # Initialize duration trackers
        e022_total_duration = 0
        e032_total_duration = 0

        for idx, item in enumerate(normalized_dataset_paths):
            normalized_path = concatenate(params.get("output_path"), item)
            process = process + (100 / total)

            # E022 timing
            e022_start = datetime.now()
            logger.info(f"E022 [{idx+1}/{total}] START: {e022_start.strftime('%Y-%m-%d %H:%M:%S')}")
            logger.info(f"[E022] CSV path: {normalized_path}")
            if os.path.exists(normalized_path):
                import csv as _csv
                with open(normalized_path, 'r', encoding='utf-8-sig') as _f:
                    reader = _csv.reader(_f)
                    header = next(reader, None)
                    row_count = sum(1 for _ in reader)
                logger.info(f"[E022] CSV: {row_count:,} rows, {len(header) if header else 0} cols")
            else:
                logger.warning(f"[E022] CSV file not found: {normalized_path}")

            E022(
                normalized_path,
                model_path,
                output_directory,
                file_path,
                float(threshold_value),
                str(job_id),
                params.get("db_path"),
                (process / 2),
                data_set_result_id,
                logs_dir,
            )

            e022_end = datetime.now()
            e022_duration = (e022_end - e022_start).total_seconds()
            e022_total_duration += e022_duration
            logger.info(f"E022 [{idx+1}/{total}] END: {e022_end.strftime('%Y-%m-%d %H:%M:%S')} (Duration: {e022_duration:.2f}s)")

            create_or_update_job(job_id, (process / 2))

            # E032 timing
            e032_start = datetime.now()
            logger.info(f"E032 [{idx+1}/{total}] START: {e032_start.strftime('%Y-%m-%d %H:%M:%S')}")

            E032(
                file_path,
                spatial_file,
                output_directory,
                key_column,
                str(job_id),
                params.get("db_path"),
                process,
                data_set_result_id,
                logs_dir,
            )

            e032_end = datetime.now()
            e032_duration = (e032_end - e032_start).total_seconds()
            e032_total_duration += e032_duration
            logger.info(f"E032 [{idx+1}/{total}] END: {e032_end.strftime('%Y-%m-%d %H:%M:%S')} (Duration: {e032_duration:.2f}s)")

            create_or_update_job(job_id, process)

        # IF003 END and summary
        if003_end = datetime.now()
        if003_duration = (if003_end - if003_start).total_seconds()
        logger.info(f"IF003 END: {if003_end.strftime('%Y-%m-%d %H:%M:%S')} (Total Duration: {if003_duration:.2f}s)")

        logger.info("=" * 60)
        logger.info("TIMING SUMMARY:")
        logger.info(f"  E022 Total: {e022_total_duration:.2f}s ({e022_total_duration/60:.2f}m)")
        logger.info(f"  E032 Total: {e032_total_duration:.2f}s ({e032_total_duration/60:.2f}m)")
        logger.info(f"  IF003 TOTAL: {if003_duration:.2f}s ({if003_duration/60:.2f}m)")
        logger.info("=" * 60)

        create_or_update_job(job_id, "complete")

    except Exception:
        # Log error timing
        if003_end = datetime.now()
        if if003_start:
            if003_duration = (if003_end - if003_start).total_seconds()

        if job_id:
            create_or_update_job(job_id, "error")
        if logger:
            logger.error("IF003 failed:\n%s", traceback.format_exc())
            if if003_duration:
                logger.error(
                    f"IF003 ERROR END: {if003_end.strftime('%Y-%m-%d %H:%M:%S')} "
                    f"(Duration before error: {if003_duration:.2f}s)"
                )
    finally:
        if output_directory and os.path.isdir(output_directory):
            shutil.rmtree(output_directory)


if __name__ == "__main__":
    main()
