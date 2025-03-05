
import argparse
import json
import os
import shutil
import sys
import uuid
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

    params = {
        'db_path': json_dict.get('database_path'),
        'output_path': json_dict.get('output_path'),
        'output_format': json_dict.get('output_file_type', 'csv'),
        'target_crs': json_dict.get('output_coordinate', 'EPSG:4326 (WGS84)'),
        'target_unit': json_dict.get('target_unit', 'building'),
        'reference_date': json_dict.get('reference_date', None),
        'data_set_results_id': json_dict.get('data_set_results_id', '')
    }

    random_str = str(uuid.uuid4())
    output_directory = concatenate(params.get('output_path'), random_str)
    job_id = None
    try:
        if not params.get('db_path'):
            raise Exception("Error: database_path field is required")
        
        connect_sqllite(params.get('db_path'))

        job_id = create_or_update_job(None ,"", "export", os.getpid(), 0, args.parameters)
        output_format = params.get('output_format')
        if params.get('output_format') == 'geopackage':
            output_format = 'gpkg'

        file_path = f"{output_directory}.{output_format}"
        
        new_params = {
            'data_set_results_id': params.get('data_set_results_id'),
            'target_unit': params.get('target_unit'),
            'output_format': params.get('output_format'),
            'target_crs': params.get('target_crs'),
            'reference_date': params.get('reference_date'),
            'output_path': file_path
        }
        E033(new_params, job_id, params.get('db_path'))
        create_or_update_job(job_id, "complete")

        create_job_results(job_id, f"{random_str}.{output_format}")
    except Exception as e:
        if job_id:
            create_or_update_job(job_id, "error")
    finally:
        if output_directory and os.path.isdir(output_directory):
            shutil.rmtree(output_directory)

        
if __name__ == "__main__":
    main()