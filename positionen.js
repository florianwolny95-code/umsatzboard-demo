/* Positions-/Karrierekatalog — ÖFFENTLICHE PLATZHALTER-FASSUNG.
 *
 * Die Positionsbezeichnungen des tecis-Karrieremodells sind öffentlich bekannt.
 * Die Provisionssätze (‰), Volumengrenzen und Haftungseinbehalte stammen aus
 * der Anlage 5 (Geschäftsplan, Vertragsanlage) und sind VERTRAULICH — sie
 * stehen deshalb hier nur als neutrale Platzhalter.
 *
 * Echte Werte lokal einspielen: `positionen.local.js` anlegen (steht in
 * .gitignore), darin window.POSITIONEN = [...] mit gleicher Struktur.
 *
 * Felder:
 *   key        interner Schlüssel
 *   name       Anzeigename
 *   weg        'basis' | 'fuehrung' | 'profi'
 *   stufe      Rangfolge (aufsteigend)
 *   promille   Provisionssatz in ‰ auf das Netto-Volumen
 *   eigen      Mindest-Netto-Eigenvolumen für diese Position
 *   team       Mindest-Netto-Teamvolumen für diese Position
 *   einbehalt  Provisionshaftungseinbehalt in %
 *   qualitaet  max. Beförderungsquote Qualität in % (null = keine)
 */
window.POSITIONEN = [
  // Alle Zahlen sind frei gewählte Demo-Werte (glatte Stufen), NICHT die echten Konditionen.
  { key: 'trainee',   name: 'Trainee',          weg: 'basis', stufe: 1, promille: 5,  eigen: 0,      team: 0,      einbehalt: 15, qualitaet: null },
  { key: 'assistent', name: 'Beraterassistent', weg: 'basis', stufe: 2, promille: 10, eigen: 100000, team: 200000, einbehalt: 15, qualitaet: null },
  { key: 'junior',    name: 'Juniorberater',    weg: 'basis', stufe: 3, promille: 15, eigen: 200000, team: 400000, einbehalt: 15, qualitaet: null },
  { key: 'senior',    name: 'Seniorberater',    weg: 'basis', stufe: 4, promille: 20, eigen: 400000, team: 800000, einbehalt: 15, qualitaet: null },

  { key: 'teamleiter',  name: 'Teamleiter',         weg: 'fuehrung', stufe: 5,  promille: 25, eigen: 0, team: 2000000,   einbehalt: 15, qualitaet: 15 },
  { key: 'repraesent',  name: 'Repräsentanzleiter', weg: 'fuehrung', stufe: 6,  promille: 30, eigen: 0, team: 4000000,   einbehalt: 15, qualitaet: 15 },
  { key: 'branch',      name: 'Branch Manager',     weg: 'fuehrung', stufe: 7,  promille: 35, eigen: 0, team: 8000000,   einbehalt: 15, qualitaet: 15 },
  { key: 'regional',    name: 'Regional Manager',   weg: 'fuehrung', stufe: 8,  promille: 40, eigen: 0, team: 20000000,  einbehalt: 15, qualitaet: 15 },
  { key: 'divisional',  name: 'Divisional Manager', weg: 'fuehrung', stufe: 9,  promille: 45, eigen: 0, team: 40000000,  einbehalt: 15, qualitaet: 15 },
  { key: 'general',     name: 'General Manager',    weg: 'fuehrung', stufe: 10, promille: 50, eigen: 0, team: 80000000,  einbehalt: 15, qualitaet: 15 },

  { key: 'sc',     name: 'Sales Consultant',         weg: 'profi', stufe: 5, promille: 25, eigen: 800000,  team: 0, einbehalt: 15, qualitaet: 15 },
  { key: 'ssc',    name: 'Senior Sales Consultant',  weg: 'profi', stufe: 6, promille: 30, eigen: 1600000, team: 0, einbehalt: 15, qualitaet: 10 },
  { key: 'sm',     name: 'Sales Manager',            weg: 'profi', stufe: 7, promille: 35, eigen: 2000000, team: 0, einbehalt: 15, qualitaet: 10 },
  { key: 'ssm',    name: 'Senior Sales Manager',     weg: 'profi', stufe: 8, promille: 40, eigen: 4000000, team: 0, einbehalt: 15, qualitaet: 10 },
  { key: 'gsm',    name: 'General Sales Manager',    weg: 'profi', stufe: 9, promille: 45, eigen: 0,       team: 0, einbehalt: 15, qualitaet: 10 },
];
window.POSITIONEN_QUELLE = 'Platzhalter (öffentliche Demo) — echte Sätze via positionen.local.js';
