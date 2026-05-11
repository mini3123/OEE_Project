Chart.defaults.color = '#7B7F96';
Chart.defaults.borderColor = '#252838';

const I18N = {
    ko: {
        nav_main:'메인', nav_failure:'고장 분석', nav_maint:'유지보수', nav_shift:'교대별 OEE',
        page_title:'고장 분석', chart_pareto:'고장 원인 파레토', chart_donut:'원인별 비율', chart_shift:'교대별 고장 현황',
        filter_cause:'원인', filter_equip:'설비', filter_start:'시작일', filter_end:'종료일',
        btn_reset:'초기화', btn_csv:'CSV 다운로드', section_log:'고장 이력',
        col_date:'날짜', col_time:'발생 시각', col_shift:'교대', col_equip:'설비명', col_cause:'고장 원인', col_downtime:'정지 시간(분)',
        opt_all:'전체', cause_mech:'기계 고장', cause_elec:'전기 고장', cause_repl:'교체 작업', cause_line:'라인 막힘', cause_mat:'자재 부족', cause_qual:'품질 불량',
        shift_a:'A조', shift_b:'B조', shift_c:'C조',
        prev:'← 이전', next:'다음 →'
    },
    en: {
        nav_main:'Dashboard', nav_failure:'Failure', nav_maint:'Maintenance', nav_shift:'Shift OEE',
        page_title:'Failure Analysis', chart_pareto:'Failure Pareto', chart_donut:'Cause Distribution', chart_shift:'Failure by Shift',
        filter_cause:'Cause', filter_equip:'Machine', filter_start:'From', filter_end:'To',
        btn_reset:'Reset', btn_csv:'Export CSV', section_log:'Failure Log',
        col_date:'Date', col_time:'Time', col_shift:'Shift', col_equip:'Machine', col_cause:'Cause', col_downtime:'Downtime (min)',
        opt_all:'All', cause_mech:'Mechanical', cause_elec:'Electrical', cause_repl:'Changeover', cause_line:'Blocked', cause_mat:'Starved', cause_qual:'Quality',
        shift_a:'Shift A', shift_b:'Shift B', shift_c:'Shift C',
        prev:'← Prev', next:'Next →'
    }
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
    const causeKeyMap = { Mechanical:'cause_mech', Electrical:'cause_elec', Changeover:'cause_repl', Blocked:'cause_line', Starved:'cause_mat', Quality:'cause_qual' };
    document.querySelectorAll('[data-cause-key]').forEach(el => {
        const k = causeKeyMap[el.dataset.causeKey];
        if (k && t[k]) el.textContent = t[k];
    });
    document.querySelector('#filterCause option[value=""]').textContent = t.opt_all;
    document.querySelector('#filterCause option[value="Mechanical"]').textContent = t.cause_mech;
    document.querySelector('#filterCause option[value="Electrical"]').textContent = t.cause_elec;
    document.querySelector('#filterCause option[value="Changeover"]').textContent = t.cause_repl;
    document.querySelector('#filterCause option[value="Blocked"]').textContent = t.cause_line;
    document.querySelector('#filterCause option[value="Starved"]').textContent = t.cause_mat;
    document.querySelector('#filterCause option[value="Quality"]').textContent = t.cause_qual;
    const causeMap = currentLang === 'ko' ? causeMapKo : causeMapEn;
    const newLabels = pareto.map(d => causeMap[d.cause] || d.cause);
    if (typeof paretoChartInst !== 'undefined') {
        paretoChartInst.data.labels = newLabels;
        paretoChartInst.data.datasets[0].backgroundColor = newLabels.map(l => causeColors[l] || 'rgba(245,168,0,0.7)');
        paretoChartInst.data.datasets[0].borderColor = newLabels.map(l => causeBorder[l] || '#F5A800');
        paretoChartInst.update('none');
    }
    if (typeof donutChartInst !== 'undefined') {
        donutChartInst.data.labels = newLabels;
        donutChartInst.data.datasets[0].backgroundColor = newLabels.map(l => causeColors[l] || 'rgba(245,168,0,0.8)');
        donutChartInst.update('none');
    }
    const equipAllOpt = document.querySelector('#filterEquip option[value=""]');
    if (equipAllOpt) equipAllOpt.textContent = t.opt_all;
    if (typeof shiftChartInst !== 'undefined') {
        shiftChartInst.data.labels = buildShiftLabels();
        shiftChartInst.data.datasets[0].label = currentLang === 'ko' ? '고장 건수' : 'Failures';
        shiftChartInst.data.datasets[1].label = currentLang === 'ko' ? '총 정지(분)' : 'Downtime (min)';
        shiftChartInst.options.scales.y.title.text  = currentLang === 'ko' ? '건수' : 'Count';
        shiftChartInst.options.scales.y2.title.text = currentLang === 'ko' ? '정지(분)' : 'Downtime';
        shiftChartInst.update('none');
    }
}

