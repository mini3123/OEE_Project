const I18N = {
    ko: {
        nav_main:'메인', nav_failure:'고장 분석', nav_maint:'유지보수', nav_shift:'교대별 OEE',
        page_title:'유지보수 이력', section_log:'유지보수 이력',
        filter_type:'유형', filter_equip:'설비', filter_start:'시작일', filter_end:'종료일',
        btn_reset:'초기화', btn_csv:'CSV 다운로드',
        col_date:'날짜', col_equip:'설비명', col_type:'점검 유형', col_engineer:'담당자', col_shift:'조', col_note:'비고',
        opt_all:'전체', type_regular:'정기점검', type_parts:'부품교체', type_emergency:'긴급수리',
        shift_a:'A조', shift_b:'B조', shift_c:'C조',
        prev:'← 이전', next:'다음 →'
    },
    en: {
        nav_main:'Dashboard', nav_failure:'Failure', nav_maint:'Maintenance', nav_shift:'Shift OEE',
        page_title:'Maintenance Log', section_log:'Maintenance Log',
        filter_type:'Type', filter_equip:'Machine', filter_start:'From', filter_end:'To',
        btn_reset:'Reset', btn_csv:'Export CSV',
        col_date:'Date', col_equip:'Machine', col_type:'Type', col_engineer:'Engineer', col_shift:'Shift', col_note:'Note',
        opt_all:'All', type_regular:'Inspection', type_parts:'Parts Repl.', type_emergency:'Emergency',
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
    const typeMap = { '정기점검': 'type_regular', '부품교체': 'type_parts', '긴급수리': 'type_emergency' };
    document.querySelectorAll('[data-type-key]').forEach(el => {
        const k = typeMap[el.dataset.typeKey];
        if (k && t[k]) el.textContent = t[k];
    });
    document.querySelector('#filterType option[value=""]').textContent = t.opt_all;
    document.querySelector('#filterType option[value="정기점검"]').textContent = t.type_regular;
    document.querySelector('#filterType option[value="부품교체"]').textContent = t.type_parts;
    document.querySelector('#filterType option[value="긴급수리"]').textContent = t.type_emergency;
    const noteMapEn = {
        '정상완료': 'Completed', '정상 완료': 'Completed',
        '이상없음': 'No anomaly', '이상 없음': 'No anomaly',
        '점검 완료': 'Inspection done', '점검완료': 'Inspection done',
        '수리 완료': 'Repair done', '수리완료': 'Repair done',
        '부품 교체 완료': 'Parts replaced', '부품교체 완료': 'Parts replaced',
        '오일 교체': 'Oil changed', '오일교체': 'Oil changed',
        '벨트 교체': 'Belt replaced', '벨트교체': 'Belt replaced',
        '필터 교체': 'Filter replaced', '필터교체': 'Filter replaced',
        '청소 및 윤활': 'Cleaned & lubricated', '청소완료': 'Cleaning done',
        '긴급수리 완료': 'Emergency repair done', '긴급 수리 완료': 'Emergency repair done',
        '재점검 필요': 'Re-inspection needed', '추가 조치 필요': 'Further action needed',
        '윤활 보충': 'Lubrication topped up', '볼트 조임': 'Bolt tightened',
        '교정 완료': 'Calibration done', '세척 완료': 'Cleaning done'
    };
    document.querySelectorAll('[data-note-raw]').forEach(el => {
        const raw = el.dataset.noteRaw;
        el.textContent = currentLang === 'en' ? (noteMapEn[raw] || raw) : raw;
    });
}

const PAGE_SIZE = 20;
let currentPage = 1;

function applyFilter() {
    const type  = document.getElementById('filterType').value;
    const equip = document.getElementById('filterEquip').value;
    const start = document.getElementById('filterStart').value;
    const end   = document.getElementById('filterEnd').value;
    document.querySelectorAll('tbody tr').forEach(row => {
        const rowDate  = row.cells[0].innerText;
        const rowEquip = row.dataset.equip || '';
        const rowType  = row.dataset.type  || '';
        const ok = (type  === '' || rowType  === type)  &&
                   (equip === '' || rowEquip === equip) &&
                   (start === '' || rowDate  >= start)  &&
                   (end   === '' || rowDate  <= end);
        row.dataset.filtered = ok ? '1' : '0';
    });
    currentPage = 1;
    renderPage();
}
function resetFilter() {
    ['filterType','filterEquip','filterStart','filterEnd'].forEach(id => document.getElementById(id).value = '');
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
    const dates = Array.from(document.querySelectorAll('tbody td:first-child')).map(td => td.innerText).filter(Boolean).sort();
    if (!dates.length) { renderPage(); return; }
    const maxDate = dates[dates.length - 1];
    const minD = new Date(maxDate); minD.setDate(minD.getDate() - 29);
    document.getElementById('filterStart').value = minD.toISOString().slice(0,10);
    document.getElementById('filterEnd').value   = maxDate;
    applyFilter();
})();

function downloadCSV(filename) {
    const rows = Array.from(document.querySelectorAll('table tr'));
    const csv  = rows.filter(r => r.style.display !== 'none')
        .map(r => Array.from(r.querySelectorAll('th,td')).map(c => '"'+c.innerText.trim().replace(/"/g,'""')+'"').join(',')).join('\n');
    const blob = new Blob(['﻿'+csv], {type:'text/csv;charset=utf-8;'});
    Object.assign(document.createElement('a'), {href: URL.createObjectURL(blob), download: filename}).click();
}

applyLang();
