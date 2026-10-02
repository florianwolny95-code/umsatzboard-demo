// node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const O = require('../organigramm.js');
global.window = undefined;
const POS = (() => { const w = {}; require('vm').runInNewContext(require('fs').readFileSync(__dirname + '/../positionen.js', 'utf8'), { window: w }); return w.POSITIONEN; })();

test('CSV mit Semikolon, Kopfzeile nach Titelzeilen, FK über Partnernummer', () => {
  const csv = 'Organigramm Export;;;\r\nStand 01.10.2026;;;\r\nVP-Nr.;Name;Position;FK-Nr.;E-Mail\r\n' +
    '900001;Anna Beispiel;Repräsentanzleiter;;anna@example.invalid\r\n900002;"Muster, Ben";SB;900001;\r\n900003;Carla Probe;Juniorberater;900002;\r\n';
  const r = O.lesenText(csv);
  assert.equal(r.art, 'tabelle');
  assert.deepEqual(r.zeilen.map(z => z.name), ['Anna Beispiel', 'Muster, Ben', 'Carla Probe']);
  assert.equal(r.zeilen[1].fkNummer, '900001');
  const plan = O.planen(r.zeilen, [], { anker: 7, positionen: POS });
  assert.deepEqual(plan.neu.map(n => [n.name, n.position, n.eltern.art]), [
    ['Anna Beispiel', 'repraesent', 'anker'], ['Muster, Ben', 'senior', 'neu'], ['Carla Probe', 'junior', 'neu']]);
  assert.equal(plan.neu[1].eltern.key, plan.neu[0].key);
  assert.equal(plan.neu[0].gruppe, 'MZ');
  assert.equal(plan.neu[0].email, 'anna@example.invalid');
});

test('Vorname/Nachname getrennt, FK über Namen, Tabulator (aus dem CRM kopiert)', () => {
  const txt = 'Vorname\tNachname\tKarrierestufe\tFührungskraft\nAnna\tBeispiel\tTeamleiter\t\nBen\tMuster\tTrainee\tAnna Beispiel\nEva\tVorlage\tSenior Sales Consultant\tAnna Beispiel (900001)\n';
  const r = O.lesenText(txt);
  const plan = O.planen(r.zeilen, [{ id: 3, name: 'Anna Beispiel', partnernummer: '900001', parent_id: null }], { anker: 1, positionen: POS });
  assert.equal(plan.unveraendert, 1);                    // Anna gibt es schon
  assert.deepEqual(plan.neu.map(n => [n.name, n.eltern]), [['Ben Muster', { art: 'bestand', id: 3 }], ['Eva Vorlage', { art: 'bestand', id: 3 }]]);
  assert.equal(plan.neu[1].karriereweg, 'profi');
});

test('Ebene statt Führungskraft', () => {
  const csv = 'Ebene;Name;Position\n1;A;RL\n2;B;SB\n3;C;JB\n2;D;SB\n3;E;TR\n';
  const plan = O.planen(O.lesenText(csv).zeilen, [], { anker: null, positionen: POS });
  const byName = Object.fromEntries(plan.neu.map(n => [n.name, n]));
  assert.equal(byName.A.eltern.art, 'anker');
  assert.equal(byName.C.eltern.key, byName.B.key);
  assert.equal(byName.E.eltern.key, byName.D.key);
  assert.equal(byName.D.eltern.key, byName.A.key);
});

test('Eingerückter Text (Baum aus dem Organigramm kopiert)', () => {
  const txt = 'Anna Beispiel (Repräsentanzleiter)\n  ├ Ben Muster – Seniorberater – 900002\n  │   └ Carla Probe, Juniorberater\n  └ Eva Vorlage (SSC)\n';
  const r = O.lesenText(txt);
  assert.equal(r.art, 'gliederung');
  assert.deepEqual(r.zeilen.map(z => [z.name, z.ebene]), [['Anna Beispiel', 0], ['Ben Muster', 1], ['Carla Probe', 2], ['Eva Vorlage', 1]]);
  assert.equal(r.zeilen[1].nummer, '900002');
  const plan = O.planen(r.zeilen, [], { anker: 5, positionen: POS });
  assert.deepEqual(plan.baum.map(b => [b.tiefe, b.name, b.rolle]), [
    [0, 'Anna Beispiel', 'Repräsentanzleiter'], [1, 'Ben Muster', 'Seniorberater'], [2, 'Carla Probe', 'Juniorberater'], [1, 'Eva Vorlage', 'Senior Sales Consultant']]);
});

