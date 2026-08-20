"""統合テスト共通フィクスチャ

全インタフェース（IF001〜IF005）が使用するテスト用DBスキーマを提供する。
各テストは必要なテーブルだけ使用し、不要なテーブルは無視してよい。
"""

import sqlite3

import pytest


@pytest.fixture()
def test_db(tmp_path):
    """テスト用SQLiteデータベースを作成して返す

    全インタフェースが必要とするテーブルのスーパーセット:
    - jobs: ジョブ管理
    - job_tasks: タスク進捗・エラー記録
    - job_results: 出力ファイル登録
    - data_set_results: 結果メタデータ
    - data_set_detail_buildings: 建物単位推定結果
    - data_set_detail_areas: 地域単位集計結果
    """
    db_path = str(tmp_path / "test.db")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE jobs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            status TEXT,
            type TEXT,
            parameters TEXT,
            process_id INTEGER,
            is_named INTEGER
        )
    """)
    cursor.execute("""
        CREATE TABLE job_tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            job_id INTEGER NOT NULL,
            progress_percent TEXT,
            preprocess_type TEXT,
            error_code TEXT,
            error_msg TEXT,
            result TEXT,
            finished_at TEXT
        )
    """)
    cursor.execute("""
        CREATE TABLE job_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            job_id INTEGER NOT NULL,
            file_path TEXT
        )
    """)
    cursor.execute("""
        CREATE TABLE data_set_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT,
            job_id INTEGER
        )
    """)
    cursor.execute("""
        CREATE TABLE data_set_detail_buildings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            data_set_result_id INTEGER,
            reference_date TEXT,
            building_id TEXT,
            building_structure_type TEXT,
            predicted_label INTEGER,
            predicted_probability REAL,
            lat_geocoding REAL,
            lon_geocoding REAL,
            normalized_address TEXT,
            bldg_geometry TEXT,
            area_group TEXT,
            key_code TEXT,
            predicted_probability_change_rate_from_oldest REAL,
            predicted_probability_change_rate_from_previous REAL,
            residence_id TEXT,
            is_vacant INTEGER,
            vacant_type TEXT,
            vacant_source TEXT,
            vacant_year TEXT,
            address_precision_flag INTEGER,
            optional_data_source TEXT
        )
    """)
    cursor.execute("""
        CREATE TABLE data_set_detail_areas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            data_set_result_id INTEGER,
            reference_date TEXT,
            vacant_house_count INTEGER,
            predicted_probability REAL,
            area_group TEXT,
            geometry TEXT
        )
    """)
    # 登録データセット。エラー文面へ登録ファイル名（file_name）を添える際、IF001 が
    # payload の path（=file_path）をキーに引く（app 側 raw_data_sets のサブセット）。
    cursor.execute("""
        CREATE TABLE raw_data_sets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            file_name TEXT NOT NULL,
            file_path TEXT NOT NULL
        )
    """)
    # 名寄せ済みデータセット。推定(IF003)のエラーに対象データ名を添える際に file_path で引く。
    cursor.execute("""
        CREATE TABLE normalized_data_sets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            file_name TEXT NOT NULL,
            file_path TEXT NOT NULL
        )
    """)
    # 分析画面のビュー。データ出力(IF004)を view_id 付きで呼ぶと parameters の
    # 表示項目が SELECT 句になる（app 側 result_views のサブセット）。
    cursor.execute("""
        CREATE TABLE result_views (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sheet_id INTEGER,
            data_set_result_id INTEGER,
            title TEXT,
            unit TEXT,
            style TEXT,
            parameters TEXT
        )
    """)
    conn.commit()
    conn.close()
    return db_path
