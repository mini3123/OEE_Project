import threading
import os
import numpy as np
import mysql.connector
from dotenv import load_dotenv
from datetime import date, timedelta, datetime

load_dotenv()

IDEAL_RATE = 6
MACHINES = ["M1", "M2"]
DOWNTIME_CAUSES = ["Mechanical", "Electrical", "Changeover", "Blocked", "Starved", "Quality"]
SHIFT_ENGINEER = {"A": "이수민", "B": "박준혁", "C": "황순봉"}
MTYPE_MAP = {
    "Mechanical": "긴급수리", "Electrical": "긴급수리",
    "Changeover": "부품교체", "Quality": "부품교체",
    "Blocked": "정기점검", "Starved": "정기점검"
}
# 교대 경계: A=0~479분, B=480~959분, C=960~1439분 (6시 기준)
SHIFT_BOUNDS = [("A", 0, 480), ("B", 480, 960), ("C", 960, 1440)]

MINUTES_PER_TICK = 60   # 틱당 시뮬 분 (1시간)
TICK_SLEEP = 3          # 실제 대기 초 → 1일 = 24틱 = 72초


def get_conn():
    return mysql.connector.connect(
        host=os.getenv("DB_HOST", "127.0.0.1"),
        port=int(os.getenv("DB_PORT", 3306)),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        database=os.getenv("DB_NAME"),
        ssl_ca=os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'ca.pem'),
        ssl_verify_cert=True
    )


def shift_of(sim_min):
    for name, start, end in SHIFT_BOUNDS:
        if start <= sim_min < end:
            return name
    return "C"


def simulate_minutes(n_min):
    fail_probs = {
        "Mechanical": 0.0009, "Electrical": 0.0006, "Changeover": 0.0007,
        "Blocked": 0.0006, "Starved": 0.0006, "Quality": 0.0005
    }
    running = 0; total = 0; good = 0; failures = []
    i = 0
    while i < n_min:
        fired = [c for c in DOWNTIME_CAUSES if np.random.rand() < fail_probs[c]]
        if fired:
            cause = np.random.choice(fired)
            dur = int(min(np.random.randint(5, 40), n_min - i))
            failures.append((cause, dur))
            i += dur
        else:
            u = int(np.random.poisson(IDEAL_RATE))
            s = 1 if (u > 0 and np.random.rand() < 0.02) else 0
            total += u; good += u - s; running += 1
            i += 1
    return running, total, good, failures


def calc_oee(planned, running, total, good):
    avail = running / planned if planned > 0 else 0.0
    perf = total / (IDEAL_RATE * running) if running > 0 else 0.0
    qual = good / total if total > 0 else 0.0
    return round(avail, 4), round(perf, 4), round(qual, 4), round(avail * perf * qual, 4)


def empty_state():
    return {"planned": 0, "running": 0, "total": 0, "good": 0}


SHIFT_START = {"A": 0, "B": 480, "C": 960}


def restore_day_state_from_shifts(cur, sim_date, eq_ids):
    """완료된 교대 기록에서 당일 누적 day_state 복원 (근사값)."""
    day_state = {m: empty_state() for m in MACHINES}
    for m in MACHINES:
        eq_id = eq_ids[m]
        cur.execute(
            "SELECT availability, performance, quality FROM oee_shift_log "
            "WHERE equipment_id = %s AND log_date = %s",
            (eq_id, sim_date)
        )
        for avail, perf, qual in cur.fetchall():
            planned = 480
            running = round(avail * planned)
            total   = round(perf * running * IDEAL_RATE) if running > 0 else 0
            good    = round(qual * total) if total > 0 else 0
            day_state[m]["planned"] += planned
            day_state[m]["running"] += running
            day_state[m]["total"]   += total
            day_state[m]["good"]    += good
    return day_state


