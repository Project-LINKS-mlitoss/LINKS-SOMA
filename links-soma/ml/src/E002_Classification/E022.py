"""
# E022 空き家分類機能
判定用データをインプットとして建物単位で空き家を確率的に判定するための分類用機械学習アルゴリズム（トレーニング済み）を実行する機能。
"""

import json
import os
import pickle
import shutil
import sys
import uuid
import chardet
import zipfile 
import numpy as np
import pandas as pd
import re
import time
import gc

current_dir = os.path.dirname(os.path.abspath(__file__))
async_tasks_path = os.path.join(current_dir, '..', 'async_tasks')
if async_tasks_path not in sys.path:
    sys.path.append(async_tasks_path)

try:
    from utils import *
    from constants import *
except ImportError:
    sys.path.remove(async_tasks_path)
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))
    from async_tasks.utils import *
    from async_tasks.constants import *


# pandasの表示オプションを設定
pd.set_option('display.max_columns', None)

ERROR_CODE=None
ERROR_MSG=None

def detect_encoding(file_path):
    """
    ファイルのエンコーディングを検出する

    Parameters
    ----------
    file_path : str
        検出対象のファイルパス

    Returns
    -------
    encoding : str
        検出されたエンコーディング
    """
    # ファイルの内容を読み込む
    with open(file_path, 'rb') as file:
        raw_data = file.read(100)
    # エンコーディングを検出して返す
    result = chardet.detect(raw_data)
    return result['encoding']

def read_csv(path: str) -> pd.DataFrame:
    """
    CSVファイルを読み込む

    Parameters
    ----------
    path : str
        読み込むファイルのパス

    Returns
    -------
    pd.DataFrame
        読み込まれたデータフレーム、エラー時はNone
    """
    try:
        # ファイルの拡張子を取得し、小文字に変換
        file_extension = os.path.splitext(path)[1].lower()

        # CSVファイル以外の場合はエラーを発生させる
        if file_extension != '.csv':
            set_error(ERROR_20001)
            raise ValueError(f"CSVファイル以外は対応していません: {file_extension}")

        # 複数のエンコーディングを試行
        encodings = ['utf-8-sig']
        for encoding in encodings:
            try:
                # 各エンコーディングでファイルの読み込みを試みる
                return pd.read_csv(path, encoding=encoding)
            except UnicodeDecodeError:
                # デコードエラーが発生した場合、次のエンコーディングを試す
                continue

        # 自動でエンコーディングを検出し、再度読み込みを試みる
        detected_encoding = detect_encoding(path)
        if detected_encoding:
            return pd.read_csv(path, encoding=detected_encoding)

        # 適切なエンコーディングが見つからない場合、エラーを発生させる
        set_error(ERROR_20002)
        raise ValueError(f"適切なエンコーディングが見つかりませんでした: {path}")
    except Exception as e:
        # 何らかの例外が発生した場合、エラーメッセージを表示してNoneを返す
        if ERROR_CODE is None:
            set_error(ERROR_20003, path)
        raise

def extract_zip(zip_file, extract_to):
    """
    zipファイルを解凍し、解凍されたファイルのパスを返す関数。
    
    Parameters:
    -----------
    zip_file : str
        zipファイルのパス。
    extract_to : str
        解凍先のディレクトリ。

    Returns:
    --------
    dict
        解凍された各ファイルのパス。
    """
    with zipfile.ZipFile(zip_file, 'r') as zip_ref:
        zip_ref.extractall(extract_to)
    files = os.listdir(extract_to)
    model_files = [os.path.join(extract_to, f) for f in files if f.endswith(".pkl")]
    return model_files

def load_models(model_zip, job_id):
    """
    ディレクトリ内のpickleファイルから訓練済みモデルを読み込む

    Parameters
    ----------
    directory : str
        モデルファイルが格納されているディレクトリへのパス

    Returns
    -------
    list
        読み込まれた訓練済みモデルのリスト
    """
    # 一時ディレクトリを作成
    if job_id is not None:
        temp_dir = os.path.join(os.getcwd(), str(uuid.uuid4()))
    else:
        temp_dir = os.path.join(os.getcwd(), "temp_files")

    os.makedirs(temp_dir, exist_ok=True)
    model_files = extract_zip(model_zip, temp_dir)
    models = []
    columns = []
    for model_file in model_files:
        # 各モデルファイルを読み込み、リストに追加
        with open(model_file, 'rb') as f:
            if model_file.endswith("_columns.pkl"):
                columns = pickle.load(f)
            else:
                models.append(pickle.load(f))

    gc.collect()
    for _ in range(10):  # Try up to 10 times
        try:
            shutil.rmtree(temp_dir)  # Attempt to delete the directory
            break
        except PermissionError:
            time.sleep(0.5)  # Wait 0.5 seconds before retrying

    return models, columns

