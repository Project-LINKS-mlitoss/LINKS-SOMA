"""
# E014 テキストマッチング機能
* 任意のアセットに対しテキストマッチングによるインデキシング処理を行う機能。この機能には特定のワードをキーとした結合、除外、確率計算等が含まれる。
* テキストマッチングには完全一致と部分一致による結合方式を持つ。部分一致ではテキストマッチング度合いを示す類似率を算出する。ユーザーは部分一致において類似度の閾値を指定し、閾値以上の類似率のデータを結合する。

閾値以下の類似度の住所は"対応住所なし"として出力される.
入力は、住所を含むCSVファイル2つと、N-gramのサイズ、類似度の閾値を指定する.
出力は、2つのCSVファイルを住所をもとにマッチングした結果を含むCSVファイル.
"""

import json
import sys
from typing import List, Tuple
import io
import os
import re
import chardet
import pandas as pd
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from scipy.sparse import csr_matrix
import numpy as np
import warnings

warnings.filterwarnings("ignore")
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


OUTPUT_PATH = "matched_data.csv"
ERROR_CODE=None
ERROR_MSG=None

@staticmethod
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
            set_error(ERROR_00026, file_extension)
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
        set_error(ERROR_00027, path)
        # 適切なエンコーディングが見つからない場合、エラーを発生させる
        raise ValueError(f"適切なエンコーディングが見つかりませんでした: {path}")
    except Exception as e:
        # 何らかの例外が発生した場合、エラーメッセージを表示してNoneを返す
        if ERROR_CODE is None:
            set_error(ERROR_00011, path)
        raise

def get_column_names(csv_file: str) -> List[str]:
    """
    CSVファイルの列名を取得する
    
    Parameters
    ----------
    csv_file : str
        CSVファイルのパス
    
    Returns
    -------
    List[str]
        列名のリスト、エラー時は空のリスト
    """
    try:
        # CSVファイルを読み込む
        df = read_data(csv_file)
        # 列名のリストを返す
        return df.columns.tolist()
    except Exception as e:
        # エラーが発生した場合、メッセージを表示して空のリストを返す
        return []

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

