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
    if getattr(sys, 'frozen', False):
        bundle_dir = sys._MEIPASS
        os.environ['GDAL_DATA'] = os.path.join(bundle_dir, 'gdal_data')
        os.environ['PROJ_LIB'] = os.path.join(bundle_dir, 'proj_data')
        if sys.platform == 'darwin':
            lib_path = os.path.join(bundle_dir, '.dylibs')
            if os.path.exists(lib_path):
                os.environ['DYLD_LIBRARY_PATH'] = lib_path


setup_environment()

from constants import *
from utils import (
    create_or_update_job,
    create_or_update_job_task,
    connect_sqllite,
    create_job_results,
    concatenate,
    get_rotating_logger,
)

sys.path.append(
    os.path.abspath(os.path.join(os.path.dirname(__file__), "../"))
)

from src.E002_Classification.E021 import train_and_evaluate as E021  # noqa: E402
from src.preprocessing.import_validation import FeatureTypeMismatchError  # noqa: E402

sys.stdin = open(sys.stdin.fileno(), mode="r", encoding="utf-8")
sys.stdout = open(sys.stdout.fileno(), mode="w", encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description="IF002 空き家判定モデル構築")
    parser.add_argument("--parameters", type=str)
    args = parser.parse_args()

    json_dict = json.loads(args.parameters)
    if isinstance(json_dict, str):
        json_dict = json.loads(json_dict)

    job_id = None
    output_directory = None
    logger = None
    if002_start = None

    try:
        if002_start = datetime.now()
        database_path = json_dict.get("database_path", None)
        job_id = json_dict.get("job_id", None)
        output_path_base = json_dict.get("output_path", ".")

        if not database_path:
            raise Exception("Error: database_path field is required")

        connect_sqllite(database_path)
        job_id = create_or_update_job(
            job_id, "", "ml", os.getpid(), 0,
            json.dumps(json_dict, ensure_ascii=False), True,
        )

        # Setup logging
        # ジョブ単位ディレクトリに分離（ジョブ混在・証跡DLのため）
        logs_dir = concatenate(output_path_base, f"logs/job_{job_id}")
        os.makedirs(logs_dir, exist_ok=True)
        logger = get_rotating_logger(logs_dir, logger_name="IF002")
        logger.info(f"IF002 START: {if002_start.strftime('%Y-%m-%d %H:%M:%S')}")

        # Setup output directory
        random_str = str(uuid.uuid4())
        output_directory = concatenate(output_path_base, random_str)
        os.makedirs(output_directory, exist_ok=True)

        # Extract parameters
        settings = json_dict.get("settings", {})
        advanced = settings.get("advanced", {})

        params = {
            "db_path": database_path,
            "input_path": concatenate(output_path_base, json_dict.get("input_path", "")),
            "output_path": output_directory,
            "explanatory_variables": settings.get("explanatory_variables", []),
            "test_size": advanced.get("test_size", 0.3),
            "n_splits": advanced.get("n_splits", 3),
            "undersample": advanced.get("undersample", False),
            "undersample_ratio": advanced.get("undersample_ratio", 3.0),
            "recall_target": advanced.get("recall_target", advanced.get("threshold", 0.65)),
            "hyperparameter_flag": advanced.get("hyperparameter_flag", False),
            "n_trials": advanced.get("n_trials", 100),
            "lambda_l1": advanced.get("lambda_l1", 0),
            "lambda_l2": advanced.get("lambda_l2", 0),
            "num_leaves": advanced.get("num_leaves", 31),
            "feature_fraction": advanced.get("feature_fraction", 1.0),
            "bagging_fraction": advanced.get("bagging_fraction", 1.0),
            "bagging_freq": advanced.get("bagging_freq", 0),
            "min_data_in_leaf": advanced.get("min_data_in_leaf", 20),
            "citycode_value": json_dict.get("citycode_value", None),
            "targetyear_value": json_dict.get("targetyear_value", None),
            "job_id": job_id,
        }

        logger.info(f"Input: {params['input_path']}")
        logger.info(f"Features: {len(params['explanatory_variables'])} variables")

        # Run training
        E021(**params)

        # Complete
        create_or_update_job(job_id, "complete")
        create_job_results(job_id, f"{random_str}.zip")

        if002_end = datetime.now()
        if002_duration = (if002_end - if002_start).total_seconds()
        logger.info(f"IF002 END: {if002_end.strftime('%Y-%m-%d %H:%M:%S')} "
                     f"(Duration: {if002_duration:.2f}s) ({if002_duration/60:.2f}m)")

    except FeatureTypeMismatchError as e:
        # 説明変数の型不一致(E-201): 不透明な ValueError でなく、どの列が非数値か＋責任分界を記録
        if job_id:
            error_msg = ERROR_FEATURE_TYPE_IF002["message"].replace(
                "{param_st1}", "、".join(e.columns)
            )
            create_or_update_job_task(
                job_id,
                progress_percent="",
                preprocess_type=None,
                error_code=ERROR_FEATURE_TYPE_IF002["code"],
                error_msg=error_msg,
                result=json.dumps({}),
                is_finish=True,
            )
            create_or_update_job(job_id, "error")
        if logger:
            logger.error("IF002 feature type mismatch: %s", e)
    except Exception:
        if002_end = datetime.now()
        if job_id:
            create_or_update_job(job_id, "error")
        if logger:
            logger.error("IF002 failed:\n%s", traceback.format_exc())
            if if002_start:
                duration = (if002_end - if002_start).total_seconds()
                logger.info(f"IF002 ERROR END: Duration before error: {duration:.2f}s")
    finally:
        if output_directory and os.path.isdir(output_directory):
            shutil.rmtree(output_directory)


if __name__ == "__main__":
    import multiprocessing as mp
    mp.freeze_support()
    main()