def check_features(new_data, required_features, outcome_variable):
    """
    新しいデータに必要な特徴量が含まれているかチェックし、余分な特徴量を削除する

    Parameters
    ----------
    new_data : pd.DataFrame
        新しいデータを含むDataFrame
    required_features : list
        必要な特徴量名のリスト
    outcome_variable : str
        目的変数の名前

    Returns
    -------
    tuple
        (pd.DataFrame, bool, str) - (調整されたDataFrame, 特徴量が一致する場合True, 一致しない場合のエラーメッセージ)
    """
    # 'geometry'列を必要な特徴量リストから除外
    required_features_without_geometry = [feature for feature in required_features if feature != 'geometry']
    all_required_features = required_features_without_geometry + [outcome_variable]

    # 新しいデータの特徴量を取得
    new_data_features = new_data.columns.tolist()
    missing_features = [feature for feature in all_required_features if feature not in new_data_features]
    extra_features = [feature for feature in new_data_features if feature not in all_required_features and feature != 'geometry']

    # 不足している特徴量と余分な特徴量を特定
    if missing_features:
        set_error(ERROR_20004, missing_features)
        error_message = "学習に使用したデータと予測に使用するデータの列が一致しません!\n"
        error_message += f"不足している特徴量: {missing_features}\n"
        return new_data, False, error_message

    if extra_features:
        # 余分な特徴量がある場合、それらを削除
        new_data = new_data.drop(columns=extra_features)
        info_message = f"削除された余分な特徴量: {extra_features}\n"
        return new_data, True, info_message

    return new_data, True, ""

def predict(models, new_data, required_features, threshold):
    """
    訓練済みモデルを使用して予測を行う

    Parameters
    ----------
    models : list
        訓練済みモデルのリスト
    new_data : pd.DataFrame
        新しいデータを含むDataFrame
    required_features : list
        必要な特徴量名のリスト
    threshold : float
        二値分類の閾値

    Returns
    -------
    tuple
        (np.array, np.array) - (二値予測結果, 予測確率)
    """
    # 予測に使用する特徴量を選択
    X_pred = new_data[required_features]

    categorical_features = X_pred.select_dtypes(include=["object"]).columns.tolist()
    for col in categorical_features:
        X_pred[col] = X_pred[col].astype("category")

    # 各モデルの予測確率の平均を計算
    test_preds_proba = np.mean([model.predict_proba(X_pred)[:, 1] for model in models], axis=0)

    # 閾値を適用して二値予測を行う
    test_preds = (test_preds_proba >= threshold).astype(int)

    return test_preds, test_preds_proba

