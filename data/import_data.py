import mysql.connector
import pandas as pd
import os
import random


conn = mysql.connector.connect(
    host = "127.0.0.1",
    user = "root",
    password = "dltnals0920!",
    database = "ajin_oee"
)

cursor = conn.cursor()
print("MySQL 연결 성공")

equipment_data = [
    ("M1","A라인","2026-04-07"),
    ("M2","B라인","2026-06-15")
]

sql = "INSERT INTO equipment(equipment_name, line_name, install_date) VALUES (%s, %s, %s)"
cursor.executemany(sql,equipment_data)
conn.commit()
print("equipment 삽입완료")

DATA_DIR = os.path.dirname(os.path.abspath(__file__))
oee_df = pd.read_csv(f"{DATA_DIR}/oee_by_day.csv")

machine_map = {"M1" : 1, "M2" : 2}
oee_df["equipment_id"] = oee_df["machine"].map(machine_map)

sql = """INSERT INTO oee_log
         (equipment_id, log_date, availability, performance, quality, oee)
         VALUES (%s, %s, %s, %s, %s, %s)"""

for _, row in oee_df.iterrows():
    cursor.execute(sql, (
        row["equipment_id"], 
        row["day"], 
        row["availability"], 
        row["performance"], 
        row["quality"], 
        row["oee"]
        ))
conn.commit()
print("oee_log 삽입완료")

pareto_df = pd.read_csv(f"{DATA_DIR}/downtime_pareto.csv")
pareto_df["equipment_id"] = pareto_df["machine"].map(machine_map)

sql = """INSERT INTO failure_log
            (equipment_id, failure_date, cause, downtime, action_taken)
            VALUES (%s, %s, %s, %s, %s)"""

for _, row in pareto_df.iterrows():
    cursor.execute(sql, (
        row["equipment_id"],
        row["day"],
        row["cause"],
        row["minutes"],
        None
    ))            
            
conn.commit()
print("failure_log 삽입완료")
        
maintenance_data = []
types = ['정기점검', '긴급수리', '부품교체']
engineers = ['이수민', '박준혁', '황순봉']

for equipment_id in [1, 2]:
    for month in range(5,6):
        for week in range(1,5):
            maintenance_data.append((
                equipment_id,
                f"2026-05-{week * 7:02d}",
                random.choice(types),
                random.choice(engineers),
                "정상 완료"
            ))
            
sql = """INSERT INTO maintenance_log
            (equipment_id, maintenance_date, type, engineer, note)
            VALUES (%s, %s, %s, %s, %s)"""
            
cursor.executemany(sql, maintenance_data)
conn.commit()
print("maintenance_log 삽입완료")