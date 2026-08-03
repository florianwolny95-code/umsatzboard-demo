/* Demo-Modus: ersetzt Supabase durch localStorage (kein Login, kein Server).
   Aktiv, wenn config.js keine echten Zugangsdaten hat. Beispieldaten (fiktiv). */
globalThis.DemoDB = (function () {
  const KEY = 'umsatzboard_demo_v8';
  let store = null;

  function seed() {
    return {
      // Jeder Mitarbeiter = eigener Knoten (kann selbst planen), Hierarchie über parent_id.
      // Namen als "Vorname + Nachname-Initial" (öffentliches Repo). sortierung = DFS-Reihenfolge.
      // gruppe = Farb-Tier: MZ(gold)=Management, SN(teal)=Senior, RM(lila)=Junior, TR(grau)=Trainee/Assistent.
      bereiche: [
        { id: 32, name: 'Florian W.', rolle: 'Inhaber · Finanzierung', gruppe: 'MZ', parent_id: null, quartalsziel: 0, sortierung: 0 },
        { id: 1, name: 'Robert M.', rolle: 'Regional Manager', gruppe: 'MZ', parent_id: null, quartalsziel: 0, sortierung: 1 },
        { id: 2, name: 'Steve N.', rolle: 'Branch Manager', gruppe: 'MZ', parent_id: 1, quartalsziel: 0, sortierung: 2 },
        { id: 3, name: 'Maximilian Z.', rolle: 'Repräsentanzleiter', gruppe: 'MZ', parent_id: 2, quartalsziel: 0, sortierung: 3 },
        { id: 12, name: 'Paul P.', rolle: 'Trainee', gruppe: 'TR', parent_id: 3, quartalsziel: 0, sortierung: 4 },
        { id: 13, name: 'Lukas S.', rolle: 'Trainee', gruppe: 'TR', parent_id: 3, quartalsziel: 0, sortierung: 5 },
        { id: 14, name: 'Hannes J.', rolle: 'Beraterassistent', gruppe: 'TR', parent_id: 3, quartalsziel: 0, sortierung: 6 },
        { id: 15, name: 'Nils S.', rolle: 'Beraterassistent', gruppe: 'TR', parent_id: 3, quartalsziel: 0, sortierung: 7 },
        { id: 4, name: 'Agon A.', rolle: 'Seniorberater', gruppe: 'SN', parent_id: 3, quartalsziel: 0, sortierung: 8 },
        { id: 16, name: 'Mats S.', rolle: 'Trainee', gruppe: 'TR', parent_id: 4, quartalsziel: 0, sortierung: 9 },
        { id: 17, name: 'Mara D.', rolle: 'Trainee', gruppe: 'TR', parent_id: 4, quartalsziel: 0, sortierung: 10 },
        { id: 18, name: 'Julien G.', rolle: 'Trainee', gruppe: 'TR', parent_id: 4, quartalsziel: 0, sortierung: 11 },
        { id: 19, name: 'Max L.', rolle: 'Beraterassistent', gruppe: 'TR', parent_id: 4, quartalsziel: 0, sortierung: 12 },
        { id: 5, name: 'Lennart W.', rolle: 'Seniorberater', gruppe: 'SN', parent_id: 3, quartalsziel: 0, sortierung: 13 },
        { id: 20, name: 'Stian P.', rolle: 'Beraterassistent', gruppe: 'TR', parent_id: 5, quartalsziel: 0, sortierung: 14 },
        { id: 8, name: 'Tom E.', rolle: 'Juniorberater', gruppe: 'RM', parent_id: 5, quartalsziel: 0, sortierung: 15 },
        { id: 21, name: 'Erik K.', rolle: 'Trainee', gruppe: 'TR', parent_id: 8, quartalsziel: 0, sortierung: 16 },
        { id: 22, name: 'Timo L.', rolle: 'Trainee', gruppe: 'TR', parent_id: 8, quartalsziel: 0, sortierung: 17 },
        { id: 23, name: 'Carl S.', rolle: 'Trainee', gruppe: 'TR', parent_id: 8, quartalsziel: 0, sortierung: 18 },
        { id: 6, name: 'Aron Z.', rolle: 'Seniorberater', gruppe: 'SN', parent_id: 3, quartalsziel: 0, sortierung: 19 },
        { id: 24, name: 'Linus A.', rolle: 'Trainee', gruppe: 'TR', parent_id: 6, quartalsziel: 0, sortierung: 20 },
        { id: 9, name: 'Tim G.', rolle: 'Juniorberater', gruppe: 'RM', parent_id: 6, quartalsziel: 0, sortierung: 21 },
        { id: 25, name: 'Daniel F.', rolle: 'Trainee', gruppe: 'TR', parent_id: 9, quartalsziel: 0, sortierung: 22 },
        { id: 26, name: 'Jeremy G.', rolle: 'Trainee', gruppe: 'TR', parent_id: 9, quartalsziel: 0, sortierung: 23 },
        { id: 27, name: 'Hannes Ge.', rolle: 'Trainee', gruppe: 'TR', parent_id: 9, quartalsziel: 0, sortierung: 24 },
        { id: 28, name: 'Joe L.', rolle: 'Trainee', gruppe: 'TR', parent_id: 9, quartalsziel: 0, sortierung: 25 },
        { id: 29, name: 'Roman W.', rolle: 'Trainee', gruppe: 'TR', parent_id: 9, quartalsziel: 0, sortierung: 26 },
        { id: 7, name: 'Ruben Z.', rolle: 'Seniorberater', gruppe: 'SN', parent_id: 3, quartalsziel: 0, sortierung: 27 },
        { id: 10, name: 'Franco P.', rolle: 'Juniorberater', gruppe: 'RM', parent_id: 7, quartalsziel: 0, sortierung: 28 },
        { id: 30, name: 'Niklas F.', rolle: 'Trainee', gruppe: 'TR', parent_id: 10, quartalsziel: 0, sortierung: 29 },
        { id: 11, name: 'Alexander H.', rolle: 'Juniorberater', gruppe: 'RM', parent_id: 10, quartalsziel: 0, sortierung: 30 },
        { id: 31, name: 'Nick A.', rolle: 'Trainee', gruppe: 'TR', parent_id: 11, quartalsziel: 0, sortierung: 31 },
      ],
      sub_leiter: [],
      // Beispiel-Interessenten über 3 Monate (Mai–Juli 2026) — direkt an Personen (bereich_id).
      // erfasst_am = seit wann auf der Liste; einige Juli-Leads bewusst alt (Alter-Anzeige).
      eintraege: [
        // ── Juli 2026 ──
        { id: 1, bereich_id: 12, kunde: 'Familie Berger', monat: '2026-07', status: 'offen', ablehnungsgrund: null, potenzial: 60000, terminart: 'S2', erfasst_am: '2026-07-02', notiz: '', sortierung: 10 },
        { id: 2, bereich_id: 13, kunde: 'Dr. Krause', monat: '2026-07', status: 'kunde', ablehnungsgrund: null, potenzial: 120000, terminart: 'S3', erfasst_am: '2026-06-15', notiz: 'Depot-Optimierung', sortierung: 20 },
        { id: 3, bereich_id: 14, kunde: 'Sanitär Voss GmbH', monat: '2026-07', status: 'offen', ablehnungsgrund: null, potenzial: 45000, terminart: 'S1', erfasst_am: '2026-07-08', notiz: '', sortierung: 30 },
        { id: 4, bereich_id: 3, kunde: 'Empfehlung Weber', monat: '2026-07', status: 'kunde', ablehnungsgrund: null, potenzial: 40000, terminart: 'Service', erfasst_am: '2026-07-05', notiz: '', sortierung: 5 },
        { id: 5, bereich_id: 16, kunde: 'Familie Ott', monat: '2026-07', status: 'kunde', ablehnungsgrund: null, potenzial: 90000, terminart: 'S3', erfasst_am: '2026-06-20', notiz: '', sortierung: 10 },
        { id: 6, bereich_id: 17, kunde: 'Sabine Lux', monat: '2026-07', status: 'offen', ablehnungsgrund: null, potenzial: 20000, terminart: 'S1', erfasst_am: '2026-07-10', notiz: '', sortierung: 20 },
        { id: 7, bereich_id: 18, kunde: 'Peter Hain', monat: '2026-07', status: 'offen', ablehnungsgrund: null, potenzial: 35000, terminart: 'S2', erfasst_am: '2026-05-28', notiz: 'liegt lange', sortierung: 30 },
        { id: 8, bereich_id: 19, kunde: 'Praxis Dr. Sommer', monat: '2026-07', status: 'offen', ablehnungsgrund: null, potenzial: 110000, terminart: 'S3', erfasst_am: '2026-06-10', notiz: 'Praxisfinanzierung', sortierung: 40 },
        { id: 9, bereich_id: 20, kunde: 'Handwerk Nord GmbH', monat: '2026-07', status: 'offen', ablehnungsgrund: null, potenzial: 150000, terminart: 'S2', erfasst_am: '2026-05-15', notiz: 'großer Deal, dran bleiben', sortierung: 10 },
        { id: 10, bereich_id: 5, kunde: 'Familie Brandt', monat: '2026-07', status: 'kunde', ablehnungsgrund: null, potenzial: 55000, terminart: 'S3', erfasst_am: '2026-07-01', notiz: '', sortierung: 5 },
        { id: 11, bereich_id: 24, kunde: 'Jonas Weber', monat: '2026-07', status: 'offen', ablehnungsgrund: null, potenzial: 15000, terminart: 'S1', erfasst_am: '2026-07-09', notiz: 'Berufsstart', sortierung: 10 },
        { id: 12, bereich_id: 7, kunde: 'Autohaus Krüger', monat: '2026-07', status: 'offen', ablehnungsgrund: null, potenzial: 95000, terminart: 'S2', erfasst_am: '2026-06-25', notiz: '', sortierung: 10 },
        { id: 13, bereich_id: 21, kunde: 'Bau Süd GmbH', monat: '2026-07', status: 'kunde', ablehnungsgrund: null, potenzial: 120000, terminart: 'S3', erfasst_am: '2026-06-30', notiz: '', sortierung: 10 },
        { id: 14, bereich_id: 22, kunde: 'Familie Winter', monat: '2026-07', status: 'offen', ablehnungsgrund: null, potenzial: 30000, terminart: 'S1', erfasst_am: '2026-07-11', notiz: '', sortierung: 20 },
        { id: 15, bereich_id: 25, kunde: 'Familie Albrecht', monat: '2026-07', status: 'offen', ablehnungsgrund: null, potenzial: 25000, terminart: 'S2', erfasst_am: '2026-07-06', notiz: '', sortierung: 10 },
        { id: 16, bereich_id: 26, kunde: 'Kita Sonnenschein', monat: '2026-07', status: 'offen', ablehnungsgrund: null, potenzial: 40000, terminart: 'S1', erfasst_am: '2026-07-03', notiz: '', sortierung: 20 },
        { id: 17, bereich_id: 27, kunde: 'Marco Diehl', monat: '2026-07', status: 'kunde', ablehnungsgrund: null, potenzial: 20000, terminart: 'S3', erfasst_am: '2026-06-18', notiz: '', sortierung: 30 },
        { id: 18, bereich_id: 30, kunde: 'Klein AG', monat: '2026-07', status: 'offen', ablehnungsgrund: null, potenzial: 50000, terminart: 'S2', erfasst_am: '2026-05-20', notiz: 'liegt lange', sortierung: 10 },
        { id: 19, bereich_id: 31, kunde: 'Lead Empfehlung März', monat: '2026-07', status: 'offen', ablehnungsgrund: null, potenzial: 10000, terminart: 'S1', erfasst_am: '2026-03-30', notiz: 'sehr alt – nachfassen', sortierung: 10 },
        { id: 20, bereich_id: 2, kunde: 'Steuerbüro Lenz', monat: '2026-07', status: 'kunde', ablehnungsgrund: null, potenzial: 80000, terminart: 'AEC', erfasst_am: '2026-06-28', notiz: '', sortierung: 10 },
        // ── Juni 2026 ──
        { id: 21, bereich_id: 13, kunde: 'Familie Moor', monat: '2026-06', status: 'abgelehnt', ablehnungsgrund: 'Zeitpunkt', potenzial: 0, terminart: 'S1', erfasst_am: '2026-06-05', notiz: '', sortierung: 10 },
        { id: 22, bereich_id: 12, kunde: 'Ilka Brenner', monat: '2026-06', status: 'kunde', ablehnungsgrund: null, potenzial: 70000, terminart: 'S3', erfasst_am: '2026-06-02', notiz: '', sortierung: 20 },
        { id: 23, bereich_id: 16, kunde: 'Familie Weiß', monat: '2026-06', status: 'abgelehnt', ablehnungsgrund: 'Nicht erreichbar', potenzial: 90000, terminart: 'S1', erfasst_am: '2026-05-25', notiz: '', sortierung: 10 },
        { id: 24, bereich_id: 17, kunde: 'Erik Manns', monat: '2026-06', status: 'kunde', ablehnungsgrund: null, potenzial: 25000, terminart: 'TzT', erfasst_am: '2026-06-10', notiz: '', sortierung: 20 },
        { id: 25, bereich_id: 20, kunde: 'Büro May', monat: '2026-06', status: 'kunde', ablehnungsgrund: null, potenzial: 45000, terminart: 'Service', erfasst_am: '2026-06-01', notiz: '', sortierung: 10 },
        { id: 26, bereich_id: 6, kunde: 'Zahnarzt Dr. Ruth', monat: '2026-06', status: 'abgelehnt', ablehnungsgrund: 'Kein Interesse', potenzial: 60000, terminart: 'S1', erfasst_am: '2026-06-08', notiz: '', sortierung: 10 },
        { id: 27, bereich_id: 7, kunde: 'Gasthof Linde', monat: '2026-06', status: 'abgelehnt', ablehnungsgrund: 'Konkurrenz', potenzial: 40000, terminart: 'S2', erfasst_am: '2026-05-30', notiz: '', sortierung: 10 },
        { id: 28, bereich_id: 23, kunde: 'Familie Sturm', monat: '2026-06', status: 'kunde', ablehnungsgrund: null, potenzial: 65000, terminart: 'S3', erfasst_am: '2026-06-12', notiz: '', sortierung: 10 },
        { id: 29, bereich_id: 25, kunde: 'Familie Adler', monat: '2026-06', status: 'abgelehnt', ablehnungsgrund: 'Kein Budget', potenzial: 15000, terminart: 'S1', erfasst_am: '2026-06-15', notiz: '', sortierung: 20 },
        { id: 30, bereich_id: 30, kunde: 'Familie Wolter', monat: '2026-06', status: 'kunde', ablehnungsgrund: null, potenzial: 35000, terminart: 'S3', erfasst_am: '2026-06-03', notiz: '', sortierung: 20 },
        // ── Mai 2026 ──
        { id: 31, bereich_id: 3, kunde: 'Familie Steiner', monat: '2026-05', status: 'kunde', ablehnungsgrund: null, potenzial: 85000, terminart: 'S3', erfasst_am: '2026-05-05', notiz: '', sortierung: 10 },
        { id: 32, bereich_id: 20, kunde: 'Physio Vital', monat: '2026-05', status: 'abgelehnt', ablehnungsgrund: 'Vertagt', potenzial: 30000, terminart: 'S2', erfasst_am: '2026-04-28', notiz: '', sortierung: 10 },
        { id: 33, bereich_id: 28, kunde: 'Familie Kaminski', monat: '2026-05', status: 'kunde', ablehnungsgrund: null, potenzial: 40000, terminart: 'S3', erfasst_am: '2026-05-02', notiz: '', sortierung: 10 },
        { id: 34, bereich_id: 19, kunde: 'Malermeister Timm', monat: '2026-05', status: 'abgelehnt', ablehnungsgrund: 'Kein Bedarf', potenzial: 20000, terminart: 'S1', erfasst_am: '2026-05-10', notiz: '', sortierung: 20 },
        { id: 35, bereich_id: 21, kunde: 'Familie Reuter', monat: '2026-05', status: 'kunde', ablehnungsgrund: null, potenzial: 50000, terminart: 'S3', erfasst_am: '2026-04-20', notiz: '', sortierung: 20 },
      ],
      // Kampagne „Privates Altersvorsorgedepot" — eigene Kandidatenliste je Person
      avdepot: [
        { id: 1, bereich_id: 3, kunde: 'Familie Berger', status: 'angesprochen', erfasst_am: '2026-07-01', notiz: 'Riester vorhanden', sortierung: 10 },
        { id: 2, bereich_id: 3, kunde: 'Dr. Krause', status: 'eroeffnet', erfasst_am: '2026-06-20', notiz: '', sortierung: 20 },
        { id: 3, bereich_id: 4, kunde: 'Sabine Lux', status: 'offen', erfasst_am: '2026-07-05', notiz: '', sortierung: 10 },
        { id: 4, bereich_id: 8, kunde: 'Bau Süd GmbH', status: 'angesprochen', erfasst_am: '2026-06-28', notiz: 'Geschäftsführer', sortierung: 10 },
        { id: 5, bereich_id: 8, kunde: 'Familie Winter', status: 'kein_interesse', erfasst_am: '2026-06-15', notiz: 'hat schon ETF', sortierung: 20 },
        { id: 6, bereich_id: 12, kunde: 'Ilka Brenner', status: 'offen', erfasst_am: '2026-07-08', notiz: '', sortierung: 10 },
        { id: 7, bereich_id: 9, kunde: 'Kita Sonnenschein', status: 'angesprochen', erfasst_am: '2026-07-02', notiz: 'bAV-Anschluss', sortierung: 10 },
        { id: 8, bereich_id: 2, kunde: 'Steuerbüro Lenz', status: 'eroeffnet', erfasst_am: '2026-06-10', notiz: '', sortierung: 10 },
      ],
      // 30er-Liste / KPÜ — Kundenpotenzialübersicht je Person (Namen fiktiv)
      kpue: [
        { id: 1, bereich_id: 32, name: 'Familie Neumann', typ: 'kunde', prio: 'A', erfasst_am: '2026-06-01', notiz: 'Anschlussfinanzierung 2027', sortierung: 10 },
        { id: 2, bereich_id: 32, name: 'Dr. Seifert', typ: 'interessent', prio: 'A', erfasst_am: '2026-06-20', notiz: 'Praxiskauf', sortierung: 20 },
        { id: 3, bereich_id: 32, name: 'Julia Brandt', typ: 'potenzial', prio: 'B', erfasst_am: '2026-07-05', notiz: 'Empfehlung', sortierung: 30 },
        { id: 4, bereich_id: 4, name: 'Familie Otte', typ: 'kunde', prio: 'B', erfasst_am: '2026-05-15', notiz: '', sortierung: 10 },
        { id: 5, bereich_id: 4, name: 'Marc Lehner', typ: 'potenzial', prio: 'A', erfasst_am: '2026-07-01', notiz: 'Sportverein', sortierung: 20 },
        { id: 6, bereich_id: 4, name: 'Tina Vogt', typ: 'interessent', prio: 'B', erfasst_am: '2026-06-25', notiz: '', sortierung: 30 },
        { id: 7, bereich_id: 16, name: 'Kevin Roth', typ: 'potenzial', prio: 'C', erfasst_am: '2026-07-08', notiz: 'Studienkollege', sortierung: 10 },
        { id: 8, bereich_id: 16, name: 'Laura Simon', typ: 'potenzial', prio: 'B', erfasst_am: '2026-07-10', notiz: '', sortierung: 20 },
        { id: 9, bereich_id: 8, name: 'Bauunternehmen Falk', typ: 'interessent', prio: 'A', erfasst_am: '2026-06-12', notiz: 'über Bau Süd', sortierung: 10 },
      ],
    };
  }
  const DEFAULTS = {
    bereiche: { rolle: '', gruppe: 'SN', parent_id: null, quartalsziel: 0, sortierung: 0 },
    sub_leiter: { sortierung: 0 },
    eintraege: { kunde: null, monat: null, status: 'offen', ablehnungsgrund: null, potenzial: 0, terminart: null, notiz: null, erfasst_am: null, sortierung: 0 },
    avdepot: { kunde: null, status: 'offen', notiz: null, erfasst_am: null, sortierung: 0 },
    kpue: { name: null, typ: 'potenzial', prio: 'B', notiz: null, erfasst_am: null, sortierung: 0 },
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