def insert_sqlite(input_data, data_set_result_id):
    """
    指定されたデータをSQLiteデータベースに挿入し、同時にインポート可能な形式でファイルを出力する

    Parameters
    ----------
    input_data : pd.DataFrame
        SQLiteデータベースに挿入し、ファイル出力するデータを含むDataFrame
    Raises
    ------
    Exception
        データベースにデータを挿入またはファイル出力する際にエラーが発生した場合に例外を発生させる
    """

    try:
        # カラム名のマッピング
        mapping_header = {
            'data_set_result_id': 'data_set_result_id',
            '世帯コード': 'household_code',
            '正規化住所': 'normalized_address',
            'reference_date': 'reference_date',
            '世帯人数': 'household_size',
            '最大年齢': 'max_age',
            '最小年齢': 'min_age',
            '水道使用量変化率_suido_residence': 'change_ratio_water_usage',
            '15歳未満人数': 'members_under_15',
            '15歳未満構成比': 'percentage_under_15',
            '15歳以上64歳以下人数': 'members_15_to_64',
            '15歳以上64歳以下構成比': 'percentage_15_to_64',
            '65歳以上人数': 'members_over_65',
            '65歳以上構成比': 'percentage_over_65',
            '男女比': 'gender_ratio',
            '住定期間': 'residence_duration',
            '水道番号_suido_residence': 'water_supply_number',
            '閉栓フラグ_suido_residence': 'water_disconnection_flag',
            '最大使用水量_suido_residence': 'max_water_usage',
            '平均使用水量_suido_residence': 'avg_water_usage',
            '合計使用水量_suido_residence': 'total_water_usage',
            '最小使用水量_suido_residence': 'min_water_usage',
            '名寄せ元情報_suido_residence': 'water_supply_source_info',
            '構造名称_touki_residence': 'structure_name',
            '登記日付_touki_residence': 'registration_date',
            '名寄せ元情報_touki_residence': 'registration_source_info',
            '住所_akiya_result_cleaned': 'vacant_house_address',
            '名寄せ元情報_akiya_result_cleaned': 'vacant_house_source_info',
            '住所_geocoding_cleaned': 'geocoded_address',
            'lat_geocoding_cleaned': 'geocoded_latitude',
            'lon_geocoding_cleaned': 'geocoded_longitude',
            '名寄せ元情報_geocoding_cleaned': 'geocoding_source_info',
            'suido_residence_flag': 'has_water_supply',
            'juki_residence_flag': 'has_juki_registry',
            'touki_residence_flag': 'has_touki_registry',
            'juki_suido_flag': 'has_juki_and_water',
            'akiya_result_cleaned_flag': 'has_vacant_result',
            'juki_suido_touki_flag': 'has_juki_water_property',
            'geocoding_cleaned_flag': 'has_geocoding',
            'juki_suido_touki_akiya_flag': 'has_juki_water_property_vacant',
            'fid': 'fid',
            'gml_id': 'gml_id',
            'class': 'class',
            'geometry_plateau': 'geometry',
            'measuredHeight': 'measuredheight',
            'measuredHeight_uom': 'measuredheight_uom',
            'srcScale': 'src_scale',
            'geometrySrcDesc': 'geometry_src_desc',
            'thematicSrcDesc': 'thematic_src_desc',
            'lod1HeightType': 'lod1_height_type',
            'buildingID': 'building_id',
            'prefecture': 'prefecture',
            'city': 'city',
            'description': 'description',
            'rank': 'rank',
            'depth': 'depth',
            'depth_uom': 'depth_uom',
            'adminType': 'admin_type',
            'scale': 'scale',
            'duration': 'duration',
            'duration_uom': 'duration_uom',
            '建築確認申請の用途': 'building_use',
            '地上階数': 'floors_above_ground',
            '地下階数': 'floors_below_ground',
            'value': 'value',
            'value_uom': 'value_uom',
            'buildingDisasterRiskAttribute|BuildingInlandFloodingRiskAttribute|description': 'inland_flooding_risk_desc',
            'buildingDisasterRiskAttribute|BuildingInlandFloodingRiskAttribute|rank': 'inland_flooding_risk_rank',
            'buildingDisasterRiskAttribute|BuildingInlandFloodingRiskAttribute|depth': 'inland_flooding_risk_depth',
            'buildingDisasterRiskAttribute|BuildingInlandFloodingRiskAttribute|depth_uom': 'inland_flooding_risk_depth_uom',
            'buildingDisasterRiskAttribute|BuildingRiverFloodingRiskAttribute|description': 'river_flooding_risk_desc',
            'buildingDisasterRiskAttribute|BuildingRiverFloodingRiskAttribute|rank': 'river_flooding_risk_rank',
            'buildingDisasterRiskAttribute|BuildingRiverFloodingRiskAttribute|depth': 'river_flooding_risk_depth',
            'buildingDisasterRiskAttribute|BuildingRiverFloodingRiskAttribute|depth_uom': 'river_flooding_risk_depth_uom',
            'buildingDisasterRiskAttribute|BuildingLandSlideRiskAttribute|description': 'landslide_risk_desc',
            '大規模店舗名称': 'large_store_name',
            'appearanceSrcDesc': 'appearance_src_desc',
            'branchID': 'branch_id',
            'residenceID': 'residence_id',
            'test_flg': 'is_test',
            'name': 'name',
            'areaType': 'area_type',
            'pred': 'predicted_label',
            'pred_proba': 'predicted_probability',
            'S_NAME': 'area_group'
        }
        # カラム名を変換
        input_data = input_data.drop('geometry', axis=1, errors='ignore')
        input_data = input_data.rename(columns=mapping_header)
        existing_columns = input_data.columns.tolist()
        mapped_columns = [col for col in mapping_header.values() if col in existing_columns]
        input_data = input_data[mapped_columns]
        input_data = drop_duplicates(input_data, mapped_columns)
        
        # SQLiteにデータを挿入        
        input_data['data_set_result_id'] = data_set_result_id 
        if 'reference_date' not in input_data.columns:
            input_data['reference_date'] = ""
        
        # Find the first valid reference_date that is not NaN, None, or empty
        reference_date_value = input_data.loc[
            input_data['reference_date'].notna() & (input_data['reference_date'] != ''), 
            'reference_date'
        ].iloc[0] if not input_data.loc[
            input_data['reference_date'].notna() & (input_data['reference_date'] != ''), 
                'reference_date'
            ].empty else ''

        # Replace NaN, None, and empty values with the found value (or leave it empty if no valid value is found)
        input_data['reference_date'] = input_data['reference_date'].replace([None, '', pd.NA], reference_date_value)

        if input_data.get("structure_name", None) is not None:
            structure_map = { 0: "RC造", 1: "SRC造", 2:"S造", 3:"その他", 4:"木造" }
            input_data["structure_name"] = input_data["structure_name"].map(structure_map).fillna(input_data["structure_name"])

        is_success = create_data_set_detail_buildings_or_area(input_data)
        if not is_success:
            raise

    except Exception as e:
        # エラー時の処理
        set_error(ERROR_20007)
        raise

