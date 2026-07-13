/* Umsatzboard Controlling v2 — Vanilla JS + Supabase/Demo. Kein Build-Step.
   Intern: bereiche = Führungskraft (FK), sub_leiter = Berater, eintraege = Interessent. */
const CFG = window.SUPABASE_CONFIG || {};
const DEMO = !CFG.url || /DEIN-PROJEKT/.test(CFG.url);
const sb = DEMO ? DemoDB.client() : window.supabase.createClient(CFG.url, CFG.anonKey);

const TERMINARTEN = ['S1', 'S2', 'S3', 'Service', 'AEC', 'TzT', 'Recruiting'];
const STATUS = ['offen', 'kunde', 'abgelehnt'];
const STATUS_LABEL = { offen: '○ Offen', kunde: '✓ Kunde', abgelehnt: '✕ Abgelehnt' };
const STUFE_WK = { S1: 0.1, S2: 0.4, S3: 0.7, Service: 0.5, AEC: 0.3 };   // Wahrscheinlichkeit für gewichtete Pipeline
const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

const $ = s => document.querySelector(s);
const el = (t, c, txt) => { const e = document.createElement(t); if (c) e.className = c; if (txt != null) e.textContent = txt; return e; };
const eur = n => (Number(n) || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const str = v => (v == null ? '' : String(v)).trim();
const num = v => { if (typeof v === 'number') return v; const n = parseFloat(str(v).replace(/[^\d,-]/g, '').replace(',', '.')); return isNaN(n) ? 0 : n; };
const monthLabel = m => { if (!m) return '—'; const [y, mo] = m.split('-'); return MONATE[+mo - 1] + ' ' + y; };
function monthShift(m, d) { let [y, mo] = m.split('-').map(Number); mo += d; while (mo < 1) { mo += 12; y--; } while (mo > 12) { mo -= 12; y++; } return y + '-' + String(mo).padStart(2, '0'); }

let BEREICHE = [];
let viewer = { role: 'admin', fkId: null };
let currentMonat = new Date().toISOString().slice(0, 7);
let currentView = showControlling, curName = 'controlling';
let realtimeCh = null;

/* ── Auth ──────────────────────────────────────────────────────────── */
async function init() {
  if (DEMO) { document.body.classList.add('demo'); return enterApp({ user: { email: 'Demo-Modus' } }); }
  sb.auth.onAuthStateChange((event, s) => {
    if (event === 'PASSWORD_RECOVERY') return showRecovery();
    if (!s) showLogin();
  });
  if (location.hash.includes('type=recovery')) return showRecovery();
  const { data: { session } } = await sb.auth.getSession();
  session ? enterApp(session) : showLogin();
}
function showLogin() { $('#app').hidden = true; $('#recovery').hidden = true; $('#login').hidden = false; }
function showRecovery() { $('#login').hidden = true; $('#app').hidden = true; $('#recovery').hidden = false; }

$('#loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = $('#loginBtn'); btn.disabled = true; btn.textContent = 'Anmelden…';
  const { data, error } = await sb.auth.signInWithPassword({ email: $('#email').value.trim(), password: $('#password').value });
  btn.disabled = false; btn.textContent = 'Anmelden';
  if (error) { const b = $('#loginError'); b.hidden = false; b.textContent = 'Anmeldung fehlgeschlagen: ' + error.message; return; }
  enterApp(data.session);
});
$('#forgotBtn').addEventListener('click', async () => {
  const email = $('#email').value.trim();
  if (!email) return toast('Bitte oben deine E-Mail eingeben', true);
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
  error ? toast(error.message, true) : toast('E-Mail zum Zurücksetzen gesendet');
});
$('#recoveryForm').addEventListener('submit', async e => {
  e.preventDefault();
  const { error } = await sb.auth.updateUser({ password: $('#newPass').value });
  if (error) { const b = $('#recoveryError'); b.hidden = false; b.textContent = error.message; return; }
  location.replace(location.origin + location.pathname);
});
$('#logoutBtn').addEventListener('click', async () => { await sb.auth.signOut(); location.reload(); });
$('#changePwBtn').addEventListener('click', async () => {
  const p = prompt('Neues Passwort (min. 6 Zeichen):'); if (!p) return;
  if (p.length < 6) return toast('Mindestens 6 Zeichen', true);
  const { error } = await sb.auth.updateUser({ password: p });
  error ? toast(error.message, true) : toast('Passwort geändert');
});

