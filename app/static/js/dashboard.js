Chart.defaults.color = '#7B7F96';
Chart.defaults.borderColor = '#252838';
Chart.defaults.font.family = "'Noto Sans KR', sans-serif";

const allChartData = window.PAGE_DATA.chartData;
const allOeeData   = window.PAGE_DATA.oeeData;
const barRaw       = window.PAGE_DATA.barData;

const I18N = {
    ko: { page_title:'OEE 현황 대시보드', nav_main:'메인', nav_failure:'고장 분석', nav_maint:'유지보수', nav_shift:'교대별 OEE', kpi_avail:'평균 가동률', kpi_perf:'평균 성능률', kpi_qual:'평균 품질률', kpi_oee:'평균 OEE', chart_trend:'OEE 추이', chart_ratio:'OEE 요인 분해', chart_bar:'설비별 평균 OEE', heatmap:'OEE 히트맵', period_week:'주간', period_month:'월간', period_all:'전체', period_ratio:'비율', target:'목표선', oee_status:'OEE 현황', filter_equip:'설비', filter_start:'시작일', filter_end:'종료일', btn_reset:'초기화', btn_csv:'CSV 다운로드', col_equip:'설비명', col_date:'날짜', col_avail:'가동률', col_perf:'성능률', col_qual:'품질률', col_oee:'OEE', prev:'← 이전', next:'다음 →', legend_title:'범례', bar_legend:'평균 OEE (%)', trend_label:'주간 성과', trend_sub:'이번주 · 지난주 대비', month_trend_label:'월간 성과', month_trend_sub:'이번달 · 지난달 대비' },
    en: { page_title:'OEE Dashboard', nav_main:'Dashboard', nav_failure:'Failure', nav_maint:'Maintenance', nav_shift:'Shift OEE', kpi_avail:'Avg Availability', kpi_perf:'Avg Performance', kpi_qual:'Avg Quality', kpi_oee:'Avg OEE', chart_trend:'OEE Trend', chart_ratio:'OEE Factor Breakdown', chart_bar:'Avg OEE by Machine', heatmap:'OEE Heatmap', period_week:'Weekly', period_month:'Monthly', period_all:'All', period_ratio:'Ratio', target:'Target', oee_status:'OEE Records', filter_equip:'Machine', filter_start:'From', filter_end:'To', btn_reset:'Reset', btn_csv:'Export CSV', col_equip:'Machine', col_date:'Date', col_avail:'Avail', col_perf:'Perf', col_qual:'Qual', col_oee:'OEE', prev:'← Prev', next:'Next →', legend_title:'Legend', bar_legend:'Avg OEE (%)', trend_label:'Weekly Performance', trend_sub:'This week · last week', month_trend_label:'Monthly Performance', month_trend_sub:'This month · last month' }
};
let currentLang = localStorage.getItem('lang') || 'ko';
function toggleLang() {
    currentLang = currentLang === 'ko' ? 'en' : 'ko';
    localStorage.setItem('lang', currentLang);
    applyLang();
}
function applyLang() {
    const t = I18N[currentLang];
    document.getElementById('langBtn').textContent = currentLang === 'ko' ? 'EN' : '한';
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const k = el.dataset.i18n;
        if (t[k] !== undefined) el.textContent = t[k];
    });
    ['avail','perf','qual','oee'].forEach(k => {
        const lbl = document.getElementById('label_' + k);
        if (lbl) lbl.textContent = t['kpi_' + k];
    });
    if (typeof barChart !== 'undefined') {
        barChart.data.datasets[0].label = t.bar_legend;
        barChart.update('none');
    }
    if (typeof oeeChart !== 'undefined') {
        oeeChart.data.datasets[2].label = t.target;
        oeeChart.update('none');
    }
    if (typeof ratioChart !== 'undefined') {
        ratioChart.data.datasets[0].label = t.col_avail;
        ratioChart.data.datasets[1].label = t.col_perf;
        ratioChart.data.datasets[2].label = t.col_qual;
        ratioChart.update('none');
    }
    const trendLbl = document.getElementById('trendLabel');
    if (trendLbl) trendLbl.textContent = t.trend_label;
    const trendSubLbl = document.getElementById('trendSubLabel');
    if (trendSubLbl) trendSubLbl.textContent = t.trend_sub;
    const monthTrendLbl = document.getElementById('monthTrendLabel');
    if (monthTrendLbl) monthTrendLbl.textContent = t.month_trend_label;
    const monthTrendSubLbl = document.getElementById('monthTrendSubLabel');
    if (monthTrendSubLbl) monthTrendSubLbl.textContent = t.month_trend_sub;
    const equipAllOpt = document.querySelector('#filterEquip option[value=""]');
    if (equipAllOpt) equipAllOpt.textContent = currentLang === 'ko' ? '전체' : 'All';
}

