import os
import random
import numpy as np
import pandas as pd

SEED = 1337
random.seed(SEED)
np.random.seed(SEED)

WORK = os.path.dirname(os.path.abspath(__file__))
DAYS = 30
FREQ = "min"
IDEAL_RATE = 6
MACHINES = ["M1", "M2"]
DOWNTIME_CAUSES = ["Mechanical", "Electrical", "Changeover", "Blocked", "Starved", "Quality"]

start = pd.Timestamp("2026-05-01 06:00:00")
end = start + pd.Timedelta(days=DAYS)
time_index = pd.date_range(start, end, freq=FREQ, inclusive="left")

def shift_name(ts):
    h = ts.hour
    if 6 <= h < 14:
        return "A"
    if 14 <= h < 22:
        return "B"
    return "C"

calendar = pd.DataFrame({"timestamp": time_index})
calendar["shift"] = [shift_name(ts) for ts in time_index]
calendar["day"] = calendar["timestamp"].dt.date

def synth_machine(machine):
    fail_probs = {
        "Mechanical": 0.0009, "Electrical": 0.0006, "Changeover": 0.0007,
        "Blocked": 0.0006, "Starved": 0.0006, "Quality": 0.0005
    }
    df = pd.DataFrame({"timestamp": time_index, "machine": machine, "is_running": 1})
    for c in DOWNTIME_CAUSES:
        df[f"cause_{c}"] = 0

    i, n = 0, len(df)
    while i < n:
        fired = [c for c in DOWNTIME_CAUSES if np.random.rand() < fail_probs[c]]
        if fired and df.loc[i, "is_running"] == 1:
            cause = np.random.choice(fired)
            L = np.random.randint(5, 40)
            j = min(i + L, n)
            df.loc[i:j, "is_running"] = 0
            df.loc[i, f"cause_{cause}"] = 1
            i = j
        else:
            i += 1

    rate_shift = df["timestamp"].dt.hour.map(lambda h: 0.5 if h in [6, 14, 22] else 0.0)    # 교대 시작시간(06:00, 14:00, 22:00)에 생상량이 살짝 올라가게 설정
    lam = IDEAL_RATE + rate_shift.values
    df["units"] = np.where(df["is_running"] == 1, np.random.poisson(lam), 0)
    df["scrap"] = (np.random.rand(n) < 0.02).astype(int) * (df["units"] > 0).astype(int)
    df["good_units"] = df["units"] - df["scrap"]
    return df

raw = pd.concat([synth_machine(m) for m in MACHINES], ignore_index=True)
raw = raw.merge(calendar, on="timestamp", how="left")
raw = raw.sort_values(["timestamp", "machine"]).reset_index(drop=True)

def calc_oee(df):
    df = df.copy()
    df["availability"] = np.where(df["planned_min"] > 0, df["running_min"] / df["planned_min"], 0.0)
    df["performance"] = np.where(df["running_min"] > 0, df["total_units"] / (IDEAL_RATE * df["running_min"]), 0.0)
    df["quality"] = np.where(df["total_units"] > 0, df["good_units"] / df["total_units"], 0.0)
    df["oee"] = df["availability"] * df["performance"] * df["quality"]
    return df

oee_day = raw.groupby(["machine", "day"], as_index=False).agg(
    planned_min=("is_running", "size"),
    running_min=("is_running", "sum"),
    total_units=("units", "sum"),
    good_units=("good_units", "sum")
)
oee_day = calc_oee(oee_day)
oee_day.to_csv(f"{WORK}/oee_by_day.csv", index=False)

oee_shift = raw.groupby(["machine", "day", "shift"], as_index=False).agg(
    planned_min=("is_running", "size"),
    running_min=("is_running", "sum"),
    total_units=("units", "sum"),
    good_units=("good_units", "sum")
)
oee_shift = calc_oee(oee_shift)
oee_shift.to_csv(f"{WORK}/oee_by_shift.csv", index=False)

def intervals_from_flags(df, cause_col):
    starts = df.index[df[cause_col] == 1].tolist()
    intervals = []
    n = len(df)
    for s in starts:
        e = min(s + 1, n)
        while e < n and df.loc[e, "is_running"] == 0:
            e += 1
        dur = max(0, e - s)
        if dur > 0:
            intervals.append((df.loc[s, "timestamp"], df.loc[max(0, e-1), "timestamp"], dur))
    return intervals

rows = []
for (m, d), g in raw.groupby(["machine", "day"], sort=False):
    g = g.sort_values("timestamp").reset_index(drop=True)
    for cause in DOWNTIME_CAUSES:
        for (ts_start, ts_end, minutes) in intervals_from_flags(g, f"cause_{cause}"):
            rows.append({"machine": m, "day": d, "cause": cause,
                         "start": ts_start, "end": ts_end, "minutes": int(minutes)})

downtime = pd.DataFrame(rows, columns=["machine", "day", "cause", "start", "end", "minutes"])
pareto = (downtime.groupby(["machine", "day", "cause"], as_index=False)["minutes"]
          .sum()
          .sort_values(["machine", "day", "minutes"], ascending=[True, True, False])
          .reset_index(drop=True))
pareto.to_csv(f"{WORK}/downtime_pareto.csv", index=False)
downtime.to_csv(f"{WORK}/downtime_events.csv", index=False)

raw.to_csv(f"{WORK}/factory_synth_minutely.csv", index=False)

print("CSV 파일 생성 완료:")
for f in ["oee_by_day.csv", "oee_by_shift.csv", "downtime_pareto.csv", "factory_synth_minutely.csv"]:
    path = os.path.join(WORK, f)
    print(f"  ✓ {f} ({os.path.getsize(path):,} bytes)")