const causeMapKo = { 'Mechanical':'기계 고장', 'Electrical':'전기 고장', 'Changeover':'교체 작업', 'Blocked':'라인 막힘', 'Starved':'자재 부족', 'Quality':'품질 불량' };
const causeMapEn = { 'Mechanical':'Mechanical', 'Electrical':'Electrical', 'Changeover':'Changeover', 'Blocked':'Blocked', 'Starved':'Starved', 'Quality':'Quality' };
const causeColors = { '기계 고장':'rgba(239,83,80,0.75)', '교체 작업':'rgba(245,168,0,0.75)', '자재 부족':'rgba(171,71,188,0.75)', '전기 고장':'rgba(66,165,245,0.75)', '라인 막힘':'rgba(38,198,218,0.75)', '품질 불량':'rgba(34,201,122,0.75)', 'Mechanical':'rgba(239,83,80,0.75)', 'Changeover':'rgba(245,168,0,0.75)', 'Starved':'rgba(171,71,188,0.75)', 'Electrical':'rgba(66,165,245,0.75)', 'Blocked':'rgba(38,198,218,0.75)', 'Quality':'rgba(34,201,122,0.75)' };
const causeBorder = { '기계 고장':'#EF5350', '교체 작업':'#F5A800', '자재 부족':'#AB47BC', '전기 고장':'#42A5F5', '라인 막힘':'#26C6DA', '품질 불량':'#22C97A', 'Mechanical':'#EF5350', 'Changeover':'#F5A800', 'Starved':'#AB47BC', 'Electrical':'#42A5F5', 'Blocked':'#26C6DA', 'Quality':'#22C97A' };

const pareto       = window.PAGE_DATA.pareto;
const shiftFailure = window.PAGE_DATA.shiftFailure;
const paretoLabels = pareto.map(d => causeMapKo[d.cause] || d.cause);

const paretoChartInst = new Chart(document.getElementById('paretoChart'), {
    type: 'bar',
    data: { labels: paretoLabels, datasets: [{ label: '총 정지시간 (분)', data: pareto.map(d => d.total_downtime), backgroundColor: paretoLabels.map(l => causeColors[l] || 'rgba(245,168,0,0.7)'), borderColor: paretoLabels.map(l => causeBorder[l] || '#F5A800'), borderWidth: 1, borderRadius: 4 }] },
    options: { responsive: true, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => { const min = ctx.parsed.y; const h = Math.floor(min/60), m = min%60; return h>0?`${min}분 (${h}h ${m}m)`:`${min}분`; } } } }, scales: { x: { grid: { display: false } }, y: { grid: { color: '#1E2130' } } } }
});

