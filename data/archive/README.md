# Factory OEE & Downtime (Synthetic) — Starter Dataset

**Author:** Christopher Grove  
**License:** CC0-1.0 (Public Domain)  
**Created:** 2025-10-05

This dataset is a **self-contained, synthetic** factory dataset designed for tutorials and quick experiments in
**OEE (Availability × Performance × Quality)** analysis, downtime Pareto analysis, and basic SPC (X-bar/R).

The data are generated minute-by-minute for a small line with two machines (M1, M2) over multiple days, including
random downtime intervals and scrap. Use it to prototype dashboards, teach manufacturing analytics, or benchmark
feature engineering—**without needing the internet**.

---

## Files

- `factory_synth_minutely.csv` — Minutely time series for the line (per machine).  
- `oee_by_day.csv` — OEE aggregates by machine × day.  
- `oee_by_shift.csv` — OEE aggregates by machine × day × shift (A/B/C).  
- `downtime_pareto.csv` — Downtime minutes aggregated by cause (Mechanical, Electrical, etc.).  
- `spc_xbar_r.csv` — Hourly subgroup stats for SPC (X̄ and R) per machine.  

> Tip: Generate these straight from the companion notebook and upload the CSVs here.

---

## Data Dictionary (selected columns)

### `factory_synth_minutely.csv`
- `timestamp` *(datetime)* — Minute timestamp.  
- `machine` *(string)* — Machine ID (`M1` or `M2`).  
- `is_running` *(int)* — 1 if running; 0 if down.  
- `units` *(int)* — Units produced in that minute (0 if down).  
- `scrap` *(int)* — Units scrapped in that minute (0 if down).  
- `good_units` *(int)* — `units - scrap`.  
- `shift` *(A/B/C)* — 3 shifts per day: A (06:00–14:00), B (14:00–22:00), C (22:00–06:00).  
- `day` *(date)* — Calendar day.

### `oee_by_day.csv` / `oee_by_shift.csv`
- `planned_min` — Minutes in period.  
- `running_min` — Minutes with `is_running = 1`.  
- `total_units`, `good_units` — Sum over period.  
- `availability` — `running_min / planned_min`.  
- `performance` — `total_units / (IDEAL_RATE * running_min)` with IDEAL_RATE=6 by default.  
- `quality` — `good_units / total_units`.  
- `oee` — `availability * performance * quality`.

### `downtime_pareto.csv`
- `machine`, `day`, `cause` — Downtime cause category (Mechanical, Electrical, Changeover, Blocked, Starved, Quality).  
- `minutes` — Total downtime minutes in that period for that cause.

### `spc_xbar_r.csv`
- `machine`, `hour` — Hourly subgroup.  
- `count` — Subgroup size (running minutes).  
- `xbar` — Mean units/min within subgroup.  
- `s` — Std deviation within subgroup.  
- `R` — Range within subgroup.

---

## OEE Quick Reference

- **Availability** = Running Time / Planned Time  
- **Performance**  = Actual Output / (Ideal Rate × Running Time)  
- **Quality**      = Good Output / Total Output  
- **OEE**          = Availability × Performance × Quality

---

## How To Reproduce / Extend

Use the companion notebook “*Factory OEE & Downtime — a Beginner’s Guide (Synthetic)*” to regenerate CSVs.
You can tweak failure rates, downtime distributions, scrap rate, and ideal rate to simulate different behaviors.

---

## Example Usage (Python)

```python
import pandas as pd
df = pd.read_csv("/kaggle/input/<DATASET_SLUG>/factory_synth_minutely.csv", parse_dates=["timestamp"])
print(df.head())
```

---

## License

This dataset is released under **CC0 1.0 (Public Domain)**. You can copy, modify, distribute and perform the work,
even for commercial purposes, all without asking permission.

If you find it useful, please ⭐ star the dataset and cite the notebook!

