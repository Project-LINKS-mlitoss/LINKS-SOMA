"""
# E013 住居単位データ作成機能
* 水道使用量（水道栓単位）、住民基本台帳（個人単位）等のデータを住居単位のデータへ再集計する機能
"""

import json
import os
import sys
from datetime import datetime, timedelta
import chardet
import numpy as np
import pandas as pd
from dateutil.relativedelta import relativedelta
from sklearn.preprocessing import LabelEncoder
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

COLUMNS = {
            "suido_use": {
                "suido_number": "水道番号",
                "meter_reading_date": "検針年月日",
                "suido_usage": "使用水量"
            },
            "suido_status": {
                "suido_number": "水道番号",
                "usage_status": "開閉栓区分",
                "suido_address": "正規化住所",
                "usage_start_date": "使用開始日",
                "usage_end_date": "使用中止日"
            },
            "juki": {
                "setai_code": "世帯コード",
                "juki_address": "正規化住所",
                "birth": "生年月日",
                "sex": "性別",
                "move_date": "住定異動年月日"
            },
            "tatemono": {
                "tatemono_address": "正規化住所",
                "structure": "登記構造",
                "registration_date": "登記日付"
            }
        }

ERROR_CODE=None
ERROR_MSG=None

class DataProcessor:
    def __init__(self, input_paths, output_paths, reference_date, search_period):
        # 入力ファイルのパスを設定
        self.INPUT_PATHS = input_paths
        # 出力ファイルのパスを設定
        self.OUTPUT_PATHS = output_paths
        # 空き家予測の基準日
        self.reference_date = datetime.strptime(str(reference_date), "%Y-%m-%d")
        # 検索期間
        self.SEARCH_PERIOD = int(search_period)
        # データごとの出力するカラムを定義
        self.OUTPUT_COLUMNS = {
            "suido": [
                "水道番号", "正規化住所", "閉栓フラグ", '使用開始日', '使用中止日',
                "最大使用水量", "平均使用水量", "最小使用水量", "合計使用水量", "水道使用量変化率"
            ],
            "juki": [
                "世帯コード", "正規化住所", "世帯人数",
                "15歳未満人数", "15歳未満構成比",
                "15歳以上64歳以下人数", "15歳以上64歳以下構成比",
                "65歳以上人数", "65歳以上構成比", "最大年齢", "最小年齢",
                "男女比", "住定期間", "住定異動年月日"
            ],
            "tatemono": ["正規化住所", "構造名称", "登記日付"]
        }


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

    @staticmethod
    def read_data(path, **kwargs):
        """
        CSVファイルまたはテキストファイルを読み込む
        Parameters
        ----------
        path : str
            読み込むファイルのパス
        **kwargs : dict
            pandas.read_csv に渡す追加のキーワード引数
        Returns
        -------
        df : pandas.DataFrame
            読み込まれたデータフレーム、エラー時はNone
        """
        try:
            # ファイルの拡張子を取得し、小文字に変換
            file_extension = os.path.splitext(path)[1].lower()
            
            if file_extension not in ['.csv', '.txt']:
                set_error(ERROR_00006)
                raise ValueError(f"CSVファイルまたはテキストファイル以外は対応していません: {file_extension}")
            
            # 複数のエンコーディングを試行                
            encodings = ['utf-8-sig']
            for encoding in encodings:
                try:
                    # 各エンコーディングでファイルの読み込みを試みる
                    return pd.read_csv(path, encoding=encoding, **kwargs, low_memory=False)
                except UnicodeDecodeError:
                    # デコードエラーが発生した場合、次のエンコーディングを試す
                    continue
            
            # 自動でエンコーディングを検出し、再度読み込みを試みる
            detected_encoding = DataProcessor.detect_encoding(path)
            if detected_encoding:
                return pd.read_csv(path, encoding=detected_encoding, **kwargs)
            
            # 適切なエンコーディングが見つからない場合、エラーを発生させる
            set_error(ERROR_00008)
            raise ValueError(f"適切なエンコーディングが見つかりませんでした: {path}")
        except Exception as e:
            # 何らかの例外が発生した場合、エラーメッセージを表示してNoneを返す
            if ERROR_CODE is None:
                set_error(ERROR_00007)
            raise

    @staticmethod
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
        # 試行するエンコーディングのリスト
        encodings = ['utf-8-sig']
        for encoding in encodings:
            try:
                # 各エンコーディングでCSVファイルとして保存を試みる
                df.to_csv(path, encoding=encoding, index=False)
                return
            except Exception as e:
                set_error(ERROR_00009, path, encoding)

    @staticmethod
    def drop_duplicates(df, subset, keep="first"):
        """
        データフレームから重複行を削除する
        Parameters
        ----------
        df : pandas.DataFrame
            重複を削除するデータフレーム
        subset : list
            重複を推定するカラムのリスト
        keep : str, optional
            残す行を指定（'first', 'last', False）
        Returns
        -------
        pandas.DataFrame
            重複が削除されたデータフレーム
        """
        return df.drop_duplicates(subset=subset, keep=keep)

    def process(self):
        raise NotImplementedError("Subclasses must implement this method")