def embedding_address(main_csv: io.BytesIO | str, sub_csv: io.BytesIO | str, main_column: str, sub_column: str, merge_base: str, output_path:str, ngram: int = 0, threshold: float = 0.5, batch_size: int = 1000, job_id: str = None, db_path: str = None, input_source: list = [], progress_percent_job = 50, progress_percent = 0) -> Tuple[str, str]:   
    """
    住所名寄せ処理を行う
    
    Parameters
    ----------
    main_csv : io.BytesIO
        メインのCSVファイル
    sub_csv : io.BytesIO
        サブのCSVファイル
    main_column : str
        メインファイルの結合キーとなる列名
    sub_column : str
        サブファイルの結合キーとなる列名
    merge_base : str
        結合の基準となるファイル名
    ngram : int, optional
        N-gramのサイズ（デフォルト: 2）
    threshold : float, optional
        類似度の閾値（デフォルト: 0.5）
    
    Returns
    -------
    Tuple[str, str]
        結果ファイルのパスと結果の概要
    """
    try:
        if db_path:
            connect_sqllite(db_path)
            progress_percent = progress_percent / 4
            progress_percent_job = progress_percent_job + progress_percent
        task_id = None
        if job_id:
            create_or_update_job(job_id, progress_percent_job)
            task_id = create_or_update_job_task(job_id, progress_percent="0", preprocess_type="e014", error_code=None, error_msg=None, result=None)
      
        if output_path is None:
            output_path = OUTPUT_PATH
        
        output_dir = os.path.dirname(output_path)

        if not os.path.exists(output_dir):
            os.makedirs(output_dir)

        # CSVファイルを読み込む
        if hasattr(main_csv, 'name'):
            main_df = read_data(main_csv.name)
        else:
            main_df = read_data(main_csv)

        if hasattr(sub_csv, 'name'):
            sub_df = read_data(sub_csv.name)
        else:
            sub_df = read_data(sub_csv)
        
        if '住基' in input_source and '水道' in input_source:
            # 日付のNormalize化をし、年月を取得
            main_start_date_col = [col for col in ['使用開始日', '住定異動年月日', '登記日付' ] if col in main_df.columns][0]
            main_df = normalize_dates(main_df,main_start_date_col)
            main_df['開始月'] = pd.to_datetime(main_df[main_start_date_col]).dt.strftime("%Y-%m")
            sub_start_date_col = [col for col in ['使用開始日', '住定異動年月日', '登記日付' ] if col in sub_df.columns][0]
            sub_df = normalize_dates(sub_df,sub_start_date_col)
            sub_df['開始月'] = pd.to_datetime(sub_df[sub_start_date_col]).dt.strftime('%Y-%m')

            # 住基の住所に閾値以上の世帯コードが結びつく住所のデータを住基、水道双方から除外
            family_thresh = 4
            if '世帯コード' in main_df.columns:
                mlt_family_address_list = main_df.groupby(main_column)['世帯コード'].nunique()[main_df.groupby(main_column)['世帯コード'].nunique()>=family_thresh].index
            else:
                mlt_family_address_list = sub_df.groupby(main_column)['世帯コード'].nunique()[sub_df.groupby(main_column)['世帯コード'].nunique()>=family_thresh].index

            main_df = main_df.loc[~main_df[main_column].isin(mlt_family_address_list)].reset_index(drop=False)
            sub_df = sub_df.loc[~sub_df[sub_column].isin(mlt_family_address_list)].reset_index(drop=False)
    
        # 結合元のファイルがmain, 結合対象のファイルがsub、初めに読み込んだファイルを一旦mainにしているので、結合基準をsubにしてたら入れ替える
        if hasattr(sub_csv, 'name') and merge_base == os.path.basename(sub_csv.name):
            main_csv, sub_csv = sub_csv, main_csv
            main_column, sub_column = sub_column, main_column
            main_df, sub_df = sub_df, main_df

        # データの行数、完全一致割合の計算に使用
        data_rows = len(main_df)
        sub_data_rows = len(sub_df)
        
        # アップロードされた元のファイル名を使用して拡張子を除去
        if hasattr(main_csv, 'name'):
            main_csv_name = os.path.splitext(os.path.basename(main_csv.name))[0]
        else:
            main_csv_name = os.path.splitext(os.path.basename(main_csv))[0]

        # アップロードされた元のファイル名を使用して拡張子を除去
        if hasattr(sub_csv, 'name'):
            sub_csv_name = os.path.splitext(os.path.basename(sub_csv.name))[0]
        else:
            sub_csv_name = os.path.splitext(os.path.basename(sub_csv))[0]

        # アンダーバーと数字のパターンを削除
        sub_csv_name = re.sub(r'_\d+$', '', sub_csv_name)

        
        # カラム名にファイル名を付与
        sub_df.columns = [f"{col}_{sub_csv_name}" if col != sub_column else col for col in sub_df.columns]
        
        # 名寄せが判断できるflagを設定
        main_flag_name = f'{main_csv_name}_flag'
        sub_flag_name = f'{sub_csv_name}_flag'
        # 初期値は全て1
        main_df[main_flag_name] = 1
        main_df[sub_flag_name] = 1

        # 名寄せ対象になる行を元情報として残す
        sub_df[f'名寄せ元情報_{sub_csv_name}'] = sub_df[sub_column]
        sub_df.rename(columns={sub_column: main_column}, inplace=True)
        if job_id:
            create_or_update_job(job_id, progress_percent_job)
            create_or_update_job_task(job_id, progress_percent="30", preprocess_type="e014", error_code=None, error_msg=None, result=None, id= task_id)
        
        if '住基' in input_source and '水道' in input_source:
            # 水道で1つの住所に複数の水道番号が結びついている住所を取り出す
            multi_address_in_main = main_df[main_column].value_counts()[main_df[main_column].value_counts()>1].index
            main_df_single = main_df.loc[~main_df[main_column].isin(multi_address_in_main)].copy().reset_index(drop=True)
            main_df_multi = main_df.loc[main_df[main_column].isin(multi_address_in_main)].copy().reset_index(drop=True)

            # 単一住所のレコードを住基と完全一致で結合させる
            main_single_sub_merge = main_df_single.merge(sub_df, on=main_column, how='inner')

            search_cols = [ "世帯コード", "水道番号", "使用開始日" , "使用中止日", "閉栓フラグ", "最大使用水量", 
                        "平均使用水量", "最小使用水量", "合計使用水量", "水道使用量変化率", "開始月"]
            
            merged_df_col_dict = {}

            for colname in search_cols:
                tar_colname_list = [ col for col in main_single_sub_merge.columns if colname in col ]
                if len(tar_colname_list) > 0:
                    merged_df_col_dict[colname] = tar_colname_list[0]
                else:
                    merged_df_col_dict[colname] = colname
                
            # 複数住所のレコードを水道使用開始月と住定年月が同じのレコードのみで結びつける（family_thresh以上は排除）
            main_multi_sub_merge = pd.DataFrame(columns = main_single_sub_merge.columns)
            no_juki = []
            over_thresh_building = []
            for address in multi_address_in_main:
                tar_main = main_df_multi.loc[main_df_multi[main_column]==address].sort_values([main_column,merged_df_col_dict['開始月']]).reset_index(drop=True)
                tar_sub = sub_df.loc[sub_df[main_column]==address].sort_values([main_column,f"開始月_{sub_csv_name}"]).reset_index(drop=True)
                if len(tar_sub) == 0:
                    no_juki.append(address)
                elif len(tar_sub) == 1:
                    tar_merged = tar_main.iloc[[-1]].merge(tar_sub, on=main_column, how='inner')
                    main_multi_sub_merge = pd.concat([main_multi_sub_merge,tar_merged ])
                elif len(tar_sub) >= family_thresh:
                    over_thresh_building.append(address)
                else:
                    tar_merged = tar_main.merge(tar_sub.drop(main_column, axis=1), left_on=merged_df_col_dict['開始月'], right_on=f"開始月_{sub_csv_name}",  how='inner')
                    main_multi_sub_merge = pd.concat([main_multi_sub_merge,tar_merged ])
    
            # 上記二つのマージ済みデータを合算
            try:
                juki_suido_merged = pd.concat([main_single_sub_merge.loc[main_single_sub_merge[merged_df_col_dict["世帯コード"]].notnull()],
                                          main_multi_sub_merge.loc[main_multi_sub_merge[merged_df_col_dict["世帯コード"]].notnull()]], ignore_index=True)
            except NameError:
                juki_suido_merged = main_single_sub_merge.loc[main_single_sub_merge[merged_df_col_dict["世帯コード"]].notnull()].reset_index()
        
            # 一つの世帯コードに複数の水道番号が紐づいている場合、水道番号を一つに集計
            setai_multi_ids = juki_suido_merged.groupby(merged_df_col_dict["世帯コード"])[merged_df_col_dict['水道番号']].count()[juki_suido_merged.groupby(merged_df_col_dict["世帯コード"])[merged_df_col_dict['水道番号']].count()>1].index

            juki_suido_merged_single = juki_suido_merged.loc[~juki_suido_merged[merged_df_col_dict["世帯コード"]].isin(setai_multi_ids)]
            juki_suido_merged_multi = juki_suido_merged.loc[juki_suido_merged[merged_df_col_dict["世帯コード"]].isin(setai_multi_ids)]
        
            suido_groupby_calcs = {
                merged_df_col_dict['水道番号']:'first', '正規化住所':pd.Series.mode, merged_df_col_dict['使用開始日']:'max',
                merged_df_col_dict['使用中止日']:'max', merged_df_col_dict['閉栓フラグ']:'max', 
                merged_df_col_dict['最大使用水量']:'max', merged_df_col_dict['平均使用水量']:'mean', 
                merged_df_col_dict['最小使用水量']:'min', merged_df_col_dict['合計使用水量']:'sum', merged_df_col_dict['水道使用量変化率']:'mean', 
                merged_df_col_dict['開始月']:'min'
            }
            juki_suido_merged_multi[merged_df_col_dict["使用開始日"]] = pd.to_datetime(juki_suido_merged_multi[merged_df_col_dict["使用開始日"]])
            juki_suido_merged_multi[merged_df_col_dict["使用中止日"]] = pd.to_datetime(juki_suido_merged_multi[merged_df_col_dict["使用中止日"]])
            juki_suido_merged_multi[merged_df_col_dict["開始月"]] = pd.to_datetime(juki_suido_merged_multi[merged_df_col_dict["開始月"]])
            juki_suido_merged_multi[merged_df_col_dict["閉栓フラグ"]] = juki_suido_merged_multi[merged_df_col_dict["閉栓フラグ"]].astype('bool')

            juki_suido_merged_multi_grpd = juki_suido_merged_multi.groupby(merged_df_col_dict["世帯コード"])[list(suido_groupby_calcs.keys())].agg(suido_groupby_calcs).reset_index(drop=False)
            juki_suido_merged_multi_organized = juki_suido_merged_multi.drop(list(suido_groupby_calcs.keys()),axis=1).drop_duplicates(merged_df_col_dict["世帯コード"]).merge(juki_suido_merged_multi_grpd, on=merged_df_col_dict["世帯コード"])

            df_merge = pd.concat([juki_suido_merged_single,juki_suido_merged_multi_organized], ignore_index=True)
    
        else:
            # 完全一致による結合
            sub_column_nenamed = [ col for col in sub_df.columns if sub_column in col ][0]
            sub_df = sub_df.drop_duplicates(sub_column_nenamed, keep='first')
            if ngram == 0:
                df_merge = main_df.merge(sub_df, on=main_column, how='left')
            else:
                df_merge = main_df.merge(sub_df, on=main_column, how='inner')
            
        merged_rows = len(df_merge)    # 完全一致できた行数
        # N-gramで名寄せできた行数をカウント
        ngram_rows = 0
        similarity_scores = []  # 類似度スコアを保存するリスト
    
        if ngram != 0:
            # 未結合のデータを抽出
            main_df = main_df[~main_df[main_column].isin(df_merge[main_column])]
            sub_df = sub_df[~sub_df[main_column].isin(df_merge[main_column])]
            main_df = main_df.reset_index(drop=True)
            sub_df = sub_df.reset_index(drop=True)
            if len(main_df) > 0 and len(sub_df) > 0:
                if job_id:
                    create_or_update_job(job_id, progress_percent_job)
                    create_or_update_job_task(job_id, progress_percent="40", preprocess_type="e014", error_code=None, error_msg=None, result=None, id= task_id)
                # N-gramで類似度を計算する準備
                vectorizer = CountVectorizer(analyzer='char', ngram_range=(ngram, ngram))
                main_df_ngram_matrix = vectorizer.fit_transform(main_df[main_column].astype(str))
                sub_df_ngram_matrix = vectorizer.transform(sub_df[main_column].astype(str))
        
                # 疎行列に変換してメモリ効率を改善
                main_df_ngram_matrix = csr_matrix(main_df_ngram_matrix)
                sub_df_ngram_matrix = csr_matrix(sub_df_ngram_matrix)
        
                # バッチ処理による類似度計算
                for start in range(0, main_df_ngram_matrix.shape[0], batch_size):
                    end = min(start + batch_size, main_df_ngram_matrix.shape[0])
        
                    # バッチ単位で類似度を計算
                    batch_similarities = cosine_similarity(main_df_ngram_matrix[start:end], sub_df_ngram_matrix)
                    
                    # バッチ内の各行ごとに処理
                    for i, similarities in enumerate(batch_similarities):
                        top_indices = similarities.argsort()[-3:][::-1]  # 上位3件を取得
        
                        if similarities[top_indices[0]] >= threshold:
                            row_index = start + i  # バッチの中での行番号をグローバルに変換
                            for col in sub_df.columns:
                                main_df.at[row_index, col] = sub_df.iloc[top_indices[0]][col]
                            similarity_scores.append(similarities[top_indices[0]])  # 類似度スコアを追加
                            ngram_rows += 1  # この行が正しく名寄せされた場合にカウント
                        else:
                            row_index = start + i
                            main_df.at[row_index, f'名寄せ元情報_{sub_csv_name}'] = ""
                            main_df.at[row_index, f'{sub_flag_name}'] = 0
                            similarity_scores.append(similarities[top_indices[0]])  # 閾値未満の場合スコアは0
                        
                # 類似度スコアを結果データフレームに追加
                main_df[f'similarity_score_{sub_csv_name}'] = similarity_scores
            
                # 結果のデータフレームを作成
                result_df = pd.concat([df_merge, main_df], axis=0, ignore_index=True)
        
                # flag情報を最後に持ってくる
                result_df = result_df[[col for col in result_df.columns if col != main_flag_name] + [main_flag_name]]
                
                # カラム名にflagを含むカラムを最後に移動
                result_df[main_flag_name] = result_df[main_flag_name].astype(int)
                result_df[sub_flag_name] = result_df[sub_flag_name].astype(int)
                
                flag_columns = [col for col in result_df.columns if 'flag' in col]
                other_columns = [col for col in result_df.columns if 'flag' not in col]
                result_df = result_df[other_columns + flag_columns]
            else:
                result_df = df_merge
        else:
            result_df = df_merge
            
        if job_id:
            create_or_update_job(job_id, progress_percent_job)
            create_or_update_job_task(job_id, progress_percent="90", preprocess_type="e014", error_code=None, error_msg=None, result=None, id= task_id)
        # 結果をCSVファイルとして保存
        saved_file_path = save_csv(result_df, output_path)
        
        # 結果の表示
        complete_match_ratio = f'結合元データとの完全一致割合: {merged_rows / data_rows * 100:.2f}%'
        if ngram != 0:
            threshold_match_ratio = f'結合元データとの閾値以上結合割合: {(merged_rows + ngram_rows) / data_rows * 100:.2f}%'
        else:
            threshold_match_ratio = f'結合元データとの閾値以上結合割合: {merged_rows / data_rows * 100:.2f}%'
        sub_complete_match_ratio = f'結合先データとの完全一致割合: {merged_rows / sub_data_rows * 100:.2f}%'
        
        if ngram == 0:
            ngram_rows = 0
            threshold_match_ratio = complete_match_ratio
        res = {
            'joining_rate': (merged_rows + ngram_rows) / data_rows * 100,
            'input_source': input_source
        }
        if job_id:
            create_or_update_job_task(job_id, progress_percent="100", preprocess_type="e014", error_code=None, error_msg=None, result=json.dumps(res, ensure_ascii=False), id= task_id, is_finish=True)

        return saved_file_path, f"{complete_match_ratio}\n{threshold_match_ratio}\n{sub_complete_match_ratio}"
    except Exception as e:
        if ERROR_CODE is None:
            set_error(ERROR_00013)
        if task_id is not None:
            create_or_update_job_task(job_id, progress_percent="", preprocess_type="e014", error_code=ERROR_CODE, error_msg=ERROR_MSG, result=json.dumps({}), id= task_id, is_finish=True)
        raise Exception("テキストマッチング処理中にエラーが発生しました。")

def save_csv(df, path):
    """
    データフレームをCSVファイルとして保存する
    
    Parameters
    ----------
    df : pandas.DataFrame
        保存するデータフレーム
    path : str
        保存先のファイルパス
    """
    # 絶対パスに変換
    abs_path = os.path.abspath(path)
    
    # 試行するエンコーディングのリスト
    encodings = ['utf-8-sig']
    for encoding in encodings:
        try:
            # 各エンコーディングでCSVファイルとして保存を試みる
            df.to_csv(abs_path, encoding=encoding, index=False)
            return abs_path
        except Exception as e:
            set_error(ERROR_00012, abs_path, encoding)
    
    return None

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