async function loadViewer(session) {
  if (DEMO) { viewer = { role: 'admin', fkId: null }; return; }
  const { data } = await sb.from('profiles').select('*').eq('user_id', session.user.id).single();
  viewer = data ? { role: data.role || 'fk', fkId: data.bereich_id || null } : { role: 'fk', fkId: null };
}

async function enterApp(session) {
  $('#login').hidden = true; $('#recovery').hidden = true; $('#app').hidden = false;
  await loadViewer(session);
  if (DEMO) $('#userLine').innerHTML = '<span style="color:var(--gold-l);font-weight:700">● DEMO-MODUS</span><br>lokale Beispieldaten';
  else $('#userLine').textContent = session.user.email + (viewer.role === 'admin' ? ' · Admin' : ' · FK');
  await loadBereiche();
  buildRoleSwitch();
  subscribe();
  go(showControlling);
}

async function loadBereiche() {
  const { data, error } = await sb.from('bereiche').select('*').order('sortierung');
  if (error) return toast('Laden fehlgeschlagen: ' + error.message, true);
  BEREICHE = data;
}

/* ── Rollen / Hierarchie ───────────────────────────────────────────── */
const isAdmin = () => viewer.role === 'admin';
const childrenFks = id => BEREICHE.filter(b => b.parent_id === id);
function subtreeIds(id) { const out = [id]; for (const c of childrenFks(id)) out.push(...subtreeIds(c.id)); return out; }
function fkDepth(b) { let d = 0, p = b.parent_id; while (p != null) { const par = BEREICHE.find(x => x.id === p); if (!par) break; d++; p = par.parent_id; } return d; }
const visibleFks = () => isAdmin() ? BEREICHE : BEREICHE.filter(b => subtreeIds(viewer.fkId).includes(b.id));
const scopedFkName = () => { const b = BEREICHE.find(x => x.id === viewer.fkId); return b ? b.name : '—'; };
const baseDepth = () => isAdmin() ? 0 : fkDepth(BEREICHE.find(x => x.id === viewer.fkId) || { parent_id: null });

function buildRoleSwitch() {
  const box = $('#roleSwitch');
  if (!DEMO) { box.hidden = true; return; }   // echte Rollen kommen aus profiles (Supabase)
  box.hidden = false; box.innerHTML = '';
  box.appendChild(el('div', 'rs-lbl', 'ANSICHT ALS'));
  const sel = el('select');
  sel.appendChild(new Option('Admin · alle', 'admin'));
  for (const b of BEREICHE) sel.appendChild(new Option('FK · ' + b.name, 'fk:' + b.id));
  sel.value = isAdmin() ? 'admin' : 'fk:' + viewer.fkId;
  sel.onchange = () => {
    viewer = sel.value === 'admin' ? { role: 'admin', fkId: null } : { role: 'fk', fkId: Number(sel.value.split(':')[1]) };
    go(showControlling);
  };
  box.appendChild(sel);
}

/* ── Navigation ────────────────────────────────────────────────────── */
function go(thunk) { currentView = thunk; thunk(); }
function rerenderCurrent() { currentView(); }

function renderNav() {
  const nav = $('#nav'); nav.innerHTML = '';
  const item = (label, thunk, active) => { const a = el('a', 'dash' + (active ? ' active' : ''), label); a.onclick = () => go(thunk); nav.appendChild(a); };
  item('📊 Controlling', showControlling, curName === 'controlling');
  item('🗓 Monatsauswertung', showMonat, curName === 'monat');
  item('♻ Recycling', showRecycling, curName === 'recycling');
  const base = baseDepth();
  for (const b of visibleFks()) {
    const a = el('a', curName === 'fk:' + b.id ? 'active' : '');
    a.style.paddingLeft = (11 + Math.max(0, fkDepth(b) - base) * 13) + 'px';
    a.appendChild(el('span', 'dot ' + b.gruppe));
    a.appendChild(el('span', null, b.name));
    a.onclick = () => go(() => showFk(b.id));
    nav.appendChild(a);
  }
}

function monthNav() {
  const bar = el('div', 'monthnav');
  const prev = el('button', 'mn-btn', '◀'); prev.onclick = () => { currentMonat = monthShift(currentMonat, -1); rerenderCurrent(); };
  const next = el('button', 'mn-btn', '▶'); next.onclick = () => { currentMonat = monthShift(currentMonat, 1); rerenderCurrent(); };
  bar.append(prev, el('div', 'mn-lbl', monthLabel(currentMonat)), next);
  return bar;
}

