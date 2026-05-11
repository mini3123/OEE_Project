const _INTERVALS = [10, 30, 60, 300];
let _intIdx = parseInt(localStorage.getItem('liveInterval') || '1');
let _on = localStorage.getItem('liveOn') !== 'false';
let _cd = _INTERVALS[_intIdx];

function toggleRefresh() {
    _on = !_on;
    localStorage.setItem('liveOn', _on);
    document.getElementById('_dot').style.color = _on ? 'var(--success)' : 'var(--text-muted)';
    _cd = _INTERVALS[_intIdx];
    document.getElementById('_cd').textContent = _cd;
}
function setRefreshInterval() {
    _intIdx = parseInt(document.getElementById('_intSel').value);
    localStorage.setItem('liveInterval', _intIdx);
    _cd = _INTERVALS[_intIdx];
    document.getElementById('_cd').textContent = _cd;
}

document.getElementById('_dot').style.color = _on ? 'var(--success)' : 'var(--text-muted)';
document.getElementById('_intSel').value = _intIdx;
document.getElementById('_cd').textContent = _cd;

setInterval(() => {
    if (!_on) { _cd = _INTERVALS[_intIdx]; document.getElementById('_cd').textContent = _cd; return; }
    _cd--;
    document.getElementById('_cd').textContent = _cd;
    if (_cd <= 0) location.reload();
}, 1000);
