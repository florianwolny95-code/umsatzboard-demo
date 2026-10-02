/* Monatsplanung und Geschäftsstand — reine Rechenlogik, ohne Datenbank und ohne DOM.
 * Läuft im Browser (window.Planung) und unter Node (Tests in tests/).
 *
 * Monatsplanung: je Person und Monat die Positionen, die eingereicht werden sollen
 * (Kunde, Sparte, Volumen, Stand). Ziel kommt aus der Tabelle `ziele`.
 *
 * Geschäftsstand: Kennzahlen aus der Bereichsauswertung für Profiberater
 * (Skill prozess-profiberater-bereichsauswertung). Format „wolny-geschaeftsstand“,
 * Version 1 — Beispiel in beispiele/geschaeftsstand-muster.json. Für die Beförderung
 * zählt abgerechnetes Netto-Eigenvolumen im rollierenden Fenster, nicht eingereichtes.
 */
(function (root) {
  // Gleiche Sparten wie /planung in der Beratungssuite, damit beide Planungen zusammenpassen
  const SPARTEN = [
    'Baufinanzierung', 'Privatkredit', 'Bausparen', 'Altersvorsorge / AV-Depot',
    'Berufsunfähigkeit / Arbeitskraft', 'Krankenversicherung', 'Sachversicherung',
    'Investment / Depot', 'Immobilienvermittlung', 'Sonstiges',
  ];
  const PLAN_STATUS = ['geplant', 'eingereicht', 'policiert', 'verguetet', 'entfallen'];
  const PLAN_LABEL = { geplant: '○ Geplant', eingereicht: '◔ Eingereicht', policiert: '◑ Policiert', verguetet: '✓ Vergütet', entfallen: '✕ Entfallen' };
  // „Eingereicht“ im Sinne des Monatsziels: alles, was den Antrag schon hinter sich hat
  const RAUS = ['eingereicht', 'policiert', 'verguetet'];

  const zahl = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const MONAT_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

  function monatPlus(m, d) {
    let [y, mo] = m.split('-').map(Number); mo += d;
    while (mo < 1) { mo += 12; y--; } while (mo > 12) { mo -= 12; y++; }
    return y + '-' + String(mo).padStart(2, '0');
  }
  // Anzahl Monate von a bis b (b später → positiv)
  function monateZwischen(a, b) {
    const [ya, ma] = a.split('-').map(Number), [yb, mb] = b.split('-').map(Number);
    return (yb - ya) * 12 + (mb - ma);
  }

  /* ── Monatsplanung ─────────────────────────────────────────────── */
  // Summen einer Positionsliste. plan = alles außer entfallen; eingereicht = ab Antrag.
  function summe(positionen) {
    const s = { plan: 0, offen: 0, eingereicht: 0, policiert: 0, verguetet: 0, entfallen: 0, anzahl: 0, jeSparte: {} };
    for (const p of positionen || []) {
      const b = zahl(p.betrag), st = PLAN_STATUS.includes(p.status) ? p.status : 'geplant';
      if (st === 'entfallen') { s.entfallen += b; continue; }
      s.anzahl++; s.plan += b;
      if (st === 'geplant') s.offen += b;
      if (RAUS.includes(st)) s.eingereicht += b;
      if (st === 'policiert' || st === 'verguetet') s.policiert += b;
      if (st === 'verguetet') s.verguetet += b;
      const sp = p.sparte || 'Sonstiges';
      s.jeSparte[sp] = (s.jeSparte[sp] || 0) + b;
    }
    return s;
  }
  // Abstand zum Monatsziel: was noch einzureichen ist und ob der Plan das Ziel überhaupt trägt
  function gegenZiel(ziel, s) {
    ziel = zahl(ziel);
    return {
      ziel,
      fehltEingereicht: Math.max(0, ziel - s.eingereicht),
      fehltImPlan: Math.max(0, ziel - s.plan),
      planDeckt: ziel ? s.plan / ziel : null,
      erreicht: ziel ? s.eingereicht / ziel : null,
    };
  }

  /* ── Geschäftsstand (Kennzahlen aus der Bereichsauswertung) ─────── */
  const t = (v, max) => { const s = String(v ?? '').trim(); return s ? s.slice(0, max || 200) : null; };
  const AMPEL = ['gruen', 'gelb', 'rot'];
  const ampelVon = v => { const k = String(v || '').toLowerCase().replace('ü', 'ue'); return AMPEL.includes(k) ? k : null; };
  const zahlOderNull = v => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v))) ? null : Number(v);

  // Prüft eine Kennzahlen-Datei und übernimmt nur bekannte Felder (keine Kundennamen vorgesehen).
  function pruefeGeschaeftsstand(roh) {
    if (!roh || typeof roh !== 'object' || roh.format !== 'wolny-geschaeftsstand')
      throw new Error('Keine Kennzahlen-Datei der Bereichsauswertung (Format „wolny-geschaeftsstand“ fehlt).');
    if (roh.version !== 1) throw new Error('Unbekannte Version der Kennzahlen-Datei: ' + roh.version);
    const k = roh.karriere || {};
    const reihe = [];
    for (const e of Array.isArray(k.eigenvolumenJeMonat) ? k.eigenvolumenJeMonat : []) {
      if (!e || !MONAT_RE.test(e.monat || '')) throw new Error('Monat im Eigenvolumen ungültig: ' + (e && e.monat));
      const w = Number(e.wert);
      if (!Number.isFinite(w) || w < 0) throw new Error('Eigenvolumen für ' + e.monat + ' ist keine Zahl.');
      const i = reihe.findIndex(x => x.monat === e.monat);
      if (i >= 0) reihe[i].wert = w; else reihe.push({ monat: e.monat, wert: w });
    }
    reihe.sort((a, b) => a.monat < b.monat ? -1 : 1);
    if (reihe.length > 24) reihe.splice(0, reihe.length - 24);
    const fenster = Math.round(zahl(k.fenstermonate)) || 6;
    if (fenster < 1 || fenster > 24) throw new Error('Fenstermonate müssen zwischen 1 und 24 liegen.');
    const grenze = zahlOderNull(k.grenzeEigenvolumen);
    if (grenze !== null && grenze <= 0) throw new Error('Grenze der nächsten Stufe muss größer als 0 sein.');
    const monat = MONAT_RE.test(roh.monat || '') ? roh.monat : (reihe.length ? reihe[reihe.length - 1].monat : null);
    const zielMonat = MONAT_RE.test(k.zielMonat || '') ? k.zielMonat : null;
    const p = roh.produktion || {}, q = roh.qualitaet || {};
    return {
      format: 'wolny-geschaeftsstand', version: 1,
      titel: t(roh.titel, 120), monat, stand: /^\d{4}-\d{2}-\d{2}$/.test(roh.stand || '') ? roh.stand : null,
      bericht: roh.bericht ? { titel: t(roh.bericht.titel, 120), url: /^https:\/\//.test(roh.bericht.url || '') ? t(roh.bericht.url, 500) : null } : null,
      partner: { partnernummer: t(roh.partner && roh.partner.partnernummer, 40) },
      karriere: {
        stufeHeute: t(k.stufeHeute, 60), naechsteStufe: t(k.naechsteStufe, 60),
        grenzeEigenvolumen: grenze, fenstermonate: fenster, zielMonat, eigenvolumenJeMonat: reihe,
      },
      qualitaet: { bqq: zahlOderNull(q.bqq), grenze: zahlOderNull(q.grenze) },
      produktion: {
        eingereichtLfdJahr: zahlOderNull(p.eingereichtLfdJahr), zumVorjahrProzent: zahlOderNull(p.zumVorjahrProzent),
        pipelineAntraege: zahlOderNull(p.pipelineAntraege), pipelineVolumen: zahlOderNull(p.pipelineVolumen),
      },
      ampeln: (Array.isArray(roh.ampeln) ? roh.ampeln : []).slice(0, 8)
        .map(a => ({ feld: t(a.feld, 40), ampel: ampelVon(a.ampel), wert: t(a.wert, 60), text: t(a.text, 200) })).filter(a => a.feld),
      provision: (Array.isArray(roh.provision) ? roh.provision : []).slice(0, 15)
        .map(a => ({ punkt: t(a.punkt, 80), faelle: zahlOderNull(a.faelle), detail: t(a.detail, 120), ampel: ampelVon(a.ampel) })).filter(a => a.punkt),
      aufgaben: (Array.isArray(roh.aufgaben) ? roh.aufgaben : []).slice(0, 10)
        .map(a => ({ titel: t(a.titel, 80), frist: t(a.frist, 30), text: t(a.text, 240) })).filter(a => a.titel),
    };
  }

  // Weg zur nächsten Stufe aus dem rollierenden Netto-Eigenvolumen (Rechnung wie im Bericht).
  function befoerderungsweg(kz) {
    const k = (kz && kz.karriere) || {};
    const fenster = k.fenstermonate || 6;
    const reihe = (k.eigenvolumenJeMonat || []).slice(-fenster);
    if (!reihe.length) return null;
    const rollierend = reihe.reduce((a, e) => a + zahl(e.wert), 0);
    const grenze = zahl(k.grenzeEigenvolumen) || null;
    const letzter = reihe[reihe.length - 1].monat;
    const schnitt = rollierend / reihe.length;
    // Fenster nach i weiteren Monaten mit gleichem Tempo je Monat
    const nachMonaten = (i, tempo) => {
      const bleibt = reihe.slice(Math.min(reihe.length, Math.max(0, i - (fenster - reihe.length)))).reduce((a, e) => a + zahl(e.wert), 0);
      return bleibt + Math.min(i, fenster) * tempo;
    };
    const noetigJeMonatBis = zielMonat => {
      if (!grenze) return null;
      const n = monateZwischen(letzter, zielMonat);
      if (n < 1) return null;
      const bleibt = n >= fenster ? 0 : nachMonaten(n, 0);
      return Math.max(0, (grenze - bleibt) / Math.min(n, fenster));
    };
    const ausblick = (tempo, monate = 3) => {
      const zeilen = [];
      for (let i = 1; i <= monate; i++) zeilen.push({ monat: monatPlus(letzter, i), rollierend: nachMonaten(i, tempo) });
      const erreicht = grenze ? zeilen.find(z => z.rollierend >= grenze - 0.5) : null;
      return { tempo, zeilen, erreichtIm: erreicht ? erreicht.monat : null };
    };
    return {
      fenster, reihe, letzterMonat: letzter, rollierend, grenze, schnitt,
      quote: grenze ? rollierend / grenze : null,
      fehlt: grenze ? Math.max(0, grenze - rollierend) : null,
      faelltHeraus: reihe.length === fenster ? reihe[0] : null,
      // so viel muss im nächsten Abrechnungsmonat dazukommen, damit die Grenze danach erreicht ist
      noetigNaechsterMonat: grenze ? Math.max(0, grenze - nachMonaten(1, 0)) : null,
      noetigJeMonatBis, ausblick,
    };
  }

  // Monatsplanung gegen das nötige Tempo für die Stufe stellen
  function abgleich(weg, planSumme, zielMonat) {
    if (!weg || !weg.grenze) return null;
    const noetig = weg.noetigJeMonatBis(zielMonat);
    if (noetig == null) return null;
    return { noetig, plan: planSumme.plan, eingereicht: planSumme.eingereicht, fehltImPlan: Math.max(0, noetig - planSumme.plan) };
  }

  const api = { SPARTEN, PLAN_STATUS, PLAN_LABEL, summe, gegenZiel, pruefeGeschaeftsstand, befoerderungsweg, abgleich, monatPlus, monateZwischen };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Planung = api;
})(typeof window !== 'undefined' ? window : globalThis);
