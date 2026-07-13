/* Demo-Modus: ersetzt Supabase durch localStorage (kein Login, kein Server).
   Aktiv, wenn config.js keine echten Zugangsdaten hat. Beispieldaten (fiktiv). */
globalThis.DemoDB = (function () {
  const KEY = 'umsatzboard_demo_v3';
  let store = null;

  function seed() {
    return {
      // Führungskräfte (FK) — Demo-Struktur (Hierarchietiefe/Rollen wie im echten Org).
      // Namen als "Vorname + Nachname-Initial" (dieses Repo ist öffentlich, volle Namen bewusst nicht).
      // gruppe = Farb-Tier: MZ(gold)=Management, SN(teal)=Seniorberater, RM(lila)=Juniorberater.
      bereiche: [
        { id: 1, name: 'Robert M.', rolle: 'Regional Manager', gruppe: 'MZ', parent_id: null, quartalsziel: 0, sortierung: 1 },
        { id: 2, name: 'Steve N.', rolle: 'Branch Manager', gruppe: 'MZ', parent_id: 1, quartalsziel: 0, sortierung: 2 },
        { id: 3, name: 'Maximilian Z.', rolle: 'Repräsentanzleiter', gruppe: 'MZ', parent_id: 2, quartalsziel: 0, sortierung: 3 },
        { id: 4, name: 'Agon A.', rolle: 'Seniorberater', gruppe: 'SN', parent_id: 3, quartalsziel: 0, sortierung: 4 },
        { id: 5, name: 'Lennart W.', rolle: 'Seniorberater', gruppe: 'SN', parent_id: 3, quartalsziel: 0, sortierung: 5 },
        { id: 6, name: 'Aron Z.', rolle: 'Seniorberater', gruppe: 'SN', parent_id: 3, quartalsziel: 0, sortierung: 6 },
        { id: 7, name: 'Ruben Z.', rolle: 'Seniorberater', gruppe: 'SN', parent_id: 3, quartalsziel: 0, sortierung: 7 },
        { id: 8, name: 'Tom E.', rolle: 'Juniorberater', gruppe: 'RM', parent_id: 5, quartalsziel: 0, sortierung: 8 },
        { id: 9, name: 'Tim G.', rolle: 'Juniorberater', gruppe: 'RM', parent_id: 6, quartalsziel: 0, sortierung: 9 },
        { id: 10, name: 'Franco P.', rolle: 'Juniorberater', gruppe: 'RM', parent_id: 7, quartalsziel: 0, sortierung: 10 },
        { id: 11, name: 'Alexander H.', rolle: 'Juniorberater', gruppe: 'RM', parent_id: 10, quartalsziel: 0, sortierung: 11 },
      ],
      // Berater (Team-Mitglieder) unter ihrer FK — gleiches Kürzel-Schema
      sub_leiter: [
        { id: 1, bereich_id: 3, name: 'Paul P.', sortierung: 10 },
        { id: 2, bereich_id: 3, name: 'Lukas S.', sortierung: 20 },
        { id: 3, bereich_id: 3, name: 'Hannes J.', sortierung: 30 },
        { id: 4, bereich_id: 3, name: 'Nils S.', sortierung: 40 },
        { id: 5, bereich_id: 4, name: 'Mats S.', sortierung: 10 },
        { id: 6, bereich_id: 4, name: 'Mara D.', sortierung: 20 },
        { id: 7, bereich_id: 4, name: 'Julien G.', sortierung: 30 },
        { id: 8, bereich_id: 4, name: 'Max L.', sortierung: 40 },
        { id: 9, bereich_id: 5, name: 'Stian P.', sortierung: 10 },
        { id: 10, bereich_id: 8, name: 'Erik K.', sortierung: 10 },
        { id: 11, bereich_id: 8, name: 'Timo L.', sortierung: 20 },
        { id: 12, bereich_id: 8, name: 'Carl S.', sortierung: 30 },
        { id: 13, bereich_id: 6, name: 'Linus A.', sortierung: 10 },
        { id: 14, bereich_id: 9, name: 'Daniel F.', sortierung: 10 },
        { id: 15, bereich_id: 9, name: 'Jeremy G.', sortierung: 20 },
        { id: 16, bereich_id: 9, name: 'Hannes Ge.', sortierung: 30 },
        { id: 17, bereich_id: 9, name: 'Joe L.', sortierung: 40 },
        { id: 18, bereich_id: 9, name: 'Roman W.', sortierung: 50 },
        { id: 19, bereich_id: 10, name: 'Niklas F.', sortierung: 10 },
        { id: 20, bereich_id: 11, name: 'Nick A.', sortierung: 10 },
      ],
      // Beispiel-Interessenten (aktueller Monat 2026-07 + zwei Vormonat 2026-06 fürs Recycling)
      eintraege: [
        { id: 1, bereich_id: 3, sub_leiter_id: 1, kunde: 'Familie Berg', monat: '2026-07', status: 'offen', ablehnungsgrund: null, potenzial: 60000, datum: '', terminart: 'S2', notiz: '', sortierung: 10 },
        { id: 2, bereich_id: 4, sub_leiter_id: 5, kunde: 'Dr. Ott', monat: '2026-07', status: 'kunde', ablehnungsgrund: null, potenzial: 90000, datum: '', terminart: 'S3', notiz: '', sortierung: 10 },
        { id: 3, bereich_id: 4, sub_leiter_id: 7, kunde: 'Sabine Lux', monat: '2026-07', status: 'offen', ablehnungsgrund: null, potenzial: 20000, datum: '', terminart: 'S1', notiz: '', sortierung: 20 },
        { id: 4, bereich_id: 4, sub_leiter_id: null, kunde: 'Empfehlung Weber', monat: '2026-07', status: 'kunde', ablehnungsgrund: null, potenzial: 40000, datum: '', terminart: 'Service', notiz: '', sortierung: 5 },
        { id: 5, bereich_id: 8, sub_leiter_id: 10, kunde: 'Bau Nord GmbH', monat: '2026-07', status: 'kunde', ablehnungsgrund: null, potenzial: 120000, datum: '', terminart: 'S3', notiz: '', sortierung: 10 },
        { id: 6, bereich_id: 5, sub_leiter_id: 9, kunde: 'Praxis Sonne', monat: '2026-07', status: 'offen', ablehnungsgrund: null, potenzial: 80000, datum: '', terminart: 'S2', notiz: '', sortierung: 10 },
        { id: 7, bereich_id: 9, sub_leiter_id: 14, kunde: 'Familie Adler', monat: '2026-06', status: 'abgelehnt', ablehnungsgrund: 'Kein Budget', potenzial: 15000, datum: '', terminart: 'S1', notiz: '', sortierung: 10 },
        { id: 8, bereich_id: 10, sub_leiter_id: 19, kunde: 'Klein AG', monat: '2026-07', status: 'offen', ablehnungsgrund: null, potenzial: 50000, datum: '', terminart: 'S2', notiz: '', sortierung: 10 },
        { id: 9, bereich_id: 11, sub_leiter_id: 20, kunde: 'Neuer Lead', monat: '2026-07', status: 'offen', ablehnungsgrund: null, potenzial: 10000, datum: '', terminart: 'S1', notiz: '', sortierung: 10 },
        { id: 10, bereich_id: 3, sub_leiter_id: 2, kunde: 'Familie Moor', monat: '2026-06', status: 'abgelehnt', ablehnungsgrund: 'Zeitpunkt', potenzial: 0, datum: '', terminart: 'S1', notiz: '', sortierung: 20 },
      ],
    };
  }
  const DEFAULTS = {
    bereiche: { rolle: '', gruppe: 'SN', parent_id: null, quartalsziel: 0, sortierung: 0 },
    sub_leiter: { sortierung: 0 },
    eintraege: { sub_leiter_id: null, kunde: null, monat: null, status: 'offen', ablehnungsgrund: null, potenzial: 0, datum: null, terminart: null, notiz: null, sortierung: 0 },
  };

  function load() {
    if (store) return;
    const raw = globalThis.localStorage && localStorage.getItem(KEY);
    store = raw ? JSON.parse(raw) : seed();
    save();
  }
  function save() { if (globalThis.localStorage) localStorage.setItem(KEY, JSON.stringify(store)); }
  function nextId(t) { const r = store[t]; return r.length ? Math.max(...r.map(x => x.id)) + 1 : 1; }
  function sortRows(res, o) {
    return res.slice().sort((a, b) => {
      const x = a[o.col], y = b[o.col];
      const xn = x == null || x === '', yn = y == null || y === '';
      if (xn && yn) return 0;
      if (xn) return o.nullsFirst ? -1 : 1;
      if (yn) return o.nullsFirst ? 1 : -1;
      if (x < y) return o.asc ? -1 : 1;
      if (x > y) return o.asc ? 1 : -1;
      return 0;
    });
  }

  class Q {
    constructor(t) { load(); this.t = t; this._f = []; this._order = null; this._op = 'select'; this._p = null; this._single = false; this._ret = false; }
    select() { if (this._op === 'select') this._op = 'select'; else this._ret = true; return this; }
    order(col, opts) { this._order = { col, asc: !(opts && opts.ascending === false), nullsFirst: !!(opts && opts.nullsFirst) }; return this; }
    eq(col, val) { this._f.push([col, val]); return this; }
    insert(p) { this._op = 'insert'; this._p = p; return this; }
    update(p) { this._op = 'update'; this._p = p; return this; }
    delete() { this._op = 'delete'; return this; }
    single() { this._single = true; return this; }
    then(res, rej) { try { res(this._exec()); } catch (e) { rej ? rej(e) : res({ data: null, error: { message: e.message } }); } }
    _exec() {
      const rows = store[this.t];
      const match = r => this._f.every(([c, v]) => r[c] === v);
      if (this._op === 'select') {
        let out = rows.filter(match);
        if (this._order) out = sortRows(out, this._order);
        return { data: this._single ? (out[0] || null) : out.slice(), error: null };
      }
      if (this._op === 'insert') {
        const arr = Array.isArray(this._p) ? this._p : [this._p];
        const ins = [];
        for (const p of arr) {
          if (this.t === 'monatswerte' && rows.some(r => r.monat === p.monat))
            return { data: null, error: { message: 'duplicate key value violates unique constraint' } };
          const row = { id: nextId(this.t), ...DEFAULTS[this.t], ...p };
          rows.push(row); ins.push(row);
        }
        save();
        return { data: this._ret ? (this._single ? ins[0] : ins) : null, error: null };
      }
      if (this._op === 'update') { for (const r of rows.filter(match)) Object.assign(r, this._p); save(); return { data: null, error: null }; }
      if (this._op === 'delete') { store[this.t] = rows.filter(r => !match(r)); save(); return { data: null, error: null }; }
    }
  }

  function client() {
    load();
    const noAuth = { error: { message: 'Im Demo-Modus nicht nötig.' } };
    return {
      from: t => new Q(t),
      auth: {
        async getSession() { return { data: { session: { user: { email: 'demo@lokal' } } } }; },
        onAuthStateChange() { return { data: { subscription: { unsubscribe() { } } } }; },
        async signInWithPassword() { return { data: { session: { user: { email: 'demo@lokal' } } }, error: null }; },
        async signOut() { return { error: null }; },
        async resetPasswordForEmail() { return noAuth; },
        async updateUser() { return noAuth; },
      },
      channel() { const ch = { on() { return ch; }, subscribe() { return ch; } }; return ch; },
      removeChannel() { },
    };
  }

  return { client, reset() { store = seed(); save(); } };
})();