/* ── Datenzugriff (rollen-gescoped) ────────────────────────────────── */
async function allVisibleEintraege() {
  const ids = visibleFks().map(b => b.id);
  const { data } = await sb.from('eintraege').select('*');
  return (data || []).filter(r => ids.includes(r.bereich_id));
}
async function allSubs() { const { data } = await sb.from('sub_leiter').select('*'); return data || []; }
const subName = (subs, id) => { const s = subs.find(x => x.id === id); return s ? s.name : '—'; };
const fkName = id => { const b = BEREICHE.find(x => x.id === id); return b ? b.name : '—'; };

/* ── Controlling-Dashboard ─────────────────────────────────────────── */
async function showControlling() {
  curName = 'controlling'; renderNav();
  const rows = (await allVisibleEintraege()).filter(r => (r.monat || '') === currentMonat);
  const v = $('#view'); v.innerHTML = '';
  v.appendChild(header('CONTROLLING', isAdmin() ? 'Controlling-Dashboard' : 'Mein Team',
    (isAdmin() ? 'Alle Führungskräfte' : scopedFkName()) + ' · Monat ' + monthLabel(currentMonat), 'teal'));
  v.appendChild(monthNav());

  const kunden = rows.filter(r => r.status === 'kunde');
  const umsatz = kunden.reduce((a, r) => a + num(r.potenzial), 0);
  const quote = rows.length ? Math.round(kunden.length / rows.length * 100) : 0;
  const gew = rows.filter(r => r.status === 'offen').reduce((a, r) => a + num(r.potenzial) * (STUFE_WK[r.terminart] || 0.2), 0);
  const kpis = el('div', 'kpis');
  kpis.append(kpi('Interessenten', rows.length), kpi('Kunden', kunden.length),
    kpi('Abschlussquote', quote + ' %'), kpi('Umsatz (Kunde)', eur(umsatz)), kpi('Gew. Pipeline', eur(gew)));
  v.appendChild(kpis);

  v.appendChild(el('div', 'pillinfo', 'Zahlen je Führungskraft rollen den ganzen Unterbaum hoch (inkl. untergeordneter FKs).'));
  const t = el('table', 'dash-tbl');
  t.innerHTML = '<thead><tr><th>Führungskraft</th><th>Rolle</th><th class="num">Interess.</th>' +
    '<th class="num">Kunden</th><th class="num">Quote</th><th class="num">Umsatz</th><th class="num">Gew. Pipeline</th></tr></thead>';
  const tb = el('tbody');
  const scopeIds = visibleFks().map(b => b.id); const base = baseDepth();
  for (const b of visibleFks()) {
    const ids = subtreeIds(b.id).filter(id => scopeIds.includes(id));
    const fr = rows.filter(r => ids.includes(r.bereich_id));
    const fk = fr.filter(r => r.status === 'kunde');
    const fq = fr.length ? Math.round(fk.length / fr.length * 100) : 0;
    const fg = fr.filter(r => r.status === 'offen').reduce((a, r) => a + num(r.potenzial) * (STUFE_WK[r.terminart] || 0.2), 0);
    const tr = el('tr');
    if (!fr.length) tr.classList.add('row-dim');
    const depth = Math.max(0, fkDepth(b) - base);
    const nt = el('td'); nt.style.paddingLeft = (12 + depth * 18) + 'px';
    if (depth) nt.appendChild(el('span', 'tree', '└ '));
    nt.appendChild(el('span', 'dot ' + b.gruppe)); const ln = el('a', 'name', ' ' + b.name); ln.onclick = () => go(() => showFk(b.id)); nt.appendChild(ln); tr.appendChild(nt);
    tr.appendChild(el('td', 'rolle', b.rolle || '—'));
    tr.appendChild(el('td', 'num', fr.length));
    tr.appendChild(el('td', 'num', fk.length));
    const qt = el('td', 'num', fr.length ? fq + ' %' : '—'); qt.style.color = fq >= 50 ? '#15803D' : fq > 0 ? '#B45309' : '#B91C1C'; tr.appendChild(qt);
    tr.appendChild(el('td', 'num', eur(fk.reduce((a, r) => a + num(r.potenzial), 0))));
    tr.appendChild(el('td', 'num', eur(fg)));
    tb.appendChild(tr);
  }
  t.appendChild(tb); v.appendChild(t);
  if (!rows.length) v.appendChild(el('div', 'empty', 'Keine Interessenten in ' + monthLabel(currentMonat) + '. Lege welche im Bereich einer Führungskraft an.'));
}

