// ── STATE ──
let rules  = [];
let visMap = {};
let activeF = 'all';
let logs   = [];

// ── BOOT ──
window.addEventListener('DOMContentLoaded', () => {
  loadVis();
  loadRules();
});


// ── VISIBILITY ──
function loadVis() {
  try { visMap = JSON.parse(localStorage.getItem('mtr_vis') || '{}'); } catch(e){ visMap={}; }
}
function saveVis() { localStorage.setItem('mtr_vis', JSON.stringify(visMap)); }
function isVis(c)  { return visMap[c] !== false; }

function visAll(v) {
  rules.forEach(r => { if(r.comment) visMap[r.comment] = v; });
  saveVis(); renderVisList(); render();
  toast(v ? 'Все правила показаны' : 'Все правила скрыты', 'inf');
}

function setVis(c, v) { visMap[c] = v; saveVis(); render(); updateStats(); }

// ── API ──
async function callAPI(path, body) {
  const r = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

// ── LOAD RULES ──
async function loadRules() {
  const btn = document.getElementById('refreshBtn');
  if (btn) btn.classList.add('spin');
  showSkels();
  try {
    const data = await callAPI('/api/rules', { });
    // Фильтруем: только правила с непустым комментарием
    rules = (data.rules || []).filter(r => r.comment && r.comment.trim() !== '');
    setOnline(true);
    addLog('Загружено ' + rules.length + ' routing rules (с комментариями)', 'ok');
    render(); renderVisList(); updateStats();
  } catch(e) {
    setOnline(false);
    addLog('Ошибка: ' + e.message, 'err');
    showErr(e.message);
  } finally {
    if (btn) btn.classList.remove('spin');
  }
}

// ── TOGGLE ──
async function toggleRule(id, enable, cb) {
  const wrap = cb.closest('.toggle');
  const card = cb.closest('.rule-card');
  wrap.classList.add('busy');
  card.style.opacity = '0.55';
  try {
    await callAPI('/api/rule/toggle', { id, enable });
    const r = rules.find(x => (x['.id'] || x.id) === id);
    if (r) r.disabled = enable ? 'false' : 'true';
    card.classList.toggle('on',  enable);
    card.classList.toggle('off', !enable);
    updateStats();
    const name = r ? r.comment : id;
    addLog('"' + name + '" → ' + (enable ? 'включено' : 'выключено'), 'ok');
    toast((enable ? '▶ ' : '■ ') + name, enable ? 'ok' : 'inf');
  } catch(e) {
    cb.checked = !enable;
    addLog('Ошибка toggle: ' + e.message, 'err');
    toast('Ошибка: ' + e.message, 'err');
  } finally {
    wrap.classList.remove('busy');
    card.style.opacity = '';
  }
}

// ── RENDER RULES ──
function getFiltered() {
  const qEl = document.getElementById('searchQ');
  const q = (qEl ? qEl.value : '').toLowerCase();
  return rules.filter(r => {
    if (!isVis(r.comment)) return false;
    const disabled = r.disabled === 'true' || r.disabled === true;
    if (activeF === 'on'  && disabled)  return false;
    if (activeF === 'off' && !disabled) return false;
    if (q && !r.comment.toLowerCase().includes(q)) return false;
    return true;
  });
}

function render() {
  const list = document.getElementById('rulesList');
  if (!list) return;
  const rows = getFiltered();

  if (rows.length === 0) {
    list.innerHTML = '<div class="empty">' +
      '<div class="empty-ico">⇌</div>' +
      '<h3>' + (rules.length === 0 ? 'Нет данных' : 'Нет совпадений') + '</h3>' +
      '<p>' + (rules.length === 0 ? 'Подключитесь к роутеру' : 'Измените фильтр или настройки видимости') + '</p>' +
      '</div>';
    return;
  }

  list.innerHTML = rows.map((r, i) => {
    const id  = r['.id'] || r.id || String(i);
    const on  = !(r.disabled === 'true' || r.disabled === true);
    const src = r['src-address'] || '';
    const dst = r['dst-address'] || '';
    const tbl = r['table']       || '';

    return '<div class="rule-card ' + (on ? 'on' : 'off') + '" style="animation-delay:' + (i*0.03) + 's">' +
      '<span class="rule-idx">' + (i+1) + '</span>' +
      '<div class="rule-body">' +
        '<div class="rule-comment">' + esc(r.comment) + '</div>' +
        '<div class="rule-tags">' +
          (src ? '<span class="tag src">src: ' + esc(src) + '</span>' : '') +
          (dst ? '<span class="tag dst">dst: ' + esc(dst) + '</span>' : '') +
          (tbl ? '<span class="tag tbl">table: ' + esc(tbl) + '</span>' : '') +
          '<span class="tag id">#' + esc(id) + '</span>' +
        '</div>' +
      '</div>' +
      '<label class="toggle">' +
        '<input type="checkbox" ' + (on ? 'checked' : '') +
          ' onchange="toggleRule(\'' + esc(id) + '\', this.checked, this)">' +
        '<span class="toggle-track"></span>' +
        '<span class="toggle-thumb"></span>' +
      '</label>' +
    '</div>';
  }).join('');
}

function renderVisList() {
  const list = document.getElementById('visList');
  if (!list) return;
  const commented = rules.filter(r => r.comment);
  if (!commented.length) {
    list.innerHTML = '<div style="color:var(--muted);font-size:.75rem;padding:.8rem">Нет правил с комментариями</div>';
    return;
  }
  list.innerHTML = commented.map(r => {
    const v   = isVis(r.comment);
    const src = r['src-address'] || '';
    const dst = r['dst-address'] || '';
    return '<div class="vis-item">' +
      '<label>' +
        '<input type="checkbox" ' + (v ? 'checked' : '') +
          ' onchange="setVis(\'' + esc(r.comment) + '\', this.checked)">' +
        esc(r.comment) +
      '</label>' +
      '<span class="vis-meta">' +
        (src ? 'src: ' + esc(src) : '') +
        (src && dst ? ' · ' : '') +
        (dst ? 'dst: ' + esc(dst) : '') +
      '</span>' +
    '</div>';
  }).join('');
}

function updateStats() {
  const vis = rules.filter(r => r.comment && isVis(r.comment));
  const on  = vis.filter(r => !(r.disabled === 'true' || r.disabled === true));
  const hid = rules.filter(r => r.comment && !isVis(r.comment));
  
  const setTxt = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  setTxt('sTotal', vis.length);
  setTxt('sOn', on.length);
  setTxt('sOff', vis.length - on.length);
  setTxt('sHid', hid.length);
}

function setFilter(f, el) {
  activeF = f;
  document.querySelectorAll('.fbtn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  render();
}

// ── STATUS ──
function setOnline(v) {
  const pill = document.getElementById('statusPill');
  const txt  = document.getElementById('statusTxt');
  if (pill) pill.className = 'pill' + (v ? ' online' : '');
  if (txt) txt.textContent = v ? 'online' : 'offline';
}

// ── SKELETONS / ERR ──
function showSkels() {
  const list = document.getElementById('rulesList');
  if (list) {
    list.innerHTML =
      '<div class="skel"></div>' +
      '<div class="skel" style="opacity:.7"></div>' +
      '<div class="skel" style="opacity:.4"></div>';
  }
}
function showErr(msg) {
  const list = document.getElementById('rulesList');
  if (list) {
    list.innerHTML =
      '<div class="empty"><div class="empty-ico">✕</div>' +
      '<h3>Нет подключения</h3><p>' + esc(msg) + '</p></div>';
  }
  ['sTotal','sOn','sOff','sHid'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '–';
  });
}

// ── TABS ──
function switchTab(name, el) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
  const panel = document.getElementById('panel-' + name);
  if (panel) panel.classList.add('active');
}

// ── LOG ──
function addLog(msg, type) {
  type = type || 'info';
  const t = new Date().toLocaleTimeString('ru', { hour12:false });
  logs.unshift({ t, msg, type });
  if (logs.length > 300) logs.pop();
  const box = document.getElementById('logBox');
  if (box) box.innerHTML = logs.map(l =>
    '<div class="log-row">' +
    '<span class="log-t">' + l.t + '</span>' +
    '<span class="log-m ' + l.type + '">' + esc(l.msg) + '</span>' +
    '</div>'
  ).join('');
}
function clearLog() { logs = []; const box = document.getElementById('logBox'); if(box) box.innerHTML = ''; }

// ── TOAST ──
function toast(msg, type) {
  type = type || 'inf';
  const icons = { ok:'✓', err:'✕', inf:'·' };
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.innerHTML = '<span>' + (icons[type]||'·') + '</span>' +
    '<span style="flex:1">' + esc(msg) + '</span>' +
    '<button class="toast-x" onclick="this.parentElement.remove()">×</button>';
  const container = document.getElementById('toasts');
  if (container) container.prepend(el);
  setTimeout(() => { if(el.parentNode) el.remove(); }, 3500);
}

// ── UTILS ──
function esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g, '&#39;');
}
