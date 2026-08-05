/* Umsatzboard Controlling v3 — Vanilla JS + Supabase/Demo. Kein Build-Step.
   Modell: jeder Mitarbeiter ist ein Knoten (bereiche) in der Hierarchie (parent_id) und
   plant eigene Interessenten (eintraege.bereich_id zeigt direkt auf die Person). */
const CFG = window.SUPABASE_CONFIG || {};
const DEMO = !CFG.url || /DEIN-PROJEKT/.test(CFG.url);
const sb = DEMO ? DemoDB.client() : window.supabase.createClient(CFG.url, CFG.anonKey);

const TERMINARTEN = ['S1', 'S2', 'S3', 'Service', 'AEC', 'TzT', 'Recruiting'];
const STATUS = ['offen', 'kunde', 'abgelehnt'];
const STATUS_LABEL = { offen: '○ Offen', kunde: '✓ Kunde', abgelehnt: '✕ Abgelehnt' };
const STUFE_WK = { S1: 0.1, S2: 0.4, S3: 0.7, Service: 0.5, AEC: 0.3 };   // Wahrscheinlichkeit für gewichtete Pipeline
const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const KOMPASS_URL = 'https://wolny-tools.vercel.app/tools/av-depot-kompass.html';   // internes Beratungs-Tool (Login „beratung")
const TOOLS_URL = 'https://wolny-tools.vercel.app/';                                 // Beratungstools-Portal
const COCKPIT_URL = null;   // Finanzierungscockpit — Verknüpfung folgt, sobald es eine Live-URL hat
const AV_STATUS = ['offen', 'angesprochen', 'eroeffnet', 'kein_interesse'];
const AV_LABEL = { offen: '○ Offen', angesprochen: '◔ Angesprochen', eroeffnet: '✓ Depot eröffnet', kein_interesse: '✕ Kein Interesse' };
const KPUE_TYP = ['potenzial', 'interessent', 'kunde'];
const KPUE_LABEL = { potenzial: '◇ Potenziell', interessent: '○ Interessent', kunde: '✓ Kunde' };
const KPUE_ZIEL = 30;   // klassische 30er-Liste
const MON_KURZ = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
// Aktivitäten-Funnel: Vorlaufkennzahlen von der Ansprache bis zum Abschluss
const FUNNEL = [
  { key: 'kontakte',  kurz: 'Kontakte', label: 'Kontakte / Ansprachen' },
  { key: 's1',        kurz: 'S1',       label: 'S1 · Erstgespräch' },
  { key: 's2',        kurz: 'S2',       label: 'S2 · Konzeptpräsentation' },
  { key: 's3',        kurz: 'S3',       label: 'S3 · Abschlussgespräch' },
  { key: 'abschluss', kurz: 'Abschluss', label: 'Abschlüsse' },
];

const $ = s => document.querySelector(s);
const el = (t, c, txt) => { const e = document.createElement(t); if (c) e.className = c; if (txt != null) e.textContent = txt; return e; };
const eur = n => (Number(n) || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const str = v => (v == null ? '' : String(v)).trim();
const num = v => { if (typeof v === 'number') return v; const n = parseFloat(str(v).replace(/[^\d,-]/g, '').replace(',', '.')); return isNaN(n) ? 0 : n; };
const monthLabel = m => { if (!m) return '—'; const [y, mo] = m.split('-'); return MONATE[+mo - 1] + ' ' + y; };
function monthShift(m, d) { let [y, mo] = m.split('-').map(Number); mo += d; while (mo < 1) { mo += 12; y--; } while (mo > 12) { mo -= 12; y++; } return y + '-' + String(mo).padStart(2, '0'); }
const heute = () => new Date().toISOString().slice(0, 10);
function daysSince(dstr) { if (!dstr) return null; const d = new Date(dstr + 'T00:00:00'); if (isNaN(d)) return null; const t = new Date(); t.setHours(0, 0, 0, 0); return Math.floor((t - d) / 86400000); }
function fmtDate(dstr) { if (!dstr) return '—'; const [y, m, d] = dstr.split('-'); return d + '.' + m + '.' + y; }
const byAge = (a, b) => { const x = a.erfasst_am || '9999', y = b.erfasst_am || '9999'; return x < y ? -1 : x > y ? 1 : ((a.sortierung || 0) - (b.sortierung || 0)); };

let BEREICHE = [];
let ZIELE = [];              // { bereich_id, jahr, monat (1-12), wert }
let viewer = { role: 'admin', fkId: null };
let currentMonat = new Date().toISOString().slice(0, 7);
let currentView = showControlling, curName = 'controlling';
let showAllNodes = false;
let boardTab = 'pipeline';   // 'pipeline' | 'avdepot'
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
  else $('#userLine').textContent = session.user.email + (viewer.role === 'admin' ? ' · Admin' : '');
  await loadBereiche();
  await loadZiele();
  // Demo: nicht auf einem leeren Monat starten → jüngster Monat mit Daten
  if (DEMO) {
    const { data } = await sb.from('eintraege').select('*');
    const monate = [...new Set((data || []).map(r => r.monat).filter(Boolean))].sort();
    if (monate.length && !monate.includes(currentMonat)) currentMonat = monate[monate.length - 1];
  }
  buildRoleSwitch();
  subscribe();
  go(showControlling);
}

async function loadBereiche() {
  const { data, error } = await sb.from('bereiche').select('*').order('sortierung');
  if (error) return toast('Laden fehlgeschlagen: ' + error.message, true);
  BEREICHE = data;
}
async function loadZiele() {
  const { data } = await sb.from('ziele').select('*');
  ZIELE = data || [];
}

/* ── Ziele: Soll-Ist über die Hierarchie ───────────────────────────── */
const jahrVon = m => Number((m || '').slice(0, 4));
const monVon = m => Number((m || '').slice(5, 7));
// Monatsziel einer Person (ohne Unterbau)
const zielEigen = (bid, jahr, monat) => {
  const z = ZIELE.find(x => x.bereich_id === bid && x.jahr === jahr && x.monat === monat);
  return z ? num(z.wert) : 0;
};
// Monatsziel inkl. Unterbau (rollt hoch wie die Ist-Zahlen)
const zielSubtree = (bid, jahr, monat) => subtreeIds(bid).reduce((a, id) => a + zielEigen(id, jahr, monat), 0);
const zielJahrEigen = (bid, jahr) => ZIELE.filter(x => x.bereich_id === bid && x.jahr === jahr).reduce((a, x) => a + num(x.wert), 0);
const zielJahrSubtree = (bid, jahr) => subtreeIds(bid).reduce((a, id) => a + zielJahrEigen(id, jahr), 0);
// Ampel: Zielerreichungsgrad → Klasse
function ampel(ist, soll) {
  if (!soll) return { pct: null, cls: 'amp-none', txt: '—' };
  const p = Math.round(ist / soll * 100);
  return { pct: p, cls: p >= 100 ? 'amp-gruen' : p >= 80 ? 'amp-gelb' : p >= 50 ? 'amp-orange' : 'amp-rot', txt: p + ' %' };
}
function ampelBadge(ist, soll) {
  const a = ampel(ist, soll);
  const s = el('span', 'amp ' + a.cls, a.txt);
  if (soll) s.title = eur(ist) + ' von ' + eur(soll);
  return s;
}
async function setZiel(bid, jahr, monat, wert) {
  const ex = ZIELE.find(x => x.bereich_id === bid && x.jahr === jahr && x.monat === monat);
  if (ex) { await sb.from('ziele').update({ wert }).eq('id', ex.id); ex.wert = wert; }
  else {
    const { data, error } = await sb.from('ziele').insert({ bereich_id: bid, jahr, monat, wert }).select().single();
    if (error) return toast(error.message, true);
    ZIELE.push(data);
  }
}

/* ── Rollen / Hierarchie ───────────────────────────────────────────── */
const isAdmin = () => viewer.role === 'admin';
const childrenFks = id => BEREICHE.filter(b => b.parent_id === id);
function subtreeIds(id) { const out = [id]; for (const c of childrenFks(id)) out.push(...subtreeIds(c.id)); return out; }
function fkDepth(b) { let d = 0, p = b.parent_id; while (p != null) { const par = BEREICHE.find(x => x.id === p); if (!par) break; d++; p = par.parent_id; } return d; }
const visibleFks = () => isAdmin() ? BEREICHE : BEREICHE.filter(b => subtreeIds(viewer.fkId).includes(b.id));
const scopedName = () => { const b = BEREICHE.find(x => x.id === viewer.fkId); return b ? b.name : '—'; };
const baseDepth = () => isAdmin() ? 0 : fkDepth(BEREICHE.find(x => x.id === viewer.fkId) || { parent_id: null });
const fkName = id => { const b = BEREICHE.find(x => x.id === id); return b ? b.name : '—'; };