function filterByPeriod(data, period) {
    if (period === 'all' || period === 'ratio') return data;
    const timestamps = data.map(d => +new Date(d.log_date));
    const maxTs  = Math.max(...timestamps);
    const cutoff = new Date(maxTs);
    if (period === 'week')  cutoff.setDate(cutoff.getDate() - 6);
    if (period === 'month') cutoff.setDate(cutoff.getDate() - 29);
    return data.filter(d => +new Date(d.log_date) >= +cutoff);
}

let _targetVal = parseFloat(localStorage.getItem('oeeTarget') || '85');
document.getElementById('targetInput').value = _targetVal;

function buildLineData(filtered) {
    const m1 = filtered.filter(d => d.equipment_id === 1);
    const m2 = filtered.filter(d => d.equipment_id === 2);
    const labels = m1.map(d => { const dt = new Date(d.log_date); return (dt.getMonth()+1).toString().padStart(2,'0')+'-'+dt.getDate().toString().padStart(2,'0'); });
    return {
        labels,
        datasets: [
            { label: 'M1', data: m1.map(d => (d.oee*100).toFixed(1)), borderColor: '#F5A800', backgroundColor: 'rgba(245,168,0,0.08)', borderWidth: 2, pointRadius: 3, pointBackgroundColor: '#F5A800', fill: true, tension: 0.4 },
            { label: 'M2', data: m2.map(d => (d.oee*100).toFixed(1)), borderColor: '#42A5F5', backgroundColor: 'rgba(66,165,245,0.06)', borderWidth: 2, pointRadius: 3, pointBackgroundColor: '#42A5F5', fill: true, tension: 0.4 },
            { label: I18N[currentLang].target || '목표', data: Array(labels.length).fill(_targetVal), borderColor: '#22C97A', borderWidth: 1.5, borderDash: [6,4], pointRadius: 0, fill: false }
        ]
    };
}

const initFiltered = filterByPeriod(allChartData, 'month');
const oeeChart = new Chart(document.getElementById('oeeChart'), {
    type: 'line',
    data: buildLineData(initFiltered),
    options: { responsive: true, plugins: { legend: { labels: { boxWidth: 10, font: { size: 11 } } } }, scales: { x: { grid: { color: '#1E2130' } }, y: { grid: { color: '#1E2130' } } } }
});