def main(stop_event=None):
    if stop_event is None:
        stop_event = threading.Event()

    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT MAX(log_date) FROM oee_log")
    last_date = cur.fetchone()[0]
    cur.execute("SELECT equipment_name, equipment_id FROM equipment")
    eq_ids = {row[0]: row[1] for row in cur.fetchall()}

    sim_date = last_date + timedelta(days=1)

    # 당일 이미 완료된 교대 확인 → 중단 지점부터 재개
    cur.execute(
        "SELECT DISTINCT sl.shift FROM oee_shift_log sl "
        "JOIN equipment e ON sl.equipment_id = e.equipment_id "
        "WHERE sl.log_date = %s",
        (sim_date,)
    )
    done_shifts = {row[0] for row in cur.fetchall()}
    remaining   = [s for s in ("A", "B", "C") if s not in done_shifts]

    if not remaining:
        # 세 교대 모두 완료됐는데 day_log 없는 엣지케이스 → 다음 날로
        sim_date += timedelta(days=1)
        sim_min, current_shift = 0, "A"
        day_state = {m: empty_state() for m in MACHINES}
    else:
        current_shift = remaining[0]
        sim_min = SHIFT_START[current_shift]
        day_state = (restore_day_state_from_shifts(cur, sim_date, eq_ids)
                     if done_shifts else {m: empty_state() for m in MACHINES})

    cur.close(); conn.close()

    shift_state = {m: empty_state() for m in MACHINES}

    resume_info = f"재개: {sim_date} {current_shift}조({sim_min//60+6:02d}:00~)" if done_shifts else f"시작일: {sim_date}"
    print(f"시뮬레이터 시작 | {resume_info} | 틱={MINUTES_PER_TICK}분, 간격={TICK_SLEEP}초")
    print(f"1일 = {1440 // MINUTES_PER_TICK * TICK_SLEEP}초 실시간")

    while not stop_event.is_set():
        conn = get_conn()
        cur = conn.cursor()

        for m in MACHINES:
            eq_id = eq_ids[m]
            running, total, good, failures = simulate_minutes(MINUTES_PER_TICK)

            for state in [day_state[m], shift_state[m]]:
                state["planned"] += MINUTES_PER_TICK
                state["running"] += running
                state["total"] += total
                state["good"] += good

            # 고장 + 유지보수 기록
            tick_hour = (6 + sim_min // 60) % 24
            for cause, dur in failures:
                fail_min_offset = int(np.random.randint(0, MINUTES_PER_TICK))
                fh = (tick_hour + fail_min_offset // 60) % 24
                fm = fail_min_offset % 60
                cur.execute(
                    "INSERT INTO failure_log (equipment_id, failure_date, failure_time, cause, downtime) "
                    "VALUES (%s, %s, %s, %s, %s)",
                    (eq_id, sim_date, f"{fh:02d}:{fm:02d}:00", cause, dur)
                )
                if dur >= 10 and np.random.rand() < 0.6:
                    eng = SHIFT_ENGINEER[current_shift]
                    cur.execute(
                        "INSERT INTO maintenance_log (equipment_id, maintenance_date, type, engineer, shift, note) "
                        "VALUES (%s, %s, %s, %s, %s, %s)",
                        (eq_id, sim_date, MTYPE_MAP[cause], eng, current_shift, "정상 완료")
                    )

        sim_min += MINUTES_PER_TICK
        new_shift = shift_of(sim_min % 1440)

        # 교대 경계
        if new_shift != current_shift or sim_min % 480 == 0:
            for m in MACHINES:
                eq_id = eq_ids[m]
                avail, perf, qual, oee = calc_oee(**shift_state[m])
                cur.execute(
                    "INSERT INTO oee_shift_log (equipment_id, log_date, shift, availability, performance, quality, oee) "
                    "VALUES (%s, %s, %s, %s, %s, %s, %s)",
                    (eq_id, sim_date, current_shift, avail, perf, qual, oee)
                )
                shift_state[m] = empty_state()
            print(f"  교대 완료: {sim_date} {current_shift}조 → {new_shift}조")
            current_shift = new_shift

        # 하루 완료 (1440분)
        if sim_min >= 1440:
            for m in MACHINES:
                eq_id = eq_ids[m]
                avail, perf, qual, oee = calc_oee(**day_state[m])
                cur.execute(
                    "INSERT INTO oee_log (equipment_id, log_date, availability, performance, quality, oee) "
                    "VALUES (%s, %s, %s, %s, %s, %s)",
                    (eq_id, sim_date, avail, perf, qual, oee)
                )
                day_state[m] = empty_state()

            conn.commit()
            cur.close(); conn.close()

            print(f"[{datetime.now():%H:%M:%S}] 일 완료: {sim_date} → {sim_date + timedelta(days=1)}")
            sim_date += timedelta(days=1)
            sim_min = 0
            current_shift = "A"
            stop_event.wait(TICK_SLEEP)
            continue

        conn.commit()
        cur.close(); conn.close()

        sim_hour = (6 + sim_min // 60) % 24
        print(f"[{datetime.now():%H:%M:%S}] {sim_date} {sim_hour:02d}:00 ({current_shift}조) | "
              f"M1 OEE≈{calc_oee(**day_state['M1'])[3]:.1%} M2 OEE≈{calc_oee(**day_state['M2'])[3]:.1%}")
        stop_event.wait(TICK_SLEEP)


if __name__ == "__main__":
    main()