function buildRoleSwitch() {
  const box = $('#roleSwitch');
  if (!DEMO) { box.hidden = true; return; }   // echte Rollen kommen aus profiles (Supabase)
  box.hidden = false; box.innerHTML = '';
  box.appendChild(el('div', 'rs-lbl', 'ANSICHT ALS'));
  const sel = el('select');
  sel.appendChild(new Option('Admin · alle', 'admin'));
  for (const b of BEREICHE) sel.appendChild(new Option('· '.repeat(fkDepth(b)) + b.name + (b.rolle ? ' (' + b.rolle + ')' : ''), 'fk:' + b.id));
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
  item('🎯 Ziele & Planung', showZiele, curName === 'ziele');
  item('📞 Aktivitäten-Funnel', showFunnel, curName === 'funnel');
  item('🧮 Volumenrechner', showVolumen, curName === 'volumen');
  item('🏅 Karriere & Provision', showKarriere, curName === 'karriere');
  item('🗓 Monatsauswertung', showMonat, curName === 'monat');
  item('🚀 AV-Kampagne', showKampagne, curName === 'kampagne');
  item('♻ Recycling', showRecycling, curName === 'recycling');
  const base = baseDepth();
  // Nav zeigt Führungskräfte (Knoten mit Team), Wurzel-Knoten (z.B. Inhaber) + den eigenen Knoten.
  const navNodes = visibleFks().filter(b => childrenFks(b.id).length > 0 || b.parent_id == null || b.id === viewer.fkId);
  for (const b of navNodes) {
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
function nodeStats(id, monthRows) {
  const ids = subtreeIds(id);
  const fr = monthRows.filter(r => ids.includes(r.bereich_id));
  const k = fr.filter(r => r.status === 'kunde');
  return { n: fr.length, k: k.length, ums: k.reduce((a, r) => a + num(r.potenzial), 0) };
}

/* ── Controlling-Dashboard ─────────────────────────────────────────── */
async function showControlling() {
  curName = 'controlling'; renderNav();
  const rows = (await allVisibleEintraege()).filter(r => (r.monat || '') === currentMonat);
  const v = $('#view'); v.innerHTML = '';
  v.appendChild(header('CONTROLLING', isAdmin() ? 'Controlling-Dashboard' : 'Mein Bereich',
    (isAdmin() ? 'Gesamte Organisation' : scopedName()) + ' · Monat ' + monthLabel(currentMonat), 'teal'));
  v.appendChild(monthNav());

  const kunden = rows.filter(r => r.status === 'kunde');
  const umsatz = kunden.reduce((a, r) => a + num(r.potenzial), 0);
  const quote = rows.length ? Math.round(kunden.length / rows.length * 100) : 0;
  const gew = rows.filter(r => r.status === 'offen').reduce((a, r) => a + num(r.potenzial) * (STUFE_WK[r.terminart] || 0.2), 0);
  const jahr = jahrVon(currentMonat), mon = monVon(currentMonat);
  const sollM = visibleFks().filter(b => !b.parent_id || !visibleFks().some(x => x.id === b.parent_id))
    .reduce((a, b) => a + zielSubtree(b.id, jahr, mon), 0);
  const kpis = el('div', 'kpis');
  kpis.append(kpi('Interessenten', rows.length), kpi('Kunden', kunden.length),
    kpi('Abschlussquote', quote + ' %'), kpi('Umsatz (Kunde)', eur(umsatz)),
    kpi('Monatsziel', sollM ? eur(sollM) : '—'), kpi('Zielerreichung', ampel(umsatz, sollM).txt),
    kpi('Gew. Pipeline', eur(gew)));
  v.appendChild(kpis);

  const bar = el('div', 'toolbar');
  const lbl = el('label', 'pillinfo'); lbl.style.cssText = 'display:flex;align-items:center;gap:8px;cursor:pointer';
  const cb = el('input'); cb.type = 'checkbox'; cb.checked = showAllNodes;
  cb.onchange = () => { showAllNodes = cb.checked; rerenderCurrent(); };
  lbl.append(cb, el('span', null, 'Alle Mitarbeiter zeigen (nicht nur Führungskräfte) · Zahlen rollen den Unterbau hoch'));
  bar.appendChild(lbl); v.appendChild(bar);

  const t = el('table', 'dash-tbl');
  t.innerHTML = '<thead><tr><th>Mitarbeiter</th><th>Rolle</th><th class="num">Interess.</th>' +
    '<th class="num">Kunden</th><th class="num">Quote</th><th class="num">Umsatz (Ist)</th>' +
    '<th class="num">Monatsziel</th><th>Ampel</th><th class="num">Gew. Pipeline</th></tr></thead>';
  const tb = el('tbody');
  const scopeIds = visibleFks().map(b => b.id); const base = baseDepth();
  const tableNodes = visibleFks().filter(b => showAllNodes || childrenFks(b.id).length > 0 || b.id === viewer.fkId);
  for (const b of tableNodes) {
    const ids = subtreeIds(b.id).filter(id => scopeIds.includes(id));
    const fr = rows.filter(r => ids.includes(r.bereich_id));
    const fk = fr.filter(r => r.status === 'kunde');
    const fq = fr.length ? Math.round(fk.length / fr.length * 100) : 0;
    const fg = fr.filter(r => r.status === 'offen').reduce((a, r) => a + num(r.potenzial) * (STUFE_WK[r.terminart] || 0.2), 0);
    const fUms = fk.reduce((a, r) => a + num(r.potenzial), 0);
    const fSoll = zielSubtree(b.id, jahr, mon);
    const tr = el('tr');
    if (!fr.length && !fSoll) tr.classList.add('row-dim');
    const depth = Math.max(0, fkDepth(b) - base);
    const nt = el('td'); nt.style.paddingLeft = (12 + depth * 18) + 'px';
    if (depth) nt.appendChild(el('span', 'tree', '└ '));
    nt.appendChild(el('span', 'dot ' + b.gruppe)); const ln = el('a', 'name', ' ' + b.name); ln.onclick = () => go(() => showFk(b.id)); nt.appendChild(ln); tr.appendChild(nt);
    tr.appendChild(el('td', 'rolle', b.rolle || '—'));
    tr.appendChild(el('td', 'num', fr.length));
    tr.appendChild(el('td', 'num', fk.length));
    const qt = el('td', 'num', fr.length ? fq + ' %' : '—'); qt.style.color = fq >= 50 ? '#15803D' : fq > 0 ? '#B45309' : '#B91C1C'; tr.appendChild(qt);
    tr.appendChild(el('td', 'num', eur(fUms)));
    tr.appendChild(el('td', 'num', fSoll ? eur(fSoll) : '—'));
    const at = el('td'); at.appendChild(ampelBadge(fUms, fSoll)); tr.appendChild(at);
    tr.appendChild(el('td', 'num', eur(fg)));
    tb.appendChild(tr);
  }
  t.appendChild(tb); v.appendChild(t);
  if (!rows.length) v.appendChild(el('div', 'empty', 'Keine Interessenten in ' + monthLabel(currentMonat) + '. Lege welche im Board eines Mitarbeiters an.'));
}

/* ── Monatsauswertung ──────────────────────────────────────────────── */
async function showMonat() {
  curName = 'monat'; renderNav();
  const rowsAll = await allVisibleEintraege();
  const rows = rowsAll.filter(r => r.monat === currentMonat).sort((a, b) => (a.bereich_id - b.bereich_id) || byAge(a, b));
  const v = $('#view'); v.innerHTML = '';
  v.appendChild(header('MONATSAUSWERTUNG', 'Monat ' + monthLabel(currentMonat),
    'Alle Interessenten des Monats je Mitarbeiter. „Abgelehnt" schiebt mit Grund ins Recycling.', 'gold'));
  v.appendChild(monthNav());

  const kunden = rows.filter(r => r.status === 'kunde').length;
  const abg = rows.filter(r => r.status === 'abgelehnt').length;
  v.appendChild(el('div', 'pillinfo', rows.length + ' Interessenten · ' + kunden + ' Kunde · ' + abg + ' abgelehnt · ' + (rows.length - kunden - abg) + ' offen'));

  const t = el('table', 'tbl');
  t.innerHTML = '<thead><tr><th>Interessent</th><th>Terminart</th><th class="num">Potenzial €</th>' +
    '<th>Status</th><th>Grund</th><th>Auf Liste seit</th></tr></thead>';
  const tb = el('tbody');
  let lastFk = null;
  for (const r of rows) {
    if (r.bereich_id !== lastFk) {
      lastFk = r.bereich_id;
      const b = BEREICHE.find(x => x.id === r.bereich_id);
      const band = el('tr', 'subband'); const td = el('td'); td.colSpan = 6;
      td.textContent = '⬧  ' + fkName(r.bereich_id).toUpperCase() + (b && b.rolle ? '  ·  ' + b.rolle : '');
      band.appendChild(td); tb.appendChild(band);
    }
    const tr = el('tr'); if (r.status === 'kunde') tr.classList.add('is-kunde');
    tr.appendChild(el('td', null, r.kunde || '—'));
    tr.appendChild(el('td', null, r.terminart || '—'));
    tr.appendChild(el('td', 'num', eur(num(r.potenzial))));
    tr.appendChild(statusCell(r));
    tr.appendChild(grundCell(r));
    tr.appendChild(seitDisplay(r));
    tb.appendChild(tr);
  }
  t.appendChild(tb); v.appendChild(t);
  if (!rows.length) v.appendChild(el('div', 'empty', 'Keine Interessenten in diesem Monat.'));
}

/* ── Recycling ─────────────────────────────────────────────────────── */
async function showRecycling() {
  curName = 'recycling'; renderNav();
  const rowsAll = await allVisibleEintraege();
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
  t.innerHTML = '<thead><tr><th>Interessent</th><th>Mitarbeiter</th><th>Letzter Monat</th>' +
    '<th>Ablehnungsgrund</th><th class="num">Potenzial €</th><th class="col-del"></th></tr></thead>';
  const tb = el('tbody');
  for (const r of rec) {
    const tr = el('tr');
    tr.appendChild(el('td', null, r.kunde || '—'));
    tr.appendChild(el('td', null, fkName(r.bereich_id)));
    tr.appendChild(el('td', null, r.monat ? monthLabel(r.monat) : '—'));
    tr.appendChild(grundCell(r));
    tr.appendChild(el('td', 'num', eur(num(r.potenzial))));
    const at = el('td'); const b = el('button', 'btn sub reactivate', '↺ Reaktivieren');
    b.onclick = async () => { await save(r.id, 'status', 'offen'); await save(r.id, 'monat', currentMonat); toast('In ' + monthLabel(currentMonat) + ' reaktiviert'); rerenderCurrent(); };
    at.appendChild(b); tr.appendChild(at);
    tb.appendChild(tr);
  }
  t.appendChild(tb); v.appendChild(t);
  if (!rec.length) v.appendChild(el('div', 'empty', 'Recycling ist leer — nichts abgelehnt.'));
}

/* ── Aktivitäten-Funnel (Vorlaufkennzahlen) ────────────────────────── */
const aktEigen = (bid, monat, aktRows) => {
  const r = (aktRows || []).find(x => x.bereich_id === bid && x.monat === monat);
  const o = {}; for (const s of FUNNEL) o[s.key] = r ? num(r[s.key]) : 0;
  return o;
};
// Summe über den Unterbau (wie bei Volumen/Zielen)
function aktSubtree(bid, monat, aktRows) {
  const o = {}; for (const s of FUNNEL) o[s.key] = 0;
  for (const id of subtreeIds(bid)) {
    const e = aktEigen(id, monat, aktRows);
    for (const s of FUNNEL) o[s.key] += e[s.key];
  }
  return o;
}
// Umwandlungsquoten Stufe → Stufe; null wenn Ausgangsstufe leer
function quoten(a) {
  const q = [];
  for (let i = 1; i < FUNNEL.length; i++) {
    const von = a[FUNNEL[i - 1].key], nach = a[FUNNEL[i].key];
    q.push({ von: FUNNEL[i - 1].kurz, nach: FUNNEL[i].kurz, wert: von ? nach / von : null });
  }
  return q;
}
// Rückrechnung: benötigte Aktivität für ein Umsatzziel.
// Fehlende eigene Quoten werden durch Referenzwerte ersetzt (transparent markiert).
const REF_QUOTE = { s1: 0.35, s2: 0.6, s3: 0.7, abschluss: 0.6 };   // Kontakt→S1→S2→S3→Abschluss
function rueckrechnung(ziel, aVolProAbschluss, a) {
  const q = quoten(a);
  const eff = [];   // effektive Quote je Übergang + ob geschätzt
  for (let i = 0; i < q.length; i++) {
    const eigen = q[i].wert;
    const ok = eigen != null && eigen > 0;
    eff.push({ wert: ok ? eigen : REF_QUOTE[FUNNEL[i + 1].key], geschaetzt: !ok });
  }
  const proAbschluss = aVolProAbschluss > 0 ? aVolProAbschluss : 0;
  const abschluesse = proAbschluss ? ziel / proAbschluss : 0;
  // von hinten nach vorne hochrechnen
  const bedarf = { abschluss: abschluesse };
  let n = abschluesse;
  for (let i = FUNNEL.length - 2; i >= 0; i--) {
    const e = eff[i];
    n = e.wert > 0 ? n / e.wert : 0;
    bedarf[FUNNEL[i].key] = n;
  }
  return { bedarf, eff, abschluesse };
}

async function showFunnel() {
  curName = 'funnel'; renderNav();
  const ids = visibleFks().map(b => b.id);
  const [{ data: allAkt }, { data: allE }] = await Promise.all([
    sb.from('aktivitaeten').select('*'),
    sb.from('eintraege').select('*'),
  ]);
  const aktRows = (allAkt || []).filter(r => ids.includes(r.bereich_id));
  const jahr = jahrVon(currentMonat), mon = monVon(currentMonat);

  const v = $('#view'); v.innerHTML = '';
  v.appendChild(header('AKTIVITÄTEN', 'Funnel & Vorlaufkennzahlen',
    'Kontakte → S1 → S2 → S3 → Abschluss. Zahlen je Monat erfassen, Quoten und Aktivitätsbedarf rechnen sich daraus.', 'teal'));
  v.appendChild(monthNav());

  // Gesamt-Funnel des Sichtbereichs (Wurzeln des Bereichs, damit nichts doppelt zählt)
  const wurzeln = visibleFks().filter(b => !ids.includes(b.parent_id));
  const ges = {}; for (const s of FUNNEL) ges[s.key] = 0;
  for (const b of wurzeln) { const a = aktSubtree(b.id, currentMonat, aktRows); for (const s of FUNNEL) ges[s.key] += a[s.key]; }

  // Trichter
  const maxV = Math.max(1, ges.kontakte || 0);
  const fw = el('div', 'funnelwrap');
  for (const [i, s] of FUNNEL.entries()) {
    const row = el('div', 'fn-row');
    row.appendChild(el('div', 'fn-lbl', s.label));
    const barBox = el('div', 'fn-barbox');
    const bar = el('div', 'fn-bar fn-' + s.key);
    bar.style.width = Math.max(2, (ges[s.key] / maxV) * 100) + '%';
    bar.appendChild(el('span', 'fn-val', String(ges[s.key])));
    barBox.appendChild(bar);
    row.appendChild(barBox);
    // Quote zur Vorstufe
    const qt = el('div', 'fn-quote');
    if (i > 0) {
      const von = ges[FUNNEL[i - 1].key];
      qt.textContent = von ? '↳ ' + Math.round(ges[s.key] / von * 100) + ' %' : '↳ —';
    }
    row.appendChild(qt);
    fw.appendChild(row);
  }
  v.appendChild(fw);

  // Kennzahlen
  const kunden = (allE || []).filter(r => ids.includes(r.bereich_id) && r.monat === currentMonat && r.status === 'kunde');
  const umsatz = kunden.reduce((a, r) => a + num(r.potenzial), 0);
  const proAbschluss = ges.abschluss ? umsatz / ges.abschluss : (kunden.length ? umsatz / kunden.length : 0);
  const gesamtQuote = ges.kontakte ? ges.abschluss / ges.kontakte : null;
  const kp = el('div', 'kpis');
  kp.append(kpi('Kontakte', ges.kontakte), kpi('Abschlüsse', ges.abschluss),
    kpi('Gesamtquote', gesamtQuote == null ? '—' : (gesamtQuote * 100).toFixed(1).replace('.', ',') + ' %'),
    kpi('Ø Volumen je Abschluss', proAbschluss ? eur(proAbschluss) : '—'));
  v.appendChild(kp);

  // Rückrechnung aus dem Monatsziel
  const soll = wurzeln.reduce((a, b) => a + zielSubtree(b.id, jahr, mon), 0);
  const rrBox = el('div', 'av-intro rr-box');
  if (!soll) rrBox.appendChild(el('p', 'av-lead', 'Kein Monatsziel hinterlegt — trag es unter „Ziele & Planung" ein, dann rechnet das Board hier den nötigen Aktivitätsbedarf aus.'));
  else if (!proAbschluss) rrBox.appendChild(el('p', 'av-lead', 'Noch kein Ø-Volumen je Abschluss bekannt (Abschlüsse oder Umsatz fehlen) — sobald der erste Monat gepflegt ist, rechnet das Board den Aktivitätsbedarf.'));
  else {
    const rr = rueckrechnung(soll, proAbschluss, ges);
    rrBox.appendChild(el('div', 'rr-titel', 'Aktivitätsbedarf für das Monatsziel ' + eur(soll)));
    const chain = el('div', 'rr-chain');
    for (const [i, s] of FUNNEL.entries()) {
      const item = el('div', 'rr-item');
      item.appendChild(el('div', 'rr-num', Math.ceil(rr.bedarf[s.key] || 0).toLocaleString('de-DE')));
      item.appendChild(el('div', 'rr-lbl', s.kurz));
      const ist = ges[s.key], need = Math.ceil(rr.bedarf[s.key] || 0);
      if (ist >= need && need > 0) item.classList.add('rr-ok');
      item.title = 'Ist: ' + ist + ' · benötigt: ' + need;
      chain.appendChild(item);
      if (i < FUNNEL.length - 1) chain.appendChild(el('div', 'rr-pfeil', '→'));
    }
    rrBox.appendChild(chain);
    const gesch = rr.eff.some(e => e.geschaetzt);
    rrBox.appendChild(el('div', 'rr-fuss', 'Basis: Ø ' + eur(proAbschluss) + ' je Abschluss' +
      (gesch ? ' · für fehlende eigene Quoten sind Erfahrungswerte angesetzt (35/60/70/60 %)' : ' · gerechnet mit euren eigenen Quoten')));
  }
  v.appendChild(rrBox);

  // Tabelle: Erfassung je Person + Quoten
  const wrap = el('div', 'tblscroll');
  const t = el('table', 'dash-tbl fn-tbl');
  let head = '<thead><tr><th>Mitarbeiter</th>';
  for (const s of FUNNEL) head += '<th class="num">' + s.kurz + '</th>';
  head += '<th class="num">K→S1</th><th class="num">S1→S2</th><th class="num">S2→S3</th><th class="num">S3→A</th><th class="num">Gesamt</th></tr></thead>';
  t.innerHTML = head;
  const tb = el('tbody');
  const base = baseDepth();
  for (const b of visibleFks()) {
    const eig = aktEigen(b.id, currentMonat, aktRows);
    const team = aktSubtree(b.id, currentMonat, aktRows);
    const hatTeam = childrenFks(b.id).length > 0;
    const tr = el('tr');
    if (!team.kontakte && !team.abschluss) tr.classList.add('row-dim');
    const depth = Math.max(0, fkDepth(b) - base);
    const nt = el('td'); nt.style.paddingLeft = (12 + depth * 18) + 'px';
    if (depth) nt.appendChild(el('span', 'tree', '└ '));
    nt.appendChild(el('span', 'dot ' + b.gruppe));
    const ln = el('a', 'name', ' ' + b.name); ln.onclick = () => go(() => showFk(b.id)); nt.appendChild(ln);
    tr.appendChild(nt);

    for (const s of FUNNEL) {
      const td = el('td', 'num');
      const i = el('input', 'fn-in'); i.type = 'number'; i.min = 0; i.value = eig[s.key] || '';
      i.placeholder = '–';
      i.onchange = async () => { await setAktivitaet(b.id, currentMonat, s.key, Number(i.value) || 0); rerenderCurrent(); };
      td.appendChild(i);
      if (hatTeam && team[s.key] !== eig[s.key]) td.appendChild(el('div', 'ziel-team', 'Team: ' + team[s.key]));
      tr.appendChild(td);
    }
    // Quoten auf Team-Basis (das ist die Führungssicht)
    for (const q of quoten(team)) {
      const td = el('td', 'num');
      td.appendChild(quoteBadge(q.wert));
      tr.appendChild(td);
    }
    const gq = team.kontakte ? team.abschluss / team.kontakte : null;
    const gt = el('td', 'num'); gt.appendChild(quoteBadge(gq, true)); tr.appendChild(gt);
    tb.appendChild(tr);
  }
  t.appendChild(tb); wrap.appendChild(t); v.appendChild(wrap);
}

function quoteBadge(wert, gesamt) {
  if (wert == null) return el('span', 'amp amp-none', '—');
  const p = wert * 100;
  // Schwellen: Übergangsquoten und Gesamtquote werden unterschiedlich bewertet
  const gut = gesamt ? 8 : 55, mittel = gesamt ? 4 : 35;
  const cls = p >= gut ? 'amp-gruen' : p >= mittel ? 'amp-gelb' : 'amp-rot';
  return el('span', 'amp ' + cls, (p >= 10 ? Math.round(p) : p.toFixed(1).replace('.', ',')) + ' %');
}
async function setAktivitaet(bid, monat, feld, wert) {
  const { data: vorhanden } = await sb.from('aktivitaeten').select('*').eq('bereich_id', bid).eq('monat', monat);
  const row = (vorhanden || [])[0];
  if (row) await sb.from('aktivitaeten').update({ [feld]: wert }).eq('id', row.id);
  else await sb.from('aktivitaeten').insert({ bereich_id: bid, monat, [feld]: wert });
}

/* ── Karriere & Provision (Systematik tecis Anlage 5) ──────────────── */
const positionen = () => (window.POSITIONEN || []).slice().sort((a, b) => a.stufe - b.stufe);
const posOf = b => positionen().find(p => p.key === (b && b.position)) || null;
const promilleOf = b => { const p = posOf(b); return p ? num(p.promille) : 0; };
// nächste Stufe im selben Karriereweg (Basis läuft in Führung oder Profi weiter)
function naechstePos(b) {
  const p = posOf(b); if (!p) return positionen()[0] || null;
  const weg = p.weg === 'basis' ? (b.karriereweg || 'fuehrung') : p.weg;
  const kandidaten = positionen().filter(x => x.stufe > p.stufe && (x.weg === weg || x.weg === 'basis'));
  return kandidaten[0] || null;
}
// Eigenvolumen einer Person = Summe ihrer Positionen im Volumenrechner (Bewertungszeitraum = geladene Zeilen)
function eigenVolumen(bid, volRows) {
  return (volRows || []).filter(r => r.bereich_id === bid)
    .reduce((a, r) => a + volumen(tarife().find(x => x.name === r.tarif), r), 0);
}
const teamVolumen = (bid, volRows) => subtreeIds(bid).reduce((a, id) => a + eigenVolumen(id, volRows), 0);
// Provision: Eigenanteil + Differenzprovision auf die direkt Zugeordneten (Anlage 5, I.7)
function provision(b, volRows) {
  const satz = promilleOf(b);
  const eigen = eigenVolumen(b.id, volRows) * satz / 1000;
  let diff = 0;
  for (const k of childrenFks(b.id)) {
    const delta = satz - promilleOf(k);
    if (delta > 0) diff += teamVolumen(k.id, volRows) * delta / 1000;
  }
  const brutto = eigen + diff;
  const p = posOf(b);
  const einbehalt = brutto * (p ? num(p.einbehalt) : 0) / 100;
  return { satz, eigen, diff, brutto, einbehalt, auszahlung: brutto - einbehalt };
}

async function showKarriere() {
  curName = 'karriere'; renderNav();
  const { data: allVol } = await sb.from('volumen').select('*');
  const ids = visibleFks().map(b => b.id);
  const volRows = (allVol || []).filter(r => ids.includes(r.bereich_id));

  const v = $('#view'); v.innerHTML = '';
  v.appendChild(header('KARRIERE & PROVISION', 'Positionen und Stufenfortschritt',
    'Systematik der tecis Anlage 5: Position → Provisionssatz, Volumen → nächste Stufe.', 'gold'));

  const q = el('div', 'pillinfo', 'Positions-Quelle: ' + (window.POSITIONEN_QUELLE || 'unbekannt'));
  if (!/Anlage 5/.test(window.POSITIONEN_QUELLE || '')) q.classList.add('warn');
  v.appendChild(q);

  const gesVol = visibleFks().filter(b => !ids.includes(b.parent_id)).reduce((a, b) => a + teamVolumen(b.id, volRows), 0);
  const gesProv = visibleFks().reduce((a, b) => a + provision(b, volRows).brutto, 0);
  const kp = el('div', 'kpis');
  kp.append(kpi('Volumen gesamt', gesVol.toLocaleString('de-DE', { maximumFractionDigits: 0 })),
    kpi('Provision (Struktur)', eur(gesProv)),
    kpi('Positionen besetzt', visibleFks().filter(b => posOf(b)).length + ' / ' + visibleFks().length));
  v.appendChild(kp);

  const wrap = el('div', 'tblscroll');
  const t = el('table', 'dash-tbl karr-tbl');
  t.innerHTML = '<thead><tr><th>Mitarbeiter</th><th>Position</th><th class="num">‰</th>' +
    '<th class="num">Eigenvolumen</th><th class="num">Teamvolumen</th><th>Nächste Stufe</th>' +
    '<th class="num">Eigenprov.</th><th class="num">Differenzprov.</th><th class="num">Auszahlung</th></tr></thead>';
  const tb = el('tbody');
  const base = baseDepth();
  for (const b of visibleFks()) {
    const ev = eigenVolumen(b.id, volRows), tv = teamVolumen(b.id, volRows);
    const pr = provision(b, volRows), p = posOf(b), nx = naechstePos(b);
    const tr = el('tr');
    const depth = Math.max(0, fkDepth(b) - base);
    const nt = el('td'); nt.style.paddingLeft = (12 + depth * 18) + 'px';
    if (depth) nt.appendChild(el('span', 'tree', '└ '));
    nt.appendChild(el('span', 'dot ' + b.gruppe));
    const ln = el('a', 'name', ' ' + b.name); ln.onclick = () => go(() => showFk(b.id)); nt.appendChild(ln);
    tr.appendChild(nt);

    // Position wählbar
    const pt = el('td'); const sel = el('select', 'statussel pos-sel');
    sel.appendChild(new Option('— keine —', ''));
    let lastWeg = null, grp = null;
    const WEG_LBL = { basis: 'Qualifikation & Berater', fuehrung: 'Führungskarriere', profi: 'Profiberaterkarriere' };
    for (const po of positionen()) {
      if (po.weg !== lastWeg) { grp = window.document.createElement('optgroup'); grp.label = WEG_LBL[po.weg] || po.weg; sel.appendChild(grp); lastWeg = po.weg; }
      const o = new Option(po.name, po.key); if (b.position === po.key) o.selected = true; grp.appendChild(o);
    }
    sel.onchange = async () => {
      await sb.from('bereiche').update({ position: sel.value || null }).eq('id', b.id);
      await loadBereiche(); rerenderCurrent();
    };
    pt.appendChild(sel); tr.appendChild(pt);

    tr.appendChild(el('td', 'num', p ? String(p.promille).replace('.', ',') : '—'));
    tr.appendChild(el('td', 'num', ev.toLocaleString('de-DE', { maximumFractionDigits: 0 })));
    tr.appendChild(el('td', 'num', tv.toLocaleString('de-DE', { maximumFractionDigits: 0 })));

    // Fortschritt zur nächsten Stufe
    const ft = el('td', 'karr-next');
    if (!nx) ft.appendChild(el('span', 'karr-top', '★ Spitzenposition'));
    else {
      const zielEigen = num(nx.eigen), zielTeam = num(nx.team);
      const relEigen = zielEigen ? ev / zielEigen : 1;
      const relTeam = zielTeam ? tv / zielTeam : 1;
      const pct = Math.round(Math.min(relEigen, relTeam) * 100);
      ft.appendChild(el('div', 'karr-name', nx.name));
      const bar = el('div', 'bar karr-bar'); const sp = el('span');
      sp.style.width = Math.min(100, pct) + '%'; if (pct >= 100) sp.style.background = '#15803D';
      bar.appendChild(sp); ft.appendChild(bar);
      const need = [];
      if (zielEigen) need.push('Eigen ' + Math.round(relEigen * 100) + ' %');
      if (zielTeam) need.push('Team ' + Math.round(relTeam * 100) + ' %');
      ft.appendChild(el('div', 'karr-need', need.join(' · ') || '—'));
    }
    tr.appendChild(ft);

    tr.appendChild(el('td', 'num', pr.eigen ? eur(pr.eigen) : '—'));
    tr.appendChild(el('td', 'num', pr.diff ? eur(pr.diff) : '—'));
    const at = el('td', 'num karr-aus', pr.brutto ? eur(pr.auszahlung) : '—');
    if (pr.brutto && p) at.title = 'Brutto ' + eur(pr.brutto) + ' − ' + p.einbehalt + ' % Haftungseinbehalt';
    tr.appendChild(at);
    tb.appendChild(tr);
  }
  t.appendChild(tb); wrap.appendChild(t); v.appendChild(wrap);

  v.appendChild(el('div', 'pillinfo', 'Differenzprovision = (eigener Satz − Satz der direkt zugeordneten Person) × deren Teamvolumen. ' +
    'Auszahlung nach Abzug des Haftungseinbehalts. 40/70/90-Regelung und Qualitätsquote sind noch nicht abgebildet.'));
}

/* ── Volumenrechner (Systematik tecis Anlage 4) ────────────────────── */
const tarife = () => window.TARIFE || [];
// Volumen einer Position nach Formeltyp der Anlage 4
function volumen(t, p) {
  if (!t) return 0;
  const b = num(p.betrag), j = num(p.jahre), e = num(p.einmal), f = num(t.faktor) || 0;
  switch (t.typ) {
    case 'bs':        return b * 12 * Math.min(j, t.bzdMax || j) * f;        // Beitragssumme, BZD maximiert
    case 'einmal':    return b * f;                                           // Einmalbeitrag/Zeichnungssumme
    case 'mb':        return b * f;                                           // Monatsbeitrag × Faktor (PKV)
    case 'jnb':       return b * 12 * f;                                      // Jahresnettobeitrag
    case 'nb':        return b * f;                                           // Nettobeitrag
    case 'sparplan':  return (b * 12 * j + e) * f;                            // Rate × Dauer (+ Einmalanlage)
    case 'summe':     return b * (num(t.bewertung) || 1) * f;                 // Darlehen/Bauspar × Bewertungsfaktor
    case 'kaufpreis': return b * (num(p.satz) / 100) * f;                     // Kaufpreis × Provisionssatz %
    default:          return 0;
  }
}
const TYP_FELDER = {   // welche Eingaben ein Typ braucht
  bs:        { betrag: 'Monatsbeitrag €', jahre: 'BZD (Jahre)' },
  einmal:    { betrag: 'Einmalbetrag €' },
  mb:        { betrag: 'Monatsbeitrag €' },
  jnb:       { betrag: 'Monatsbeitrag €' },
  nb:        { betrag: 'Nettobeitrag €' },
  sparplan:  { betrag: 'Sparrate €', jahre: 'Dauer (Jahre)', einmal: 'Einmalanlage €' },
  summe:     { betrag: 'Darlehens-/Bausparsumme €' },
  kaufpreis: { betrag: 'Kaufpreis €', satz: 'Provision %' },
};

async function showVolumen() {
  curName = 'volumen'; renderNav();
  const { data: all } = await sb.from('volumen').select('*');
  const ids = visibleFks().map(b => b.id);
  const list = (all || []).filter(r => ids.includes(r.bereich_id)).sort((a, b) => (a.sortierung || 0) - (b.sortierung || 0));

  const v = $('#view'); v.innerHTML = '';
  v.appendChild(header('VOLUMEN', 'Volumenrechner',
    'Systematik der tecis Anlage 4: Volumen = Basis × Faktor (BZD maximiert). Positionen erfassen, Summe unten.', 'gold'));

  const q = el('div', 'pillinfo', 'Faktoren-Quelle: ' + (window.TARIFE_QUELLE || 'unbekannt'));
  if (!window.PROMILLE_BEISPIEL) q.classList.add('warn');
  v.appendChild(q);

  const t = el('table', 'tbl vol-tbl');
  t.innerHTML = '<thead><tr><th>Kunde</th><th>Tarif</th><th class="num">Basis</th>' +
    '<th class="num">Jahre / %</th><th class="num">Einmal €</th><th class="num">Volumen</th><th class="col-del"></th></tr></thead>';
  const tb = el('tbody');
  for (const r of list) tb.appendChild(volRowEl(r));
  volAddLine(tb, viewer.fkId || (visibleFks()[0] || {}).id);
  t.appendChild(tb); v.appendChild(t);

  const gesamt = list.reduce((a, r) => a + volumen(tarife().find(x => x.name === r.tarif), r), 0);
  const g = el('div', 'gesamt');
  g.appendChild(el('span', 'lbl', 'VOLUMEN GESAMT'));
  const right = el('div', 'gesamt-right');
  right.appendChild(el('span', 'val', (gesamt).toLocaleString('de-DE', { maximumFractionDigits: 0 })));
  right.appendChild(el('span', 'sub-val', list.length + ' Positionen' +
    (window.PROMILLE_BEISPIEL ? '  ·  Beispiel ' + String(window.PROMILLE_BEISPIEL).replace('.', ',') + ' ‰ = ' + eur(gesamt * window.PROMILLE_BEISPIEL / 1000) : '')));
  g.appendChild(right); v.appendChild(g);

  if (!window.PROMILLE_BEISPIEL)
    v.appendChild(el('div', 'empty', 'Diese Ansicht rechnet mit Platzhalter-Faktoren. Die echten Werte der Anlage 4 liegen lokal in tarife.local.js (nicht im öffentlichen Repo).'));
}

function volRowEl(r) {
  const t0 = tarife().find(x => x.name === r.tarif);
  const tr = el('tr');
  const c1 = el('td'); const i1 = el('input'); i1.value = r.kunde ?? ''; i1.placeholder = 'Kunde…';
  i1.onchange = () => saveTbl('volumen', r.id, 'kunde', i1.value); c1.appendChild(i1); tr.appendChild(c1);

  const c2 = el('td'); const s = el('select', 'vol-tarif');
  s.appendChild(new Option('— Tarif wählen —', ''));
  let lastSparte = null, grp = null;
  for (const t of tarife()) {
    if (t.sparte !== lastSparte) { grp = window.document.createElement('optgroup'); grp.label = t.sparte; s.appendChild(grp); lastSparte = t.sparte; }
    const o = new Option(t.name, t.name); if (r.tarif === t.name) o.selected = true; grp.appendChild(o);
  }
  s.onchange = async () => { await saveTbl('volumen', r.id, 'tarif', s.value); rerenderCurrent(); };
  c2.appendChild(s); tr.appendChild(c2);

  const felder = TYP_FELDER[t0 ? t0.typ : 'bs'] || {};
  const mk = (col, ph, cls) => {
    const td = el('td', 'num'); const i = el('input', cls); i.type = 'number'; i.value = r[col] ?? '';
    i.placeholder = ph || '–'; if (!ph) i.disabled = true;
    i.onchange = () => { saveTbl('volumen', r.id, col, Number(i.value) || 0); rerenderCurrent(); };
    td.appendChild(i); return td;
  };
  tr.appendChild(mk('betrag', felder.betrag));
  tr.appendChild(mk(felder.satz ? 'satz' : 'jahre', felder.jahre || felder.satz));
  tr.appendChild(mk('einmal', felder.einmal));

  const vol = volumen(t0, r);
  const vt = el('td', 'num vol-erg', vol ? vol.toLocaleString('de-DE', { maximumFractionDigits: 0 }) : '—');
  if (t0 && t0.hinweis) vt.title = t0.hinweis;
  tr.appendChild(vt);

  const del = el('td', 'col-del'); const bt = el('button', 'del-btn', '✕');
  bt.onclick = async () => { await sb.from('volumen').delete().eq('id', r.id); rerenderCurrent(); };
  del.appendChild(bt); tr.appendChild(del);
  return tr;
}
function volAddLine(tb, bereichId) {
  const tr = el('tr'); const td = el('td'); td.colSpan = 7; td.style.padding = '4px';
  const btn = el('button', 'add-line', '+ Position'); btn.onclick = async () => {
    const { data, error } = await sb.from('volumen').insert({ bereich_id: bereichId, monat: currentMonat, sortierung: Date.now() % 1e9 }).select().single();
    if (error) return toast(error.message, true);
    tb.insertBefore(volRowEl(data), tr); const f = tr.previousSibling.querySelector('input'); if (f) f.focus();
  };
  td.appendChild(btn); tr.appendChild(td); tb.appendChild(tr);
}

/* ── Ziele & Planung (Jahr → Monat, Soll-Ist je Person) ────────────── */
async function showZiele() {
  curName = 'ziele'; renderNav();
  const jahr = jahrVon(currentMonat);
  const { data: allE } = await sb.from('eintraege').select('*');
  const ids = visibleFks().map(b => b.id);
  const ist = (allE || []).filter(r => ids.includes(r.bereich_id) && r.status === 'kunde' && jahrVon(r.monat) === jahr);

  const v = $('#view'); v.innerHTML = '';
  v.appendChild(header('ZIELE & PLANUNG', 'Jahresplanung ' + jahr,
    'Jahresziel setzen → wird auf 12 Monate verteilt. Monatswerte einzeln anpassbar. Zahlen rollen den Unterbau hoch.', 'teal'));

  // Jahres-Navigation
  const nav = el('div', 'monthnav');
  const pv = el('button', 'mn-btn', '◀'); pv.onclick = () => { currentMonat = (jahr - 1) + currentMonat.slice(4); rerenderCurrent(); };
  const nx = el('button', 'mn-btn', '▶'); nx.onclick = () => { currentMonat = (jahr + 1) + currentMonat.slice(4); rerenderCurrent(); };
  nav.append(pv, el('div', 'mn-lbl', 'Jahr ' + jahr), nx);
  v.appendChild(nav);

  // KPIs gesamt (Sichtbereich)
  const sollGes = visibleFks().filter(b => !b.parent_id || !ids.includes(b.parent_id)).reduce((a, b) => a + zielJahrSubtree(b.id, jahr), 0);
  const istGes = ist.reduce((a, r) => a + num(r.potenzial), 0);
  const bisMonat = monVon(currentMonat);
  const sollYtd = visibleFks().filter(b => !b.parent_id || !ids.includes(b.parent_id))
    .reduce((a, b) => { let s = 0; for (let m = 1; m <= bisMonat; m++) s += zielSubtree(b.id, jahr, m); return a + s; }, 0);
  const istYtd = ist.filter(r => monVon(r.monat) <= bisMonat).reduce((a, r) => a + num(r.potenzial), 0);
  const kp = el('div', 'kpis');
  kp.append(kpi('Jahresziel', eur(sollGes)), kpi('Ist ' + jahr, eur(istGes)),
    kpi('Zielerreichung', ampel(istGes, sollGes).txt),
    kpi('Soll bis ' + MON_KURZ[bisMonat - 1], eur(sollYtd)),
    kpi('Ampel YTD', ampel(istYtd, sollYtd).txt));
  v.appendChild(kp);

  const info = el('div', 'pillinfo', 'Klick auf ein Monatsfeld zum Ändern. „Jahr setzen" verteilt gleichmäßig auf 12 Monate.');
  v.appendChild(info);

  // Tabelle: je Person Jahresziel + 12 Monate + Ist + Ampel
  const wrap = el('div', 'tblscroll');
  const t = el('table', 'dash-tbl ziel-tbl');
  let head = '<thead><tr><th>Mitarbeiter</th><th class="num">Jahresziel</th><th class="num">Ist</th><th>Ampel</th>';
  for (const m of MON_KURZ) head += '<th class="num mon">' + m + '</th>';
  t.innerHTML = head + '</tr></thead>';
  const tb = el('tbody');
  const base = baseDepth();
  for (const b of visibleFks()) {
    const eigenJahr = zielJahrEigen(b.id, jahr);
    const teamJahr = zielJahrSubtree(b.id, jahr);
    const bIst = ist.filter(r => subtreeIds(b.id).includes(r.bereich_id)).reduce((a, r) => a + num(r.potenzial), 0);
    const tr = el('tr');
    const depth = Math.max(0, fkDepth(b) - base);
    const nt = el('td'); nt.style.paddingLeft = (12 + depth * 18) + 'px';
    if (depth) nt.appendChild(el('span', 'tree', '└ '));
    nt.appendChild(el('span', 'dot ' + b.gruppe));
    const ln = el('a', 'name', ' ' + b.name); ln.onclick = () => go(() => showFk(b.id)); nt.appendChild(ln);
    if (b.rolle) nt.appendChild(el('span', 'ziel-rolle', ' · ' + b.rolle));
    tr.appendChild(nt);

    // Jahresziel: eigener Wert editierbar, Team-Summe als Hinweis
    const jt = el('td', 'num'); const ji = el('input', 'ziel-jahr'); ji.type = 'number'; ji.step = 1000; ji.value = eigenJahr || '';
    ji.placeholder = '0'; ji.title = 'Jahresziel dieser Person — verteilt sich gleichmäßig auf 12 Monate';
    ji.onchange = async () => {
      const w = Math.round((Number(ji.value) || 0) / 12);
      for (let m = 1; m <= 12; m++) await setZiel(b.id, jahr, m, w);
      toast('Jahresziel verteilt: 12 × ' + eur(w)); rerenderCurrent();
    };
    jt.appendChild(ji);
    if (teamJahr !== eigenJahr) jt.appendChild(el('div', 'ziel-team', 'Team: ' + eur(teamJahr)));
    tr.appendChild(jt);

    tr.appendChild(el('td', 'num', eur(bIst)));
    const at = el('td'); at.appendChild(ampelBadge(bIst, teamJahr)); tr.appendChild(at);

    for (let m = 1; m <= 12; m++) {
      const td = el('td', 'num mon');
      const i = el('input', 'ziel-mon'); i.type = 'number'; i.step = 500;
      i.value = zielEigen(b.id, jahr, m) || '';
      i.placeholder = '–';
      i.onchange = async () => { await setZiel(b.id, jahr, m, Number(i.value) || 0); rerenderCurrent(); };
      if (m === bisMonat) td.classList.add('mon-akt');
      td.appendChild(i); tr.appendChild(td);
    }
    tb.appendChild(tr);
  }
  t.appendChild(tb); wrap.appendChild(t); v.appendChild(wrap);
}

/* ── AV-Kampagnenübersicht (Rollup über die Hierarchie) ────────────── */
async function showKampagne() {
  curName = 'kampagne'; renderNav();
  const ids = visibleFks().map(b => b.id);
  const { data: all } = await sb.from('avdepot').select('*');
  const rows = (all || []).filter(r => ids.includes(r.bereich_id));
  const v = $('#view'); v.innerHTML = '';
  v.appendChild(header('KAMPAGNE', 'Privates Altersvorsorgedepot',
    (isAdmin() ? 'Gesamte Organisation' : scopedName()) + ' · Kandidaten und eröffnete Depots je Team', 'gold'));

  const er = rows.filter(r => r.status === 'eroeffnet');
  const ang = rows.filter(r => r.status === 'angesprochen');
  const kpis = el('div', 'kpis');
  kpis.append(kpi('Kandidaten', rows.length), kpi('Angesprochen', ang.length),
    kpi('Depots eröffnet', er.length),
    kpi('Abschlussquote', rows.length ? Math.round(er.length / rows.length * 100) + ' %' : '—'));
  v.appendChild(kpis);

  const bar = el('div', 'toolbar');
  const link = el('a', 'btn av-kompass', '🧭 AV-Depot Kompass öffnen'); link.href = KOMPASS_URL; link.target = '_blank'; link.rel = 'noopener';
  bar.appendChild(link);
  const lbl = el('label', 'pillinfo'); lbl.style.cssText = 'display:flex;align-items:center;gap:8px;cursor:pointer';
  const cb = el('input'); cb.type = 'checkbox'; cb.checked = showAllNodes;
  cb.onchange = () => { showAllNodes = cb.checked; rerenderCurrent(); };
  lbl.append(cb, el('span', null, 'Alle Mitarbeiter zeigen · Zahlen rollen den Unterbau hoch'));
  bar.appendChild(lbl); v.appendChild(bar);

  const t = el('table', 'dash-tbl');
  t.innerHTML = '<thead><tr><th>Mitarbeiter</th><th>Rolle</th><th class="num">Kandidaten</th>' +
    '<th class="num">Angesprochen</th><th class="num">Eröffnet</th><th class="num">Kein Interesse</th><th class="num">Quote</th></tr></thead>';
  const tb = el('tbody');
  const scopeIds = ids; const base = baseDepth();
  const tableNodes = visibleFks().filter(b => showAllNodes || childrenFks(b.id).length > 0 || b.parent_id == null || b.id === viewer.fkId);
  for (const b of tableNodes) {
    const sub = subtreeIds(b.id).filter(x => scopeIds.includes(x));
    const fr = rows.filter(r => sub.includes(r.bereich_id));
    const fe = fr.filter(r => r.status === 'eroeffnet').length;
    const tr = el('tr');
    if (!fr.length) tr.classList.add('row-dim');
    const depth = Math.max(0, fkDepth(b) - base);
    const nt = el('td'); nt.style.paddingLeft = (12 + depth * 18) + 'px';
    if (depth) nt.appendChild(el('span', 'tree', '└ '));
    nt.appendChild(el('span', 'dot ' + b.gruppe)); const ln = el('a', 'name', ' ' + b.name);
    ln.onclick = () => { boardTab = 'avdepot'; go(() => showFk(b.id)); }; nt.appendChild(ln); tr.appendChild(nt);
    tr.appendChild(el('td', 'rolle', b.rolle || '—'));
    tr.appendChild(el('td', 'num', fr.length));
    tr.appendChild(el('td', 'num', fr.filter(r => r.status === 'angesprochen').length));
    const et = el('td', 'num', fe); et.style.color = fe ? '#15803D' : ''; et.style.fontWeight = fe ? '700' : ''; tr.appendChild(et);
    tr.appendChild(el('td', 'num', fr.filter(r => r.status === 'kein_interesse').length));
    tr.appendChild(el('td', 'num', fr.length ? Math.round(fe / fr.length * 100) + ' %' : '—'));
    tb.appendChild(tr);
  }
  t.appendChild(tb); v.appendChild(t);
  if (!rows.length) v.appendChild(el('div', 'empty', 'Noch keine Kampagnen-Kandidaten. Jeder trägt sie auf seinem Board im Reiter „Privates Altersvorsorgedepot" ein.'));
}

/* ── Mitarbeiter-Board (eigene Planung, monats-gescoped) ───────────── */
async function showFk(id) {
  curName = 'fk:' + id; renderNav();
  const b = BEREICHE.find(x => x.id === id); if (!b) return;
  const v = $('#view'); v.innerHTML = '';
  const subT = { pipeline: 'Planung ' + monthLabel(currentMonat) + ' · Interessenten pflegen', avdepot: 'Kampagne · Privates Altersvorsorgedepot', kpue: 'Kundenpotenzialübersicht · 30er-Liste' };
  v.appendChild(header((b.rolle || 'MITARBEITER').toUpperCase(), b.name, subT[boardTab] || subT.pipeline, b.gruppe));
  const tabs = el('div', 'tabbar');
  const mk = (key, label) => { const t = el('button', 'tab' + (boardTab === key ? ' active' : ''), label); t.onclick = () => { boardTab = key; showFk(id); }; return t; };
  tabs.append(mk('pipeline', 'Interessenten-Pipeline'), mk('avdepot', '🎯 Privates Altersvorsorgedepot'), mk('kpue', '📇 30er-Liste (KPÜ)'));
  v.appendChild(tabs);
  if (isInhaber(b)) renderToolLinks(v);
  if (boardTab === 'avdepot') return renderAvdepot(v, b);
  if (boardTab === 'kpue') return renderKpue(v, b);
  return renderPipeline(v, b, id);
}

const isInhaber = b => (b.rolle || '').startsWith('Inhaber');

/* Tool-Verknüpfungen (Inhaber-Board): Beratungstools, Kompass, Finanzierungscockpit */
function renderToolLinks(v) {
  const grid = el('div', 'toolgrid');
  const card = (icon, name, sub, url) => {
    const c = el(url ? 'a' : 'div', 'teamcard toolcard' + (url ? '' : ' toolcard-off'));
    if (url) { c.href = url; c.target = '_blank'; c.rel = 'noopener'; }
    const head = el('div', 'tc-head', icon + '  ' + name);
    c.appendChild(head); c.appendChild(el('div', 'tc-role', sub));
    return c;
  };
  grid.appendChild(card('🧰', 'Beratungstools', 'Portal öffnen (wolny-tools)', TOOLS_URL));
  grid.appendChild(card('🧭', 'AV-Depot Kompass', 'Beratungs-Tool · Login „beratung"', KOMPASS_URL));
  grid.appendChild(card('🏠', 'Finanzierungscockpit', COCKPIT_URL ? 'Cockpit öffnen' : 'Verknüpfung folgt', COCKPIT_URL));
  v.appendChild(grid);
}

async function renderPipeline(v, b, id) {
  const { data: all } = await sb.from('eintraege').select('*');
  const monthRows = (all || []).filter(r => r.monat === currentMonat);
  const own = monthRows.filter(r => r.bereich_id === id).sort(byAge);
  v.appendChild(monthNav());

  // Hierarchie: übergeordnete Person ändern
  const bar = el('div', 'toolbar');
  const pWrap = el('label', 'pillinfo'); pWrap.style.cssText = 'display:flex;align-items:center;gap:7px';
  pWrap.appendChild(el('span', null, 'Untersteht:'));
  const psel = el('select'); psel.style.cssText = 'border:1px solid var(--line);border-radius:7px;padding:5px';
  psel.appendChild(new Option('— oberste Ebene', ''));
  for (const o of BEREICHE.filter(x => !subtreeIds(id).includes(x.id))) psel.appendChild(new Option(o.name + ' · ' + (o.rolle || ''), o.id));
  psel.value = b.parent_id || '';
  psel.onchange = async () => { await sb.from('bereiche').update({ parent_id: psel.value ? Number(psel.value) : null }).eq('id', id); await loadBereiche(); rerenderCurrent(); toast('Hierarchie aktualisiert'); };
  pWrap.appendChild(psel); bar.appendChild(pWrap);
  v.appendChild(bar);

  // Team (direkte Mitarbeiter) als Kacheln — Zahlen inkl. Unterbau
  const kids = childrenFks(id).slice().sort((a, c) => a.sortierung - c.sortierung);
  if (kids.length) {
    v.appendChild(el('div', 'section-lbl', 'Team (' + kids.length + ') — Zahlen inkl. Unterbau · zum Öffnen klicken'));
    const grid = el('div', 'teamgrid');
    for (const c of kids) {
      const st = nodeStats(c.id, monthRows);
      const card = el('div', 'teamcard');
      const head = el('div', 'tc-head'); head.appendChild(el('span', 'dot ' + c.gruppe)); head.appendChild(el('span', 'tc-name', ' ' + c.name));
      card.appendChild(head);
      card.appendChild(el('div', 'tc-role', c.rolle || ''));
      card.appendChild(el('div', 'tc-stats', st.n + ' Interess. · ' + st.k + ' Kunde · ' + eur(st.ums)));
      card.onclick = () => go(() => showFk(c.id));
      grid.appendChild(card);
    }
    v.appendChild(grid);
  }

  // Eigene Interessenten (nach Alter sortiert, ältester zuerst)
  v.appendChild(el('div', 'section-lbl', 'Eigene Interessenten · ' + monthLabel(currentMonat)));
  const t = el('table', 'tbl');
  t.innerHTML = '<thead><tr><th>Interessent</th><th>Terminart</th><th class="num">Potenzial €</th>' +
    '<th>Status</th><th>Grund</th><th>Auf Liste seit</th><th>Notiz</th><th class="col-del"></th></tr></thead>';
  const tb = el('tbody');
  for (const r of own) tb.appendChild(rowEl(r));
  addLine(tb, id);
  t.appendChild(tb); v.appendChild(t);

  const pipeline = own.reduce((a, r) => a + num(r.potenzial), 0);
  const kundeUms = own.filter(r => r.status === 'kunde').reduce((a, r) => a + num(r.potenzial), 0);
  const oldest = own.filter(r => r.erfasst_am)[0];
  const soll = zielEigen(id, jahrVon(currentMonat), monVon(currentMonat));
  const sollTeam = zielSubtree(id, jahrVon(currentMonat), monVon(currentMonat));
  const g = el('div', 'gesamt');
  g.appendChild(el('span', 'lbl', 'EIGENE PIPELINE ' + monthLabel(currentMonat).toUpperCase()));
  const right = el('div', 'gesamt-right');
  const valRow = el('div', 'gesamt-valrow');
  valRow.appendChild(el('span', 'val', eur(pipeline)));
  if (soll) valRow.appendChild(ampelBadge(kundeUms, soll));
  right.appendChild(valRow);
  right.appendChild(el('span', 'sub-val', 'davon Kunde: ' + eur(kundeUms) +
    (soll ? '  ·  Ziel: ' + eur(soll) : '') +
    (sollTeam > soll ? '  ·  Team-Ziel: ' + eur(sollTeam) : '') +
    (oldest ? '  ·  ältester Lead: ' + daysSince(oldest.erfasst_am) + ' Tage' : '')));
  g.appendChild(right);
  v.appendChild(g);
}

/* ── Privates Altersvorsorgedepot (Kampagnen-Liste je Person) ──────── */
async function renderAvdepot(v, b) {
  const { data: all } = await sb.from('avdepot').select('*');
  const list = (all || []).filter(r => r.bereich_id === b.id).sort(byAge);

  const box = el('div', 'av-intro');
  box.appendChild(el('p', 'av-lead', 'Kampagne: private Altersvorsorgedepots aufbauen. Trag hier deine Kandidaten ein und arbeite die Liste ab — mit dem Kompass rechnest du im Gespräch den Vorteil vor.'));
  const link = el('a', 'btn av-kompass', '🧭 AV-Depot Kompass öffnen'); link.href = KOMPASS_URL; link.target = '_blank'; link.rel = 'noopener';
  box.appendChild(link);
  box.appendChild(el('span', 'av-hint', 'Öffnet das Beratungs-Tool (Login „beratung").'));
  v.appendChild(box);

  const t = el('table', 'tbl');
  t.innerHTML = '<thead><tr><th>Kunde / Kandidat</th><th>Status</th><th>Auf Liste seit</th><th>Notiz</th><th class="col-del"></th></tr></thead>';
  const tb = el('tbody');
  for (const r of list) tb.appendChild(avRowEl(r));
  avAddLine(tb, b.id);
  t.appendChild(tb); v.appendChild(t);

  const eroeffnet = list.filter(r => r.status === 'eroeffnet').length;
  const g = el('div', 'gesamt');
  g.appendChild(el('span', 'lbl', 'AV-DEPOT KAMPAGNE'));
  const right = el('div', 'gesamt-right');
  right.appendChild(el('span', 'val', list.length + ' Kandidaten'));
  right.appendChild(el('span', 'sub-val', eroeffnet + ' Depot eröffnet · ' + list.filter(r => r.status === 'offen').length + ' offen'));
  g.appendChild(right); v.appendChild(g);
}
function avRowEl(r) {
  const tr = el('tr'); if (r.status === 'eroeffnet') tr.classList.add('is-kunde');
  const c1 = el('td'); const i1 = el('input'); i1.value = r.kunde ?? ''; i1.placeholder = 'Name…'; i1.onchange = () => saveTbl('avdepot', r.id, 'kunde', i1.value); c1.appendChild(i1); tr.appendChild(c1);
  const c2 = el('td'); const s = el('select', 'statussel av-' + (r.status || 'offen'));
  for (const st of AV_STATUS) { const o = el('option', null, AV_LABEL[st]); o.value = st; if ((r.status || 'offen') === st) o.selected = true; s.appendChild(o); }
  s.onchange = async () => { await saveTbl('avdepot', r.id, 'status', s.value); rerenderCurrent(); };
  c2.appendChild(s); tr.appendChild(c2);
  const c3 = el('td', 'seit'); const di = el('input'); di.type = 'date'; di.value = r.erfasst_am || '';
  di.onchange = () => { saveTbl('avdepot', r.id, 'erfasst_am', di.value || null); r.erfasst_am = di.value; c3.querySelector('.age').replaceWith(ageBadge(di.value)); };
  c3.append(di, ageBadge(r.erfasst_am)); tr.appendChild(c3);
  const c4 = el('td'); const i4 = el('input'); i4.value = r.notiz ?? ''; i4.onchange = () => saveTbl('avdepot', r.id, 'notiz', i4.value); c4.appendChild(i4); tr.appendChild(c4);
  const del = el('td', 'col-del'); const bt = el('button', 'del-btn', '✕'); bt.onclick = async () => { await sb.from('avdepot').delete().eq('id', r.id); rerenderCurrent(); }; del.appendChild(bt); tr.appendChild(del);
  return tr;
}
function avAddLine(tb, bereichId) {
  const tr = el('tr'); const td = el('td'); td.colSpan = 5; td.style.padding = '4px';
  const btn = el('button', 'add-line', '+ Kandidat'); btn.onclick = async () => {
    const { data, error } = await sb.from('avdepot').insert({ bereich_id: bereichId, status: 'offen', erfasst_am: heute(), sortierung: Date.now() % 1e9 }).select().single();
    if (error) return toast(error.message, true);
    tb.insertBefore(avRowEl(data), tr); const f = tr.previousSibling.querySelector('input'); if (f) f.focus();
  };
  td.appendChild(btn); tr.appendChild(td); tb.appendChild(tr);
}
async function saveTbl(table, id, col, val) {
  const { error } = await sb.from(table).update({ [col]: val }).eq('id', id);
  if (error) toast('Speichern fehlgeschlagen: ' + error.message, true);
}

/* ── 30er-Liste / KPÜ (Kundenpotenzialübersicht je Person) ─────────── */
async function renderKpue(v, b) {
  const { data: all } = await sb.from('kpue').select('*');
  const list = (all || []).filter(r => r.bereich_id === b.id).sort((a, c) => (a.sortierung || 0) - (c.sortierung || 0));

  const n = list.length, pct = Math.min(100, Math.round(n / KPUE_ZIEL * 100));
  const box = el('div', 'av-intro');
  const left = el('div', 'kpue-progress');
  left.appendChild(el('div', 'kpue-count', n + ' / ' + KPUE_ZIEL));
  const barOut = el('div', 'bar kpue-bar'); const sp = el('span'); sp.style.width = pct + '%';
  if (n >= KPUE_ZIEL) sp.style.background = '#15803D';
  barOut.appendChild(sp); left.appendChild(barOut);
  box.appendChild(left);
  box.appendChild(el('p', 'av-lead', 'Deine Kundenpotenzialübersicht: 30 Namen, mit denen du arbeitest — Kunden, Interessenten und mögliche Kontakte. Wird ein Name konkret, nimmst du ihn in die Monats-Pipeline auf.'));
  v.appendChild(box);

  const t = el('table', 'tbl');
  t.innerHTML = '<thead><tr><th style="width:28px">#</th><th>Name</th><th>Typ</th><th>Prio</th><th>Auf Liste seit</th><th>Notiz</th><th class="col-del"></th></tr></thead>';
  const tb = el('tbody');
  list.forEach((r, i) => tb.appendChild(kpueRowEl(r, i + 1)));
  kpueAddLine(tb, b.id);
  t.appendChild(tb); v.appendChild(t);

  const g = el('div', 'gesamt');
  g.appendChild(el('span', 'lbl', '30ER-LISTE ' + b.name.toUpperCase()));
  const right = el('div', 'gesamt-right');
  right.appendChild(el('span', 'val', n + ' Namen'));
  right.appendChild(el('span', 'sub-val',
    list.filter(r => r.typ === 'kunde').length + ' Kunden · ' +
    list.filter(r => r.typ === 'interessent').length + ' Interessenten · ' +
    list.filter(r => (r.typ || 'potenzial') === 'potenzial').length + ' potenziell'));
  g.appendChild(right); v.appendChild(g);
}
function kpueRowEl(r, nr) {
  const tr = el('tr'); if (r.typ === 'kunde') tr.classList.add('is-kunde');
  tr.appendChild(el('td', 'kpue-nr', String(nr)));
  const c1 = el('td'); const i1 = el('input'); i1.value = r.name ?? ''; i1.placeholder = 'Name…'; i1.onchange = () => saveTbl('kpue', r.id, 'name', i1.value); c1.appendChild(i1); tr.appendChild(c1);
  const c2 = el('td'); const s = el('select', 'statussel kp-' + (r.typ || 'potenzial'));
  for (const ty of KPUE_TYP) { const o = el('option', null, KPUE_LABEL[ty]); o.value = ty; if ((r.typ || 'potenzial') === ty) o.selected = true; s.appendChild(o); }
  s.onchange = async () => { await saveTbl('kpue', r.id, 'typ', s.value); rerenderCurrent(); };
  c2.appendChild(s); tr.appendChild(c2);
  const c3 = el('td'); const p = el('select', 'statussel prio-' + (r.prio || 'B'));
  for (const pr of ['A', 'B', 'C']) { const o = el('option', null, pr); o.value = pr; if ((r.prio || 'B') === pr) o.selected = true; p.appendChild(o); }
  p.onchange = async () => { await saveTbl('kpue', r.id, 'prio', p.value); rerenderCurrent(); };
  c3.appendChild(p); tr.appendChild(c3);
  const c4 = el('td', 'seit'); const di = el('input'); di.type = 'date'; di.value = r.erfasst_am || '';
  di.onchange = () => { saveTbl('kpue', r.id, 'erfasst_am', di.value || null); r.erfasst_am = di.value; c4.querySelector('.age').replaceWith(ageBadge(di.value)); };
  c4.append(di, ageBadge(r.erfasst_am)); tr.appendChild(c4);
  const c5 = el('td'); const i5 = el('input'); i5.value = r.notiz ?? ''; i5.onchange = () => saveTbl('kpue', r.id, 'notiz', i5.value); c5.appendChild(i5); tr.appendChild(c5);
  const del = el('td', 'col-del'); const bt = el('button', 'del-btn', '✕'); bt.onclick = async () => { await sb.from('kpue').delete().eq('id', r.id); rerenderCurrent(); }; del.appendChild(bt); tr.appendChild(del);
  return tr;
}
function kpueAddLine(tb, bereichId) {
  const tr = el('tr'); const td = el('td'); td.colSpan = 7; td.style.padding = '4px';
  const btn = el('button', 'add-line', '+ Name'); btn.onclick = async () => {
    const { data, error } = await sb.from('kpue').insert({ bereich_id: bereichId, typ: 'potenzial', prio: 'B', erfasst_am: heute(), sortierung: Date.now() % 1e9 }).select().single();
    if (error) return toast(error.message, true);
    const nr = [...tb.querySelectorAll('tr')].length;   // grob: laufende Nummer
    tb.insertBefore(kpueRowEl(data, nr), tr); const f = tr.previousSibling.querySelector('input'); if (f) f.focus();
  };
  td.appendChild(btn); tr.appendChild(td); tb.appendChild(tr);
}

function rowEl(r) {
  const tr = el('tr'); if (r.status === 'kunde') tr.classList.add('is-kunde');
  tr.appendChild(cellInput(r, 'kunde', 'text'));
  tr.appendChild(cellInput(r, 'terminart', 'text', 'terminarten'));
  tr.appendChild(cellPot(r));
  tr.appendChild(statusCell(r));
  tr.appendChild(grundCell(r));
  tr.appendChild(seitCell(r));
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
function ageBadge(dstr) {
  const d = daysSince(dstr); const span = el('span', 'age');
  if (d == null) { span.textContent = '—'; span.classList.add('age-none'); return span; }
  span.textContent = d + ' T'; span.title = 'seit ' + fmtDate(dstr);
  span.classList.add(d > 45 ? 'age-hot' : d > 21 ? 'age-warm' : 'age-ok');
  return span;
}
function seitCell(r) {   // editierbar (Board)
  const td = el('td', 'seit');
  const i = el('input'); i.type = 'date'; i.value = r.erfasst_am || ''; i.title = 'Seit wann auf der Liste';
  i.onchange = () => { save(r.id, 'erfasst_am', i.value || null); r.erfasst_am = i.value; td.querySelector('.age').replaceWith(ageBadge(i.value)); };
  td.append(i, ageBadge(r.erfasst_am)); return td;
}
function seitDisplay(r) {  // read-only (Übersichten)
  const td = el('td', 'seit');
  td.append(el('span', 'seit-date', fmtDate(r.erfasst_am)), ageBadge(r.erfasst_am));
  return td;
}
function addLine(tb, bereichId) {
  const tr = el('tr'); const td = el('td'); td.colSpan = 8; td.style.padding = '4px';
  const btn = el('button', 'add-line', '+ Interessent'); btn.onclick = async () => {
    const { data, error } = await sb.from('eintraege').insert({ bereich_id: bereichId, monat: currentMonat, status: 'offen', potenzial: 0, erfasst_am: heute(), sortierung: Date.now() % 1e9 }).select().single();
    if (error) return toast(error.message, true);
    tb.insertBefore(rowEl(data), tr);
    const first = tr.previousSibling.querySelector('input'); if (first) first.focus();
  };
  td.appendChild(btn); tr.appendChild(td); tb.appendChild(tr);
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
  const rerender = async () => {
    const a = document.activeElement;
    if (a && (a.tagName === 'INPUT' || a.tagName === 'SELECT')) return;
    await loadZiele();
    rerenderCurrent();
  };
  realtimeCh = sb.channel('board');
  for (const table of ['eintraege', 'bereiche', 'avdepot', 'kpue', 'ziele', 'volumen', 'aktivitaeten'])
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

/* ── Excel-Import (SheetJS) — je Blatt = ein Mitarbeiter ───────────── */
$('#importBtn').addEventListener('click', () => $('#importFile').click());
$('#importFile').addEventListener('change', async e => {
  const file = e.target.files[0]; e.target.value = '';
  if (!file) return;
  if (!confirm('Import aus "' + file.name + '"?\nInteressenten des gewählten Monats werden je gefundenem Mitarbeiter ersetzt.')) return;
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
    await sb.from('eintraege').delete().eq('bereich_id', b.id).eq('monat', importMonat);
    const eintraege = []; let idx = 0;
    for (let ri = 7; ri <= 65 && ri < grid.length; ri++) {
      const row = grid[ri] || []; const cC = str(row[2]); if (!cC || cC.includes('⬧')) continue;
      eintraege.push({ bereich_id: b.id, kunde: cC, monat: importMonat, status: 'offen', potenzial: num(row[5]), terminart: str(row[7]) || null, notiz: str(row[8]) || null, erfasst_am: heute(), sortierung: ++idx * 100 });
    }
    if (eintraege.length) { const { error } = await sb.from('eintraege').insert(eintraege); if (error) throw error; }
  }
}

/* ── Excel-Export ──────────────────────────────────────────────────── */
$('#exportBtn').addEventListener('click', exportXlsx);
async function exportXlsx() {
  toast('Export wird erstellt…');
  const { data: rows } = await sb.from('eintraege').select('*').order('bereich_id');
  const wb = XLSX.utils.book_new();
  const add = (name, aoa) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), name.replace(/[\[\]\*\?\/\\:]/g, ' ').slice(0, 31));

  // Controlling (aktueller Monat) — je Mitarbeiter mit Unterbau-Rollup
  const cur = (rows || []).filter(r => r.monat === currentMonat);
  const dash = [['Mitarbeiter', 'Rolle', 'Ebene', 'Interessenten', 'Kunden', 'Quote %', 'Umsatz €']];
  for (const b of BEREICHE) {
    const ids = subtreeIds(b.id); const fr = cur.filter(r => ids.includes(r.bereich_id)); const k = fr.filter(r => r.status === 'kunde');
    dash.push([b.name, b.rolle || '', fkDepth(b), fr.length, k.length, fr.length ? Math.round(k.length / fr.length * 100) : '', k.reduce((a, r) => a + num(r.potenzial), 0)]);
  }
  add('Controlling ' + currentMonat, dash);

  // Alle Interessenten flach
  const flat = [['Mitarbeiter', 'Rolle', 'Monat', 'Interessent', 'Terminart', 'Potenzial €', 'Status', 'Grund', 'Auf Liste seit', 'Notiz']];
  for (const r of (rows || [])) { const b = BEREICHE.find(x => x.id === r.bereich_id) || {}; flat.push([b.name || '', b.rolle || '', r.monat || '', r.kunde || '', r.terminart || '', num(r.potenzial), r.status || '', r.ablehnungsgrund || '', r.erfasst_am || '', r.notiz || '']); }
  add('Interessenten', flat);

  // Recycling
  const rec = [['Interessent', 'Mitarbeiter', 'Monat', 'Ablehnungsgrund', 'Potenzial €']];
  for (const r of (rows || []).filter(r => r.status === 'abgelehnt')) rec.push([r.kunde || '', fkName(r.bereich_id), r.monat || '', r.ablehnungsgrund || '', num(r.potenzial)]);
  add('Recycling', rec);

  XLSX.writeFile(wb, 'Umsatzboard_' + new Date().toISOString().slice(0, 10) + '.xlsx');
  toast('Export fertig');
}

init();