class SuidoProcessor(DataProcessor):
    def preprocess_suido_use(self, df):
        """
        水道使用量データの前処理を行う
        Parameters
        ----------
        df : pandas.DataFrame
            水道使用量データ
        Returns
        -------
        pandas.DataFrame
            前処理済みの水道使用量データ
        """
        cols = COLUMNS["suido_use"]
        try:
            df = normalize_dates(df, cols["meter_reading_date"], ['%Y%m%d', '%Y/%m/%d', '%d/%m/%Y', '%Y-%m-%d', '%m/%d/%Y'])
        except:
            set_error(ERROR_00022)
            raise Exception("'検針年月'が含まれているか、正しいカラムが指定されているかご確認ください。")

        # 検針年月を作成
        df["検針年月"] = df[cols["meter_reading_date"]].dt.strftime("%Y-%m")
        
        # 同一水道番号・同一月のデータを合計
        try:
            df_cleaned = df.groupby([cols["suido_number"], "検針年月"])[cols["suido_usage"]].sum().reset_index()
        except:
            set_error(ERROR_00037)
            raise Exception("水道番号のデータが異常です。もう一度データを確認ください。")
        
        return df_cleaned


    def preprocess_suido_data(self, df):
        """
        水道データを処理し、最古の使用量と最新の使用量を取得する
        Parameters
        ----------
        df : pandas.DataFrame
            ピボットテーブル形式の水道使用量データ
        Returns
        -------
        pandas.DataFrame
            最古の使用量と最新の使用量が追加されたデータ
        """
        # reference_dateとSTART_DATEを初期化
        if isinstance(self.reference_date, str):
            try:
                self.reference_date = datetime.strptime(self.reference_date, "%Y%m%d")
            except:
                self.reference_date = datetime.strptime(self.reference_date, "%Y-%m")
        
        self.START_DATE = (self.reference_date - relativedelta(years=self.SEARCH_PERIOD)).strftime("%Y-%m")
        reference_month = self.reference_date.strftime("%Y-%m")  # 月単位に変換

        # start_date_水道使用量に対して次の月の値を確認するロジック
        start_date = pd.to_datetime(self.START_DATE)
        while start_date <= pd.to_datetime(reference_month):
            next_month_str = start_date.strftime("%Y-%m")
            if next_month_str in df.columns:
                df["start_date_水道使用量"] = df[next_month_str].fillna(0)
                break
            # 次の月に進む
            start_date += relativedelta(months=1)
        else:
            df["start_date_水道使用量"] = 0  # ループを抜けた場合は0

        # reference_date_水道使用量に対して前の月の値を確認するロジック
        if reference_month not in df.columns:
            prev_month = (pd.to_datetime(reference_month) - relativedelta(months=1)).strftime("%Y-%m")
            if prev_month in df.columns:
                df["reference_date_水道使用量"] = df[prev_month].fillna(0)
            else:
                df["reference_date_水道使用量"] = 0  # NaNの場合、0に設定
        else:
            df["reference_date_水道使用量"] = df[reference_month].fillna(0)  # NaNを0に置換

        return df


    def pivot_table(self, df):
        """
        水道使用量データのピボットテーブルを作成する
        Parameters
        ----------
        df : pandas.DataFrame
            前処理済みの水道使用量データ
        Returns
        -------
        pandas.DataFrame
            ピボットテーブル形式の水道使用量データ
        """
        cols = COLUMNS["suido_use"]

        # 検針年月が含まれているか確認
        if "検針年月" not in df.columns:
            set_error(ERROR_00022)
            raise KeyError("'検針年月'がデータフレームに含まれていません")

        # ピボットテーブルの作成
        df_suido_use_pt = df.pivot_table(index=cols["suido_number"], columns="検針年月", values=cols["suido_usage"], aggfunc='sum').reset_index()

        return df_suido_use_pt


    def calculate_suido_stats(self, suido_use, suido_status):
        """
        水道使用量の統計量と変化率を計算する
        Parameters
        ----------
        df_use : pandas.DataFrame
            指定期間で抽出された水道データ
        df_status : pandas.DataFrame
            指定期間の水道ステータス
        Returns
        -------
        pandas.DataFrame
            統計量と変化率が追加された水道データ
        """
        try:
            suido_status = suido_status.copy()
            cols_use = COLUMNS["suido_use"]
            cols_status = COLUMNS["suido_status"]
            reference_date = pd.to_datetime(self.reference_date).strftime('%Y-%m')
            start_date = pd.to_datetime(self.START_DATE)

            # suido_useでデータがない年月の特定
            date_columns = [ col for col in suido_use.columns if col[:2] in ['19', '20'] ]
            min_date_columns = pd.to_datetime(min(date_columns))
            max_date_columns = pd.to_datetime(max(date_columns))
            min_year = min_date_columns.year
            min_month = min_date_columns.month
            max_year = max_date_columns.year
            max_month = max_date_columns.month
            basic_list = []
            for year in range(min_year,max_year+1 ):
                for month in range(1,13):
                    basic_list.append(str(pd.to_datetime(f"{year}-{month}").strftime('%Y-%m')))
            basic_list = [ ym for ym in basic_list if pd.to_datetime(ym) >= pd.to_datetime(f"{min_year}-{min_month}") ]      
            basic_list = [ ym for ym in basic_list if pd.to_datetime(ym) <= pd.to_datetime(f"{max_year}-{max_month}") ]  
            missing_month = [ ym for ym in basic_list if ym not in date_columns ]

            suido_status_pre = suido_status.loc[:,[cols_status['suido_number'],cols_status['usage_start_date'],cols_status['usage_end_date']]]
            suido_status_pre = normalize_dates(suido_status_pre, cols_status["usage_start_date"])
            suido_status_pre = normalize_dates(suido_status_pre, cols_status["usage_end_date"])

            suido_status_pre[cols_status['usage_start_date']] = suido_status_pre[cols_status['usage_start_date']].dt.strftime('%Y-%m')
            suido_status_pre[cols_status['usage_end_date']] = suido_status_pre[cols_status['usage_end_date']].dt.strftime('%Y-%m')

            # nullへデータを挿入（ffill)
            suido_pre_merged = suido_status_pre.merge(suido_use, on=cols_use['suido_number'],how='inner').reset_index(drop=True)
            suido_pre_merged.loc[:,min(date_columns):max(date_columns)] = suido_pre_merged.loc[:,min(date_columns):max(date_columns)].ffill(axis=1)    

            # dfの日付を対象期間のみにしぼる
            non_date_columns = [ col for col in suido_pre_merged.columns if col not in date_columns ]
            new_date_columns = [ ym for ym in date_columns if pd.to_datetime(ym) >=  start_date ]
            new_date_columns = [ ym for ym in new_date_columns if pd.to_datetime(ym) <=  pd.to_datetime(reference_date) ]
            suido_pre_merged = suido_pre_merged[non_date_columns+new_date_columns].reset_index(drop=True)

            suido_pre_merged['null_num'] = suido_pre_merged[new_date_columns].sum(axis=1)
            suido_pre_merged['start_date_水道使用量'] = 0
            suido_pre_merged['reference_date_水道使用量'] = 0
            
            # 開始日、終了日の日付を取得(データ期間中の期間に修正)
            for row in suido_pre_merged.loc[suido_pre_merged['null_num']!=0].index:
                try:
                    tar_ym = suido_pre_merged.loc[row,new_date_columns].dropna().index[0]
                    suido_pre_merged.loc[row, 'start_date_水道使用量'] = float(suido_pre_merged.loc[row,tar_ym])
                except:
                    suido_pre_merged.loc[row, 'start_date_水道使用量'] = 0
                try:
                    tar_ym = suido_pre_merged.loc[row,new_date_columns].dropna().index[-1]
                    suido_pre_merged.loc[row, 'reference_date_水道使用量'] = float(suido_pre_merged.loc[row,tar_ym])
                except:
                    suido_pre_merged.loc[row, 'reference_date_水道使用量'] = 0

            if len(new_date_columns) < 1:
                set_error(ERROR_00020)
                raise ValueError("基準日が不正です。正しいフォーマットになっているか、もしくは正しい日付となっているかかご確認ください 。")
            # suido_useに欠損年月がある場合に開始日、終了日の日付を修正(そのほかもデータ期間中の期間に修正)
            df_use = suido_pre_merged.apply(lambda x:self.get_start_base_value(x,missing_month,new_date_columns), axis=1)
        
            # 統計量の計算
            df_use["最大使用水量"] = df_use[new_date_columns].max(axis=1)
            df_use["平均使用水量"] = df_use[new_date_columns].mean(axis=1)
            df_use["最小使用水量"] = df_use[new_date_columns].min(axis=1)
            df_use["合計使用水量"] = df_use[new_date_columns].sum(axis=1)

            # 変化率の計算 (基準日の使用量 / 開始日の使用量)
            df_use["水道使用量変化率"] = df_use.apply(
                lambda row: row["reference_date_水道使用量"] / row["start_date_水道使用量"]
                if pd.notnull(row["start_date_水道使用量"]) and row["start_date_水道使用量"] != 0
                else 0, axis=1)
            
            # 出力するカラムを選択
            return df_use[[cols_use["suido_number"], "最大使用水量", "平均使用水量", "最小使用水量", "合計使用水量", "水道使用量変化率"]]
        except Exception as e:
            raise Exception(e)
    
    def value_operation_flg(self, df):
        """
        閉栓フラグを付与する
        Parameters
        ----------
        df : pandas.DataFrame
            水道状況データ
        Returns
        -------
        pandas.DataFrame
            閉栓フラグが更新された水道状況データ
        """
        cols = COLUMNS["suido_status"]
        
        # 閉栓フラグの初期設定：usage_end_dateがnullでない場合にTrue
        df["閉栓フラグ"] = df[cols["usage_end_date"]].notnull()
        
        # reference_dateとusage_end_dateを比較して、usage_end_dateがreference_dateより新しい場合はFalseに設定
        df_temp = normalize_dates(df.copy(), cols["usage_end_date"])
        df["usage_end_date"] = df_temp[cols["usage_end_date"]]  # usage_end_dateを日付に変換
        df["閉栓フラグ"] = np.where(
            (df["閉栓フラグ"]) & (df["usage_end_date"] > self.reference_date),  # 閉栓フラグがTrueかつ usage_end_date > reference_date
            False,  # 閉栓フラグをFalseに変更
            df["閉栓フラグ"]  # それ以外は元の値を保持
        )
        
        return df
    
    def get_start_base_value(self, row, missing_month, date_columns):
        cols_status = COLUMNS["suido_status"]

        if isinstance(self.reference_date, datetime):
            reference_date = self.reference_date.strftime('%Y-%m')
        else:
            reference_date = self.reference_date

        if len(missing_month)>0:
            if pd.isnull(row[cols_status["usage_start_date"]]):
                start_day = min(date_columns)
            elif row[cols_status["usage_start_date"]] < min(date_columns):
                start_day = min(date_columns)
            elif (row[cols_status["usage_start_date"]] >= min(missing_month) )&(row[cols_status["usage_start_date"]] <= max(missing_month)):
                start_day = (pd.to_datetime(max(missing_month)) + timedelta(days=31)).strftime('%Y-%m')
            elif row[cols_status["usage_start_date"]] > reference_date:
                start_day = reference_date
            else:
                start_day = row[cols_status["usage_start_date"]]

        else:
            if pd.isnull(row[cols_status["usage_start_date"]]):
                start_day = min(date_columns)
            elif row[cols_status["usage_start_date"]] < min(date_columns):
                start_day = min(date_columns)
            elif row[cols_status["usage_start_date"]] > reference_date:
                start_day = reference_date
            else:
                start_day = row[cols_status["usage_start_date"]]

        if not row.get(start_day):
            row['start_date_水道使用量'] = 0
        elif pd.isnull(row.get(start_day)):
            searching = True
            col = row.index.get_loc(start_day)
            while searching:
                if row.index[col] >= reference_date :
                    row['start_date_水道使用量'] = 0
                    searching = False
                elif pd.isnull(row.iloc[col]):
                    col += 1
                else:
                    row['start_date_水道使用量'] = row.iloc[col]
                    searching = False

        else:
            row['start_date_水道使用量'] = row[start_day]

        if row.get(reference_date, None) is not None:
            row['reference_date_水道使用量'] = 0 if pd.isnull(row[reference_date]) else row[reference_date]
        else:
            row['reference_date_水道使用量'] = 0
        return row

    def process(self):

        cols_status = COLUMNS["suido_status"]
        
        try:
            # データの読み込み
            df_suido_use = self.read_data(self.INPUT_PATHS["suido_use"])
            df_suido_status = self.read_data(self.INPUT_PATHS["suido_status"])

            if df_suido_use is None or df_suido_status is None:
                return

            # 単一住所に複数の水道番号（4件以上）が紐づく場合を集合住宅と定義し排除
            mlti_suido_nums = df_suido_status.groupby(cols_status["suido_number"])[cols_status["suido_address"]].nunique()[df_suido_status.groupby(cols_status["suido_number"])[cols_status["suido_address"]].nunique()<=3].index
            df_suido_status = df_suido_status.loc[df_suido_status[cols_status["suido_number"]].isin(mlti_suido_nums)]
            df_suido_status = df_suido_status.sort_values(
                [cols_status["suido_number"],
                 cols_status["usage_start_date"]], 
                ascending=True, na_position='first').drop_duplicates(cols_status["suido_number"], keep='last')
            
            # 住戸単位にする
            df_suido_use_cleaned = self.preprocess_suido_use(df_suido_use)
            df_suido_use_pt = self.pivot_table(df_suido_use_cleaned)
            # 基準日からさかのぼって指定期間の水道使用量のみを抽出
            df_suido_use_processed = self.preprocess_suido_data(df_suido_use_pt)
            # 水道使用量の統計量を計算
            df_suido_stats = self.calculate_suido_stats(df_suido_use_processed, df_suido_status)
            # 閉栓フラグを付与
            df_suido_operation = self.value_operation_flg(df_suido_status)

            # データの結合と整形
            cols_status = COLUMNS["suido_status"]
            df_suido = pd.merge(df_suido_operation[[cols_status["suido_number"], cols_status["suido_address"],'使用開始日', '使用中止日', "閉栓フラグ"]], 
                                df_suido_stats, on=cols_status["suido_number"], how="left")
            
            # 1住所に異なる水道番号が5以上結びつく住所を排除
            multi_address = df_suido.groupby(cols_status["suido_address"])[cols_status["suido_number"]].nunique()\
            [df_suido.groupby(cols_status["suido_address"])[cols_status["suido_number"]].nunique()>4].index
            df_suido = df_suido.loc[~df_suido[cols_status["suido_address"]].isin(multi_address)].reset_index(drop=True)  

            # df_suido の全てのカラムを確認
            all_columns = df_suido.columns

            # 「水道使用量変化率」以外のカラムの null を 0 で埋める
            columns_to_fill_zero = [col for col in all_columns if col != "水道使用量変化率"]
            df_suido[columns_to_fill_zero] = df_suido[columns_to_fill_zero].fillna(0)

            # 「水道使用量変化率」の null を 1 で埋める
            if "水道使用量変化率" in all_columns:
                df_suido["水道使用量変化率"] = df_suido["水道使用量変化率"].fillna(1)

            # 条件1: 最大使用水量, 平均使用水量, 最小使用水量, 合計使用水量がすべて0のとき
            usage_columns = ["最大使用水量", "平均使用水量", "最小使用水量", "合計使用水量"]

            # 条件1: 水道使用量変化率を1に設定
            df_suido.loc[df_suido[usage_columns].sum(axis=1) == 0, "水道使用量変化率"] = 1

            # 重複データを削除
            df_suido = self.drop_duplicates(df_suido.sort_values(by="最大使用水量", ascending=False), 
                                        subset=cols_status["suido_address"])
            
            # 出力カラムの選択
            df_suido = df_suido[self.OUTPUT_COLUMNS["suido"]]
            df_suido["reference_date"] = self.reference_date

            # 出力
            self.save_csv(df_suido, self.OUTPUT_PATHS["suido"])
        except Exception as e:
            if ERROR_CODE is None:
                set_error(ERROR_00038)
                raise Exception("建物情報のデータが異常です。もう一度データを確認ください。")

            raise Exception(e)

    