function buildRatioData(data) {
    const avg = (arr, key) => arr.length ? arr.reduce((s,d)=>s+d[key],0)/arr.length : 0;
    const m1d = data.filter(d => d.equipment_name === 'M1');
    const m2d = data.filter(d => d.equipment_name === 'M2');
    const t = I18N[currentLang];
    return {
        labels: ['M1','M2'],
        datasets: [
            { label: t.col_avail||'가동률', data: [avg(m1d,'availability')*100, avg(m2d,'availability')*100].map(v=>v.toFixed(1)), backgroundColor: 'rgba(66,165,245,0.75)', borderColor: '#42A5F5', borderWidth: 1, borderRadius: 4 },
            { label: t.col_perf||'성능률',  data: [avg(m1d,'performance')*100, avg(m2d,'performance')*100].map(v=>v.toFixed(1)), backgroundColor: 'rgba(245,168,0,0.75)',  borderColor: '#F5A800', borderWidth: 1, borderRadius: 4 },
            { label: t.col_qual||'품질률',  data: [avg(m1d,'quality')*100, avg(m2d,'quality')*100].map(v=>v.toFixed(1)),      backgroundColor: 'rgba(34,201,122,0.75)', borderColor: '#22C97A', borderWidth: 1, borderRadius: 4 }
        ]
    };
}
const ratioChart = new Chart(document.getElementById('ratioChart'), {
    type: 'bar',
    data: buildRatioData(allOeeData),
    options: { responsive: true, plugins: { legend: { labels: { boxWidth: 10, font: { size: 11 } } } }, scales: { x: { grid: { display: false } }, y: { grid: { color: '#1E2130' }, min: 0, max: 100 } } }
});

const barChart = new Chart(document.getElementById('barChart'), {
    type: 'bar',
    data: { labels: barRaw.map(d=>d.equipment_name), datasets: [{ label: I18N[currentLang].bar_legend, data: barRaw.map(d=>(d.avg_oee*100).toFixed(1)), backgroundColor: ['rgba(245,168,0,0.7)','rgba(66,165,245,0.7)'], borderColor: ['#F5A800','#42A5F5'], borderWidth: 1, borderRadius: 4 }] },
    options: { responsive: true, plugins: { legend: { labels: { boxWidth: 10, font: { size: 11 } } } }, scales: { x: { grid: { display: false } }, y: { grid: { color: '#1E2130' }, min: 80, max: 100 } } }
});

(function buildTrendSummary() {
    if (!allOeeData.length) return;
    const ONE_DAY = 86400000;
    const maxTs = Math.max(...allOeeData.map(d => +new Date(d.log_date)));
    const thisWeek = allOeeData.filter(d => +new Date(d.log_date) > maxTs - 7 * ONE_DAY);
    const lastWeek = allOeeData.filter(d => { const ts = +new Date(d.log_date); return ts > maxTs - 14 * ONE_DAY && ts <= maxTs - 7 * ONE_DAY; });
    let html = '';
    ['M1','M2'].forEach(m => {
        const tw = thisWeek.filter(d => d.equipment_name === m);
        const lw = lastWeek.filter(d => d.equipment_name === m);
        const twAvg = tw.length ? tw.reduce((s,d)=>s+d.oee,0)/tw.length*100 : null;
        const lwAvg = lw.length ? lw.reduce((s,d)=>s+d.oee,0)/lw.length*100 : null;
        const diff = twAvg != null && lwAvg != null ? twAvg - lwAvg : null;
        const arrow = diff === null ? '–' : diff >= 0 ? '▲' : '▼';
        const diffStr = diff === null ? 'N/A' : (diff >= 0 ? '+' : '') + diff.toFixed(1) + '%p';
        const valStr = twAvg != null ? twAvg.toFixed(1) + '%' : '–';
        const color = diff === null ? 'var(--text-muted)' : diff >= 0.05 ? 'var(--success)' : diff <= -0.05 ? 'var(--danger)' : 'var(--text-secondary)';
        html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border);">
            <span style="font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:700;color:var(--text-secondary);">${m}</span>
            <div style="text-align:right;">
                <span style="font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:700;color:var(--text-primary);">${valStr}</span>
                <span style="font-family:'Barlow Condensed',sans-serif;font-size:12px;font-weight:700;color:${color};margin-left:8px;">${arrow} ${diffStr}</span>
            </div>
        </div>`;
    });
    document.getElementById('trendRows').innerHTML = html;
})();

(function buildMonthTrendSummary() {
    if (!allOeeData.length) return;
    const maxTs = Math.max(...allOeeData.map(d => +new Date(d.log_date)));
    const maxDate = new Date(maxTs);
    const thisMonthStart = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);
    const lastMonthStart = new Date(maxDate.getFullYear(), maxDate.getMonth() - 1, 1);
    const lastMonthEnd   = new Date(maxDate.getFullYear(), maxDate.getMonth(), 0);
    const thisMonth = allOeeData.filter(d => new Date(d.log_date) >= thisMonthStart);
    const lastMonth = allOeeData.filter(d => { const dt = new Date(d.log_date); return dt >= lastMonthStart && dt <= lastMonthEnd; });
    let html = '';
    ['M1','M2'].forEach(m => {
        const tm = thisMonth.filter(d => d.equipment_name === m);
        const lm = lastMonth.filter(d => d.equipment_name === m);
        const tmAvg = tm.length ? tm.reduce((s,d)=>s+d.oee,0)/tm.length*100 : null;
        const lmAvg = lm.length ? lm.reduce((s,d)=>s+d.oee,0)/lm.length*100 : null;
        const diff = tmAvg != null && lmAvg != null ? tmAvg - lmAvg : null;
        const arrow = diff === null ? '–' : diff >= 0 ? '▲' : '▼';
        const diffStr = diff === null ? 'N/A' : (diff >= 0 ? '+' : '') + diff.toFixed(1) + '%p';
        const valStr = tmAvg != null ? tmAvg.toFixed(1) + '%' : '–';
        const color = diff === null ? 'var(--text-muted)' : diff >= 0.05 ? 'var(--success)' : diff <= -0.05 ? 'var(--danger)' : 'var(--text-secondary)';
        html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border);">
            <span style="font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:700;color:var(--text-secondary);">${m}</span>
            <div style="text-align:right;">
                <span style="font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:700;color:var(--text-primary);">${valStr}</span>
                <span style="font-family:'Barlow Condensed',sans-serif;font-size:12px;font-weight:700;color:${color};margin-left:8px;">${arrow} ${diffStr}</span>
            </div>
        </div>`;
    });
    document.getElementById('monthTrendRows').innerHTML = html;
})();

