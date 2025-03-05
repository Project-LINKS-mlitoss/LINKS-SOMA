"""
# E021 空き家学習機能
判定用データをインプットとして建物単位で空き家を確率的に判定するための分類用機械学習アルゴリズムにてトレーニングモデルを作成し、分類精度を表示する機能。
""" 

import ast
import os
import pickle
import sys
import time
import uuid
import warnings
import json
from itertools import chain

import chardet
import numpy as np
import pandas as pd
import lightgbm as lgb
import optuna
import zipfile
from concurrent.futures import ThreadPoolExecutor

from memory_profiler import profile
from sklearn.metrics import accuracy_score, confusion_matrix, precision_score, recall_score, f1_score
from sklearn.model_selection import KFold, train_test_split
from imblearn.over_sampling import SMOTE

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

# Set pandas display options
pd.set_option('display.max_columns', None)

# Define constants
CONSTANTS = {
    'model_name' : 'LightGBM',
    'explanatory_variables': [
        'gml_id', '世帯コード', '世帯人数', '15歳未満人数', '15歳以上64歳以下人数', 
        '65歳以上人数', '15歳未満構成比', '15歳以上64歳以下構成比', '65歳以上構成比', '最大年齢', '最小年齢', '男女比', 
        '住定期間', '水道番号_suido_residence', '水道使用量変化率_suido_residence', '最大使用水量_suido_residence', 
        '平均使用水量_suido_residence', '閉栓フラグ_suido_residence', '構造名称_touki_residence', 
        '登記日付_touki_residence', 'akiya_result_cleaned_flag', 'matched_data_flag'
    ],
    'outcome_variable': 'akiya_result_cleaned_flag'
    }

ERROR_CODE = None
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