def fixing_nums_aft_end_date(row,cols, oldest_date, missing_month):
    """
    getting a value to fill the missing data on 使用中止日
    """
    if not pd.isnull(row[cols["usage_end_date"]]):
        try:
            col = row.index.get_loc(row[cols["usage_end_date"]]) + 1
            row[col:-2] = np.nan
        except:
            if len(missing_month) > 0:
                col = row.index.get_loc((pd.to_datetime(max(missing_month)) + timedelta(days=31)).strftime('%Y-%m'))
                row[col:-2] = np.nan   
    return row

# 住基データの世帯単位の集計
class JukiProcessor(DataProcessor):
    # 各世帯の年齢送別人数を計算
    def calculate_age_groups(self, df):
        """
        各世帯の年齢別人数を計算する
        Parameters
        ----------
        df : pandas.DataFrame
            住民基本台帳データ
        Returns
        -------
        pandas.DataFrame
            年齢別人数が追加された住民基本台帳データ
        """
        cols = COLUMNS["juki"]
        
        # 年齢を計算
        try:
            df["年齢"] = (self.reference_date - df[cols["birth"]]).dt.days // 365
        except:
            set_error(ERROR_00039)
            raise Exception("生年月日のデータが異常です。もう一度データを確認ください。")

        # 年齢別グループを作成
        age_groups = {
            "15歳未満": df["年齢"] < 15,
            "15歳以上64歳以下": (df["年齢"] >= 15) & (df["年齢"] <= 64),
            "65歳以上": df["年齢"] >= 65
        }

        # 各グループに該当するかどうかをフラグ化
        for group, condition in age_groups.items():
            df[group] = condition.astype(int)

        # 各世帯の最大年齢と最小年齢を計算
        age_stats = df.groupby([cols["setai_code"], cols["juki_address"]])["年齢"].agg(最小年齢='min', 最大年齢='max').reset_index()
        
        # 元のデータフレームに最大年齢と最小年齢を結合
        df = pd.merge(df, age_stats, on=[cols["setai_code"], cols["juki_address"]], how="left")

        return df

    def calculate_setai_count(self, df):
        """
        各世帯の人数（世帯人数）を計算してデータフレームに追加する
        Parameters
        ----------
        df : pandas.DataFrame
            住民基本台帳データ
        Returns
        -------
        pandas.DataFrame
            世帯人数が追加されたデータ
        """
        cols = COLUMNS["juki"]
        
        # 世帯ごとの人数をカウント
        setai_count = df.groupby([cols["setai_code"], cols["juki_address"]]).size().reset_index(name='世帯人数')
        
        # 元のデータに世帯人数を結合
        df = pd.merge(df, setai_count, on=[cols["setai_code"], cols["juki_address"]], how="left")
        
        return df


    # 各世帯の年齢別人数の構成比を計算
    def calculate_age_stats(self, df):
        """
        各世帯の年齢別人数の構成比を計算する
        Parameters
        ----------
        df : pandas.DataFrame
            年齢別人数が追加された住民基本台帳データ
        Returns
        -------
        pandas.DataFrame
            年齢別構成比が追加されたデータ
        """
        cols = COLUMNS["juki"]
        group_cols = [cols["setai_code"], cols["juki_address"]]
        age_stats = {}

        total_households = df.groupby(group_cols).size().reset_index(name="total_households")

        for group in ["15歳未満", "15歳以上64歳以下", "65歳以上"]:
            stats = df.groupby(group_cols)[group].sum().reset_index(name=f"{group}人数")
            stats = stats.merge(total_households, on=group_cols)
            stats[f"{group}構成比"] = stats[f"{group}人数"] / stats["total_households"]
            stats.drop(columns="total_households", inplace=True)
            age_stats[group] = stats
        
        df_age_stats = age_stats.pop("15歳未満")
        for group, stats in age_stats.items():
            df_age_stats = df_age_stats.merge(stats, on=group_cols, how="inner")

        return df_age_stats

    # 男女比を計算
    def calculate_gender_ratio(self, df):
        """
        各世帯の男女比を計算する
        Parameters
        ----------
        df : pandas.DataFrame
            住民基本台帳データ
        Returns
        -------
        pandas.DataFrame
            男女比が追加されたデータ
        """
        cols = COLUMNS["juki"]
        gender_counts = df.groupby([cols["setai_code"], cols["juki_address"], cols["sex"]]).size().unstack(fill_value=0)
        gender_counts["男女比"] = gender_counts[2] / (gender_counts[1] + gender_counts[2])
        return gender_counts.reset_index()

    # 住定期間を計算
    def calculate_residence_duration(self, df):
        """
        各世帯の住定期間を計算する
        Parameters
        ----------
        df : pandas.DataFrame
            住民基本台帳データ
        Returns
        -------
        pandas.DataFrame
            住定期間が追加されたデータ
        """
        cols = COLUMNS["juki"]
        
        # 「住定異動年月日」を datetime に変換（フォーマット指定、エラーは NaT に）
        df[cols["move_date"]] = pd.to_datetime(df[cols["move_date"]], format='%Y%m%d', errors='coerce')
        
        # 住定期間を計算（基準日から住定異動年月日を引く）
        try:
            df["住定期間"] = (self.reference_date - df[cols["move_date"]]).dt.days
        except:
            set_error(ERROR_00040)
            raise Exception("住定異動年月日のデータが異常です。もう一度データを確認ください。")
        
        # 各世帯で最大の住定期間を取得
        return df.groupby([cols["setai_code"], cols["juki_address"]])["住定期間"].max().reset_index()

    def process(self):
        # データの読み込み
        df_juki = self.read_data(self.INPUT_PATHS["juki"])
        
        if df_juki is None:
            return
        
        try:
            # 基準日以降の誕生と移動者を除外
            cols = COLUMNS["juki"]
            df_juki = normalize_dates(df_juki, cols["birth"])
            df_juki = normalize_dates(df_juki, cols["move_date"])

            reference_date = pd.to_datetime(self.reference_date, format='%Y/%m/%d')

            df_juki = df_juki.loc[(df_juki[cols["birth"]]<=reference_date)&(df_juki[cols["move_date"]]<=reference_date)].reset_index(drop=True)
            
            # 年齢グループの計算と最大年齢・最小年齢の追加
            df_juki = self.calculate_age_groups(df_juki)
            
            # 各世帯の世帯人数を計算して追加
            df_juki = self.calculate_setai_count(df_juki)
            
            # 各世帯の年齢別人数,構成比，男女比を計算
            df_age_stats = self.calculate_age_stats(df_juki)
            df_gender_ratio = self.calculate_gender_ratio(df_juki)
            df_residence_duration = self.calculate_residence_duration(df_juki)

            # 年齢情報（最大年齢・最小年齢）と世帯人数を元のデータに再結合
            df_juki_processed = pd.merge(df_age_stats, df_juki[['世帯コード', '正規化住所', '最小年齢', '最大年齢', '世帯人数', '住定異動年月日']], 
                                        on=["世帯コード", "正規化住所"], how="left")
            
            # 男女比と住定期間を結合
            df_juki_processed = pd.merge(df_juki_processed, df_gender_ratio, on=["世帯コード", "正規化住所"], how="inner")
            df_juki_processed = pd.merge(df_juki_processed, df_residence_duration, on=["世帯コード", "正規化住所"], how="inner")
            
            # 重複を削除
            df_juki_processed = df_juki_processed.drop_duplicates(subset=["世帯コード", "正規化住所"])

            # 出力カラムの選択
            df_juki_processed = df_juki_processed[self.OUTPUT_COLUMNS["juki"]]
            df_juki_processed["reference_date"] = self.reference_date
        except:
            if ERROR_CODE is None:
                set_error(ERROR_00028)
            raise Exception("住居単位データ作成プロセスにおいて、住民基本台帳データの処理においてエラーが発生しました。")

        # 出力
        self.save_csv(df_juki_processed, self.OUTPUT_PATHS["juki"])