/* ── Monatsauswertung ──────────────────────────────────────────────── */
async function showMonat() {
  curName = 'monat'; renderNav();
  const [rowsAll, subs] = await Promise.all([allVisibleEintraege(), allSubs()]);
  const rows = rowsAll.filter(r => (r.monat || '') === currentMonat).sort((a, b) => (a.bereich_id - b.bereich_id) || (a.sortierung - b.sortierung));
  const v = $('#view'); v.innerHTML = '';
  v.appendChild(header('MONATSAUSWERTUNG', 'Monat ' + monthLabel(currentMonat),
    'Wer wurde Kunde – und wer nicht. „Abgelehnt" schiebt den Interessenten mit Grund ins Recycling.', 'gold'));
  v.appendChild(monthNav());

  const kunden = rows.filter(r => r.status === 'kunde').length;
  const abg = rows.filter(r => r.status === 'abgelehnt').length;
  v.appendChild(el('div', 'pillinfo', rows.length + ' Interessenten · ' + kunden + ' Kunde · ' + abg + ' abgelehnt · ' + (rows.length - kunden - abg) + ' offen'));

  const t = el('table', 'tbl');
  t.innerHTML = '<thead><tr><th>Interessent</th><th>Berater</th><th>Terminart</th>' +
    '<th class="num">Potenzial €</th><th>Status</th><th>Grund</th></tr></thead>';
  const tb = el('tbody');
  const showBands = visibleFks().length > 1;
  let lastFk = null;
  for (const r of rows) {
    if (showBands && r.bereich_id !== lastFk) {
      lastFk = r.bereich_id;
      const band = el('tr', 'subband'); const td = el('td'); td.colSpan = 6;
      const b = BEREICHE.find(x => x.id === r.bereich_id);
      td.textContent = '⬧  ' + fkName(r.bereich_id).toUpperCase() + (b && b.rolle ? '  ·  ' + b.rolle : '');
      band.appendChild(td); tb.appendChild(band);
    }
    const tr = el('tr'); if (r.status === 'kunde') tr.classList.add('is-kunde');
    tr.appendChild(el('td', null, r.kunde || '—'));
    tr.appendChild(el('td', null, subName(subs, r.sub_leiter_id)));
    tr.appendChild(el('td', null, r.terminart || '—'));
    tr.appendChild(el('td', 'num', eur(num(r.potenzial))));
    tr.appendChild(statusCell(r));
    tr.appendChild(grundCell(r));
    tb.appendChild(tr);
  }
  t.appendChild(tb); v.appendChild(t);
  if (!rows.length) v.appendChild(el('div', 'empty', 'Keine Interessenten in diesem Monat.'));
}

/* ── Recycling ─────────────────────────────────────────────────────── */
async function showRecycling() {
  curName = 'recycling'; renderNav();
  const [rowsAll, subs] = await Promise.all([allVisibleEintraege(), allSubs()]);
  const rec = rowsAll.filter(r => r.status === 'abgelehnt');
  const v = $('#view'); v.innerHTML = '';
  v.appendChild(header('RECYCLING', 'Recycling-Liste',
    'Nicht gewonnene Interessenten mit Grund. „Reaktivieren" holt sie in ' + monthLabel(currentMonat) + ' zurück.', 'rm'));

  const dist = {}; for (const r of rec) { const g = r.ablehnungsgrund || '(ohne Grund)'; dist[g] = (dist[g] || 0) + 1; }
  const top = Object.entries(dist).sort((a, b) => b[1] - a[1])[0];
  const kpis = el('div', 'kpis');
  kpis.append(kpi('Im Recycling', rec.length), kpi('Häufigster Grund', top ? top[0] + ' (' + top[1] + ')' : '—'),
    kpi('Potenzial gesamt', eur(rec.reduce((a, r) => a + num(r.potenzial), 0))));
  v.appendChild(kpis);

  const t = el('table', 'tbl');
  t.innerHTML = '<thead><tr><th>Interessent</th>' + (isAdmin() ? '<th>Führungskraft</th>' : '') +
    '<th>Berater</th><th>Monat</th><th>Ablehnungsgrund</th><th class="num">Potenzial €</th><th class="col-del"></th></tr></thead>';
  const tb = el('tbody');
  for (const r of rec) {
    const tr = el('tr');
    tr.appendChild(el('td', null, r.kunde || '—'));
    if (isAdmin()) tr.appendChild(el('td', null, fkName(r.bereich_id)));
    tr.appendChild(el('td', null, subName(subs, r.sub_leiter_id)));
    tr.appendChild(el('td', null, r.monat ? monthLabel(r.monat) : '—'));
    tr.appendChild(grundCell(r, true));
    tr.appendChild(el('td', 'num', eur(num(r.potenzial))));
    const at = el('td'); const b = el('button', 'btn sub reactivate', '↺ Reaktivieren');
    b.onclick = async () => { await save(r.id, 'status', 'offen'); await save(r.id, 'monat', currentMonat); toast('In ' + monthLabel(currentMonat) + ' reaktiviert'); rerenderCurrent(); };
    at.appendChild(b); tr.appendChild(at);
    tb.appendChild(tr);
  }
  t.appendChild(tb); v.appendChild(t);
  if (!rec.length) v.appendChild(el('div', 'empty', 'Recycling ist leer — nichts abgelehnt.'));
}

