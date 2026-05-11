from flask import Flask, render_template, jsonify
import mysql.connector
from dotenv import load_dotenv
import os
import sys
import threading
import logging

load_dotenv()

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data'))
from simulator import main as _sim_main

_sim_thread = None
_sim_stop   = threading.Event()
class _NoAccessLog(logging.Filter):
    def filter(self, record):
        return ' - - [' not in record.getMessage()

logging.getLogger('werkzeug').addFilter(_NoAccessLog())

app = Flask(__name__, template_folder='app/templates', static_folder='app/static')


def get_db():
    conn = mysql.connector.connect(
        host=os.getenv("DB_HOST"),
        port=int(os.getenv("DB_PORT", 3306)),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        database=os.getenv("DB_NAME"),
        ssl_ca=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ca.pem'),
        ssl_verify_cert=True
    )
    return conn

@app.route('/')
def cover():
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT AVG(oee) AS avg_oee FROM oee_log")
    summary = cursor.fetchone()
    cursor.execute("SELECT COUNT(*) AS cnt FROM equipment")
    equip_count = cursor.fetchone()['cnt']
    cursor.close()
    conn.close()
    return render_template('cover.html', summary=summary, equip_count=equip_count)

@app.route('/dashboard')
def index():
    conn = get_db()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("""
                   SELECT e.equipment_name,
                   o.log_date,
                   o.availability,
                   o.performance,
                   o.quality,
                   o.oee
                   FROM oee_log o
                   JOIN equipment e ON o.equipment_id = e.equipment_id
                   ORDER BY o.log_date DESC
                   """)
    oee_data = cursor.fetchall()
    cursor.execute("""
                   SELECT
                   AVG(availability) AS avg_availability,
                   AVG(performance) AS avg_performance,
                   AVG(quality) AS avg_quality,
                   AVG(oee) AS avg_oee
                   FROM oee_log
                   """)
    summary = cursor.fetchone()

    cursor.execute("""
                   SELECT log_date, equipment_id, AVG(oee) AS oee
                   FROM oee_log
                   GROUP BY log_date, equipment_id
                   ORDER BY log_date ASC
                   """)
    chart_data = cursor.fetchall()

    cursor.execute("""
                    SELECT e.equipment_name, AVG(o.oee) AS avg_oee
                    FROM oee_log o
                    JOIN equipment e ON o.equipment_id = e.equipment_id
                    GROUP BY e.equipment_name
                    """)
    bar_data = cursor.fetchall()
    cursor.close()
    conn.close()

    return render_template('index.html',
                           oee_data=oee_data,
                           summary=summary,
                           chart_data=chart_data,
                           bar_data=bar_data)

@app.route('/failure')
def failure():
    conn = get_db()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("""
                    SELECT f.failure_date, f.failure_time, e.equipment_name, f.cause, f.downtime
                    FROM failure_log f
                    JOIN equipment e ON f.equipment_id = e.equipment_id
                    ORDER BY f.failure_date DESC, f.failure_time DESC
                    """)
    failure_data = cursor.fetchall()

    cursor.execute("""
                    SELECT cause, SUM(downtime) AS total_downtime
                    FROM failure_log
                    GROUP BY cause
                    ORDER BY total_downtime DESC
                    """)
    pareto_data = cursor.fetchall()

    cursor.execute("""
                    SELECT
                        CASE
                            WHEN HOUR(failure_time) >= 6 AND HOUR(failure_time) < 14 THEN 'A'
                            WHEN HOUR(failure_time) >= 14 AND HOUR(failure_time) < 22 THEN 'B'
                            ELSE 'C'
                        END AS shift,
                        COUNT(*) AS cnt,
                        SUM(downtime) AS total_downtime
                    FROM failure_log
                    WHERE failure_time IS NOT NULL
                    GROUP BY shift
                    ORDER BY shift
                    """)
    shift_failure = cursor.fetchall()

    cursor.close()
    conn.close()
    return render_template('failure.html',
                           failure_data=failure_data,
                           pareto_data=pareto_data,
                           shift_failure=shift_failure)

@app.route('/maintenance')
def maintenance():
    conn = get_db()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("""
                    SELECT m.maintenance_date,
                    e.equipment_name,
                    m.type,
                    m.engineer,
                    m.shift,
                    m.note
                    FROM maintenance_log m
                    JOIN equipment e ON m.equipment_id = e.equipment_id
                    ORDER BY m.maintenance_date DESC
                    """)
    maintenance_data = cursor.fetchall()

    cursor.close()
    conn.close()
    return render_template('maintenance.html', maintenance_data=maintenance_data)

@app.route('/shift')
def shift():
    conn = get_db()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("""
        SELECT e.equipment_name, s.log_date, s.shift,
               s.availability, s.performance, s.quality, s.oee
        FROM oee_shift_log s
        JOIN equipment e ON s.equipment_id = e.equipment_id
        ORDER BY s.log_date DESC, s.shift
    """)
    shift_data = cursor.fetchall()

    cursor.execute("""
        SELECT shift,
               AVG(availability) AS avg_availability,
               AVG(performance) AS avg_performance,
               AVG(quality) AS avg_quality,
               AVG(oee) AS avg_oee
               FROM oee_shift_log
               GROUP BY shift
               ORDER BY shift
    """)
    shift_summary = cursor.fetchall()

    cursor.execute("""
        SELECT e.equipment_name, s.shift, AVG(s.oee) AS avg_oee
        FROM oee_shift_log s
        JOIN equipment e ON s.equipment_id = e.equipment_id
        GROUP BY e.equipment_name, s.shift
        ORDER BY e.equipment_name, s.shift
    """)
    shift_chart = cursor.fetchall()

    cursor.close()
    conn.close()
    return render_template('shift.html',
                           shift_data=shift_data,
                           shift_summary=shift_summary,
                           shift_chart=shift_chart)

@app.route('/api/simulator/start', methods=['POST'])
def start_simulator():
    global _sim_thread, _sim_stop
    if _sim_thread and _sim_thread.is_alive():
        return jsonify({'status': 'already_running'})
    _sim_stop = threading.Event()
    _sim_thread = threading.Thread(target=_sim_main, args=(_sim_stop,), daemon=True)
    _sim_thread.start()
    print('[DATA] 시뮬레이터 시작')
    return jsonify({'status': 'started'})

@app.route('/api/simulator/stop', methods=['POST'])
def stop_simulator():
    global _sim_stop
    _sim_stop.set()
    print('[DATA] 시뮬레이터 중지')
    return jsonify({'status': 'stopped'})

@app.route('/api/simulator/status')
def simulator_status():
    running = _sim_thread is not None and _sim_thread.is_alive()
    return jsonify({'running': running})

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False, use_reloader=False)
