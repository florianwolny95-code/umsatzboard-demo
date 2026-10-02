/* Organigramm-Import — liest einen Struktur-Export und plant, welche Partner angelegt
 * oder aktualisiert werden. Rein, ohne Datenbank und ohne DOM: läuft im Browser
 * (window.Organigramm) und unter Node (Tests in tests/).
 *
 * Eingaben:
 *   - Tabelle (CSV mit ; , oder Tab, Excel-Blatt als Raster, aus dem CRM kopierte Tabelle)
 *     mit einer Kopfzeile. Spalten werden über Synonyme erkannt (siehe SPALTEN).
 *     Hierarchie über „FK-Partnernummer“ bzw. „Führungskraft“ oder über „Ebene“.
 *   - Eingerückter Text (eine Person je Zeile, Einrückung = Ebene), z. B. aus einem Baum kopiert.
 *
 * Befund 02.10.2026: Das CRM-Organigramm exportiert nur als Bild (SVG), nicht als Tabelle.
 * Strukturlisten mit Spalten kommen eher aus dem tIS oder aus Excel; Spaltennamen sind dort
 * nicht festgelegt, darum die tolerante Erkennung.
 */
(function (root) {
  const s = v => String(v ?? '').replace(/\u00a0/g, ' ').trim();
  // Vergleichsschlüssel: klein, Umlaute als ae/oe/ue, ohne Akzente, nur Buchstaben/Ziffern
  const key = v => s(v).toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

  const SPALTEN = {
    name:     ['name', 'partner', 'partnername', 'name partner', 'vertriebspartner', 'mitarbeiter', 'berater', 'vp name', 'name vp', 'vollständiger name', 'person'],
    vorname:  ['vorname', 'first name'],
    nachname: ['nachname', 'familienname', 'last name'],
    nummer:   ['partnernummer', 'partner nr', 'partner id', 'partnerid', 'vp nr', 'vpnr', 'vp nummer', 'vpn',
               'vermittlernummer', 'vermittler nr', 'personalnummer', 'nummer', 'nr', 'id'],
    fkNummer: ['fk nr', 'fk partnernummer', 'fk-partnernummer', 'partnernummer fk', 'fk vp nr', 'fk vpnr', 'vp nr fk', 'fk id',
               'fk partner id', 'parent id', 'übergeordnete partnernummer', 'direkte fk nr', 'führungskraft nr', 'führungskraft partnernummer', 'vorgesetzter nr'],
    fkName:   ['fk', 'führungskraft', 'direkte fk', 'direkte führungskraft', 'fk name', 'name fk', 'vorgesetzter', 'vorgesetzte', 'übergeordnet',
               'übergeordnete fk', 'untersteht', 'teamleitung'],
    position: ['position', 'stufe', 'karrierestufe', 'karriere', 'titel', 'rolle', 'funktion', 'qualifikation', 'positionsbezeichnung'],
    ebene:    ['ebene', 'level', 'strukturebene', 'tiefe', 'generation', 'hierarchieebene'],
    email:    ['e-mail', 'email', 'mail', 'e-mail-adresse', 'e mail adresse', 'emailadresse'],
    status:   ['status', 'partnerstatus', 'vertragsstatus'],
  };
  const SPALT_KEYS = Object.fromEntries(Object.entries(SPALTEN).map(([f, l]) => [f, l.map(key)]));

  // Kürzel und Schreibweisen → Schlüssel im Positionskatalog (positionen.js)
  const POS_KURZ = {
    tr: 'trainee', ba: 'assistent', 'berater assistent': 'assistent', jb: 'junior', 'junior berater': 'junior', sb: 'senior', 'senior berater': 'senior',
    tl: 'teamleiter', rl: 'repraesent', 'repraesentanz leiter': 'repraesent', bm: 'branch', rm: 'regional', dm: 'divisional', gm: 'general',
    sc: 'sc', ssc: 'ssc', sm: 'sm', ssm: 'ssm', gsm: 'gsm',
  };
  const INAKTIV = /(ausgeschieden|inaktiv|gekuendigt|kuendigung|storniert|beendet)/;

  /* ── CSV / Text → Raster ─────────────────────────────────────────── */
  function trennzeichen(text) {
    const zeilen = text.split(/\r?\n/).filter(z => z.trim()).slice(0, 10);
    let best = null, bestN = 0;
    for (const d of ['\t', ';', ',']) {
      const n = zeilen.map(z => z.split(d).length - 1);
      const min = Math.min(...n);
      if (min > 0 && min >= bestN) { best = d; bestN = min; }
    }
    return best;
  }
  function csvZuRaster(text, d) {
    const out = []; let zeile = [], feld = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"' && text[i + 1] === '"') { feld += '"'; i++; }
        else if (c === '"') q = false;
        else feld += c;
      } else if (c === '"' && feld === '') q = true;
      else if (c === d) { zeile.push(feld); feld = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        zeile.push(feld); out.push(zeile); zeile = []; feld = '';
      } else feld += c;
    }
    if (feld !== '' || zeile.length) { zeile.push(feld); out.push(zeile); }
    return out.filter(z => z.some(f => s(f)));
  }

  /* ── Raster mit Kopfzeile → Zeilen ───────────────────────────────── */
  function spalteVon(kopf) {
    const k = key(kopf);
    // exakte Treffer zuerst; FK-Spalten vor Name/Nummer, sonst schnappt „Name“ sich „FK Name“
    for (const f of ['fkNummer', 'fkName', 'vorname', 'nachname', 'email', 'ebene', 'position', 'status', 'nummer', 'name'])
      if (SPALT_KEYS[f].includes(k)) return f;
    return null;
  }
  function findeKopf(raster) {
    for (let i = 0; i < Math.min(raster.length, 15); i++) {
      const felder = (raster[i] || []).map(spalteVon);
      const hat = f => felder.includes(f);
      if ((hat('name') || hat('nachname')) && felder.filter(Boolean).length >= 2) return { zeile: i, felder };
    }
    return null;
  }
  function ausRaster(raster) {
    const kopf = findeKopf(raster);
    if (!kopf) throw new Error('Keine Kopfzeile erkannt. Erwartet werden mindestens „Name“ und eine weitere Spalte wie „Partnernummer“, „Position“, „Führungskraft“ oder „Ebene“.');
    const idx = {};
    kopf.felder.forEach((f, i) => { if (f && idx[f] === undefined) idx[f] = i; });
    const zeilen = [];
    for (let r = kopf.zeile + 1; r < raster.length; r++) {
      const z = raster[r] || [];
      const g = f => idx[f] === undefined ? '' : s(z[idx[f]]);
      let name = g('name');
      if (idx.vorname !== undefined) name = s(g('vorname') + ' ' + (g('nachname') || g('name')));
      else if (!name && idx.nachname !== undefined) name = g('nachname');
      if (!name) continue;
      const ebeneRoh = g('ebene');
      zeilen.push({
        zeile: r + 1, name, nummer: g('nummer') || null, fkNummer: g('fkNummer') || null, fkName: g('fkName') || null,
        position: g('position') || null, email: g('email') || null,
        ebene: ebeneRoh !== '' && Number.isFinite(Number(ebeneRoh)) ? Number(ebeneRoh) : null,
        inaktiv: INAKTIV.test(key(g('status'))),
      });
    }
    return { zeilen, spalten: Object.keys(idx), art: 'tabelle' };
  }

  /* ── Eingerückter Text → Zeilen (Ebene aus der Einrückung) ───────── */
  function ausGliederung(text) {
    const roh = [];
    for (const [i, zeile] of text.split(/\r?\n/).entries()) {
      if (!zeile.trim()) continue;
      const m = zeile.match(/^[\s│|├└─—–\-*•·>]*/)[0];
      const breite = m.replace(/\t/g, '    ').length;
      const inhalt = zeile.slice(m.length).trim();
      if (!inhalt) continue;
      // „Name (Position)“, „Name – Position – 12345“, „Name, Position, mail@…“
      let teile = inhalt.split(/\s+[–—|-]\s+|\s*,\s*|\s*\|\s*/).map(s).filter(Boolean);
      const klammer = teile[0].match(/^(.*?)\s*\(([^)]*)\)\s*$/);
      if (klammer) teile = [klammer[1], ...klammer[2].split(/\s*[,;/]\s*/), ...teile.slice(1)];
      const r = { zeile: i + 1, name: s(teile[0]), nummer: null, fkNummer: null, fkName: null, position: null, email: null, ebene: breite, inaktiv: false };
      for (const tl of teile.slice(1)) {
        if (/^\S+@\S+\.\S+$/.test(tl)) r.email = tl;
        else if (/^[A-Za-z]{0,3}\d{3,}$/.test(tl)) r.nummer = tl;
        else if (INAKTIV.test(key(tl))) r.inaktiv = true;
        else if (!r.position) r.position = tl;
      }
      if (r.name) roh.push(r);
    }
    // Einrückungsbreiten auf Ebenen 0, 1, 2 … abbilden
    const stufen = [...new Set(roh.map(r => r.ebene))].sort((a, b) => a - b);
    for (const r of roh) r.ebene = stufen.indexOf(r.ebene);
    return { zeilen: roh, spalten: ['name', 'ebene'], art: 'gliederung' };
  }

  // Einstieg für eingefügten Text oder CSV-Dateiinhalt
  function lesenText(text) {
    text = String(text || '').replace(/^\ufeff/, '');
    if (!text.trim()) throw new Error('Kein Inhalt.');
    const d = trennzeichen(text);
    if (d) {
      const raster = csvZuRaster(text, d);
      if (findeKopf(raster)) return ausRaster(raster);
    }
    return ausGliederung(text);
  }

  /* ── Position zuordnen ───────────────────────────────────────────── */
  function positionZu(roh, positionen) {
    const k = key(roh);
    if (!k) return null;
    const list = (positionen || []).slice().sort((a, b) => b.name.length - a.name.length);
    const kurz = POS_KURZ[k] || POS_KURZ[k.replace(/\s+/g, ' ')];
    if (kurz) return list.find(p => p.key === kurz) || null;
    const kompakt = v => v.replace(/ /g, '');
    return list.find(p => key(p.name) === k) || list.find(p => kompakt(key(p.name)) === kompakt(k))
      || list.find(p => (' ' + k + ' ').includes(' ' + key(p.name) + ' ')) || null;
  }
  // Farb-Tier wie im Board: Management gold, Senior teal, Junior lila, Trainee/Assistent grau
  function gruppeZu(pos) {
    if (!pos) return 'SN';
    if (pos.weg === 'fuehrung') return 'MZ';
    if (pos.weg === 'profi') return 'SN';
    return { trainee: 'TR', assistent: 'TR', junior: 'RM', senior: 'SN' }[pos.key] || 'SN';
  }

  /* ── Import planen ───────────────────────────────────────────────── */
  // zeilen:   Ergebnis von lesenText/ausRaster
  // bestand:  vorhandene Knoten [{ id, name, partnernummer, parent_id, position, email }]
  // opts:     { anker: id|null, aktualisieren: bool, positionen: [...], inaktiveMitnehmen: bool }
  function planen(zeilen, bestand, opts) {
    opts = opts || {};
    const anker = opts.anker ?? null;
    const hinweise = [], uebersprungen = [];
    const nrKey = v => s(v).replace(/\s+/g, '').toLowerCase();
    const bestandNachNr = new Map(), bestandNachName = new Map();
    for (const b of bestand || []) {
      if (s(b.partnernummer)) bestandNachNr.set(nrKey(b.partnernummer), b);
      const nk = key(b.name);
      bestandNachName.set(nk, bestandNachName.has(nk) ? 'mehrdeutig' : b);
    }

    // 1. Zeilen säubern, Dubletten im Import erkennen
    const rows = [];
    const nrGesehen = new Map();
    for (const z of zeilen || []) {
      if (z.inaktiv && !opts.inaktiveMitnehmen) { uebersprungen.push({ zeile: z.zeile, name: z.name, grund: 'inaktiv bzw. ausgeschieden' }); continue; }
      const nr = z.nummer ? nrKey(z.nummer) : null;
      if (nr && nrGesehen.has(nr)) { uebersprungen.push({ zeile: z.zeile, name: z.name, grund: 'Partnernummer doppelt (wie Zeile ' + nrGesehen.get(nr) + ')' }); continue; }
      if (nr) nrGesehen.set(nr, z.zeile);
      const pos = positionZu(z.position, opts.positionen);
      rows.push({ ...z, key: 'z' + rows.length, nr, pos, email: z.email && /^\S+@\S+\.\S+$/.test(z.email) ? z.email.toLowerCase() : null });
    }
    const rowNachNr = new Map(rows.filter(r => r.nr).map(r => [r.nr, r]));
    const rowNachName = new Map();
    for (const r of rows) { const nk = key(r.name); rowNachName.set(nk, rowNachName.has(nk) ? 'mehrdeutig' : r); }

    // 2. Jede Zeile einem vorhandenen Knoten zuordnen (Partnernummer vor Name)
    for (const r of rows) {
      let b = r.nr ? bestandNachNr.get(r.nr) : null;
      if (!b) {
        const n = bestandNachName.get(key(r.name));
        if (n && n !== 'mehrdeutig' && (!r.nr || !s(n.partnernummer))) b = n;
      }
      r.bestand = b || null;
    }

    // 3. Übergeordnete Person bestimmen
    const hatFk = rows.some(r => r.fkNummer || r.fkName);
    const hatEbene = !hatFk && rows.some(r => r.ebene !== null);
    const minEbene = hatEbene ? Math.min(...rows.filter(r => r.ebene !== null).map(r => r.ebene)) : 0;
    const stapel = [];
    for (const r of rows) {
      r.eltern = null;   // { art: 'zeile', row } | { art: 'bestand', id } | { art: 'anker' }
      if (hatFk) {
        let ref = r.fkNummer ? nrKey(r.fkNummer) : null, refName = r.fkName;
        if (!ref && refName) { const m = refName.match(/\(([^)]+)\)\s*$/) || refName.match(/^(\S*\d{3,}\S*)$/); if (m) { ref = nrKey(m[1]); refName = refName.replace(/\s*\([^)]*\)\s*$/, ''); } }
        if (ref && rowNachNr.has(ref)) r.eltern = { art: 'zeile', row: rowNachNr.get(ref) };
        else if (ref && bestandNachNr.has(ref)) r.eltern = { art: 'bestand', id: bestandNachNr.get(ref).id };
        else if (refName && rowNachName.get(key(refName)) && rowNachName.get(key(refName)) !== 'mehrdeutig') r.eltern = { art: 'zeile', row: rowNachName.get(key(refName)) };
        else if (refName && bestandNachName.get(key(refName)) && bestandNachName.get(key(refName)) !== 'mehrdeutig') r.eltern = { art: 'bestand', id: bestandNachName.get(key(refName)).id };
        else if (ref || s(refName)) hinweise.push('Zeile ' + r.zeile + ': Führungskraft „' + s(r.fkName || r.fkNummer) + '“ von ' + r.name + ' nicht gefunden – oberste Ebene des Imports.');
      } else if (hatEbene && r.ebene !== null) {
        while (stapel.length && stapel[stapel.length - 1].ebene >= r.ebene) stapel.pop();
        if (r.ebene > minEbene && stapel.length) r.eltern = { art: 'zeile', row: stapel[stapel.length - 1] };
        stapel.push(r);
      }
      if (r.eltern && r.eltern.art === 'zeile' && r.eltern.row === r) r.eltern = null;
    }

    // 4. Zyklen im Import auflösen (A unter B, B unter A)
    for (const r of rows) {
      const weg = new Set([r]); let p = r.eltern && r.eltern.art === 'zeile' ? r.eltern.row : null;
      while (p) {
        if (weg.has(p)) { hinweise.push('Zeile ' + r.zeile + ': Kreisbezug bei ' + r.name + ' – oberste Ebene des Imports.'); r.eltern = null; break; }
        weg.add(p); p = p.eltern && p.eltern.art === 'zeile' ? p.eltern.row : null;
      }
    }

    // 5. Ergebnis: neue Knoten (Eltern zuerst) und Änderungen an vorhandenen
    // Tiefe nur über neu anzulegende Vorfahren: Eltern werden vor ihren Kindern angelegt, sonst Dateireihenfolge
    const tiefe = r => { let d = 0, p = r; while (p.eltern && p.eltern.art === 'zeile' && !p.eltern.row.bestand) { d++; p = p.eltern.row; } return d; };
    const namenVergeben = new Set([...(bestand || []).map(b => key(b.name))]);
    const ref = r => {
      if (!r.eltern) return { art: 'anker' };
      if (r.eltern.art === 'bestand') return r.eltern;
      const e = r.eltern.row;
      return e.bestand ? { art: 'bestand', id: e.bestand.id } : { art: 'neu', key: e.key };
    };
    const neu = [], aktualisiert = [];
    let unveraendert = 0;
    const geordnet = rows.slice().sort((a, b) => tiefe(a) - tiefe(b));
    for (const r of geordnet) {
      const e = ref(r);
      const rolle = r.pos ? r.pos.name : (r.position || null);
      if (!r.bestand) {
        let name = r.name;
        if (namenVergeben.has(key(name))) name = r.name + ' (' + (r.nummer || 'Import ' + r.zeile) + ')';
        namenVergeben.add(key(name));
        if (name !== r.name) hinweise.push('Zeile ' + r.zeile + ': Name „' + r.name + '“ gibt es schon – angelegt als „' + name + '“.');
        neu.push({
          key: r.key, zeile: r.zeile, name, partnernummer: r.nummer || null, email: r.email, rolle,
          position: r.pos ? r.pos.key : null, karriereweg: r.pos && r.pos.weg !== 'basis' ? r.pos.weg : null,
          gruppe: gruppeZu(r.pos), eltern: e, tiefe: tiefe(r),
        });
        continue;
      }
      const b = r.bestand, aend = {};
      if (opts.aktualisieren) {
        if (r.pos && b.position !== r.pos.key) { aend.position = r.pos.key; aend.rolle = r.pos.name; if (r.pos.weg !== 'basis') aend.karriereweg = r.pos.weg; }
        // nur verschieben, wenn die Datei eine Führungskraft nennt (die oberste Zeile bleibt, wo sie ist)
        if (e.art !== 'anker' && !(e.art === 'bestand' && e.id === b.parent_id)) aend.eltern = e;
      }
      if (r.nummer && !s(b.partnernummer)) aend.partnernummer = r.nummer;
      if (r.email && !s(b.email)) aend.email = r.email;
      if (Object.keys(aend).length) aktualisiert.push({ id: b.id, key: r.key, zeile: r.zeile, name: b.name, aenderungen: aend });
      else unveraendert++;
    }

    // Vorschau als Baum in Import-Reihenfolge
    const kinder = new Map(); const wurzeln = [];
    for (const r of rows) { const p = r.eltern && r.eltern.art === 'zeile' ? r.eltern.row : null; if (p) { if (!kinder.has(p)) kinder.set(p, []); kinder.get(p).push(r); } else wurzeln.push(r); }
    const baum = [];
    const neuNachKey = new Map(neu.map(n => [n.key, n])), aktNachKey = new Map(aktualisiert.map(a => [a.key, a]));
    const lauf = (r, d) => {
      const n = neuNachKey.get(r.key);
      baum.push({
        tiefe: d, zeile: r.zeile, name: n ? n.name : r.bestand.name, partnernummer: r.nummer, rolle: r.pos ? r.pos.name : r.position,
        positionErkannt: !!r.pos || !r.position, art: n ? 'neu' : aktNachKey.has(r.key) ? 'aktualisiert' : 'vorhanden',
        unter: r.eltern && r.eltern.art === 'bestand' ? r.eltern.id : null,
      });
      for (const k of kinder.get(r) || []) lauf(k, d + 1);
    };
    for (const w of wurzeln) lauf(w, 0);

    return { neu, aktualisiert, unveraendert, uebersprungen, hinweise, baum, anker };
  }

  // Vorlage zum Herunterladen (fiktive Namen)
  const VORLAGE = [
    'Partnernummer;Name;Position;FK-Partnernummer;E-Mail',
    '900001;Anna Beispiel;Repräsentanzleiter;;anna.beispiel@example.invalid',
    '900002;Ben Muster;Seniorberater;900001;',
    '900003;Carla Probe;Juniorberater;900002;',
    '900004;David Test;Trainee;900003;',
    '900005;Eva Vorlage;Senior Sales Consultant;900001;',
  ].join('\r\n') + '\r\n';

  const api = { lesenText, ausRaster, ausGliederung, csvZuRaster, positionZu, gruppeZu, planen, key, VORLAGE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Organigramm = api;
})(typeof window !== 'undefined' ? window : globalThis);
