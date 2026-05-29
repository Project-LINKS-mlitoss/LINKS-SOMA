"""統合テスト用共通フィクスチャ・ヘルパー

複数の統合テストファイルで共通するDBクエリヘルパーを提供する。
テーブルスキーマはテストごとに異なるため、DB作成は各テストファイルで行う。
"""

import sqlite3


def query_all(db_path: str, table: str) -> list[dict]:
    """指定テーブルの全レコードを辞書リストで取得する"""
    with sqlite3.connect(db_path) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(f"SELECT * FROM {table}").fetchall()  # noqa: S608
    return [dict(r) for r in rows]


def query_by_job_id(db_path: str, table: str, job_id: int) -> list[dict]:
    """指定テーブルからjob_idでフィルタしたレコードを取得する"""
    with sqlite3.connect(db_path) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            f"SELECT * FROM {table} WHERE job_id = ?", (job_id,)  # noqa: S608
        ).fetchall()
    return [dict(r) for r in rows]


def insert_row(db_path: str, table: str, **columns) -> int:
    """指定テーブルに1行挿入してIDを返す"""
    col_names = ", ".join(columns.keys())
    placeholders = ", ".join("?" * len(columns))
    with sqlite3.connect(db_path) as conn:
        cursor = conn.execute(
            f"INSERT INTO {table} ({col_names}) VALUES ({placeholders})",  # noqa: S608
            tuple(columns.values()),
        )
        row_id = cursor.lastrowid
    return row_id