# 固定資産課税台帳、登記簿データの住所単位の集計
class TatemonoProcessor(DataProcessor):
    # 構造を分類(E012で処理するため、ラベルエンコーディングのみ行う可能性あり)
    def classify_structure(self, df):
        """
        建物構造を分類する
        Parameters
        ----------
        df : pandas.DataFrame
            建物データ
        Returns
        -------
        pandas.DataFrame
            構造分類が追加された建物データ
        """
        cols = COLUMNS["tatemono"]
        structure_dict = {
            "木造": ["木造"],
            "RC造": ["RC造", "鉄筋コンクリート造"],
            "S造": ["S造", "鉄骨造"],
            "SRC造": ["SRC造", "鉄骨鉄筋コンクリート造"]
        }
        structure_values  = ["木造", "RC造", "S造", "SRC造", "その他"]
        df["structure_dummy"] = structure_values + [structure_values[-1]] * (len(df) - len(structure_values))

        df["構造名称"] = "その他"
        for key, values in structure_dict.items():
            pattern = "|".join(values)
            df.loc[df[cols["structure"]].str.contains(pattern, na=False), "構造名称"] = key

        label_encoder = LabelEncoder()
        # Initialize and fit LabelEncoder on "structure_dummy" to ensure it learns all possible keys from structure_dict
        df["structure_dummy"] = label_encoder.fit_transform(df["structure_dummy"])
        # Encode "構造名称" using the previously fitted LabelEncoder
        df["構造名称"] = df["構造名称"].map(lambda x: label_encoder.transform([x])[0] if x in label_encoder.classes_ else -1)
        df = df.drop('structure_dummy', axis=1, errors='ignore')

        return df

    def process(self):
        """
        建物データを処理し、構造分類を追加して出力する

        この関数は建物データを読み込み、無効な日付を処理し、構造を分類し、
        重複を除去した後、指定された出力カラムのみを選択して結果を保存します。

        Parameters
        ----------
        None

        Returns
        -------
        None
            処理結果はCSVファイルとして保存されます
        """
        # データの読み込み
        df_tatemono = self.read_data(self.INPUT_PATHS["tatemono"])
        if df_tatemono is None:
            return
        
        try:
            cols = COLUMNS["tatemono"]
            # 登記日付の処理
            df_tatemono[cols["registration_date"]] = pd.to_datetime(df_tatemono[cols["registration_date"]], format='%Y/%m/%d', errors='coerce')
            # NaT（無効な日付）を含む行を除外
            df_tatemono = df_tatemono.dropna(subset=[cols["registration_date"]])
            # 構造を分類し、ラベルエンコーディング
            df_tatemono = self.classify_structure(df_tatemono)
            # 重複データを削除
            df_tatemono = self.drop_duplicates(df_tatemono, subset=cols["tatemono_address"], keep="first")
            # 出力カラムの選択      
            df_tatemono = df_tatemono[self.OUTPUT_COLUMNS["tatemono"]]
            df_tatemono["reference_date"] = self.reference_date
        except:
            if ERROR_CODE is None:
                set_error(ERROR_00029)
            raise Exception("住居単位データ作成プロセスにおいて、登記データの処理においてエラーが発生しました。")

        # 出力
        self.save_csv(df_tatemono, self.OUTPUT_PATHS["tatemono"])