function updateKPIs(data) {
    if (!data.length) return;
    const avg = key => data.reduce((s,d)=>s+d[key],0) / data.length;
    document.getElementById('kpi_avail').textContent = (avg('availability')*100).toFixed(1)+'%';
    document.getElementById('kpi_perf').textContent  = (avg('performance')*100).toFixed(1)+'%';
    document.getElementById('kpi_qual').textContent  = (avg('quality')*100).toFixed(1)+'%';
    document.getElementById('kpi_oee').textContent   = (avg('oee')*100).toFixed(1)+'%';
}

let currentPeriod = 'month';
let _lastLinePeriod = 'month';
function setPeriod(p) {
    if (p !== 'ratio') _lastLinePeriod = p;
    currentPeriod = p;
    ['week','month','all','ratio'].forEach(id => document.getElementById('pb_'+id).classList.toggle('active', id === p));
    const isRatio = p === 'ratio';
    document.getElementById('oeeChart').style.display   = isRatio ? 'none' : '';
    document.getElementById('ratioChart').style.display = isRatio ? '' : 'none';
    document.getElementById('targetWrap').style.display = isRatio ? 'none' : 'flex';
    const t = I18N[currentLang];
    document.getElementById('chartTitle').textContent = isRatio ? (t.chart_ratio || 'OEE 요인 분해') : (t.chart_trend || 'OEE 추이');
    if (isRatio) {
        const ratioFiltered = filterByPeriod(allOeeData, _lastLinePeriod);
        ratioChart.data = buildRatioData(ratioFiltered);
        ratioChart.update();
        updateKPIs(ratioFiltered);
    } else {
        oeeChart.data = buildLineData(filterByPeriod(allChartData, p));
        oeeChart.update();
        updateKPIs(filterByPeriod(allOeeData, p));
    }
}