const donutChartInst = new Chart(document.getElementById('donutChart'), {
    type: 'doughnut',
    data: { labels: paretoLabels, datasets: [{ data: pareto.map(d => d.total_downtime), backgroundColor: paretoLabels.map(l => causeColors[l] || 'rgba(245,168,0,0.8)'), borderColor: '#1A1D2B', borderWidth: 2 }] },
    options: { responsive: true, cutout: '65%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 }, padding: 10 } }, tooltip: { callbacks: { label: (ctx) => { const min = ctx.parsed; const h=Math.floor(min/60),m=min%60; return `${ctx.label}: ${min}분${h>0?' ('+h+'h '+m+'m)':''}`; } } } } }
});

const shiftColors = { 'A':'rgba(66,165,245,0.75)', 'B':'rgba(245,168,0,0.75)', 'C':'rgba(171,71,188,0.75)' };
const shiftBorder = { 'A':'#42A5F5', 'B':'#F5A800', 'C':'#AB47BC' };
function buildShiftLabels() {
    const timeRanges = currentLang === 'ko' ? ['06-14시','14-22시','22-06시'] : ['06-14h','14-22h','22-06h'];
    return shiftFailure.map(d => {
        const idx = ['A','B','C'].indexOf(d.shift);
        return currentLang === 'ko' ? d.shift + '조 (' + timeRanges[idx] + ')' : 'Shift ' + d.shift + ' (' + timeRanges[idx] + ')';
    });
}
const shiftChartInst = new Chart(document.getElementById('shiftChart'), {
    type: 'bar',
    data: {
        labels: buildShiftLabels(),
        datasets: [
            { label: '고장 건수', data: shiftFailure.map(d => d.cnt), backgroundColor: shiftFailure.map(d => shiftColors[d.shift]), borderColor: shiftFailure.map(d => shiftBorder[d.shift]), borderWidth: 1, borderRadius: 4, yAxisID: 'y' },
            { label: '총 정지(분)', data: shiftFailure.map(d => d.total_downtime), type: 'line', borderColor: '#22C97A', backgroundColor: 'rgba(34,201,122,0.1)', borderWidth: 2, pointRadius: 4, pointBackgroundColor: '#22C97A', tension: 0.3, yAxisID: 'y2' }
        ]
    },
    options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 }, padding: 8 } }, tooltip: { callbacks: { label: (ctx) => { if (ctx.dataset.yAxisID==='y2') { const min=ctx.parsed.y,h=Math.floor(min/60),m=min%60; const lbl=currentLang==='ko'?`총 정지: ${min}분`:`Downtime: ${min}min`; return lbl+(h>0?' ('+h+'h '+m+'m)':''); } return currentLang==='ko'?`고장 건수: ${ctx.parsed.y}건`:`Failures: ${ctx.parsed.y}`; } } } }, scales: { x: { grid: { display: false } }, y: { grid: { color: '#1E2130' }, title: { display: true, text: '건수', color: '#7B7F96', font: { size: 10 } } }, y2: { position: 'right', grid: { display: false }, title: { display: true, text: '정지(분)', color: '#22C97A', font: { size: 10 } } } } }
});

const PAGE_SIZE = 20;
let currentPage = 1;

function applyFilter() {
    const cause = document.getElementById('filterCause').value;
    const equip = document.getElementById('filterEquip').value;
    const start = document.getElementById('filterStart').value;
    const end   = document.getElementById('filterEnd').value;
    document.querySelectorAll('tbody tr').forEach(row => {
        const rowDate  = row.cells[0].innerText;
        const rowEquip = row.dataset.equip || '';
        const rowCause = row.dataset.cause || '';
        const ok = (cause === '' || rowCause === cause) &&
                   (equip === '' || rowEquip === equip) &&
                   (start === '' || rowDate >= start) &&
                   (end   === '' || rowDate <= end);
        row.dataset.filtered = ok ? '1' : '0';
    });
    currentPage = 1;
    renderPage();
}
function resetFilter() {
    ['filterCause','filterEquip','filterStart','filterEnd'].forEach(id => document.getElementById(id).value = '');
    document.querySelectorAll('tbody tr').forEach(r => r.dataset.filtered = '1');
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
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    document.getElementById('pageInfo').textContent = `총 ${total}건 · ${Math.min(start+1,total)}–${Math.min(end,total)}건`;
    document.getElementById('pageNum').textContent  = `${currentPage} / ${totalPages}`;
    document.getElementById('pagePrev').disabled = currentPage <= 1;
    document.getElementById('pageNext').disabled = currentPage >= totalPages;
}
function changePage(delta) {
    const total = Array.from(document.querySelectorAll('tbody tr')).filter(r => r.dataset.filtered !== '0').length;
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
    const rows  = Array.from(tbody.querySelectorAll('tr'));
    rows.sort((a, b) => { const da=new Date(a.cells[0].innerText), db=new Date(b.cells[0].innerText); return ascending ? da-db : db-da; });
    ascending = !ascending;
    document.getElementById('sortIcon').innerText = ascending ? '↑' : '↓';
    rows.forEach(r => tbody.appendChild(r));
    currentPage = 1;
    renderPage();
}

function downloadCSV(filename) {
    const rows = Array.from(document.querySelectorAll('table tr'));
    const csv  = rows.filter(r => r.style.display !== 'none')
        .map(r => Array.from(r.querySelectorAll('th,td')).map(c => '"'+c.innerText.trim().replace(/"/g,'""')+'"').join(',')).join('\n');
    const blob = new Blob(['﻿'+csv], {type:'text/csv;charset=utf-8;'});
    Object.assign(document.createElement('a'), {href: URL.createObjectURL(blob), download: filename}).click();
}

applyLang();
