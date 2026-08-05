/* Tarifkatalog für den Volumenrechner — ÖFFENTLICHE PLATZHALTER-FASSUNG.
 *
 * WICHTIG: Die echten Volumenfaktoren stehen in der tecis-Anlage 4 (Vertragsanlage,
 * vertraulich) und gehören NICHT in dieses öffentliche Repo. Die Faktoren hier sind
 * neutrale Platzhalter, damit die Demo rechnen kann; auch die Gesellschaftsnamen
 * sind generisch gehalten.
 *
 * Echte Werte einspielen (nur lokal):
 *   1. `tarife.local.js` im selben Ordner anlegen (steht in .gitignore).
 *   2. Darin: window.TARIFE = [ ... ] — gleiche Struktur wie unten.
 *   3. index.html lädt sie automatisch und sie überschreibt diesen Katalog.
 *
 * Struktur je Eintrag:
 *   gesellschaft  Produktpartner (Auswahl 1 im Rechner)
 *   name          Tarifbezeichnung (Auswahl 2, gefiltert nach Gesellschaft)
 *   typ           Formelart (siehe unten)
 *   faktor        Volumen-/Bewertungsfaktor
 *   bzdMax        maximale Beitragszahldauer in Jahren (nur typ 'bs')
 *   bewertung     Bewertungsfaktor (nur typ 'summe')
 *
 * Formelarten (Systematik der Anlage 4):
 *   bs        Beitragssumme:      Monatsbeitrag × 12 × BZD(max) × Faktor
 *   einmal    Einmalbeitrag:      Betrag × Faktor
 *   mb        Monatsbeitrag:      Monatsbeitrag × Faktor            (z.B. PKV)
 *   jnb       Jahresnettobeitrag: Monatsbeitrag × 12 × Faktor       (z.B. Haftpflicht)
 *   nb        Nettobeitrag:       Beitrag × Faktor                  (z.B. Rechtsschutz)
 *   sparplan  Sparplan:           Rate × 12 × Dauer × Faktor  (+ Einmalanlage × Faktor)
 *   summe     Darlehen/Bauspar:   Summe × Bewertungsfaktor × Faktor
 *   kaufpreis Immobilie:          Kaufpreis × Provisionssatz% × Faktor
 */
window.TARIFE = [
  // ── Lebensversicherer A (Demo) ──────────────────────────────────────
  { gesellschaft: 'Versicherer A (Demo)', name: 'Basisvorsorge laufender Beitrag', typ: 'bs', faktor: 1.00, bzdMax: 35 },
  { gesellschaft: 'Versicherer A (Demo)', name: 'Basisvorsorge Einmalbeitrag', typ: 'einmal', faktor: 1.00 },
  { gesellschaft: 'Versicherer A (Demo)', name: 'Privatvorsorge laufender Beitrag', typ: 'bs', faktor: 1.00, bzdMax: 40 },
  { gesellschaft: 'Versicherer A (Demo)', name: 'Risikoleben', typ: 'bs', faktor: 1.00, bzdMax: 40 },

  // ── Lebensversicherer B (Demo) ──────────────────────────────────────
  { gesellschaft: 'Versicherer B (Demo)', name: 'Zusatzvorsorge laufender Beitrag', typ: 'bs', faktor: 1.00, bzdMax: 40 },
  { gesellschaft: 'Versicherer B (Demo)', name: 'Riester laufender Beitrag', typ: 'bs', faktor: 1.00, bzdMax: 40 },
  { gesellschaft: 'Versicherer B (Demo)', name: 'Berufsunfähigkeit', typ: 'bs', faktor: 1.00, bzdMax: 40 },
  { gesellschaft: 'Versicherer B (Demo)', name: 'Bestattungsvorsorge', typ: 'bs', faktor: 1.00, bzdMax: 45 },

  // ── Krankenversicherer (Demo) ───────────────────────────────────────
  { gesellschaft: 'Krankenversicherer (Demo)', name: 'Private Krankenversicherung', typ: 'mb', faktor: 100 },
  { gesellschaft: 'Krankenversicherer (Demo)', name: 'Krankenzusatz', typ: 'mb', faktor: 50 },

  // ── Komposit (Demo) ─────────────────────────────────────────────────
  { gesellschaft: 'Komposit (Demo)', name: 'Haftpflicht privat', typ: 'jnb', faktor: 10.0 },
  { gesellschaft: 'Komposit (Demo)', name: 'Rechtsschutz', typ: 'nb', faktor: 5.0 },
  { gesellschaft: 'Komposit (Demo)', name: 'Hausrat', typ: 'jnb', faktor: 10.0 },

  // ── Investment (Demo) ───────────────────────────────────────────────
  { gesellschaft: 'Investment (Demo)', name: 'Fonds-Sparplan', typ: 'sparplan', faktor: 1.00 },
  { gesellschaft: 'Investment (Demo)', name: 'Fonds-Einmalanlage', typ: 'einmal', faktor: 1.00 },
  { gesellschaft: 'Investment (Demo)', name: 'AIF Zeichnungssumme', typ: 'einmal', faktor: 1.00 },
  { gesellschaft: 'Investment (Demo)', name: 'Kombianlage Sparplan + Einmalanlage', typ: 'sparplan', faktor: 1.00 },

  // ── Finanzierung (Demo) ─────────────────────────────────────────────
  { gesellschaft: 'Finanzierung (Demo)', name: 'Baufinanzierung Darlehenssumme', typ: 'summe', faktor: 0.20, bewertung: 1.0 },
  { gesellschaft: 'Finanzierung (Demo)', name: 'Bausparen Bausparsumme', typ: 'summe', faktor: 0.25, bewertung: 1.0 },
  { gesellschaft: 'Finanzierung (Demo)', name: 'Immobilienvermittlung', typ: 'kaufpreis', faktor: 16.00 },
];
window.TARIFE_QUELLE = 'Platzhalter (öffentliche Demo) — echte Faktoren via tarife.local.js';