def drop_duplicates(df, subset, keep="first"):
        """
        データフレームから重複行を削除する
        Parameters
        ----------
        df : pandas.DataFrame
            重複を削除するデータフレーム
        subset : list
            重複を判定するカラムのリスト
        keep : str, optional
            残す行を指定（'first', 'last', False）
        Returns
        -------
        pandas.DataFrame
            重複が削除されたデータフレーム
        """
        return df.drop_duplicates(subset=subset, keep=keep)
    
def process_and_predict(input_folder, input_file, model_directory, threshold, output_file, required_features, outcome_variable, job_id=None, db_path=None, process=0, data_set_result_id=0):
    """
    入力データを処理し、予測を行い、結果を保存する
    """
    try:
        process = (process/7)
        process_init = process
        # SQLiteの接続処理をエラーハンドリング付きで実行
        sqlite_enabled = False
        if db_path:
            try:
                connect_sqllite(db_path)
                sqlite_enabled = True
            except Exception as e:
                print(f"SQLite接続に失敗しました: {e}. SQLiteを使用せずに続行します。")

        task_id = None
        if sqlite_enabled and job_id:
            task_id = create_or_update_job_task(job_id, progress_percent="0", preprocess_type=None, error_code=None, error_msg=None, result=json.dumps({}))
            create_or_update_job(job_id, process)
            process += process_init
  
        input_path = os.path.join(input_folder, input_file)
        input_data = read_csv(input_path)

        # '世帯コード'の重複を確認し、重複するレコードを削除
        duplicates = input_data['世帯コード'].duplicated(keep=False)  # keep=False で全重複行をTrueとする
        input_data = input_data[~duplicates].reset_index(drop=True)
        condition = (input_data['住定期間'] < 1000)
        input_data = input_data[~condition].reset_index(drop=True)

        # '正規化住所'の重複を確認し、3件以上の重複がある場合、該当するすべてのレコードを削除
        duplicate_counts = input_data['正規化住所'].value_counts()  # 各値の出現回数を取得
        to_remove = duplicate_counts[duplicate_counts >= 2].index  # 3件以上の値を取得
        input_data = input_data[~input_data['正規化住所'].isin(to_remove)].reset_index(drop=True)  # 該当値を除外
        
        if sqlite_enabled and job_id:
            create_or_update_job_task(job_id, progress_percent="20", preprocess_type=None, error_code=None, error_msg=None, result=json.dumps({}), id= task_id)
            create_or_update_job(job_id, process)
            process += process_init
        # 予測用データ（REQUIRED_FEATURES）を準備するためのコピーを作成
        prediction_data = input_data.copy()

        # 'geometry'列を一時的に保存し、予測から除外
        geometry_data = prediction_data['geometry']
        prediction_data = prediction_data.drop(columns=['geometry'], errors='ignore')

        # Get models and columns train
        models, columns = load_models(model_directory, job_id)
        if not columns:
            columns = required_features

        if sqlite_enabled and job_id:
            create_or_update_job_task(job_id, progress_percent="40", preprocess_type=None, error_code=None, error_msg=None, result=json.dumps({}), id= task_id)
            create_or_update_job(job_id, process)
            process += process_init

        features_columns = columns

        # Rename columns
        rename_columns = {}
        for column in prediction_data.columns:
            col = column.split('_')[0]
            if col in features_columns:
                rename_columns[column] = col
        prediction_data.rename(columns=rename_columns, errors='ignore', inplace=True)

        # 閉栓フラグをブール値に変換
        if "閉栓フラグ" in prediction_data.columns:
            try:
                prediction_data["閉栓フラグ"] = prediction_data["閉栓フラグ"].astype("bool")
            except:
                prediction_data["閉栓フラグ"] = prediction_data["閉栓フラグ"].map({"True": True, "False": False}).astype("bool")
        # 登記日付_touki_residenceを日付型に変換
        if "登記日付" in prediction_data.columns:
            prediction_data["登記日付"] = pd.to_datetime(prediction_data["登記日付"], errors='coerce')
            prediction_data["登記日付"] = prediction_data["登記日付"].dt.year

        # 構造名称_touki_residenceをカテゴリ型に変換
        if "構造名称" in prediction_data.columns: 
            fill_value = [ i for i in np.arange(100) if i not in prediction_data["構造名称"].unique()]
            if len(fill_value) == 0:
                fill_value = [ i for i in [999,9999,99999,9999999,9999999] if i not in prediction_data["構造名称"].unique()]
            prediction_data["構造名称"] = prediction_data["構造名称"].fillna(fill_value[0])
            prediction_data["構造名称"] = prediction_data["構造名称"].astype("category")

        if sqlite_enabled and job_id:
            create_or_update_job_task(job_id, progress_percent="50", preprocess_type=None, error_code=None, error_msg=None, result=json.dumps({}), id= task_id)
            create_or_update_job(job_id, process)
            process += process_init
        # 特徴量のチェック
        prediction_data, features_match, message = check_features(prediction_data, features_columns, outcome_variable)
        if not features_match:
            if sqlite_enabled and job_id:
                raise
            return message, None

        # 予測の実行
        test_preds, test_preds_proba = predict(models, prediction_data, features_columns, threshold)
        if sqlite_enabled and job_id:
            create_or_update_job_task(job_id, progress_percent="70", preprocess_type=None, error_code=None, error_msg=None, result=json.dumps({}), id= task_id)
            create_or_update_job(job_id, process)
            process += process_init

        # 元のinput_dataに予測結果を追加
        input_data['predicted_label'] = test_preds
        input_data['predicted_probability'] = test_preds_proba
        input_data['geometry'] = geometry_data
        output_dir = re.sub(r"D902.*", "", output_file)
        os.makedirs(output_dir, exist_ok=True)

        if sqlite_enabled and job_id:
            #insert SQLite
            insert_sqlite(input_data, data_set_result_id)

            create_or_update_job_task(job_id, progress_percent="90", preprocess_type=None, error_code=None, error_msg=None, result=json.dumps({}), id= task_id)
            create_or_update_job(job_id, process)
            process += process_init
        # 試行するエンコーディングのリスト
        encodings = ['utf-8-sig']
        for encoding in encodings:
            try:
                # 各エンコーディングでCSVファイルとして保存を試みる
                input_data.to_csv(output_file, index=False, encoding=encoding)

                if sqlite_enabled and job_id:
                    create_or_update_job_task(job_id, progress_percent="100", preprocess_type=None, error_code=None, error_msg=None, result=json.dumps({}), id= task_id, is_finish=True)
                    create_or_update_job(job_id, process)
                    process += process_init
                return f"予測結果が {output_file} に保存されました", output_file
            except Exception as e:
                # 保存中にエラーが発生した場合、エラーメッセージを表示して次のエンコーディングを試す
                set_error(ERROR_20005, output_file, encoding)
                raise

        return f"{output_file} への予測結果の保存に失敗しました", None
    except Exception as e:
        if ERROR_CODE is None:
            set_error(ERROR_20008)
        if task_id is not None:
            create_or_update_job_task(job_id, progress_percent="", preprocess_type=None, error_code=ERROR_CODE, error_msg=ERROR_MSG, result=json.dumps({}), id= task_id, is_finish=True)
        raise Exception("空き家判定処理中にエラーが発生しました。")

def set_error(value, param_st1=None, param_st2=None):
    global ERROR_CODE
    global ERROR_MSG
    ERROR_CODE = value['code']
    if param_st1 is not None and param_st2 is not None:
        ERROR_MSG = value['message'].format(param_st1=param_st1, param_st2=param_st2)
    elif param_st1 is not None:
        ERROR_MSG = value['message'].format(param_st1=param_st1)
    else:
        ERROR_MSG = value['message']

def normalize_dates(df, column, formats=['%Y/%m/%d', '%d/%m/%Y', '%Y-%m-%d', '%m/%d/%Y', '%Y%m%d']):
    # Initialize the temporary column with NaN values
    temp_column = f'{column}_normalized'
    df[temp_column] = np.nan

    # Try the provided formats on the invalid values
    for fmt in formats:
        mask = df[temp_column].isna()
        df.loc[mask, temp_column] = pd.to_datetime(
            df.loc[mask, column], format=fmt, errors='coerce'
        )

    # Remove the time portion and keep only the date
    df[temp_column] = pd.to_datetime(df[temp_column], errors='coerce')
    df[column] = df[temp_column]
    
    return df.drop(f'{column}_normalized',axis=1)