function applyRowColors(threshold) {
    document.querySelectorAll('tbody tr[data-oee]').forEach(row => {
        if (row.style.display === 'none') return;
        const oee = parseFloat(row.dataset.oee) * 100;
        row.style.background = oee < threshold ? 'rgba(239,83,80,0.07)' : '';
        row.cells[5].className = oee >= threshold ? 'val-good' : 'val-bad';
    });
}
function updateTarget() {
    const val = parseFloat(document.getElementById('targetInput').value);
    if (isNaN(val)) return;
    _targetVal = val;
    localStorage.setItem('oeeTarget', val);
    oeeChart.data.datasets[2].data = Array(oeeChart.data.labels.length).fill(val);
    oeeChart.update();
    applyRowColors(val);
}

function oeeColor(oee) {
    // 85% = white, ±8% 이내에서 진한 색으로 전환 (93%↑ full green, 77%↓ full red)
    const BASE = 0.85;
    const RANGE = 0.08;
    const WHITE = [255, 255, 255];
    const GREEN = [22, 163, 74];
    const RED   = [220, 38, 38];
    let r, g, b;
    if (oee >= BASE) {
        const ratio = Math.min((oee - BASE) / RANGE, 1);
        r = Math.round(WHITE[0] + (GREEN[0] - WHITE[0]) * ratio);
        g = Math.round(WHITE[1] + (GREEN[1] - WHITE[1]) * ratio);
        b = Math.round(WHITE[2] + (GREEN[2] - WHITE[2]) * ratio);
    } else {
        const ratio = Math.min((BASE - oee) / RANGE, 1);
        r = Math.round(WHITE[0] + (RED[0] - WHITE[0]) * ratio);
        g = Math.round(WHITE[1] + (RED[1] - WHITE[1]) * ratio);
        b = Math.round(WHITE[2] + (RED[2] - WHITE[2]) * ratio);
    }
    return [`rgb(${r},${g},${b})`, '#111'];
}
function renderHeatmap(period) {
    const data = filterByPeriod(allOeeData, period);
    const dates = [...new Set(data.map(d => d.log_date))].sort((a, b) => new Date(a) - new Date(b));
    const machines = ['M1','M2'];
    const lk = {};
    data.forEach(d => { if (!lk[d.log_date]) lk[d.log_date]={}; lk[d.log_date][d.equipment_name]=d.oee; });

    let html = '<table style="border-collapse:separate;border-spacing:4px;"><tr><td style="min-width:32px;"></td>';
    dates.forEach(date => {
        const dt = new Date(date);
        const lb = (dt.getMonth()+1) + '/' + dt.getDate().toString().padStart(2,'0');
        html += `<th style="padding:0 2px 6px;font-family:'Barlow Condensed',sans-serif;font-size:11px;color:var(--text-muted);font-weight:700;text-align:center;min-width:44px;white-space:nowrap;">${lb}</th>`;
    });
    html += '</tr>';
    machines.forEach(m => {
        html += `<tr><td style="padding:4px 12px 4px 0;font-family:'Barlow Condensed',sans-serif;font-size:13px;color:var(--text-secondary);font-weight:700;white-space:nowrap;">${m}</td>`;
        dates.forEach(date => {
            const oee = (lk[date] && lk[date][m] != null) ? lk[date][m] : null;
            const pct = oee != null ? (oee*100).toFixed(0)+'%' : '–';
            const [bg, tc] = oee != null ? oeeColor(oee) : ['var(--bg-surface)','var(--text-muted)'];
            html += `<td title="${date}: ${oee!=null?(oee*100).toFixed(1)+'%':'N/A'}" style="width:44px;height:38px;text-align:center;background:${bg};color:${tc};font-family:'Barlow Condensed',sans-serif;font-size:12px;font-weight:700;border-radius:4px;cursor:default;">${pct}</td>`;
        });
        html += '</tr>';
    });
    html += '</table>';
    document.getElementById('hmWrap').innerHTML = html;
    requestAnimationFrame(() => {
        const table  = document.querySelector('#hmWrap table');
        const header = document.querySelector('#hmWrap tr:first-child');
        if (!table || !header) return;
        const headerH = header.offsetHeight;
        const bodyH   = table.offsetHeight - headerH;
        document.getElementById('hmColorbarWrap').style.paddingTop = headerH + 'px';
        document.getElementById('hmColorbar').style.height = bodyH + 'px';
        document.getElementById('hmColorbarLabels').style.height = bodyH + 'px';
    });
}
function setHmPeriod(p) {
    ['week','month','all'].forEach(id => document.getElementById('hm_'+id).classList.toggle('active', id === p));
    renderHeatmap(p);
}
renderHeatmap('month');