/* ── FK-Board (operatives Pflegen, monats-gescoped) ────────────────── */
async function showFk(id) {
  curName = 'fk:' + id; renderNav();
  const b = BEREICHE.find(x => x.id === id); if (!b) return;
  const [{ data: subs }, { data: all }] = await Promise.all([
    sb.from('sub_leiter').select('*').eq('bereich_id', id).order('sortierung'),
    sb.from('eintraege').select('*').eq('bereich_id', id).order('sortierung')
  ]);
  const rows = all.filter(r => (r.monat || '') === currentMonat);
  const v = $('#view'); v.innerHTML = '';
  v.appendChild(header((b.rolle || 'FÜHRUNGSKRAFT').toUpperCase(), b.name,
    'Interessenten ' + monthLabel(currentMonat) + ' · Status pflegen, „Abgelehnt" wandert ins Recycling', b.gruppe));
  v.appendChild(monthNav());

  const bar = el('div', 'toolbar');
  const addSubBtn = el('button', 'btn sub', '+ Berater'); addSubBtn.onclick = () => addBerater(id); bar.appendChild(addSubBtn);
  // Hierarchie: übergeordnete FK ändern
  const pWrap = el('label', 'pillinfo'); pWrap.style.display = 'flex'; pWrap.style.alignItems = 'center'; pWrap.style.gap = '7px';
  pWrap.appendChild(el('span', null, 'Untersteht:'));
  const psel = el('select'); psel.style.cssText = 'border:1px solid var(--line);border-radius:7px;padding:5px';
  psel.appendChild(new Option('— oberste Ebene', ''));
  for (const o of BEREICHE.filter(x => !subtreeIds(id).includes(x.id))) psel.appendChild(new Option(o.name + ' (' + (o.rolle || '') + ')', o.id));
  psel.value = b.parent_id || '';
  psel.onchange = async () => { await sb.from('bereiche').update({ parent_id: psel.value ? Number(psel.value) : null }).eq('id', id); await loadBereiche(); rerenderCurrent(); toast('Hierarchie aktualisiert'); };
  pWrap.appendChild(psel); bar.appendChild(pWrap);
  v.appendChild(bar);

  const kids = childrenFks(id);
  if (kids.length) {
    const kb = el('div', 'childfks'); kb.appendChild(el('span', 'cf-lbl', 'Untergeordnete FKs:'));
    for (const c of kids) { const a = el('a', 'cf-link'); a.appendChild(el('span', 'dot ' + c.gruppe)); a.appendChild(el('span', null, ' ' + c.name)); a.onclick = () => go(() => showFk(c.id)); kb.appendChild(a); }
    v.appendChild(kb);
  }

  const t = el('table', 'tbl');
  t.innerHTML = '<thead><tr><th>Interessent</th><th>Terminart</th><th class="num">Potenzial €</th>' +
    '<th>Status</th><th>Grund</th><th>Datum</th><th>Notiz</th><th class="col-del"></th></tr></thead>';
  const tb = el('tbody');
  const byGroup = new Map([[null, []]]);
  for (const s of subs) byGroup.set(s.id, []);
  for (const r of rows) (byGroup.get(r.sub_leiter_id) || byGroup.get(null)).push(r);

  for (const r of byGroup.get(null)) tb.appendChild(rowEl(r));
  addLine(tb, id, null);
  for (const s of subs) {
    tb.appendChild(bandEl(s, id));
    for (const r of (byGroup.get(s.id) || [])) tb.appendChild(rowEl(r));
    addLine(tb, id, s.id);
  }
  t.appendChild(tb); v.appendChild(t);

  const pipeline = rows.reduce((a, r) => a + num(r.potenzial), 0);
  const kundeUms = rows.filter(r => r.status === 'kunde').reduce((a, r) => a + num(r.potenzial), 0);
  const g = el('div', 'gesamt');
  g.appendChild(el('span', 'lbl', 'PIPELINE ' + monthLabel(currentMonat).toUpperCase()));
  const right = el('div', 'gesamt-right');
  right.appendChild(el('span', 'val', eur(pipeline)));
  right.appendChild(el('span', 'sub-val', 'davon Kunde: ' + eur(kundeUms)));
  g.appendChild(right);
  v.appendChild(g);
}

