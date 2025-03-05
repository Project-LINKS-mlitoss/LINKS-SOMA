
import argparse
import json
import os
import shutil
import sys
import uuid
from utils import *
from constants import *

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../')))
from src.E001_DataMatching.E012 import process_data as E012
from src.E001_DataMatching.E013 import process_all_data as E013
from src.E001_DataMatching.E014 import embedding_address as E014
from src.E001_DataMatching.E016 import process_data as E016

sys.stdin = open(sys.stdin.fileno(), mode='r', encoding='utf-8')
sys.stdout = open(sys.stdout.fileno(), mode='w', encoding='utf-8')

def main():

    parser = argparse.ArgumentParser(description="E001 データ処理システム")
    parser.add_argument("--parameters", type=str)
    args = parser.parse_args()
 
    json_dict = json.loads(args.parameters)
    if isinstance(json_dict, str):
        json_dict = json.loads(json_dict)

    params = {
        'db_path': json_dict.get('database_path', None),
        'output_path': json_dict.get('output_path', '.'),
        'suido_status': json_dict.get('data', {}).get('water_status', {}).get('path', None),
        'suido_status_columns': json_dict.get('data', {}).get('water_status', {}).get('columns', {}),
        'suido_use': json_dict.get('data', {}).get('water_usage', {}).get('path', None),
        'suido_use_columns': json_dict.get('data', {}).get('water_usage', {}).get('columns', {}),
        'juki': json_dict.get('data', {}).get('resident_registry', {}).get('path', None),
        'juki_columns': json_dict.get('data', {}).get('resident_registry', {}).get('columns', {}),
        'touki': json_dict.get('data', {}).get('land_registry', {}).get('path', None),
        'touki_columns': json_dict.get('data', {}).get('land_registry', {}).get('columns', {}),
        'akiya_result': json_dict.get('data', {}).get('vacant_house', {}).get('path', None),
        'akiya_result_columns': json_dict.get('data', {}).get('vacant_house', {}).get('columns', {}),
        'geocoding': json_dict.get('data', {}).get('geocoding', {}).get('path', None),
        'geocoding_columns': json_dict.get('data', {}).get('geocoding', {}).get('columns', {}),
        'census': json_dict.get('data', {}).get('census', {}).get('path', None),
        'building_polygon': json_dict.get('data', {}).get('building_polygon', {}).get('path', None),
        'building_polygon_column': json_dict.get('data', {}).get('building_polygon', {}).get('columns', {}).get('geometry', None),
        'building_polygon_file_type': json_dict.get('data', {}).get('building_polygon', {}).get('input_file_type', None),
        'building_polygon_data_type': json_dict.get('data', {}).get('building_polygon', {}).get('data_type', 'plateau'),
        'urban_planning': json_dict.get('data', {}).get('urban_planning', {}).get('path', None),
        'n_gram_size': json_dict.get('settings', {}).get('advanced', {}).get('n_gram_size', "2"),
        'similarity_threshold': json_dict.get('settings', {}).get('advanced', {}).get('similarity_threshold', "0.95"),
        'joining_method': json_dict.get('settings', {}).get('advanced', {}).get('joining_method', ""),
        'reference_date': json_dict.get('settings', {}).get('reference_date', ""),
        'reference_data': json_dict.get('settings', {}).get('reference_data', "water_status")
    }

    columns = {
        "suido_status": {
            "suido_number": params.get("suido_status_columns", {}).get("water_supply_number"),
            "usage_status": params.get("suido_status_columns", {}).get("water_disconnection_flag"),
            "suido_status_address": params.get("suido_status_columns", {}).get("address"),
            "usage_start_date": params.get("suido_status_columns", {}).get("water_connection_date"),
            "usage_end_date": params.get("suido_status_columns", {}).get("water_disconnection_date"),
        },
        "suido_use": {
            "suido_number": params.get("suido_use_columns", {}).get("water_supply_number"),
            "meter_reading_date": params.get("suido_use_columns", {}).get("water_recorded_date"),
            "suido_usage": params.get("suido_use_columns", {}).get("water_usage"),
        },
        "juki": {
            "setai_code": params.get("juki_columns", {}).get("household_code"),
            "juki_address": params.get("juki_columns", {}).get("address"),
            "birth": params.get("juki_columns", {}).get("birth_date"),
            "gender": params.get("juki_columns", {}).get("gender"),
            "move_date": params.get("juki_columns", {}).get("resident_date"),
        },
        "touki": {
            "touki_address": params.get("touki_columns", {}).get("address"),
            "structure":  params.get("touki_columns", {}).get("structure_name"),
            "registration_date":  params.get("touki_columns", {}).get("registration_date")
        },
        "akiya_result": {
            "akiya_result_address": params.get("akiya_result_columns", {}).get("address", "住所")
        },
        "geocoding": {
            "geocoding_address": params.get("geocoding_columns", {}).get("address", "住所"),
            "geocoding_lat": params.get("geocoding_columns", {}).get("latitude", "lat"),
            "geocoding_lon": params.get("geocoding_columns", {}).get("longitude", "lon"),
        }
    }


    random_str = str(uuid.uuid4())
    output_directory = concatenate(params.get('output_path'), random_str)
    join_option = "交差結合"
    if params.get('joining_method') == 'nearest':
        join_option = '最近傍結合'
    search_period = "1"

    job_id = None
    try:
        if not params.get('db_path'):
            raise Exception("Error: database_path field is required")

        connect_sqllite(params.get('db_path'))
        job_id = create_or_update_job(None ,"", "preprocess", os.getpid(), 0, args.parameters)
        
        suido_use_file = None
        suido_status_file = None
        juki_file = None
        tatemono_file = None
        input_source = []
        input_source_jp = {
            'juki': '住基',
            'suido_status': '水道',
            'touki': '建物情報',
            'akiya_result': '空き家調査',
            'geocoding': 'ジオコーディングデータ',
        }

        merge_base = 'suido_residence'
        main_data_type = 'suido_status'
        main_csv = f"{output_directory}/suido_residence.csv"
        if params.get('reference_data') == 'resident_registry':
            merge_base = 'juki_residence'
            
        if params.get('juki'):
            main_data_type = 'juki'
            main_csv = f"{output_directory}/juki_residence.csv"

        input_files = {
            "akiya_result": concatenate(params.get('output_path'), params.get('akiya_result')),
            "geocoding": concatenate(params.get('output_path'), params.get('geocoding')),
            "building_polygon": params.get('building_polygon')
        }
            
        if params.get('suido_status'):
            input_files['suido_status'] = concatenate(params.get('output_path'), params.get('suido_status'))
            suido_status_file = f"{output_directory}/suido_status_cleaned.csv"
            if main_data_type == 'juki':
                input_source.append('suido_status')
                
        if params.get('suido_use'):
            input_files['suido_use'] = concatenate(params.get('output_path'), params.get('suido_use'))
            suido_use_file = f"{output_directory}/suido_use_cleaned.csv"
            
        if params.get('juki'):
            input_files['juki'] = concatenate(params.get('output_path'), params.get('juki'))
            juki_file = f"{output_directory}/juki_cleaned.csv"
            if main_data_type == 'suido_status':
                input_source.append('juki')
      
        if params.get('touki'):
            input_files['touki'] = concatenate(params.get('output_path'), params.get('touki'))
            tatemono_file = f"{output_directory}/touki_cleaned.csv"
            input_source.append('touki')
            
        input_source.extend(["akiya_result", "geocoding"])
        
        E012(input_files, output_directory, main_data_type, job_id, json.dumps(columns), params.get('db_path'))
        create_or_update_job(job_id, "25")

        E013(
            suido_use_file,
            suido_status_file,
            juki_file,
            tatemono_file,
            params.get("reference_date"),
            search_period,
            output_directory,
            job_id,
            params.get('db_path')
        )
        progress_percent_job = 50
        create_or_update_job(job_id, progress_percent_job)
        progress_percent = 25 / len(input_source)
        for item in input_source:
            output_e014 = f"{output_directory}/matched_data.csv"
            sub_csv = f"{output_directory}/{item}_cleaned.csv"
            if item == 'suido_status':
                sub_csv = f"{output_directory}/suido_residence.csv"
            if item in ['juki', 'touki']:
                sub_csv = f"{output_directory}/{item}_residence.csv"
            E014(
                main_csv,
                sub_csv,
                "正規化住所",
                "正規化住所",
                merge_base,
                output_e014,
                int(params.get('n_gram_size')),
                float(params.get('similarity_threshold')),
                1000,
                str(job_id),
                params.get('db_path'),
                [input_source_jp[main_data_type], input_source_jp[item]],
                progress_percent_job,
                progress_percent
            )
            main_csv = output_e014
            progress_percent_job = progress_percent_job + progress_percent
            create_or_update_job(job_id, progress_percent_job)

        option = 0 if join_option == "交差結合" else 1
        output_path_e016 = output_directory.replace(f"/{random_str}", "")
        output_path_e016 = f"{output_path_e016}/{random_str}.csv"

        gpkg_path = concatenate(params.get('output_path'), params.get("census", None))
        
        tatemono_path = concatenate(params.get('output_path'), params.get('building_polygon'))

        E016(
            tatemono_path,
            main_csv,
            gpkg_path,
            "愛知県",
            "豊田市",
            option,
            "csv",
            output_path_e016,
            job_id,
            params.get('db_path'),
            params.get('building_polygon_column', 'geometry'),
            ["テキストマッチング結果", "建物ポリゴン"],
            params.get('building_polygon_file_type'),
            params.get('building_polygon_data_type')
        )

        create_or_update_job(job_id, "complete")
        create_job_results(job_id, f"{random_str}.csv")

    except Exception as e:
        if job_id:
            create_or_update_job(job_id, "error")
    finally:
        if output_directory and os.path.isdir(output_directory):
            shutil.rmtree(output_directory)

        
if __name__ == "__main__":
    main()