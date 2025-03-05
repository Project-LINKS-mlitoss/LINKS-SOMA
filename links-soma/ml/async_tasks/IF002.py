
import argparse
import json
import os
import shutil
import sys
import uuid
from utils import *
from constants import *
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../')))
from src.E002_Classification.E021 import train_and_evaluate as E021

sys.stdin = open(sys.stdin.fileno(), mode='r', encoding='utf-8')
sys.stdout = open(sys.stdout.fileno(), mode='w', encoding='utf-8')

def main():

    parser = argparse.ArgumentParser(description="E021 空き家判定モデル構築")
    parser.add_argument("--parameters", type=str)
    args = parser.parse_args()
 
    json_dict = json.loads(args.parameters)
    if isinstance(json_dict, str):
        json_dict = json.loads(json_dict)

    params = {
        'db_path': json_dict.get("database_path", None),
        'input_path': json_dict.get('input_path', None),
        'output_path': json_dict.get('output_path', '.'),
        'explanatory_variables': json_dict.get('settings', {}).get('explanatory_variables', []),
        'test_size': json_dict.get('settings', {}).get('advanced', {}).get('test_size', 0.3),
        'n_splits': json_dict.get('settings', {}).get('advanced', {}).get('n_splits', 3),
        'undersample': json_dict.get('settings', {}).get('advanced', {}).get('undersample', 1),
        'undersample_ratio': json_dict.get('settings', {}).get('advanced', {}).get('undersample_ratio', 3.0),
        'threshold': json_dict.get('settings', {}).get('advanced', {}).get('threshold', 0.3),
        'hyperparameter_flag': json_dict.get('settings', {}).get('advanced', {}).get('hyperparameter_flag', 1),
        'n_trials': json_dict.get('settings', {}).get('advanced', {}).get('n_trials', 100),
        'lambda_l1': json_dict.get('settings', {}).get('advanced', {}).get('lambda_l1', 0),
        'lambda_l2': json_dict.get('settings', {}).get('advanced', {}).get('lambda_l2', 0),
        'num_leaves': json_dict.get('settings', {}).get('advanced', {}).get('num_leaves', 31),
        'feature_fraction': json_dict.get('settings', {}).get('advanced', {}).get('feature_fraction', 1.0),
        'bagging_fraction': json_dict.get('settings', {}).get('advanced', {}).get('bagging_fraction', 1.0),
        'bagging_freq': json_dict.get('settings', {}).get('advanced', {}).get('bagging_freq', 0),
        'min_data_in_leaf': json_dict.get('settings', {}).get('advanced', {}).get('min_data_in_leaf', 20),
        'citycode_value': json_dict.get('citycode_value', None),
        'targetyear_value': json_dict.get('targetyear_value', None)
    }

    random_str = str(uuid.uuid4())
    output_directory = concatenate(params.get('output_path'), random_str)
    
    job_id = None
    try:
        if not params.get('db_path'):
            raise Exception("Error: database_path field is required")

        connect_sqllite(params.get('db_path'))
        job_id = create_or_update_job(None ,"", "ml", os.getpid(), 0, args.parameters)
        params['input_path'] = concatenate(params.get('output_path'), json_dict.get('input_path'))
        params['output_path'] = output_directory
        params['job_id'] = job_id
        
        E021(*params.values())
        create_or_update_job(job_id, "complete")
        create_job_results(job_id, f"{random_str}.zip")
    except Exception as e:
        if job_id:
            create_or_update_job(job_id, "error")
    finally:
        if output_directory and os.path.isdir(output_directory):
            shutil.rmtree(output_directory)

        
if __name__ == "__main__":
    main()