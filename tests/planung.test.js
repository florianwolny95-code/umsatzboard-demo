// node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../planung.js');
const muster = require('../beispiele/geschaeftsstand-muster.json');

test('Monatsplanung: Summen nach Stand', () => {
  const s = P.summe([
    { betrag: 100, status: 'geplant', sparte: 'Baufinanzierung' },
    { betrag: 50, status: 'eingereicht', sparte: 'Sachversicherung' },
    { betrag: 30, status: 'policiert', sparte: 'Sachversicherung' },
    { betrag: 20, status: 'verguetet' },
    { betrag: 999, status: 'entfallen' },
  ]);
  assert.equal(s.plan, 200);
  assert.equal(s.offen, 100);
  assert.equal(s.eingereicht, 100);
  assert.equal(s.policiert, 50);
  assert.equal(s.verguetet, 20);
  assert.equal(s.entfallen, 999);
  assert.equal(s.anzahl, 4);
  assert.deepEqual(s.jeSparte, { Baufinanzierung: 100, Sachversicherung: 80, Sonstiges: 20 });
});

test('Monatsplanung: Abstand zum Ziel', () => {
  const g = P.gegenZiel(250, P.summe([{ betrag: 200, status: 'geplant' }, { betrag: 100, status: 'eingereicht' }]));
  assert.equal(g.fehltEingereicht, 150);
  assert.equal(g.fehltImPlan, 0);
  assert.equal(g.planDeckt, 300 / 250);
  assert.equal(P.gegenZiel(0, P.summe([])).erreicht, null);
});

test('Geschäftsstand: Muster wird angenommen und bereinigt', () => {
  const kz = P.pruefeGeschaeftsstand({ ...muster, fremd: 'weg', bericht: { titel: 'x', url: 'javascript:alert(1)' } });
  assert.equal(kz.monat, '2026-09');
  assert.equal(kz.karriere.eigenvolumenJeMonat.length, 6);
  assert.equal(kz.fremd, undefined);
  assert.equal(kz.bericht.url, null);
  assert.equal(kz.ampeln[1].ampel, 'gruen');
  assert.throws(() => P.pruefeGeschaeftsstand({ format: 'anders' }), /Format/);
  assert.throws(() => P.pruefeGeschaeftsstand({ ...muster, version: 2 }), /Version/);
  assert.throws(() => P.pruefeGeschaeftsstand({ ...muster, karriere: { eigenvolumenJeMonat: [{ monat: '2026-13', wert: 1 }] } }), /Monat/);
});

// Monatswerte wie im Musterbericht der Bereichsauswertung (Fantasiedaten); die Grenze ist eine neutrale
// Zahl, weil echte Stufengrenzen (Anlage 5) nicht in dieses öffentliche Repo gehören.
const MUSTERREIHE = [['2026-04', 148200], ['2026-05', 162900], ['2026-06', 201300], ['2026-07', 139800], ['2026-08', 188600], ['2026-09', 171600]]
  .map(([monat, wert]) => ({ monat, wert }));
const kzMuster = grenze => P.pruefeGeschaeftsstand({ format: 'wolny-geschaeftsstand', version: 1, karriere: { grenzeEigenvolumen: grenze, fenstermonate: 6, eigenvolumenJeMonat: MUSTERREIHE } });

test('Beförderungsweg rechnet wie der Musterbericht', () => {
  const w = P.befoerderungsweg(kzMuster(1200000));
  assert.equal(w.rollierend, 1012400);
  assert.equal(w.fehlt, 187600);
  assert.deepEqual(w.faelltHeraus, { monat: '2026-04', wert: 148200 });
  assert.equal(w.noetigNaechsterMonat, 335800);          // Grenze − (rollierend − herausfallender Monat)
  assert.equal(Math.round(w.schnitt), 168733);
  assert.equal(Math.round(w.noetigJeMonatBis('2026-12')), 233333);   // (Grenze − Jul..Sep) / 3
  // Ausblick „wie bisher“ und „+20 %“ hängen nicht an der Grenze: 1,03/1,04/1,01 und 1,07/1,11/1,11 Mio. wie im Bericht
  const wie = w.ausblick(w.schnitt);
  assert.deepEqual(wie.zeilen.map(z => (z.rollierend / 1e6).toFixed(2)), ['1.03', '1.04', '1.01']);
  assert.equal(wie.erreichtIm, null);
  assert.deepEqual(w.ausblick(w.schnitt * 1.2).zeilen.map(z => (z.rollierend / 1e6).toFixed(2)), ['1.07', '1.11', '1.11']);
  // mit dem nötigen Tempo ist die Grenze genau im Zielmonat erreicht
  const noetig = w.ausblick(w.noetigJeMonatBis('2026-12'));
  assert.deepEqual(noetig.zeilen.map(z => (z.rollierend / 1e6).toFixed(2)), ['1.10', '1.17', '1.20']);
  assert.equal(noetig.erreichtIm, '2026-12');
});

test('Beispieldatei: Platzhalter-Grenze aus positionen.js', () => {
  const w = P.befoerderungsweg(P.pruefeGeschaeftsstand(muster));
  assert.equal(w.rollierend, 1612400);
  assert.equal(Math.round(w.noetigJeMonatBis('2026-12')), 400000);
});

test('Beförderungsweg mit kurzer Reihe (neuer Profiberater)', () => {
  const kz = P.pruefeGeschaeftsstand({ format: 'wolny-geschaeftsstand', version: 1,
    karriere: { grenzeEigenvolumen: 600000, fenstermonate: 6, eigenvolumenJeMonat: [{ monat: '2026-08', wert: 100000 }, { monat: '2026-09', wert: 100000 }] } });
  const w = P.befoerderungsweg(kz);
  assert.equal(w.faelltHeraus, null);
  assert.equal(w.noetigNaechsterMonat, 400000);     // nichts fällt heraus
  assert.equal(w.noetigJeMonatBis('2026-12'), 400000 / 3);
  assert.equal(w.ausblick(100000).zeilen.at(-1).rollierend, 500000);
});

test('Abgleich Monatsplanung gegen nötiges Tempo', () => {
  const w = P.befoerderungsweg(P.pruefeGeschaeftsstand(muster));
  const a = P.abgleich(w, P.summe([{ betrag: 280000, status: 'geplant' }, { betrag: 40000, status: 'eingereicht' }]), '2026-12');
  assert.equal(Math.round(a.noetig), 400000);
  assert.equal(a.plan, 320000);
  assert.equal(Math.round(a.fehltImPlan), 80000);
});

test('Monatsrechnung über den Jahreswechsel', () => {
  assert.equal(P.monatPlus('2026-11', 3), '2027-02');
  assert.equal(P.monatPlus('2026-01', -1), '2025-12');
  assert.equal(P.monateZwischen('2026-09', '2027-01'), 4);
});

test('Demo-Daten: Kennzahlen gleich der Beispieldatei, Planung gültig', () => {
  const ctx = { globalThis: {} };
  require('vm').runInNewContext(require('fs').readFileSync(__dirname + '/../demo.js', 'utf8'), ctx);
  const seed = ctx.globalThis.DemoDB.seed();
  assert.deepEqual(JSON.parse(JSON.stringify(seed.kennzahlen[0].daten)), muster);
  for (const r of seed.planpositionen) {
    assert.ok(P.PLAN_STATUS.includes(r.status), r.status);
    assert.ok(P.SPARTEN.includes(r.sparte), r.sparte);
    assert.ok(seed.bereiche.some(b => b.id === r.bereich_id));
  }
  assert.equal(new Set(seed.planpositionen.map(r => r.id)).size, seed.planpositionen.length);
});