def read_data(path: str, **kwargs) -> pd.DataFrame:
    """
    CSVファイルを読み込む
    
    Parameters
    ----------
    path : str
        読み込むファイルのパス
    **kwargs : dict
        pandas.read_csv に渡す追加のキーワード引数
    
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
            set_error(ERROR_10001)
            raise ValueError(f"CSVファイル以外は対応していません: {file_extension}")
        
        # 複数のエンコーディングを試行                
        encodings = ['utf-8-sig']
        for encoding in encodings:
            try:
                # 各エンコーディングでファイルの読み込みを試みる
                return pd.read_csv(path, encoding=encoding, **kwargs)
            except UnicodeDecodeError:
                # デコードエラーが発生した場合、次のエンコーディングを試す
                continue
        
        # 自動でエンコーディングを検出し、再度読み込みを試みる
        detected_encoding = detect_encoding(path)
        if detected_encoding:
            return pd.read_csv(path, encoding=detected_encoding, **kwargs)
        
        # 適切なエンコーディングが見つからない場合、エラーを発生させる
        set_error(ERROR_10002)
        raise ValueError(f"適切なエンコーディングが見つかりませんでした: {path}")
    except Exception as e:
        # 何らかの例外が発生した場合、エラーメッセージを表示してNoneを返す
        if ERROR_CODE is None:
            set_error(ERROR_10003)
        raise

def prepare_learning_data(df, explanatory_variables, explanatory_variables_dict):
    """
    学習データを準備する
    
    Parameters
    ----------
    df : DataFrame
        入力データフレーム

    Returns
    -------
    learning_data : DataFrame
        準備された学習データ
    """
    # 閉栓フラグをブール値に変換

    if explanatory_variables_dict.get("閉栓フラグ") in df.columns:
        try:
            df[explanatory_variables_dict["閉栓フラグ"]] = df[explanatory_variables_dict["閉栓フラグ"]].astype("bool")
        except:
            df[explanatory_variables_dict["閉栓フラグ"]] = df[explanatory_variables_dict["閉栓フラグ"]].map({"True": True, "False": False}).astype("bool")
    # 登記日付_touki_residenceを日付型に変換
    if explanatory_variables_dict.get("登記日付") in df.columns:
        df[explanatory_variables_dict["登記日付"]] = pd.to_datetime(df[explanatory_variables_dict["登記日付"]], errors='coerce')
        df[explanatory_variables_dict["登記日付"]] = df[explanatory_variables_dict["登記日付"]].dt.year

    # 構造名称_touki_residenceをカテゴリ型に変換
    if explanatory_variables_dict.get("構造名称") in df.columns: 
        fill_value = [ i for i in np.arange(100) if i not in df[explanatory_variables_dict["構造名称"]].unique()]
        if len(fill_value) == 0:
            fill_value = [ i for i in [999,9999,99999,9999999,9999999] if i not in df[explanatory_variables_dict["構造名称"]].unique()]
        df[explanatory_variables_dict["構造名称"]] = df[explanatory_variables_dict["構造名称"]].fillna(fill_value[0])
        df[explanatory_variables_dict["構造名称"]] = df[explanatory_variables_dict["構造名称"]].astype("category")

    # 将来のマージのために識別子列をデータフレームに追加
    if "gml_id" not in df.columns:
        df["gml_id"] = df.index 

    # 特定の列を選択し、行をフィルタリングして学習データを準備
    learning_data = df.copy()

    if len(explanatory_variables) > 0:
        if isinstance(explanatory_variables, str):
            try:
                explanatory_variables = ast.literal_eval(explanatory_variables)
            except (ValueError, SyntaxError) as e:
                set_error(ERROR_10007)
                raise

        merged_variables = list(dict.fromkeys(chain(CONSTANTS['explanatory_variables'], explanatory_variables)))
        # `merged_variables` の中で `learning_data` に存在するカラムのみを選択
        valid_columns = [col for col in merged_variables if col in learning_data.columns]

        # 存在するカラムのみを使用してデータをフィルタリング
        learning_data = learning_data[valid_columns]

    else:
        learning_data = learning_data[CONSTANTS['explanatory_variables']]

    if 'matched_data_flag' in learning_data.columns:
        learning_data = learning_data[learning_data['matched_data_flag'] == 1]
        learning_data.drop(columns=['matched_data_flag'], inplace=True)

    learning_data.reset_index(drop=True, inplace=True)
    return learning_data

### 1. 学習用データとテスト用データに分割 
# - 入力：「D901　家屋単位GISデータ【CSV】」
# - 出力：学習用データ（70%）、テスト用データ（30%）

def split_data(df, params, explanatory_variables_dict):
    """
    データを学習用とテスト用に分割する

    Parameters
    ----------
    df : DataFrame
        全データセットを含むデータフレーム
    params : dict
        各種パラメータを含む辞書 

    Returns
    -------
    train_df : DataFrame
        学習データを含むデータフレーム
    test_df : DataFrame
        テストデータを含むデータフレーム
    """
    # 説明変数（X）と目的変数（y）を分離
    X = df.drop(columns = [CONSTANTS['outcome_variable']])
    X_basic_colname = {v: k for k, v in explanatory_variables_dict.items()}
    X = X.rename(columns=X_basic_colname)
    y = df[CONSTANTS['outcome_variable']]
    
    # データを学習用とテスト用に分割
    # stratify = y で目的変数の分布を維持
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=params['test_size'], stratify = y, random_state = 42)
    # アンダーサンプリングが有効な場合、学習セットを調整
    if params['undersample']:
        if y.value_counts(normalize=True)[1] < 0.02:
            X_train[CONSTANTS['outcome_variable']] = y_train
            for suido_stats_col in [ "最大使用水量", "最小使用水量", "平均使用水量"]:
                if suido_stats_col in X_train.columns:
                    X_train = X_train.loc[X_train[suido_stats_col].notnull()].reset_index(drop=True)
                    y_train = X_train[CONSTANTS['outcome_variable']]
                    X_train = X_train.drop(CONSTANTS['outcome_variable'], axis=1).reset_index(drop=True)
                    break
            
            # Nullのラベルを平均もしくは最頻値（カテゴリ）で埋める
            for col in X_train.columns:
                if X_train[col].isnull().any():
                    if X_train[col].dtypes == 'category':
                        fill_value = X_train[col].mode()[0]
                    else:
                        fill_value = X_train[col].mean()
                    X_train[col] = X_train[col].fillna(fill_value)

            # アップサンプリング
            oversample = SMOTE(random_state=101, sampling_strategy=params['undersample_ratio']/10, k_neighbors=4)
            X_train, y_train = oversample.fit_resample(X_train, y_train)

        else:
            # 正例（空き家）の数をカウント
            vacant_count = y_train.value_counts()[1]

            # アンダーサンプル比に基づいて負例（非空き家）の数を決定
            non_vacant_count = int(vacant_count * params['undersample_ratio'])
            
            # 正例（空き家）と負例（非空き家）のインデックスを取得
            vacant_indices = y_train[y_train == 1].index
            non_vacant_indices = y_train[y_train == 0].index
            
            # non_vacant_countが利用可能な非空き家インデックスを超えないようにする
            non_vacant_count = min(non_vacant_count, len(non_vacant_indices))

            # 必要な数の負例をランダムにサンプリング
            sampled_non_vacant_indices = non_vacant_indices.to_series().sample(non_vacant_count, random_state=42).index
            
            # 正例と負例のインデックスを組み合わせる
            new_indices = vacant_indices.union(sampled_non_vacant_indices)
            
            # 学習データを新しいインデックスでサブセット化
            X_train = X_train.loc[new_indices]
            y_train = y_train.loc[new_indices]
    
    # 説明変数と目的変数を学習用とテスト用のデータフレームに再結合
    train_df = X_train.copy()
    train_df[CONSTANTS['outcome_variable']] = y_train
    test_df = X_test.copy()
    test_df[CONSTANTS['outcome_variable']] = y_test

    # 学習用とテスト用のデータフレームを返す
    return train_df, test_df

### 2. 機械学習モデル（アルゴリズム：LightGBM）の構築
# - 入力：「1. 学習用データとテスト用データに分割」で作成した学習用データ（70%）
# - 出力：「D014　学習済みモデル【pkl】」

@profile
def train_lgb_with_optuna(train_df, params, citycode_value, targetyear_value, output_path, job_id=None, task_id=None, sqlite_enabled=False):
    """
    K-Fold交差検証とOptunaによるハイパーパラメータチューニングを用いてLightGBMモデルを学習する
   
    Parameters
    ----------
    train_df : DataFrame
        学習データを含むデータフレーム
    params : dict
        各種パラメータを含む辞書

    Returns
    -------
    lgbm_models : list
        学習済みのLightGBMモデルのリスト
    feature_importances_dict_train : dict
        学習データの特徴量重要度を含む辞書
    """

    # 学習データを特徴量（X）と目的変数（y）に分割
    id_train = train_df.copy()
    
    # 削除したいカラムをリストに指定
    columns_to_drop = [CONSTANTS['outcome_variable'], 'gml_id', 'gml',  '世帯コード', '水道番号']

    # 指定されたカラムのうち、`train_df` に存在するものだけを選択
    columns_to_drop = [col for col in columns_to_drop if col in train_df.columns]

    # 存在するカラムのみを削除
    X_train = train_df.drop(columns=columns_to_drop)

    y_train = train_df[CONSTANTS['outcome_variable']]
    
    # クラスの重みを調整するためのポジティブ/ネガティブサンプルの比率を計算
    pos_weight = (y_train == 0).sum() / (y_train == 1).sum()

    # K-Fold交差検証の初期化
    kf = KFold(n_splits=params['n_splits'], shuffle=True, random_state=42)
    categorical_features = X_train.select_dtypes(include=["object"]).columns.tolist()
    for col in categorical_features:
        X_train[col] = X_train[col].astype("category")

    # ハイパーパラメータ最適化のためのOptuna目的関数を定義
    def objective(trial):
        with warnings.catch_warnings():
            warnings.filterwarnings("ignore", category=FutureWarning)
            
            lgb_params = {
                'objective': 'binary',
                'lambda_l1': trial.suggest_loguniform('lambda_l1', 1e-10, 10.0),
                'lambda_l2': trial.suggest_loguniform('lambda_l2', 1e-10, 10.0),
                'num_leaves': trial.suggest_int('num_leaves', 2, 256),
                'feature_fraction': trial.suggest_uniform('feature_fraction', 0.5, 1.0),
                'bagging_fraction': trial.suggest_uniform('bagging_fraction', 0.5, 1.0),
                'bagging_freq': trial.suggest_int('bagging_freq', 0, 10),
                'min_data_in_leaf': trial.suggest_int('min_data_in_leaf', 1, 50),
                'random_state': 42,
                'verbosity': -1,
                'scale_pos_weight': pos_weight
            }
            
        # これらのパラメータで交差検証を実行
        accuracy_list = []
        for fold, (train_index, val_index) in enumerate(kf.split(X_train)):
            # このフォールドのデータを学習用と検証用に分割
            X_tr, X_val = X_train.iloc[train_index], X_train.iloc[val_index]
            y_tr, y_val = y_train.iloc[train_index], y_train.iloc[val_index]
                
            # モデルを学習
            model = lgb.LGBMClassifier(**lgb_params)
            model.fit(X_tr, y_tr, eval_set=[(X_val, y_val)], categorical_feature=categorical_features)
                
            # 検証セットで予測を行う
            preds = model.predict(X_val)
            # 精度を計算
            accuracy = accuracy_score(y_val, preds)
            accuracy_list.append(accuracy)
            
        # 全フォールドの平均精度を返す
        return np.mean(accuracy_list)
    
    # 初期の最良パラメータを設定
    best_params = {
        'random_state': 42,
        'objective': 'binary',
        'verbose': -1,
        'scale_pos_weight': pos_weight
    }
     
    # ハイパーパラメータチューニングが有効な場合、Optuna最適化を実行
    if params['hyperparameter_flag']:
        study = optuna.create_study(direction='maximize')
        study.optimize(objective, n_trials=params['n_trials'])
        # 最良のハイパーパラメータを取得
        best_params = study.best_params
    else:
        # デフォルトのハイパーパラメータを使用
        best_params = ({
            'lambda_l1': params['lambda_l1'],
            'lambda_l2': params['lambda_l2'],
            'num_leaves': params['num_leaves'],
            'feature_fraction': params['feature_fraction'],
            'bagging_fraction': params['bagging_fraction'],
            'bagging_freq': params['bagging_freq'],
            'min_data_in_leaf': params['min_data_in_leaf'],
        })
    if sqlite_enabled and job_id:
        create_or_update_job_task(job_id, progress_percent="40", preprocess_type=None, error_code=None, error_msg=None, result=json.dumps({}), id= task_id)
        create_or_update_job(job_id , "40")
    
    # 学習済みモデルを格納するリスト
    lgbm_models = []
    # 特徴量重要度を格納する空のデータフレームを作成
    df_feature_importances = pd.DataFrame()
    
    # K-Fold交差検証を実行
    for fold, (train_index, val_index) in enumerate(kf.split(X_train)):
        # このフォールドのデータを学習用と検証用に分割
        id_tr, id_val = id_train.iloc[train_index], id_train.iloc[val_index]
        X_tr, X_val = X_train.iloc[train_index], X_train.iloc[val_index]
        y_tr, y_val = y_train.iloc[train_index], y_train.iloc[val_index]
        
        # 最良のハイパーパラメータでモデルを学習
        model = lgb.LGBMClassifier(**best_params)
        model.fit(X_tr, y_tr, eval_set=[(X_val, y_val)], categorical_feature=categorical_features)

        # 特徴量重要度を計算
        feature_importances = pd.DataFrame({
            "feature": X_tr.columns,
            "importance": model.feature_importances_,
            "fold": fold
        })

        # 現在のフォールドの特徴量重要度をデータフレームに追加
        df_feature_importances = pd.concat([df_feature_importances, feature_importances], axis=0)

        # 学習済みモデルをリストに追加
        lgbm_models.append(model)
    
    if sqlite_enabled and job_id:
        create_or_update_job_task(job_id, progress_percent="50", preprocess_type=None, error_code=None, error_msg=None, result=json.dumps({}), id= task_id)
        create_or_update_job(job_id , "50")

    # 平均特徴量重要度を計算
    mean_feature_importances = df_feature_importances.groupby("feature")["importance"].mean().reset_index()
    mean_feature_importances = mean_feature_importances.sort_values(by="importance", ascending=False)
    feature_importances_dict_train = mean_feature_importances.to_dict(orient='records')

    # モデルを保存するディレクトリ
    if citycode_value is not None:
        output_file_path = f'{output_path}/data/{citycode_value}/E021/outputs/models'
        model_zip_file_path = f'{output_file_path}.zip'
    else:
        output_file_path = f'{output_path}'
        model_zip_file_path = f'{output_path}.zip'
    os.makedirs(output_file_path, exist_ok=True)
    
    if sqlite_enabled and job_id:
        create_or_update_job_task(job_id, progress_percent="60", preprocess_type=None, error_code=None, error_msg=None, result=json.dumps({}), id= task_id)
        create_or_update_job(job_id , "60")

    columns_file = os.path.join(output_file_path, f'{str(uuid.uuid4())}_columns.pkl')
    with open(columns_file, 'wb') as f:
        pickle.dump(X_train.columns.tolist(), f)
        
    # 各学習済みモデルをファイルに保存
    for i, model in enumerate(lgbm_models):
        if targetyear_value is not None:
            model_file = os.path.join(output_file_path, f'{CONSTANTS["model_name"]}_model_fold_{i+1}_{targetyear_value}.pkl')
        else:
            model_file = os.path.join(output_file_path, f'{str(uuid.uuid4())}.pkl')

        with open(model_file, 'wb') as f:
            pickle.dump(model, f)
        # モデルフォルダを ZIP 圧縮

        with zipfile.ZipFile(model_zip_file_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for root, dirs, files in os.walk(output_file_path):
                for file in files:
                    file_path = os.path.join(root, file)
                    # arcname をファイル名のみに設定して models/ フォルダを含めない
                    zipf.write(file_path, arcname=file)
    if sqlite_enabled and job_id:
        create_or_update_job_task(job_id, progress_percent="70", preprocess_type=None, error_code=None, error_msg=None, result=json.dumps({}), id= task_id)
        create_or_update_job(job_id , "70")
    # 学習済みモデル、Out-of-fold予測、学習データの特徴量重要度を返す
    return lgbm_models, feature_importances_dict_train, model_zip_file_path

### 3. 精度検証
# - 入力：テスト用データ
# - 出力：「D902　空き家推定結果データ【CSV】」

def evaluate_models_on_test(test_df, models, params):
    """
    テストセットでモデルを評価する

    Parameters
    ----------
    test_df : DataFrame
        テストデータを含むデータフレーム
    models : list
        学習済みモデルのリスト
    params : dict
        各種パラメータを含む辞書 

    Returns
    -------
    pred : DataFrame
        予測結果を含むデータフレーム
    score_dict : dict
        評価指標を含む辞書
    feature_importances_dict_test : dict
        テストデータの特徴量重要度を含む辞書
    feature_importance_plot : str
        特徴量重要度のプロット画像のファイルパス
    """
    # テストデータから識別子列を抽出
    # temproal coding: "gml_id" が存在しない場合に "gml" を "gml_id" に変更
    if "gml_id" not in test_df.columns and "gml" in test_df.columns:
        test_df.rename(columns={"gml": "gml_id"}, inplace=True)
    id_test = test_df[["gml_id"]]
    # テストデータを識別するフラグを追加
    id_test["test_flg"] = 1

    # 削除したいカラムをリストに指定
    columns_to_drop = [CONSTANTS['outcome_variable'], 'gml_id', 'gml',  '世帯コード', '水道番号']

    # 指定されたカラムのうち、`test_df` に存在するものだけを選択
    columns_to_drop = [col for col in columns_to_drop if col in test_df.columns]

    # 非特徴量列を除いて特徴量行列を作成
    X_test = test_df.drop(columns=columns_to_drop)
    # 真のラベルを抽出
    y_test = test_df[CONSTANTS['outcome_variable']]

    # 精度と特徴量重要度情報を格納する空の辞書を作成
    score_dict = {}
    categorical_features = X_test.select_dtypes(include=["object"]).columns.tolist()
    for col in categorical_features:
        if col in X_test.columns:
            X_test[col] = X_test[col].astype("category")
    
    # 平均予測確率を格納する配列を初期化
    test_preds_proba = np.zeros(len(X_test))
    
    # 特徴量重要度を格納するデータフレームを初期化
    feature_importances = pd.DataFrame()

    # 各モデルからの予測確率を累積
    for i, model in enumerate(models):
        test_preds_proba += model.predict_proba(X_test)[:, 1]

        # このモデルの特徴量重要度を計算
        importances = pd.DataFrame({
            'feature': X_test.columns,
            'importance': model.feature_importances_,
            'fold': i
        })
        feature_importances = pd.concat([feature_importances, importances], axis=0)
    
    # 平均予測確率を計算
    test_preds_proba /= len(models)
    # 閾値を使用してバイナリ予測を生成
    test_preds = (test_preds_proba >= params['threshold']).astype(int)
    
    # 予測結果を組み合わせてデータフレームを作成
    pred = pd.concat([
        id_test,
        pd.DataFrame({"pred": test_preds}),
        pd.DataFrame({"pred_proba": test_preds_proba}),
    ], axis=1)

    # 評価指標を計算
    cm = confusion_matrix(y_test, test_preds)
    
    # 混同行列から要素を抽出し、特異度を計算
    tn, fp, fn, tp = cm.ravel()
    specificity = tn / (tn + fp) if (tn + fp) > 0 else 0
    
    # 評価指標を辞書に格納
    score_dict = {
        "cm": cm.tolist(),
        "tn": tn, "fp": fp, "fn": fn, "tp": tp,
        "accuracy": accuracy_score(y_test, test_preds),
        "precision": precision_score(y_test, test_preds, zero_division=1),
        "recall": recall_score(y_test, test_preds, zero_division=1),
        "f1": f1_score(y_test, test_preds, zero_division=1),
        "specificity": specificity
    }
    
    # 予測結果、評価指標、特徴量重要度を返す
    return pred, score_dict

def merge_and_save_results(df, pred, output_file):
    """
    予測結果を元のデータフレームにマージし、結果を保存する

    Parameters
    ----------
    df : pd.DataFrame
        元のデータフレーム
    pred : pd.DataFrame
        予測結果を含むデータフレーム
    output_file : str
        結果を保存するCSVファイルのパス

    Returns
    -------
    pd.DataFrame
        マージされた結果を含む更新されたデータフレーム
    """
    # 識別子列（gml_id）を使用して予測を元のデータフレームにマージ
    merged_df = pd.merge(df, pred, on='gml_id', how='left')

    # test_flgを設定: テストデータは1、それ以外は0
    merged_df.loc[merged_df['test_flg'] != 1, 'test_flg'] = 0
    
    # 試行するエンコーディングのリスト
    encodings = ['utf-8-sig']
    for encoding in encodings:
        try:
            # 各エンコーディングでCSVファイルとして保存を試みる
            merged_df.to_csv(output_file, encoding=encoding, index=False)
            return merged_df
        except Exception as e:
            # 保存中にエラーが発生した場合、エラーメッセージを表示して次のエンコーディングを試す
            set_error(ERROR_10004, output_file, encoding)
    return merged_df

def save_metrics_and_importances(score_dict, feature_importances_dict_train, citycode_value, targetyear_value, output_path):
    """
    評価指標と特徴量重要度をJSONファイルに保存する

    Parameters
    ----------
    score_dict : dict
        評価指標を含む辞書
    feature_importances_dict_train : dict
        学習データの特徴量重要度を含む辞書
    targetyear_value : str
        対象年度の文字列
    
    Returns
    -------
    data_zip_file_path : str
        作成したZIPファイルのパス
    """
    if citycode_value is not None:
        output_dir = f'{output_path}/data/{citycode_value}/E021/outputs/'
    else:
        output_dir = f'{output_path}'
    os.makedirs(output_dir, exist_ok=True)

    # 評価指標と特徴量重要度を一つの辞書にまとめてJSONファイルに保存
    combined_data = {
        'score_dict': {k: int(v) if isinstance(v, np.int64) else v for k, v in score_dict.items()},
        'feature_importances_dict_train': feature_importances_dict_train
    }

    if targetyear_value is not None:
        output_metrics = f'{output_dir}/metrics_and_importances_{targetyear_value}.json'
    else:
        output_metrics = f'{output_dir}/metrics_and_importances.json'
    
    with open(output_metrics, 'w') as f:
        json.dump(combined_data, f)
    
    # ディレクトリ内のファイルをZIPファイルに圧縮
    data_zip_file_path = f'{output_dir}/data_files.zip'
    
    def add_to_zip(zipf, file_path, arcname):
        zipf.write(file_path, arcname)
    
    with zipfile.ZipFile(data_zip_file_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        # 並列処理でZIP圧縮を高速化
        with ThreadPoolExecutor() as executor:
            for root, _, files in os.walk(output_dir):
                for file in files:
                    file_path = os.path.join(root, file)
                    arcname = os.path.relpath(file_path, os.path.join(output_dir, '..'))
                    executor.submit(add_to_zip, zipf, file_path, arcname)

    return data_zip_file_path


def train_and_evaluate(db_path, input_file, output_path, explanatory_variables, test_size, n_splits, undersample, undersample_ratio, threshold, hyperparameter_flag, n_trials, 
                       lambda_l1, lambda_l2, num_leaves, feature_fraction, bagging_fraction, bagging_freq, min_data_in_leaf, citycode_value, targetyear_value, job_id):
    """
    モデルを学習し評価する主要関数

    Parameters
    ----------
    job_id: int
        job_id in jobs table is created when start program
    input_file : gr.File
        入力CSVファイル
    test_size : float
        テストデータの割合
    explanatory_variables : list[str]
        説明変数
    n_splits : int
        交差検証の分割数
    undersample : bool
        アンダーサンプリングを使用するかどうか
    undersample_ratio : float
        アンダーサンプリングの比率
    threshold : float
        予測の閾値
    hyperparameter_flag : bool
        ハイパーパラメータチューニングを行うかどうか
    n_trials : int
        ハイパーパラメータチューニングの試行回数
    lambda_l1 : float
        L1正則化パラメータ
    lambda_l2 : float
        L2正則化パラメータ
    num_leaves : int
        木の葉の最大数
    feature_fraction : float
        特徴量のサブサンプリング比率
    bagging_fraction : float
        データのサブサンプリング比率
    bagging_freq : int
        バギングの頻度
    min_data_in_leaf : int
        葉ノードの最小データ数

    Returns
    -------
    result_str : str
        評価結果の文字列
    feature_importance_plot : str
        特徴量重要度のプロット画像のファイルパス
    output_file : str
        出力CSVファイルのパス
    """

    try:
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
            create_or_update_job(job_id, "0")

        # データの読み込み
        file_path = input_file
        df = read_data(file_path, low_memory=False)
        if df is None:
            raise ValueError(f"ファイル {file_path} の読み込みに失敗しました。")
        

        # 入力されたカラム名を取得し、以下該当カラムに適用させる
        explanatory_vars = CONSTANTS["explanatory_variables"]
        
        # 入力された説明変数名からプレフィックス部分（例: "最小使用水量_suido_residence" → "最小使用水量"）を抽出
        exp_cols = [col.split('_')[0] for col in explanatory_vars]

        # プレフィックスに基づいて、対応するデータフレームのカラムをマッピングする辞書を作成
        explanatory_variables_dict = {}
        for col in exp_cols:
            if "akiya" not in col:
                # 'gml_id' の場合は直接対応させる
                if col == "gml_id":
                    explanatory_variables_dict[col] = "gml_id"
                else:
                    # プレフィックスが部分一致するデータフレーム内のカラムを抽出
                    tar_colname = [col901 for col901 in df.columns if col in col901]
                    if len(tar_colname) > 0:
                        explanatory_variables_dict[col] = tar_colname[0]

        # 特定のカラム（例: '最小使用水量', '平均使用水量'）が辞書に存在しない場合、データフレームから検索してマッピングに追加
        for col in ['最小使用水量', '平均使用水量', '住定異動年月日', '登記日付']:
            if col not in explanatory_variables_dict.keys():
                tar_colname = [col901 for col901 in df.columns if col in col901]
                if len(tar_colname) > 0:
                    explanatory_variables_dict[col] = tar_colname[0]


        
        # 建物構造名称カラム, 登記日付の追加
        adding_col_dict = {
            "構造名称":"buildingStructureType",
            "登記日付":"住定異動年月日",
        }
        for adding_col_name in adding_col_dict.keys():
            if adding_col_name not in explanatory_variables_dict.keys():
                explanatory_variables_dict[adding_col_name] = adding_col_name
                check_tar_col = [ col for col in df.columns if adding_col_name in col ]
                if len(check_tar_col) == 0:
                    check_alt_col = [ col for col in df.columns if adding_col_dict[adding_col_name] in col ]
                    if len(check_alt_col) > 0:
                        df[explanatory_variables_dict[adding_col_name]] = df[check_alt_col[0]].copy()
                    else:
                        df[explanatory_variables_dict[adding_col_name]] = np.nan
                else:
                    explanatory_variables_dict[adding_col_name] = check_tar_col[0]


        # '世帯コード'の重複を確認し、重複するレコードを削除
        duplicates = df['世帯コード'].duplicated(keep=False)  # keep=False で全重複行をTrueとする
        df = df[~duplicates].reset_index(drop=True)
        condition = (df['住定期間'] < 1000)
        df = df[~condition].reset_index(drop=True)
        # '正規化住所'の重複を確認し、3件以上の重複がある場合、該当するすべてのレコードを削除
        duplicate_counts = df['正規化住所'].value_counts()  # 各値の出現回数を取得
        to_remove = duplicate_counts[duplicate_counts >= 2].index  # 3件以上の値を取得
        df = df[~df['正規化住所'].isin(to_remove)].reset_index(drop=True)  # 該当値を除外

        # modify dataset which has irreguralar cases
        df.loc[df['最大使用水量_suido_residence'] > 30, '閉栓フラグ_suido_residence'] = 0
        df.loc[df['最大使用水量_suido_residence'] > 30, 'akiya_result_cleaned_flag'] = 0
        df.loc[(df['世帯人数'] == 1) & (df['最大年齢'] > 95), 'akiya_result_cleaned_flag'] = 1
        df.loc[df['最小使用水量_suido_residence'] > 150, 'akiya_result_cleaned_flag'] = 0
        df.loc[df['最大使用水量_suido_residence'] < 3, 'akiya_result_cleaned_flag'] = 1

        
        if sqlite_enabled and job_id:
            create_or_update_job_task(job_id, progress_percent="10", preprocess_type=None, error_code=None, error_msg=None, result=json.dumps({}), id=task_id)
            create_or_update_job(job_id, "10")
        learning_data = prepare_learning_data(df, explanatory_variables, explanatory_variables_dict)
        
        params = {
            'test_size': float(test_size),
            'n_splits': int(n_splits),
            'undersample': undersample,
            'undersample_ratio': float(undersample_ratio),
            'threshold': float(threshold),
            'hyperparameter_flag': hyperparameter_flag,
            'n_trials': int(n_trials),
            'lambda_l1': float(lambda_l1),
            'lambda_l2': float(lambda_l2),
            'num_leaves': int(num_leaves),
            'feature_fraction': float(feature_fraction),
            'bagging_fraction': float(bagging_fraction),
            'bagging_freq': int(bagging_freq),
            'min_data_in_leaf': int(min_data_in_leaf),
        }
        if sqlite_enabled and job_id:
            create_or_update_job_task(job_id, progress_percent="20", preprocess_type=None, error_code=None, error_msg=None, result=json.dumps({}), id= task_id)
            create_or_update_job(job_id , "20")
        train_df, test_df = split_data(learning_data, params, explanatory_variables_dict)
        
        if sqlite_enabled and job_id:
            create_or_update_job_task(job_id, progress_percent="30", preprocess_type=None, error_code=None, error_msg=None, result=json.dumps({}), id= task_id)
            create_or_update_job(job_id , "30")
        models, feature_importances_dict_train, model_zip_file_path = train_lgb_with_optuna(train_df, params, citycode_value, targetyear_value, output_path, job_id, task_id, sqlite_enabled)
        
        if sqlite_enabled and job_id:
            create_or_update_job_task(job_id, progress_percent="80", preprocess_type=None, error_code=None, error_msg=None, result=json.dumps({}), id= task_id)
            create_or_update_job(job_id , "80")
        pred, score_dict = evaluate_models_on_test(test_df, models, params)
        
        if sqlite_enabled and job_id:
            create_or_update_job_task(job_id, progress_percent="90", preprocess_type=None, error_code=None, error_msg=None, result=json.dumps({}), id= task_id)
            create_or_update_job(job_id , "90")

        if citycode_value is not None:
            output_file = f'{output_path}/data/{citycode_value}/E021/outputs/D902.csv'
        else:
            output_file = f'{output_path}/D902.csv'
        
        merge_and_save_results(df, pred, output_file)

        # Save evaluation metrics and feature importances
        data_zip_file_path = save_metrics_and_importances(score_dict, feature_importances_dict_train, citycode_value, targetyear_value, output_path)

        if sqlite_enabled and job_id:
            create_or_update_job_task(job_id, progress_percent="95", preprocess_type=None, error_code=None, error_msg=None, result=json.dumps({}), id= task_id)
            create_or_update_job(job_id , "95")
        
        converted_data = [
            {"column": item["feature"], "value": item["importance"]}
            for item in feature_importances_dict_train
        ]
        
        result = {
            'accuracy': score_dict['accuracy'] * 100,
            'f1Score': score_dict['f1'] * 100,
            'specificity': score_dict['specificity'] * 100,
            'precision': score_dict['precision'] * 100,
            'recall': score_dict['recall'] * 100,
            'important_columns': converted_data,
        }
        
        # Update progress to complete
        if sqlite_enabled and job_id:
            create_or_update_job_task(job_id, progress_percent="100", preprocess_type=None, error_code=None, error_msg=None, result=json.dumps(result, ensure_ascii=False), id= task_id, is_finish=True)
            create_or_update_job(job_id , "complete")

        return output_file, model_zip_file_path, data_zip_file_path

    except Exception as e:
        if ERROR_CODE is None:
            set_error(ERROR_10006)
        if task_id is not None:
            create_or_update_job_task(job_id, progress_percent="", preprocess_type=None, error_code=ERROR_CODE, error_msg=ERROR_MSG, result=json.dumps({}), id= task_id, is_finish=True)
        raise Exception("空き家推定の学習モデル構築中にエラーが発生しました。")

    
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