def set_columns(
    suido_number, usage_status, suido_status_address, usage_start_date, usage_end_date,
    suido_number2, meter_reading_date, suido_usage,
    setai_code, juki_address, birth, gender, move_date,
    *args
):
    global COLUMNS
    # suido_statusセクション
    COLUMNS["suido_status"]["suido_number"] = suido_number
    COLUMNS["suido_status"]["usage_status"] = usage_status
    COLUMNS["suido_status"]["usage_start_date"] = usage_start_date
    COLUMNS["suido_status"]["usage_end_date"] = usage_end_date

    # suido_use
    COLUMNS["suido_use"]["suido_number"] = suido_number2
    COLUMNS["suido_use"]["meter_reading_date"] = meter_reading_date
    COLUMNS["suido_use"]["suido_usage"] = suido_usage

    # jukiセクション
    COLUMNS["juki"]["setai_code"] = setai_code
    COLUMNS["juki"]["birth"] = birth
    COLUMNS["juki"]["sex"] = gender
    COLUMNS["juki"]["move_date"] = move_date

    
# すべてのデータを処理する関数を作成
def process_all_data(suido_use_file, suido_status_file, juki_file, tatemono_file, reference_date, search_period, output_directory, job_id, db_path=None):
    """
    すべてのデータファイルを処理する
    Parameters
    ----------
    suido_use_file : file
        水道使用量データファイル
    suido_status_file : file
        水道状況データファイル
    juki_file : file
        住民基本台帳データファイル
    tatemono_file : file
        建物データファイル
    reference_date : int
        基準日（YYYYMMDD形式）
    search_period : int
        検索期間（年）
    Returns
    -------
    list
        処理済みファイルのパスリスト
    """
    try:
        if db_path:
            connect_sqllite(db_path)
        progress_percent = 0
        task_id = None
        if job_id:
            task_id = create_or_update_job_task(job_id, progress_percent=progress_percent, preprocess_type="e013", error_code=None, error_msg=None, result=None)
        # 入力ファイルのパスを設定
        # 各ファイルオブジェクトから名前（パス）を取得し、辞書形式で保存
        input_paths = {}
        
        # 各データ処理クラスを実行
        processors = {}
        
        # 出力ファイルのパスを設定
        # 処理後のファイルの保存先パスを辞書形式で定義
        output_paths = {}
        if juki_file:
            input_paths['juki'] = juki_file
            output_paths['juki'] = f"{output_directory}/juki_residence.csv"
            processors['juki'] = JukiProcessor
        if suido_status_file:
            input_paths['suido_status'] = suido_status_file
        if suido_use_file:
            input_paths['suido_use'] = suido_use_file
            output_paths['suido'] = f"{output_directory}/suido_residence.csv"
            processors['suido'] = SuidoProcessor
        if tatemono_file:
            input_paths['tatemono'] = tatemono_file
            output_paths['tatemono'] = f"{output_directory}/touki_residence.csv"
            processors['tatemono'] = TatemonoProcessor
        
        if output_directory is None:
            output_directory = './E013/outputs'

        os.makedirs(output_directory, exist_ok=True)

        progress_percent_job = 25
        for file_key, processor_class in processors.items():
            if job_id:
                progress_percent += 30
                progress_percent_job += 8
                create_or_update_job_task(job_id, progress_percent=progress_percent, preprocess_type="e013", error_code=None, error_msg=None, result=None, id= task_id)
                create_or_update_job(job_id, progress_percent_job)
            processor_class(input_paths, output_paths, reference_date, search_period).process()

        if job_id:
            create_or_update_job_task(job_id, progress_percent="100", preprocess_type="e013", error_code=None, error_msg=None, result=json.dumps({}), id= task_id, is_finish=True)
        
        return [path for path in output_paths.values() if os.path.exists(path)]
    except Exception as e:
        if ERROR_CODE is None:
            set_error(ERROR_00010)
        if task_id is not None:
            create_or_update_job_task(job_id, progress_percent="", preprocess_type="e013", error_code=ERROR_CODE, error_msg=ERROR_MSG, result=json.dumps({}), id= task_id, is_finish=True)
        raise Exception("住居単位データ作成プロセスにおいて、水道データの処理においてエラーが発生しました。")

def normalize_dates(df, column, formats=['%Y/%m/%d', '%Y-%m-%d', '%d/%m/%Y', '%d-%m-%Y', '%m/%d/%Y', '%m-%d-%Y', '%Y%m%d']):
    # Initialize the temporary column with NaN values
    temp_column = f'{column}_normalized'
    df[temp_column] = np.nan

    df[column] = df[column].astype(str).str.split().str[0].str.rstrip('.0')
    # Try the provided formats on the invalid values
    for fmt in formats:
        mask = df[temp_column].isna() & df[column].notna()
        df.loc[mask, temp_column] = pd.to_datetime(
            df.loc[mask, column], format=fmt, errors='coerce'
        )

    # Remove the time portion and keep only the date
    df[column] = pd.to_datetime(df[temp_column], errors='coerce')
    
    return df.drop(f'{column}_normalized',axis=1)

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
