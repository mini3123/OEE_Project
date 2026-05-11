let _simRunning = false;

async function initSimStatus() {
    try {
        const d = await (await fetch('/api/simulator/status')).json();
        _simRunning = d.running;
    } catch(e) {
        _simRunning = false;
    }
    updateSimBtn();
}
async function toggleSim() {
    const ep = _simRunning ? '/api/simulator/stop' : '/api/simulator/start';
    try {
        const d = await (await fetch(ep, { method: 'POST' })).json();
        _simRunning = d.status === 'started' || d.status === 'already_running';
    } catch(e) {}
    updateSimBtn();
}
function updateSimBtn() {
    const dot = document.getElementById('simDot');
    const btn = document.getElementById('simBtn');
    if (!dot || !btn) return;
    if (_simRunning) {
        dot.style.color = '#22C97A';
        btn.textContent = 'ON';
        btn.style.background = 'rgba(34,201,122,0.1)';
        btn.style.borderColor = '#22C97A';
        btn.style.color = '#22C97A';
    } else {
        dot.style.color = 'var(--text-muted)';
        btn.textContent = 'OFF';
        btn.style.background = 'transparent';
        btn.style.borderColor = 'var(--border)';
        btn.style.color = 'var(--text-muted)';
    }
}

initSimStatus();
