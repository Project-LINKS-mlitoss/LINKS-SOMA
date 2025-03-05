
from datetime import datetime, timezone
import sqlite3
import pandas as pd


CONNECTION = None
CURSOR = None

def connect_sqllite(db_path: str):
    global CONNECTION
    global CURSOR
    CONNECTION = sqlite3.connect(db_path)
    CURSOR = CONNECTION.cursor()

def create_or_update_job(job_id: int, status: str, job_type: str = "", process_id: int = 0, is_named: int = 0, parameters: str = "") -> int:
    try:
        if job_id is None:
            CURSOR.execute("""
                INSERT INTO jobs (status, type, parameters, process_id, is_named) 
                    VALUES (?, ?, ?, ?, ?)
                        """, (status, job_type, parameters, process_id, is_named))
            job_id = CURSOR.lastrowid
        else:
            CURSOR.execute("""
                UPDATE jobs SET status = ? WHERE id = ?
                        """, (status, job_id))
            
        CONNECTION.commit()

        return job_id
    except sqlite3.Error as e:
        CONNECTION.rollback()
        return None
    
def create_or_update_job_task(job_id: int, progress_percent: str, preprocess_type: str|None, error_code: str, error_msg: str, result, id: int = None, is_finish: bool = False) -> int:
    try:
        finished_at = None
        if is_finish:
            finished_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        if id is None:
            CURSOR.execute("""
            INSERT INTO job_tasks(job_id, progress_percent, preprocess_type, error_code, result)
            VALUES (?, ?, ?, ?, ?)
            """, (job_id, progress_percent, preprocess_type, error_code, result))
            id = CURSOR.lastrowid
        else:
            if progress_percent:
                CURSOR.execute("""
                UPDATE job_tasks SET progress_percent = ?, preprocess_type = ?, error_code = ?, error_msg = ?, result = ?, finished_at = ? WHERE id = ?
                """, (progress_percent, preprocess_type, error_code, error_msg, result, finished_at, id))
            else:
                CURSOR.execute("""
                UPDATE job_tasks SET preprocess_type = ?, error_code = ?, error_msg = ?, result = ?, finished_at = ? WHERE id = ?
                """, (preprocess_type, error_code, error_msg, result, finished_at, id))
        CONNECTION.commit()
        return id
    except Exception as e:
        CONNECTION.rollback()
        raise e
    
def create_job_results(job_id: int, file_path: str):
    try:
        CURSOR.execute("""
                    INSERT INTO job_results (job_id, file_path) 
                        VALUES (?, ?)
                            """, (job_id, file_path))
        CONNECTION.commit()
    except sqlite3.Error as e:
        CONNECTION.rollback()
        
def concatenate(path_1: str, path_2: str):
    try:
        return f"{path_1}/{path_2}".replace("//", "/")
    except:
        return path_2
    
def create_data_set_detail_buildings_or_area(input_data, table_name="data_set_detail_buildings"):
    try:
        input_data.to_sql(table_name, CONNECTION, if_exists='append', index=False)
        return True
    except sqlite3.Error as e:
        return False
        
def create_data_set_results(title: str = ""):
    try:
        current_date = datetime.now().strftime('%m%d')
        base_title = f"空き家推定結果_{current_date}"
        title = base_title

        sql_check = f'SELECT COUNT(*) FROM data_set_results WHERE title LIKE "{base_title}%"'
        CURSOR.execute(sql_check)
        count = CURSOR.fetchone()[0]
        
        if count > 0:
            title = f"{base_title}_{count + 1}"
                    
        sql = f'INSERT INTO data_set_results (title) VALUES ("{title}")'
        CURSOR.execute(sql)
        CONNECTION.commit()
        id = CURSOR.lastrowid
        return id
    except sqlite3.Error as e:
        CONNECTION.rollback()
        return None
    
def get_data_set_detail_buildings_or_area(data_set_result_id, reference_date=None, table_name="data_set_detail_buildings"):
    try:
        if not reference_date:
            return pd.read_sql(f"SELECT * FROM {table_name} where data_set_result_id = {data_set_result_id}", CONNECTION)
        else:
            return pd.read_sql(f"SELECT * FROM {table_name} where data_set_result_id = {data_set_result_id} and reference_date = '{reference_date}'", CONNECTION)
            
    except sqlite3.Error as e:
        return None