const PAGE_SIZE = 20;
let currentPage = 1;

function applyFilter() {
    const equip = document.getElementById('filterEquip').value;
    const start = document.getElementById('filterStart').value;
    const end   = document.getElementById('filterEnd').value;
    document.querySelectorAll('tbody tr').forEach(row => {
        const name = row.cells[0].innerText;
        const date = row.cells[1].innerText;
        row.dataset.filtered = ((equip===''||name.includes(equip)) && (start===''||date>=start) && (end===''||date<=end)) ? '1' : '0';
    });
    currentPage = 1;
    renderPage();
}
function resetFilter() {
    ['filterEquip','filterStart','filterEnd'].forEach(id => document.getElementById(id).value='');
    document.querySelectorAll('tbody tr').forEach(row => row.dataset.filtered='1');
    currentPage = 1;
    renderPage();
}
function renderPage() {
    const rows    = Array.from(document.querySelectorAll('tbody tr'));
    const visible = rows.filter(r => r.dataset.filtered !== '0');
    const total   = visible.length;
    const start   = (currentPage - 1) * PAGE_SIZE;
    const end     = start + PAGE_SIZE;
    rows.forEach(r => r.style.display = 'none');
    visible.slice(start, end).forEach(r => r.style.display = '');
    applyRowColors(_targetVal);
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    document.getElementById('pageInfo').textContent = `총 ${total}건 · ${Math.min(start+1,total)}–${Math.min(end,total)}건`;
    document.getElementById('pageNum').textContent  = `${currentPage} / ${totalPages}`;
    document.getElementById('pagePrev').disabled = currentPage <= 1;
    document.getElementById('pageNext').disabled = currentPage >= totalPages;
}
function changePage(delta) {
    const rows = Array.from(document.querySelectorAll('tbody tr'));
    const total = rows.filter(r => r.dataset.filtered !== '0').length;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    currentPage = Math.max(1, Math.min(totalPages, currentPage + delta));
    renderPage();
}

(function initDateFilter() {
    renderPage();
})();

let ascending = false;
function sortTable() {
    const tbody = document.querySelector('tbody');
    const rows = Array.from(tbody.querySelectorAll('tr'));
    rows.sort((a, b) => { const da=new Date(a.cells[1].innerText), db=new Date(b.cells[1].innerText); return ascending ? da-db : db-da; });
    ascending = !ascending;
    document.getElementById('sortIcon').innerText = ascending ? '↑' : '↓';
    rows.forEach(row => tbody.appendChild(row));
    currentPage = 1;
    renderPage();
}

function downloadCSV(filename) {
    const rows = Array.from(document.querySelectorAll('table tr'));
    const csv = rows.filter(r => r.style.display !== 'none')
        .map(r => Array.from(r.querySelectorAll('th,td')).map(c => '"'+c.innerText.trim().replace(/"/g,'""')+'"').join(',')).join('\n');
    const blob = new Blob(['﻿'+csv], {type:'text/csv;charset=utf-8;'});
    Object.assign(document.createElement('a'), {href: URL.createObjectURL(blob), download: filename}).click();
}

applyLang();