test('Dubletten, Inaktive, unbekannte FK, Namenskonflikt, Kreisbezug', () => {
  const csv = 'Partnernummer;Name;Status;FK-Partnernummer\n1;A;aktiv;\n1;A doppelt;aktiv;\n2;B;ausgeschieden;1\n3;Max Müller;aktiv;99\n4;C;aktiv;5\n5;D;aktiv;4\n';
  const plan = O.planen(O.lesenText(csv).zeilen, [{ id: 9, name: 'Max Müller', partnernummer: '777' }], { anker: 9 });
  assert.deepEqual(plan.uebersprungen.map(u => u.grund), ['Partnernummer doppelt (wie Zeile 2)', 'inaktiv bzw. ausgeschieden']);
  const mm = plan.neu.find(n => n.partnernummer === '3');
  assert.equal(mm.name, 'Max Müller (3)');               // andere Partnernummer → eigener Knoten
  assert.equal(mm.eltern.art, 'anker');
  assert.ok(plan.hinweise.some(h => /nicht gefunden/.test(h)));
  assert.ok(plan.hinweise.some(h => /Kreisbezug/.test(h)));
  const c = plan.neu.find(n => n.name === 'C'), d = plan.neu.find(n => n.name === 'D');
  assert.ok(c.eltern.art === 'anker' || d.eltern.art === 'anker');
});

test('Vorhandene aktualisieren: Position, neue FK, fehlende Nummer und E-Mail', () => {
  const bestand = [{ id: 1, name: 'Anna Beispiel', partnernummer: null, parent_id: null, position: 'senior', email: null },
                   { id: 2, name: 'Ben Muster', partnernummer: '900002', parent_id: null, position: 'junior' }];
  const csv = 'Partnernummer;Name;Position;FK-Partnernummer;E-Mail\n900001;Anna Beispiel;Teamleiter;;a@example.invalid\n900002;Ben Muster;Seniorberater;900001;\n';
  const ohne = O.planen(O.lesenText(csv).zeilen, bestand, { positionen: POS });
  assert.deepEqual(ohne.aktualisiert.map(a => Object.keys(a.aenderungen)), [['partnernummer', 'email']]);
  const mit = O.planen(O.lesenText(csv).zeilen, bestand, { positionen: POS, aktualisieren: true });
  const ben = mit.aktualisiert.find(a => a.id === 2);
  assert.deepEqual(ben.aenderungen.eltern, { art: 'bestand', id: 1 });
  assert.equal(ben.aenderungen.position, 'senior');
  assert.equal(mit.neu.length, 0);
});

test('Positionen: Kürzel und Schreibweisen', () => {
  const k = v => (O.positionZu(v, POS) || {}).key || null;
  assert.equal(k('Regionalmanager'), 'regional');
  assert.equal(k('Senior Sales Manager'), 'ssm');
  assert.equal(k('Sales Manager'), 'sm');
  assert.equal(k('BA'), 'assistent');
  assert.equal(k('Repraesentanzleiter'), 'repraesent');
  assert.equal(k('Hausmeister'), null);
});

test('Ohne erkennbare Kopfzeile kommt eine klare Meldung', () => {
  assert.throws(() => O.ausRaster([['a', 'b'], ['c', 'd']]), /Kopfzeile/);
});

test('Vorlage lässt sich selbst importieren', () => {
  const plan = O.planen(O.lesenText(O.VORLAGE).zeilen, [], { positionen: POS });
  assert.equal(plan.neu.length, 5);
  assert.equal(plan.hinweise.length, 0);
});