function bandEl(s, bereichId) {
  const tr = el('tr', 'subband');
  const td = el('td'); td.colSpan = 8;
  const lbl = el('span', null, '⬧  ' + s.name.toUpperCase() + '  (Berater)');
  lbl.title = 'Doppelklick: umbenennen/löschen';
  lbl.ondblclick = async () => {
    const n = prompt('Berater umbenennen (leer = löschen):', s.name); if (n == null) return;
    if (n.trim() === '') { if (confirm('Berater löschen? Interessenten bleiben, verlieren die Zuordnung.')) { await sb.from('sub_leiter').delete().eq('id', s.id); rerenderCurrent(); } return; }
    await sb.from('sub_leiter').update({ name: n.trim() }).eq('id', s.id); rerenderCurrent();
  };
  td.appendChild(lbl);
  const mv = el('button', 'band-move', '⇄ verschieben'); mv.title = 'Berater zu anderer Führungskraft verschieben';
  mv.onclick = async () => {
    const list = BEREICHE.map(x => x.id + ' = ' + x.name).join('\n');
    const t = prompt('Berater „' + s.name + '" zu welcher Führungskraft?\nID eingeben:\n\n' + list, bereichId);
    if (!t) return; const tid = Number(t); if (!BEREICHE.find(x => x.id === tid)) return toast('Ungültige ID', true);
    await sb.from('sub_leiter').update({ bereich_id: tid }).eq('id', s.id);
    await sb.from('eintraege').update({ bereich_id: tid }).eq('sub_leiter_id', s.id);
    toast('Berater verschoben'); rerenderCurrent();
  };
  td.appendChild(mv);
  tr.appendChild(td); return tr;
}

function rowEl(r) {
  const tr = el('tr'); if (r.status === 'kunde') tr.classList.add('is-kunde');
  tr.appendChild(cellInput(r, 'kunde', 'text'));
  tr.appendChild(cellInput(r, 'terminart', 'text', 'terminarten'));
  tr.appendChild(cellPot(r));
  tr.appendChild(statusCell(r));
  tr.appendChild(grundCell(r));
  tr.appendChild(cellInput(r, 'datum', 'text'));
  tr.appendChild(cellInput(r, 'notiz', 'text'));
  const del = el('td', 'col-del'); const b = el('button', 'del-btn', '✕');
  b.onclick = async () => { await sb.from('eintraege').delete().eq('id', r.id); rerenderCurrent(); };
  del.appendChild(b); tr.appendChild(del);
  return tr;
}

