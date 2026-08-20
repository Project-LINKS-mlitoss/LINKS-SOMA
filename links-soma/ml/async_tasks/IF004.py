import argparse
import json
import os
import shutil
import sys
import traceback
import uuid
from datetime import datetime
from utils import *
from constants import *

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../')))
from src.E003_Summarization.E033 import processing as E033

sys.stdin = open(sys.stdin.fileno(), mode='r', encoding='utf-8')
sys.stdout = open(sys.stdout.fileno(), mode='w', encoding='utf-8')

def main():

    parser = argparse.ArgumentParser(description="IF004 データ出力")
    parser.add_argument("--parameters", type=str)
    args = parser.parse_args()
 
    json_dict = json.loads(args.parameters)
    if isinstance(json_dict, str):
        json_dict = json.loads(json_dict)

    job_id = None
    output_directory = None
    logger = None
    if004_start = None

    try:
        if004_start = datetime.now()

        database_path = json_dict.get('database_path', None)
        job_id = json_dict.get('job_id', None)
        if not database_path:
            raise Exception("Error: database_path field is required")

        connect_sqllite(database_path)
        job_id = create_or_update_job(
            job_id,
            "",
            "export",
            os.getpid(),
            0,
            json.dumps(json_dict, ensure_ascii=False),
            True
        )

        params = {
            'db_path': database_path,
            'output_path': json_dict.get('output_path'),
            'output_format': json_dict.get('output_file_type', 'csv'),
            'target_crs': json_dict.get('output_coordinate', 'EPSG:4326 (WGS84)'),
            'target_unit': json_dict.get('target_unit', 'building'),
            'data_set_results_id': json_dict.get('data_set_results_id', None),
            'view_id': json_dict.get('view_id', None),
            'reference_date': json_dict.get('reference_date', None),
        }

        # Setup logger
        # ジョブ単位ディレクトリに分離（ジョブ混在・証跡DLのため）
        logs_dir = concatenate(params.get('output_path'), f"logs/job_{job_id}")
        os.makedirs(logs_dir, exist_ok=True)
        logger = get_rotating_logger(logs_dir, logger_name="IF004")

        logger.info(f"IF004 START: {if004_start.strftime('%Y-%m-%d %H:%M:%S')}")

        random_str = str(uuid.uuid4())
        output_directory = concatenate(params.get('output_path'), random_str)

        output_format = params.get('output_format')
        if params.get('output_format') == 'geopackage':
            output_format = 'gpkg'

        file_path = f"{output_directory}.{output_format}"
        
        new_params = {
            'data_set_results_id': params.get('data_set_results_id'),
            'target_unit': params.get('target_unit'),
            'output_format': params.get('output_format'),
            'view_id': params.get('view_id'),
            'target_crs': params.get('target_crs'),
            'reference_date': params.get('reference_date'),
            'output_path': file_path
        }

        # E033 timing
        e033_start = datetime.now()
        logger.info(f"E033 START: {e033_start.strftime('%Y-%m-%d %H:%M:%S')}")

        E033(new_params, job_id, params.get('db_path'))

        e033_end = datetime.now()
        e033_duration = (e033_end - e033_start).total_seconds()
        logger.info(f"E033 END: {e033_end.strftime('%Y-%m-%d %H:%M:%S')} (Duration: {e033_duration:.2f}s)")

        create_or_update_job(job_id, "complete")
        create_job_results(job_id, f"{random_str}.{output_format}")

        # IF004 END and summary
        if004_end = datetime.now()
        if004_duration = (if004_end - if004_start).total_seconds()
        logger.info(f"IF004 END: {if004_end.strftime('%Y-%m-%d %H:%M:%S')} (Total Duration: {if004_duration:.2f}s)")

        logger.info("=" * 60)
        logger.info("TIMING SUMMARY:")
        logger.info(f"  E033: {e033_duration:.2f}s ({e033_duration/60:.2f}m)")
        logger.info(f"  IF004 TOTAL: {if004_duration:.2f}s ({if004_duration/60:.2f}m)")
        logger.info("=" * 60)

    except Exception:
        # Log error timing
        if004_end = datetime.now()
        if if004_start:
            if004_duration = (if004_end - if004_start).total_seconds()

        if job_id:
            create_or_update_job(job_id, "error")
        if logger:
            logger.error("IF004 failed:\n%s", traceback.format_exc())
            if if004_duration:
                logger.error(
                    f"IF004 ERROR END: {if004_end.strftime('%Y-%m-%d %H:%M:%S')} "
                    f"(Duration before error: {if004_duration:.2f}s)"
                )
    finally:
        if output_directory and os.path.isdir(output_directory):
            shutil.rmtree(output_directory)

        
if __name__ == "__main__":
    main()