Chart.defaults.color = '#7B7F96';
Chart.defaults.borderColor = '#252838';

const I18N = {
    ko: {
        nav_main:'메인', nav_failure:'고장 분석', nav_maint:'유지보수', nav_shift:'교대별 OEE',
        page_title:'교대별 OEE', chart_title:'교대 × 설비별 평균 OEE', section_log:'교대별 OEE 현황',
        filter_equip:'설비', filter_shift:'교대', filter_start:'시작일', filter_end:'종료일',
        btn_reset:'초기화', btn_csv:'CSV 다운로드',
        col_equip:'설비명', col_date:'날짜', col_shift:'교대', col_avail:'가동률', col_perf:'성능률', col_qual:'품질률',
        opt_all:'전체', shift_a:'A조', shift_b:'B조', shift_c:'C조',
        lbl_avail:'가동률', lbl_perf:'성능률', lbl_qual:'품질률',
        prev:'← 이전', next:'다음 →'
    },
    en: {
        nav_main:'Dashboard', nav_failure:'Failure', nav_maint:'Maintenance', nav_shift:'Shift OEE',
        page_title:'Shift OEE', chart_title:'Avg OEE by Shift × Machine', section_log:'Shift OEE Records',
        filter_equip:'Machine', filter_shift:'Shift', filter_start:'From', filter_end:'To',
        btn_reset:'Reset', btn_csv:'Export CSV',
        col_equip:'Machine', col_date:'Date', col_shift:'Shift', col_avail:'Avail', col_perf:'Perf', col_qual:'Qual',
        opt_all:'All', shift_a:'Shift A', shift_b:'Shift B', shift_c:'Shift C',
        lbl_avail:'Avail', lbl_perf:'Perf', lbl_qual:'Qual',
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
    document.querySelector('#filterShift option[value=""]').textContent = t.opt_all;
    document.querySelector('#filterShift option[value="A"]').textContent = t.shift_a;
    document.querySelector('#filterShift option[value="B"]').textContent = t.shift_b;
    document.querySelector('#filterShift option[value="C"]').textContent = t.shift_c;
    if (typeof shiftBarChart !== 'undefined') {
        shiftBarChart.data.labels = [t.shift_a, t.shift_b, t.shift_c];
        shiftBarChart.update('none');
    }
}

const chartRaw = window.PAGE_DATA.chartRaw;
const shifts   = ['A','B','C'];
const m1data   = shifts.map(sh => { const r = chartRaw.find(d => d.equipment_name==='M1' && d.shift===sh); return r ? (r.avg_oee*100).toFixed(1) : 0; });
const m2data   = shifts.map(sh => { const r = chartRaw.find(d => d.equipment_name==='M2' && d.shift===sh); return r ? (r.avg_oee*100).toFixed(1) : 0; });

const shiftBarChart = new Chart(document.getElementById('shiftChart'), {
    type: 'bar',
    data: {
        labels: ['A조','B조','C조'],
        datasets: [
            { label: 'M1', data: m1data, backgroundColor: 'rgba(245,168,0,0.75)', borderColor: '#F5A800', borderWidth: 1, borderRadius: 4 },
            { label: 'M2', data: m2data, backgroundColor: 'rgba(66,165,245,0.75)', borderColor: '#42A5F5', borderWidth: 1, borderRadius: 4 }
        ]
    },
    options: { responsive: true, plugins: { legend: { labels: { boxWidth: 10, font: { size: 11 } } } }, scales: { x: { grid: { display: false } }, y: { grid: { color: '#1E2130' }, min: 80, max: 100 } } }
});

const PAGE_SIZE = 20;
let currentPage = 1;

function applyFilter() {
    const equip = document.getElementById('filterEquip').value;
    const shift = document.getElementById('filterShift').value;
    const start = document.getElementById('filterStart').value;
    const end   = document.getElementById('filterEnd').value;
    document.querySelectorAll('tbody tr').forEach(row => {
        const rowDate  = row.cells[1].innerText;
        const rowEquip = row.dataset.equip || '';
        const rowShift = row.dataset.shift || '';
        const ok = (equip === '' || rowEquip === equip) &&
                   (shift === '' || rowShift === shift) &&
                   (start === '' || rowDate  >= start) &&
                   (end   === '' || rowDate  <= end);
        row.dataset.filtered = ok ? '1' : '0';
    });
    currentPage = 1;
    renderPage();
}
function resetFilter() {
    ['filterEquip','filterShift','filterStart','filterEnd'].forEach(id => document.getElementById(id).value = '');
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
    const dates = Array.from(document.querySelectorAll('tbody td:nth-child(2)')).map(td => td.innerText).filter(Boolean).sort();
    if (!dates.length) { renderPage(); return; }
    const maxDate = dates[dates.length - 1];
    const minD = new Date(maxDate); minD.setDate(minD.getDate() - 29);
    document.getElementById('filterStart').value = minD.toISOString().slice(0,10);
    document.getElementById('filterEnd').value   = maxDate;
    applyFilter();
})();

let ascending = false;
function sortTable() {
    const tbody = document.querySelector('tbody');
    const rows  = Array.from(tbody.querySelectorAll('tr'));
    rows.sort((a, b) => { const da=new Date(a.cells[1].innerText), db=new Date(b.cells[1].innerText); return ascending ? da-db : db-da; });
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