function cellInput(r, col, type, listId) {
  const td = el('td'); const i = el('input'); i.type = type; i.value = r[col] ?? '';
  if (listId) i.setAttribute('list', listId);
  i.onchange = () => save(r.id, col, i.value);
  td.appendChild(i); return td;
}
function cellPot(r) {
  const td = el('td', 'num'); potClass(td, r.potenzial);
  const i = el('input'); i.type = 'number'; i.step = 1000; i.value = r.potenzial || 0;
  i.onchange = () => { save(r.id, 'potenzial', Number(i.value) || 0); potClass(td, i.value); refreshTotal(); };
  td.appendChild(i); return td;
}
function potClass(td, val) {
  const n = Number(val) || 0;
  td.classList.remove('v0', 'v1', 'v50', 'v100');
  td.classList.add(n <= 0 ? 'v0' : n < 50000 ? 'v1' : n < 100000 ? 'v50' : 'v100');
}
function statusCell(r) {
  const td = el('td'); const s = el('select', 'statussel ' + (r.status || 'offen'));
  for (const st of STATUS) { const o = el('option', null, STATUS_LABEL[st]); o.value = st; if ((r.status || 'offen') === st) o.selected = true; s.appendChild(o); }
  s.onchange = async () => { await save(r.id, 'status', s.value); rerenderCurrent(); };
  td.appendChild(s); return td;
}
function grundCell(r) {
  const td = el('td');
  if ((r.status || 'offen') !== 'abgelehnt') { td.textContent = '—'; td.style.color = 'var(--grey)'; return td; }
  const i = el('input'); i.setAttribute('list', 'ablehnungsgruende'); i.value = r.ablehnungsgrund || ''; i.placeholder = 'Grund…';
  i.onchange = () => save(r.id, 'ablehnungsgrund', i.value || null);
  td.appendChild(i); return td;
}
function addLine(tb, bereichId, subId) {
  const tr = el('tr'); const td = el('td'); td.colSpan = 8; td.style.padding = '4px';
  const btn = el('button', 'add-line', '+ Interessent'); btn.onclick = async () => {
    const { data, error } = await sb.from('eintraege').insert({ bereich_id: bereichId, sub_leiter_id: subId, monat: currentMonat, status: 'offen', potenzial: 0, sortierung: Date.now() % 1e9 }).select().single();
    if (error) return toast(error.message, true);
    tb.insertBefore(rowEl(data), tr);
    const first = tr.previousSibling.querySelector('input'); if (first) first.focus();
  };
  td.appendChild(btn); tr.appendChild(td); tb.appendChild(tr);
}
async function addBerater(bereichId) {
  const name = prompt('Name des Beraters:'); if (!name || !name.trim()) return;
  const { error } = await sb.from('sub_leiter').insert({ bereich_id: bereichId, name: name.trim(), sortierung: Date.now() % 1e9 });
  error ? toast(error.message, true) : rerenderCurrent();
}
async function save(id, col, val) {
  const { error } = await sb.from('eintraege').update({ [col]: val, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) toast('Speichern fehlgeschlagen: ' + error.message, true);
}
function refreshTotal() {
  const inputs = document.querySelectorAll('.tbl td.num input');
  let t = 0; inputs.forEach(i => t += Number(i.value) || 0);
  const g = document.querySelector('.gesamt .val'); if (g) g.textContent = eur(t);
}

/* ── Realtime ──────────────────────────────────────────────────────── */
function subscribe() {
  if (realtimeCh) { sb.removeChannel(realtimeCh); realtimeCh = null; }
  const rerender = () => {
    const a = document.activeElement;
    if (a && (a.tagName === 'INPUT' || a.tagName === 'SELECT')) return;
    rerenderCurrent();
  };
  realtimeCh = sb.channel('board');
  for (const table of ['eintraege', 'sub_leiter', 'bereiche'])
    realtimeCh.on('postgres_changes', { event: '*', schema: 'public', table }, rerender);
  realtimeCh.subscribe();
}

/* ── Helpers ───────────────────────────────────────────────────────── */
function header(eyebrow, title, sub, group) {
  const h = el('div', 'hdr');
  h.appendChild(el('div', 'eyebrow', eyebrow));
  h.appendChild(el('h2', null, title));
  h.appendChild(el('div', 'sub', sub));
  h.appendChild(el('div', 'accent ' + (group || '')));
  return h;
}
function kpi(lbl, val) { const d = el('div', 'kpi'); d.appendChild(el('div', 'k-lbl', lbl)); d.appendChild(el('div', 'k-val', val)); return d; }

let toastT;
function toast(msg, err) {
  const t = $('#toast'); t.textContent = msg; t.className = 'toast' + (err ? ' err' : ''); t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, err ? 4000 : 1400);
}

