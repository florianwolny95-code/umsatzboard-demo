/* Tarifkatalog für den Volumenrechner — ÖFFENTLICHE PLATZHALTER-FASSUNG.
 *
 * WICHTIG: Die echten Volumen-/Bewertungsfaktoren stehen in der tecis-Anlage 4
 * (Vertragsanlage, vertraulich) und gehören NICHT in dieses öffentliche Repo.
 * Die Faktoren hier sind neutrale Platzhalter, damit die Demo rechnen kann.
 *
 * Echte Werte einspielen (nur lokal):
 *   1. Datei `tarife.local.js` im selben Ordner anlegen (steht in .gitignore).
 *   2. Darin: window.TARIFE = [ ... ]  — gleiche Struktur wie unten.
 *   3. index.html lädt sie automatisch, sobald sie existiert, und sie
 *      überschreibt diesen Platzhalter-Katalog.
 *
 * Formeltypen (Systematik der Anlage 4):
 *   bs        Beitragssumme:      Monatsbeitrag × 12 × BZD(max) × Faktor
 *   einmal    Einmalbeitrag:      Betrag × Faktor
 *   mb        Monatsbeitrag:      Monatsbeitrag × Faktor            (z.B. PKV)
 *   jnb       Jahresnettobeitrag: Monatsbeitrag × 12 × Faktor       (z.B. Rechtsschutz)
 *   nb        Nettobeitrag:       Beitrag × Faktor                  (z.B. Bestattung)
 *   sparplan  Sparplan:           Rate × 12 × Dauer × Faktor  (+ Einmalanlage × Faktor)
 *   summe     Darlehen/Bauspar:   Summe × Bewertungsfaktor × Faktor
 *   kaufpreis Immobilie:          Kaufpreis × Provisionssatz% × Faktor
 */
window.TARIFE = [
  // sparte, name, typ, faktor, bzdMax (Jahre, nur bei typ 'bs'), bewertung (nur 'summe')
  { sparte: 'Altersvorsorge', name: 'Basisvorsorge (Platzhalter)', typ: 'bs', faktor: 1.00, bzdMax: 35 },
  { sparte: 'Altersvorsorge', name: 'Zusatzvorsorge (Platzhalter)', typ: 'bs', faktor: 1.00, bzdMax: 40 },
  { sparte: 'Altersvorsorge', name: 'Riester (Platzhalter)', typ: 'bs', faktor: 1.00, bzdMax: 40 },
  { sparte: 'Altersvorsorge', name: 'Privatvorsorge (Platzhalter)', typ: 'bs', faktor: 1.00, bzdMax: 40 },
  { sparte: 'Altersvorsorge', name: 'Einmalbeitrag zum Vertrag (Platzhalter)', typ: 'einmal', faktor: 1.00 },
  { sparte: 'Absicherung', name: 'Private Krankenversicherung (Platzhalter)', typ: 'mb', faktor: 100 },
  { sparte: 'Absicherung', name: 'Berufsunfähigkeit (Platzhalter)', typ: 'bs', faktor: 1.00, bzdMax: 40 },
  { sparte: 'Absicherung', name: 'Risikoleben (Platzhalter)', typ: 'bs', faktor: 1.00, bzdMax: 40 },
  { sparte: 'Absicherung', name: 'Bestattungsvorsorge (Platzhalter)', typ: 'nb', faktor: 5.00 },
  { sparte: 'Vermögensabsicherung', name: 'Rechtsschutz (Platzhalter)', typ: 'jnb', faktor: 10.00 },
  { sparte: 'Vermögensabsicherung', name: 'Haftpflicht (Platzhalter)', typ: 'jnb', faktor: 10.00 },
  { sparte: 'Investment', name: 'Fonds-Sparplan (Platzhalter)', typ: 'sparplan', faktor: 1.00 },
  { sparte: 'Investment', name: 'Fonds-Einmalanlage (Platzhalter)', typ: 'einmal', faktor: 1.00 },
  { sparte: 'Investment', name: 'AIF / Zeichnungssumme (Platzhalter)', typ: 'einmal', faktor: 1.00 },
  { sparte: 'Finanzierung', name: 'Baufinanzierung (Platzhalter)', typ: 'summe', faktor: 0.20, bewertung: 1.0 },
  { sparte: 'Finanzierung', name: 'Bausparen (Platzhalter)', typ: 'summe', faktor: 0.25, bewertung: 1.0 },
  { sparte: 'Finanzierung', name: 'Immobilienvermittlung (Platzhalter)', typ: 'kaufpreis', faktor: 16.00 },
];
window.TARIFE_QUELLE = 'Platzhalter (öffentliche Demo) — echte Faktoren via tarife.local.js';
