/* Demo-Modus: ersetzt Supabase durch localStorage (kein Login, kein Server).
   Aktiv, wenn config.js keine echten Zugangsdaten hat. Beispieldaten (fiktiv). */
globalThis.DemoDB = (function () {
  const KEY = 'umsatzboard_demo_v13';   // neue Version → Beispieldaten mit Monatsplanung und Profiberater
  let store = null;
  // Kennzahlen-Datei der Bereichsauswertung (Fantasiedaten, Grenze aus dem Platzhalter-Positionskatalog)
  const MUSTER_KENNZAHLEN = {
    "format": "wolny-geschaeftsstand",
    "version": 1,
    "titel": "Bereichsauswertung Profiberater",
    "monat": "2026-09",
    "stand": "2026-10-02",
    "bericht": {
      "titel": "Mein Geschäftsstand September 2026 (Muster, Fantasiedaten)",
      "url": null
    },
    "partner": {
      "partnernummer": null
    },
    "karriere": {
      "stufeHeute": "Senior Sales Consultant",
      "naechsteStufe": "Sales Manager",
      "grenzeEigenvolumen": 2000000,
      "fenstermonate": 6,
      "zielMonat": "2026-12",
      "eigenvolumenJeMonat": [
        {
          "monat": "2026-04",
          "wert": 248200
        },
        {
          "monat": "2026-05",
          "wert": 262900
        },
        {
          "monat": "2026-06",
          "wert": 301300
        },
        {
          "monat": "2026-07",
          "wert": 239800
        },
        {
          "monat": "2026-08",
          "wert": 288600
        },
        {
          "monat": "2026-09",
          "wert": 271600
        }
      ]
    },
    "qualitaet": {
      "bqq": 2.1,
      "grenze": 10
    },
    "produktion": {
      "eingereichtLfdJahr": 2527500,
      "zumVorjahrProzent": 12.4,
      "pipelineAntraege": 14,
      "pipelineVolumen": 386400
    },
    "ampeln": [
      {
        "feld": "Karriere",
        "ampel": "gelb",
        "wert": "81 %",
        "text": "Mit dem bisherigen Tempo bleibt die Stufe außer Reichweite."
      },
      {
        "feld": "Qualität",
        "ampel": "gruen",
        "wert": "2,1 %",
        "text": "Eigene BQQ weit unter der Grenze."
      },
      {
        "feld": "Produktion",
        "ampel": "gruen",
        "wert": "+12,4 %",
        "text": "14 Anträge mit 386.400 € in der Pipeline."
      },
      {
        "feld": "Provision",
        "ampel": "rot",
        "wert": "1 Sperre",
        "text": "12.000 € blockiert, Rabattgenehmigung fehlt."
      },
      {
        "feld": "Kunden",
        "ampel": "gelb",
        "wert": "9 von 23",
        "text": "Neukunden ohne Beruf oder Einkommen."
      }
    ],
    "provision": [
      {
        "punkt": "ANB offen",
        "faelle": 2,
        "detail": "1 mit Frist vorbei",
        "ampel": "gelb"
      },
      {
        "punkt": "VNB offen",
        "faelle": 3,
        "detail": "gefährdet 6.900 €",
        "ampel": "gelb"
      },
      {
        "punkt": "Provisionssperren",
        "faelle": 1,
        "detail": "Rabattgenehmigung, 12.000 €",
        "ampel": "rot"
      },
      {
        "punkt": "Anträge ohne Policierung über 30 Tage",
        "faelle": 4,
        "detail": "58.300 €",
        "ampel": "gelb"
      },
      {
        "punkt": "Ohne Erstabrechnung",
        "faelle": 0,
        "detail": null,
        "ampel": "gruen"
      }
    ],
    "aufgaben": [
      {
        "titel": "Provisionssperre lösen",
        "frist": "bis 09.10.",
        "text": "Rabattgenehmigung nachweisen, dann ist die Provision frei."
      },
      {
        "titel": "Pipeline policieren",
        "frist": "bis 18.10.",
        "text": "Vier Anträge liegen über 30 Tage ohne Policierung; sie tragen den Weg zur Stufe."
      },
      {
        "titel": "Monatsschnitt anheben",
        "frist": "ab Oktober",
        "text": "Für die nächste Stufe im Dezember braucht es 400.000 € je Monat statt heute rund 269.000 €."
      }
    ]
  };

  function seed() {
    return {
      // Jeder Mitarbeiter = eigener Knoten (kann selbst planen), Hierarchie über parent_id.
      // Namen als "Vorname + Nachname-Initial" (öffentliches Repo). sortierung = DFS-Reihenfolge.
      // gruppe = Farb-Tier: MZ(gold)=Management, SN(teal)=Senior, RM(lila)=Junior, TR(grau)=Trainee/Assistent.
      bereiche: [
        { id: 32, name: 'Florian W.', rolle: 'Inhaber · Finanzierung', position: 'branch', gruppe: 'MZ', parent_id: null, quartalsziel: 0, sortierung: 0 },
        { id: 1, name: 'Robert M.', rolle: 'Regional Manager', position: 'regional', gruppe: 'MZ', parent_id: null, quartalsziel: 0, sortierung: 1 },
        { id: 2, name: 'Steve N.', rolle: 'Branch Manager', position: 'branch', gruppe: 'MZ', parent_id: 1, quartalsziel: 0, sortierung: 2 },
        { id: 3, name: 'Maximilian Z.', rolle: 'Repräsentanzleiter', position: 'repraesent', gruppe: 'MZ', parent_id: 2, quartalsziel: 0, sortierung: 3 },
        { id: 12, name: 'Paul P.', rolle: 'Trainee', position: 'trainee', gruppe: 'TR', parent_id: 3, quartalsziel: 0, sortierung: 4 },
        { id: 13, name: 'Lukas S.', rolle: 'Trainee', position: 'trainee', gruppe: 'TR', parent_id: 3, quartalsziel: 0, sortierung: 5 },
        { id: 14, name: 'Hannes J.', rolle: 'Beraterassistent', position: 'assistent', gruppe: 'TR', parent_id: 3, quartalsziel: 0, sortierung: 6 },
        { id: 15, name: 'Nils S.', rolle: 'Beraterassistent', position: 'assistent', gruppe: 'TR', parent_id: 3, quartalsziel: 0, sortierung: 7 },
        { id: 4, name: 'Agon A.', rolle: 'Seniorberater', position: 'senior', gruppe: 'SN', parent_id: 3, quartalsziel: 0, sortierung: 8 },
        { id: 16, name: 'Mats S.', rolle: 'Trainee', position: 'trainee', gruppe: 'TR', parent_id: 4, quartalsziel: 0, sortierung: 9 },
        { id: 17, name: 'Mara D.', rolle: 'Trainee', position: 'trainee', gruppe: 'TR', parent_id: 4, quartalsziel: 0, sortierung: 10 },
        { id: 18, name: 'Julien G.', rolle: 'Trainee', position: 'trainee', gruppe: 'TR', parent_id: 4, quartalsziel: 0, sortierung: 11 },
        { id: 19, name: 'Max L.', rolle: 'Beraterassistent', position: 'assistent', gruppe: 'TR', parent_id: 4, quartalsziel: 0, sortierung: 12 },
        { id: 5, name: 'Lennart W.', rolle: 'Seniorberater', position: 'senior', gruppe: 'SN', parent_id: 3, quartalsziel: 0, sortierung: 13 },
        { id: 20, name: 'Stian P.', rolle: 'Beraterassistent', position: 'assistent', gruppe: 'TR', parent_id: 5, quartalsziel: 0, sortierung: 14 },
        { id: 8, name: 'Tom E.', rolle: 'Juniorberater', position: 'junior', gruppe: 'RM', parent_id: 5, quartalsziel: 0, sortierung: 15 },
        { id: 21, name: 'Erik K.', rolle: 'Trainee', position: 'trainee', gruppe: 'TR', parent_id: 8, quartalsziel: 0, sortierung: 16 },
        { id: 22, name: 'Timo L.', rolle: 'Trainee', position: 'trainee', gruppe: 'TR', parent_id: 8, quartalsziel: 0, sortierung: 17 },
        { id: 23, name: 'Carl S.', rolle: 'Trainee', position: 'trainee', gruppe: 'TR', parent_id: 8, quartalsziel: 0, sortierung: 18 },
        { id: 6, name: 'Aron Z.', rolle: 'Seniorberater', position: 'senior', gruppe: 'SN', parent_id: 3, quartalsziel: 0, sortierung: 19 },
        { id: 24, name: 'Linus A.', rolle: 'Trainee', position: 'trainee', gruppe: 'TR', parent_id: 6, quartalsziel: 0, sortierung: 20 },
        { id: 9, name: 'Tim G.', rolle: 'Juniorberater', position: 'junior', gruppe: 'RM', parent_id: 6, quartalsziel: 0, sortierung: 21 },
        { id: 25, name: 'Daniel F.', rolle: 'Trainee', position: 'trainee', gruppe: 'TR', parent_id: 9, quartalsziel: 0, sortierung: 22 },
        { id: 26, name: 'Jeremy G.', rolle: 'Trainee', position: 'trainee', gruppe: 'TR', parent_id: 9, quartalsziel: 0, sortierung: 23 },
        { id: 27, name: 'Hannes Ge.', rolle: 'Trainee', position: 'trainee', gruppe: 'TR', parent_id: 9, quartalsziel: 0, sortierung: 24 },
        { id: 28, name: 'Joe L.', rolle: 'Trainee', position: 'trainee', gruppe: 'TR', parent_id: 9, quartalsziel: 0, sortierung: 25 },
        { id: 29, name: 'Roman W.', rolle: 'Trainee', position: 'trainee', gruppe: 'TR', parent_id: 9, quartalsziel: 0, sortierung: 26 },
        { id: 7, name: 'Ruben Z.', rolle: 'Seniorberater', position: 'senior', gruppe: 'SN', parent_id: 3, quartalsziel: 0, sortierung: 27 },
        { id: 10, name: 'Franco P.', rolle: 'Juniorberater', position: 'junior', gruppe: 'RM', parent_id: 7, quartalsziel: 0, sortierung: 28 },
        { id: 30, name: 'Niklas F.', rolle: 'Trainee', position: 'trainee', gruppe: 'TR', parent_id: 10, quartalsziel: 0, sortierung: 29 },
        { id: 11, name: 'Alexander H.', rolle: 'Juniorberater', position: 'junior', gruppe: 'RM', parent_id: 10, quartalsziel: 0, sortierung: 30 },
        { id: 31, name: 'Nick A.', rolle: 'Trainee', position: 'trainee', gruppe: 'TR', parent_id: 11, quartalsziel: 0, sortierung: 31 },
        // Profiberaterin (fiktiv): eigene Version des Boards mit Geschäftsstand aus der Bereichsauswertung
        { id: 33, name: 'Clara B.', rolle: 'Senior Sales Consultant', position: 'ssc', karriereweg: 'profi', gruppe: 'SN', parent_id: 3, quartalsziel: 0, sortierung: 32 },
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
        { id: 36, bereich_id: 33, kunde: 'Familie Kern', monat: '2026-07', status: 'offen', ablehnungsgrund: null, potenzial: 150000, terminart: 'S2', erfasst_am: '2026-07-04', notiz: 'Altersvorsorge, Konzept steht', sortierung: 10 },
        { id: 37, bereich_id: 33, kunde: 'Herr Sander', monat: '2026-07', status: 'kunde', ablehnungsgrund: null, potenzial: 60000, terminart: 'S3', erfasst_am: '2026-06-22', notiz: '', sortierung: 20 },
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
        { id: 10, bereich_id: 33, name: 'Familie Kern', typ: 'interessent', prio: 'A', erfasst_am: '2026-06-28', notiz: 'Altersvorsorge', sortierung: 10 },
        { id: 11, bereich_id: 33, name: 'Praxis Dr. Lenz', typ: 'kunde', prio: 'A', erfasst_am: '2026-05-12', notiz: 'BU für das Praxisteam', sortierung: 20 },
      ],
      // Ziele 2026 — Monatswerte je Person (Jahresziel = Summe der 12 Monate)
      ziele: zieleSeed(),
      // Aktivitäten-Funnel je Person/Monat (Kontakte → S1 → S2 → S3 → Abschluss)
      aktivitaeten: [
        { id: 1, bereich_id: 3,  monat: '2026-07', kontakte: 40, s1: 14, s2: 9, s3: 6, abschluss: 4 },
        { id: 2, bereich_id: 4,  monat: '2026-07', kontakte: 55, s1: 20, s2: 12, s3: 8, abschluss: 5 },
        { id: 3, bereich_id: 5,  monat: '2026-07', kontakte: 48, s1: 16, s2: 10, s3: 7, abschluss: 4 },
        { id: 4, bereich_id: 6,  monat: '2026-07', kontakte: 30, s1: 9,  s2: 5, s3: 3, abschluss: 1 },
        { id: 5, bereich_id: 7,  monat: '2026-07', kontakte: 35, s1: 12, s2: 7, s3: 5, abschluss: 3 },
        { id: 6, bereich_id: 8,  monat: '2026-07', kontakte: 62, s1: 24, s2: 15, s3: 10, abschluss: 6 },
        { id: 7, bereich_id: 9,  monat: '2026-07', kontakte: 45, s1: 13, s2: 6, s3: 3, abschluss: 1 },
        { id: 8, bereich_id: 10, monat: '2026-07', kontakte: 28, s1: 10, s2: 6, s3: 4, abschluss: 2 },
        { id: 9, bereich_id: 12, monat: '2026-07', kontakte: 70, s1: 22, s2: 11, s3: 6, abschluss: 3 },
        { id: 10, bereich_id: 13, monat: '2026-07', kontakte: 65, s1: 18, s2: 8, s3: 4, abschluss: 2 },
        { id: 11, bereich_id: 16, monat: '2026-07', kontakte: 80, s1: 26, s2: 12, s3: 7, abschluss: 3 },
        { id: 12, bereich_id: 32, monat: '2026-07', kontakte: 25, s1: 12, s2: 9, s3: 7, abschluss: 5 },
        // Vormonat für den Monatsvergleich
        { id: 13, bereich_id: 3,  monat: '2026-06', kontakte: 35, s1: 12, s2: 7, s3: 5, abschluss: 3 },
        { id: 14, bereich_id: 4,  monat: '2026-06', kontakte: 50, s1: 17, s2: 10, s3: 6, abschluss: 4 },
        { id: 15, bereich_id: 8,  monat: '2026-06', kontakte: 58, s1: 21, s2: 13, s3: 9, abschluss: 5 },
        { id: 16, bereich_id: 33, monat: '2026-07', kontakte: 30, s1: 12, s2: 9, s3: 6, abschluss: 4 },
      ],
      // Volumenrechner — Beispielpositionen (Tarifnamen aus tarife.js)
      volumen: [
        { id: 1, bereich_id: 3, monat: '2026-07', kunde: 'Familie Berger', gesellschaft: 'Versicherer A (Demo)', tarif: 'Basisvorsorge laufender Beitrag', betrag: 150, jahre: 30, einmal: 0, satz: 0, sortierung: 10 },
        { id: 2, bereich_id: 3, monat: '2026-07', kunde: 'Dr. Krause', gesellschaft: 'Versicherer B (Demo)', tarif: 'Berufsunfähigkeit', betrag: 120, jahre: 35, einmal: 0, satz: 0, sortierung: 20 },
        { id: 3, bereich_id: 4, monat: '2026-07', kunde: 'Familie Ott', gesellschaft: 'Investment (Demo)', tarif: 'Fonds-Sparplan', betrag: 200, jahre: 10, einmal: 5000, satz: 0, sortierung: 10 },
        { id: 4, bereich_id: 4, monat: '2026-07', kunde: 'Sabine Lux', gesellschaft: 'Versicherer B (Demo)', tarif: 'Riester laufender Beitrag', betrag: 100, jahre: 30, einmal: 0, satz: 0, sortierung: 20 },
        { id: 5, bereich_id: 5, monat: '2026-07', kunde: 'Familie Brandt', gesellschaft: 'Versicherer A (Demo)', tarif: 'Privatvorsorge laufender Beitrag', betrag: 250, jahre: 35, einmal: 0, satz: 0, sortierung: 10 },
        { id: 6, bereich_id: 5, monat: '2026-07', kunde: 'Praxis Sonne', gesellschaft: 'Krankenversicherer (Demo)', tarif: 'Private Krankenversicherung', betrag: 480, jahre: 0, einmal: 0, satz: 0, sortierung: 20 },
        { id: 7, bereich_id: 6, monat: '2026-07', kunde: 'Autohaus Krüger', gesellschaft: 'Finanzierung (Demo)', tarif: 'Baufinanzierung Darlehenssumme', betrag: 320000, jahre: 0, einmal: 0, satz: 0, sortierung: 10 },
        { id: 8, bereich_id: 7, monat: '2026-07', kunde: 'Klein AG', gesellschaft: 'Versicherer B (Demo)', tarif: 'Berufsunfähigkeit', betrag: 180, jahre: 35, einmal: 0, satz: 0, sortierung: 10 },
        { id: 9, bereich_id: 8, monat: '2026-07', kunde: 'Bau Süd GmbH', gesellschaft: 'Versicherer A (Demo)', tarif: 'Basisvorsorge laufender Beitrag', betrag: 400, jahre: 30, einmal: 0, satz: 0, sortierung: 10 },
        { id: 10, bereich_id: 9, monat: '2026-07', kunde: 'Kita Sonnenschein', gesellschaft: 'Komposit (Demo)', tarif: 'Rechtsschutz', betrag: 45, jahre: 0, einmal: 0, satz: 0, sortierung: 10 },
        { id: 11, bereich_id: 12, monat: '2026-07', kunde: 'Familie Berger', gesellschaft: 'Versicherer A (Demo)', tarif: 'Risikoleben', betrag: 60, jahre: 30, einmal: 0, satz: 0, sortierung: 10 },
        { id: 12, bereich_id: 16, monat: '2026-07', kunde: 'Marco Diehl', gesellschaft: 'Finanzierung (Demo)', tarif: 'Bausparen Bausparsumme', betrag: 50000, jahre: 0, einmal: 0, satz: 0, sortierung: 10 },
        { id: 13, bereich_id: 32, monat: '2026-07', kunde: 'Familie Neumann', gesellschaft: 'Finanzierung (Demo)', tarif: 'Baufinanzierung Darlehenssumme', betrag: 450000, jahre: 0, einmal: 0, satz: 0, sortierung: 10 },
        { id: 14, bereich_id: 32, monat: '2026-07', kunde: 'Dr. Seifert', gesellschaft: 'Finanzierung (Demo)', tarif: 'Immobilienvermittlung', betrag: 380000, jahre: 0, einmal: 0, satz: 7, sortierung: 20 },
      ],
      // Monatsplanung: was je Person im Monat eingereicht werden soll (Volumen €)
      planpositionen: planSeed(),
      // Kennzahlen aus der Bereichsauswertung (Profiberater) — gleich beispiele/geschaeftsstand-muster.json
      kennzahlen: [{ id: 1, bereich_id: 33, stand: '2026-10-02', monat: '2026-09', quelle: 'Datei', daten: MUSTER_KENNZAHLEN }],
    };
  }
  function planSeed() {
    const P = (bereich_id, monat, kunde, sparte, betrag, status, notiz) => ({ bereich_id, monat, kunde, sparte, betrag, status, notiz: notiz || '' });
    const rows = [
      // ── Juli 2026 ──
      P(3, '2026-07', 'Familie Berger', 'Altersvorsorge / AV-Depot', 25000, 'eingereicht'),
      P(3, '2026-07', 'Empfehlung Weber', 'Sachversicherung', 8000, 'policiert'),
      P(3, '2026-07', 'Familie Steiner', 'Baufinanzierung', 30000, 'geplant', 'Termin 24.07.'),
      P(4, '2026-07', 'Familie Ott', 'Investment / Depot', 30000, 'verguetet'),
      P(4, '2026-07', 'Marc Lehner', 'Altersvorsorge / AV-Depot', 15000, 'eingereicht'),
      P(4, '2026-07', 'Sabine Lux', 'Berufsunfähigkeit / Arbeitskraft', 12000, 'geplant'),
      P(5, '2026-07', 'Familie Brandt', 'Altersvorsorge / AV-Depot', 35000, 'eingereicht'),
      P(5, '2026-07', 'Praxis Sonne', 'Krankenversicherung', 9000, 'geplant'),
      P(8, '2026-07', 'Bau Süd GmbH', 'Sachversicherung', 18000, 'policiert'),
      P(8, '2026-07', 'Familie Winter', 'Bausparen', 6000, 'entfallen', 'hat schon ETF'),
      P(12, '2026-07', 'Familie Berger', 'Berufsunfähigkeit / Arbeitskraft', 4000, 'eingereicht'),
      P(16, '2026-07', 'Marco Diehl', 'Bausparen', 7000, 'geplant'),
      P(32, '2026-07', 'Familie Neumann', 'Baufinanzierung', 45000, 'eingereicht'),
      P(32, '2026-07', 'Dr. Seifert', 'Immobilienvermittlung', 26600, 'geplant'),
      P(33, '2026-07', 'Familie Hoff', 'Altersvorsorge / AV-Depot', 140000, 'verguetet'),
      P(33, '2026-07', 'Praxis Dr. Lenz', 'Berufsunfähigkeit / Arbeitskraft', 99800, 'verguetet'),
      // ── Juni 2026: noch offen → „aus Vormonat übernehmen“ ──
      P(4, '2026-06', 'Tina Vogt', 'Krankenversicherung', 6000, 'geplant'),
      P(5, '2026-06', 'Klein AG', 'Sachversicherung', 9000, 'geplant'),
      // ── Oktober 2026: Profiberaterin, Abgleich mit dem Geschäftsstand ──
      P(33, '2026-10', 'Familie Kern', 'Altersvorsorge / AV-Depot', 150000, 'eingereicht'),
      P(33, '2026-10', 'Herr Sander', 'Investment / Depot', 60000, 'policiert'),
      P(33, '2026-10', 'Praxis Dr. Lenz', 'Berufsunfähigkeit / Arbeitskraft', 90000, 'geplant', 'zweite Ärztin'),
      P(33, '2026-10', 'Familie Roth', 'Sachversicherung', 20000, 'geplant'),
    ];
    return rows.map((r, i) => ({ id: i + 1, sortierung: (i + 1) * 10, ...r }));
  }
  // Monatsziele generieren: gleichmäßig aufs Jahr, je Rolle unterschiedlich hoch
  function zieleSeed() {
    const proMonat = {   // bereich_id: Monatsziel €
      32: 60000,  // Florian W. (Inhaber)
      3: 50000, 2: 20000, 1: 15000,             // Management
      4: 40000, 5: 40000, 6: 30000, 7: 30000,   // Seniorberater
      8: 25000, 9: 20000, 10: 20000, 11: 12000, // Juniorberater
      12: 8000, 13: 8000, 14: 10000, 15: 10000, // Trainees/Assistenten Max
      16: 8000, 17: 8000, 18: 8000, 19: 10000,  // Team Agon
      20: 10000, 21: 8000, 22: 8000, 23: 8000,  // Team Lennart / Tom
      24: 8000, 25: 8000, 26: 8000, 27: 8000, 28: 8000, 29: 8000,
      30: 8000, 31: 6000,
      33: 300000, // Clara B. (Profiberaterin, Volumen)
    };
    const out = []; let id = 1;
    for (const [bid, wert] of Object.entries(proMonat))
      for (let m = 1; m <= 12; m++) out.push({ id: id++, bereich_id: Number(bid), jahr: 2026, monat: m, wert });
    return out;
  }
  const DEFAULTS = {
    bereiche: { rolle: '', gruppe: 'SN', parent_id: null, position: null, karriereweg: null, partnernummer: null, email: null, quartalsziel: 0, sortierung: 0 },
    sub_leiter: { sortierung: 0 },
    eintraege: { kunde: null, monat: null, status: 'offen', ablehnungsgrund: null, potenzial: 0, terminart: null, notiz: null, erfasst_am: null, sortierung: 0 },
    avdepot: { kunde: null, status: 'offen', notiz: null, erfasst_am: null, sortierung: 0 },
    kpue: { name: null, typ: 'potenzial', prio: 'B', notiz: null, erfasst_am: null, sortierung: 0 },
    ziele: { jahr: 2026, monat: 1, wert: 0 },
    volumen: { monat: null, kunde: null, gesellschaft: null, tarif: null, betrag: 0, jahre: 0, einmal: 0, satz: 0, sortierung: 0 },
    aktivitaeten: { monat: null, kontakte: 0, s1: 0, s2: 0, s3: 0, abschluss: 0 },
    planpositionen: { monat: null, kunde: null, sparte: null, betrag: 0, status: 'geplant', notiz: null, sortierung: 0 },
    kennzahlen: { stand: null, monat: null, quelle: null, daten: null },
  };

  function load() {
    if (store) return;
    const raw = globalThis.localStorage && localStorage.getItem(KEY);
    store = raw ? JSON.parse(raw) : seed();
    for (const [t, rows] of Object.entries(seed())) if (!store[t]) store[t] = rows;   // neue Tabellen in alten Ständen ergänzen
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
      const rows = store[this.t] || (store[this.t] = []);
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
      async rpc() { return { data: null, error: null }; },   // Profil-Verknüpfung gibt es nur live
      channel() { const ch = { on() { return ch; }, subscribe() { return ch; } }; return ch; },
      removeChannel() { },
    };
  }

  return { client, seed, reset() { store = seed(); save(); } };
})();