/* ── Excel-Import (SheetJS) ────────────────────────────────────────── */
$('#importBtn').addEventListener('click', () => $('#importFile').click());
$('#importFile').addEventListener('change', async e => {
  const file = e.target.files[0]; e.target.value = '';
  if (!file) return;
  if (!confirm('Import aus "' + file.name + '"?\nBestehende Interessenten & Berater der gefundenen Führungskräfte werden ersetzt.')) return;
  toast('Import läuft…');
  try { await importXlsx(file); toast('Import fertig'); go(showControlling); }
  catch (err) { toast('Import-Fehler: ' + err.message, true); }
});
async function importXlsx(file) {
  const wb = XLSX.read(await file.arrayBuffer(), { cellDates: false });
  const importMonat = prompt('Für welchen Monat importieren? (JJJJ-MM)', currentMonat) || currentMonat;
  for (const b of BEREICHE) {
    const ws = wb.Sheets[b.name]; if (!ws) continue;
    const grid = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
    await sb.from('eintraege').delete().eq('bereich_id', b.id);
    await sb.from('sub_leiter').delete().eq('bereich_id', b.id);
    let curSub = null, sIdx = 0, eIdx = 0; const eintraege = [];
    for (let ri = 7; ri <= 65 && ri < grid.length; ri++) {
      const row = grid[ri] || []; const cB = str(row[1]), cC = str(row[2]);
      if (cB.includes('⬧')) { const { data } = await sb.from('sub_leiter').insert({ bereich_id: b.id, name: cB.replace(/⬧/g, '').trim(), sortierung: ++sIdx * 100 }).select().single(); curSub = data ? data.id : null; continue; }
      if (!cC) continue;
      eintraege.push({ bereich_id: b.id, sub_leiter_id: curSub, kunde: cC, monat: importMonat, status: 'offen', potenzial: num(row[5]), datum: str(row[6]) || null, terminart: str(row[7]) || null, notiz: str(row[8]) || null, sortierung: ++eIdx * 100 });
    }
    if (eintraege.length) { const { error } = await sb.from('eintraege').insert(eintraege); if (error) throw error; }
  }
}

/* ── Excel-Export ──────────────────────────────────────────────────── */
$('#exportBtn').addEventListener('click', exportXlsx);
async function exportXlsx() {
  toast('Export wird erstellt…');
  const [{ data: subs }, { data: rows }] = await Promise.all([
    sb.from('sub_leiter').select('*').order('sortierung'),
    sb.from('eintraege').select('*').order('sortierung')
  ]);
  const wb = XLSX.utils.book_new();
  const add = (name, aoa) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), name.replace(/[\[\]\*\?\/\\:]/g, ' ').slice(0, 31));
  const subN = id => { const s = subs.find(x => x.id === id); return s ? s.name : ''; };

  // Controlling-Übersicht (aktueller Monat)
  const cur = rows.filter(r => (r.monat || '') === currentMonat);
  const dash = [['Führungskraft', 'Gruppe', 'Interessenten', 'Kunden', 'Quote %', 'Umsatz €']];
  for (const b of BEREICHE) {
    const fr = cur.filter(r => r.bereich_id === b.id); const fk = fr.filter(r => r.status === 'kunde');
    dash.push([b.name, b.gruppe, fr.length, fk.length, fr.length ? Math.round(fk.length / fr.length * 100) : '', fk.reduce((a, r) => a + num(r.potenzial), 0)]);
  }
  add('Controlling ' + currentMonat, dash);

  // Recycling
  const rec = [['Interessent', 'Führungskraft', 'Berater', 'Monat', 'Ablehnungsgrund', 'Potenzial €']];
  for (const r of rows.filter(r => r.status === 'abgelehnt')) rec.push([r.kunde || '', fkName(r.bereich_id), subN(r.sub_leiter_id), r.monat || '', r.ablehnungsgrund || '', num(r.potenzial)]);
  add('Recycling', rec);

  // je FK ein Sheet
  for (const b of BEREICHE) {
    const aoa = [['Interessent', 'Berater', 'Monat', 'Terminart', 'Potenzial €', 'Status', 'Grund', 'Datum', 'Notiz']];
    for (const r of rows.filter(r => r.bereich_id === b.id))
      aoa.push([r.kunde || '', subN(r.sub_leiter_id), r.monat || '', r.terminart || '', num(r.potenzial), r.status || '', r.ablehnungsgrund || '', r.datum || '', r.notiz || '']);
    add(b.name, aoa);
  }
  XLSX.writeFile(wb, 'Umsatzboard_' + new Date().toISOString().slice(0, 10) + '.xlsx');
  toast('Export fertig');
}

init();
