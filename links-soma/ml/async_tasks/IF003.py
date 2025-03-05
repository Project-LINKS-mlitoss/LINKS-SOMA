
import argparse
import json
import os
import shutil
import sys
import uuid
from utils import *
from constants import *

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../')))
from src.E002_Classification.E022 import process_and_predict as E022
from src.E003_Summarization.E032 import process_summarization as E032

sys.stdin = open(sys.stdin.fileno(), mode='r', encoding='utf-8')
sys.stdout = open(sys.stdout.fileno(), mode='w', encoding='utf-8')

def main():

    parser = argparse.ArgumentParser(description="E022,E032 空き家分析(推定)")
    parser.add_argument("--parameters", type=str)
    args = parser.parse_args()
 
    json_dict = json.loads(args.parameters)
    if isinstance(json_dict, str):
        json_dict = json.loads(json_dict)

    params = {
        'db_path': json_dict.get('database_path', None),
        'output_path': json_dict.get('output_path', ''),
        'model_path': json_dict.get('model_path', None),
        'threshold': json_dict.get('settings', {}).get('threshold', "0.3"),
        'area_grouping': json_dict.get('area_grouping', {}).get('path', None),
        'area_grouping_columns': json_dict.get('area_grouping', {}).get('columns', {}),
        'normalized_dataset_paths': json_dict.get('normalized_dataset_paths', [])
    }

    random_str = str(uuid.uuid4())
    output_directory = concatenate(params.get('output_path'), random_str)

    job_id = None
    try:
        if not params.get('db_path'):
            raise Exception("Error: database_path field is required")

        connect_sqllite(params.get('db_path'))

        job_id = create_or_update_job(None ,"", "result", os.getpid(), 0, args.parameters)
        file_path = f"{output_directory}/D902.csv"

        model_path = concatenate(params.get('output_path'), params.get('model_path'))
        
        REQUIRED_FEATURES = [
            '世帯人数', '15歳未満人数', '15歳以上64歳以下人数', 
            '65歳以上人数', '15歳未満構成比', '15歳以上64歳以下構成比', '65歳以上構成比', '最大年齢', '最小年齢', '男女比', 
            '住定期間', '水道使用量変化率', '最大使用水量', '平均使用水量', '閉栓フラグ', '構造名称',
            '登記日付', '合計使用水量_suido_residence'
        ]
        OUTCOME_VARIABLE = 'akiya_result_cleaned_flag'
        columns = params.get('area_grouping_columns', None)
        key_column = []
        if columns:
            key_column = [columns.get('area_group_id'), columns.get('area_group_name')]
        else:
            key_column = 'KEY_CODE'
            
        spatial_file = concatenate(params.get('output_path'), params.get('area_grouping'))
        process = 0
        total = len(params.get('normalized_dataset_paths'))
        data_set_result_id = create_data_set_results()
        for item in params.get('normalized_dataset_paths'):
            normalized = concatenate(params.get('output_path'), item)
            input_folder = os.path.dirname(normalized)
            input_file = os.path.basename(normalized)
            process = process + (100 / total)

            E022(
                input_folder, 
                input_file,
                model_path,
                float(params.get('threshold')),
                file_path,
                REQUIRED_FEATURES,
                OUTCOME_VARIABLE,
                str(job_id),
                params.get('db_path'),
                (process/2),
                data_set_result_id
            )
            create_or_update_job(job_id, (process/2))

            E032(
                file_path,
                spatial_file,
                output_directory,
                key_column,
                str(job_id),
                params.get('db_path'),
                process,
                data_set_result_id
            )
            create_or_update_job(job_id, process)
        
        create_or_update_job(job_id, "complete")

    except Exception as e:
        if job_id:
            create_or_update_job(job_id, "error")
    finally:
        if output_directory and os.path.isdir(output_directory):
            shutil.rmtree(output_directory)        
        
if __name__ == "__main__":
    main()