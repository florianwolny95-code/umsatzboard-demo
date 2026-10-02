# Umsatzboard Web — Einrichtung

Statische Web-App (kein Build). Login + Daten über **Supabase** (kostenlos).
Sensible Daten (Kundennamen, Umsätze) → **Region EU wählen** (DSGVO).

## 0. Lokal testen ohne alles (Demo-Modus)
Solange `config.js` keine echten Supabase-Daten hat, läuft die App im **Demo-Modus**:
kein Login, keine Cloud, fiktive Beispieldaten im Browser (localStorage). Ideal, um sie
Kollegen/Nutzern zu zeigen.

```
npx serve -l 4599 .        # im Ordner umsatzboard-web/  (Node nötig)
```
Dann `http://localhost:4599` öffnen. Alle Funktionen sind klickbar; Änderungen bleiben
lokal im Browser gespeichert. **Demo zurücksetzen:** Browser-Konsole → `DemoDB.reset()` und neu laden,
oder Website-Daten löschen. Sobald echte Supabase-Daten in `config.js` stehen, schaltet die App
automatisch auf echten Betrieb (Schritte 1–4).

---

## 1. Supabase-Projekt anlegen (einmalig, ~5 min)
1. Auf **supabase.com** einloggen → **New project**.
2. Region: **Central EU (Frankfurt)**. Datenbank-Passwort vergeben & merken.
3. Projekt öffnen → **SQL Editor** → **New query** → Inhalt von `schema.sql` einfügen → **Run**.
   (Legt Tabellen, Rechte, Datentrennung je Partner, Live-Updates und Platzhalter-Bereiche an.)

## 2. Zugangsdaten eintragen
Projekt → **Project Settings → API**. Zwei Werte kopieren:
- **Project URL** → in `config.js` bei `url`
- **anon public** Key → in `config.js` bei `anonKey`

(Der anon-Key darf öffentlich im Frontend stehen — die Daten sind durch Login + RLS geschützt.)

## 3. Team-Accounts anlegen
Kein offenes Registrieren. Nutzer legst du selbst an:
Projekt → **Authentication → Users → Add user** → E-Mail + Passwort → *Auto Confirm User* an.
Für jeden Berater eine Zeile. Passwörter danach an die Leute geben (die können sie später in der App unter
**„Passwort ändern"** selbst ändern, oder per **„Passwort vergessen?"** zurücksetzen).

> „Passwort vergessen" verschickt eine E-Mail. Supabases eingebauter Mailversand reicht zum Start
> (wenige Mails/Std.); für zuverlässigen Betrieb später unter *Authentication → Emails* eigenes SMTP hinterlegen.

## 4. Online stellen
Den Ordner `umsatzboard-web/` wie die Website deployen (git push = live, eigener Pfad/Subdomain).
Fertig — Team öffnet die URL, loggt sich ein.

## 5. Bestandsdaten übernehmen (optional)
In der App unten links **„⇪ Excel importieren"** → `Umsatzboard_v9_teams.xlsx` wählen.
Liest alle Bereichs-Tabs (Sub-Leiter + Kundenzeilen) 1:1 ein. Kann jederzeit erneut laufen
(ersetzt die Daten der gefundenen Bereiche).

---

## Rollen und Zugang je Partner
- **Admin** (du): sieht alle Personen, alle Auswertungen, Recycling gesamt.
- **Führungskraft (FK)**: sieht sich selbst und den eigenen Unterbau (alle Ebenen darunter), kann dort
  Personen anlegen, umhängen und löschen. Sich selbst kann eine FK nicht umhängen oder löschen.
- **Profiberater**: wie FK, nur ohne Team. Die App erkennt das an der Position (z. B. Senior Sales
  Consultant) bzw. am Karriereweg „profi“ und zeigt statt Controlling „🏁 Mein Geschäftsstand“.
- Die Trennung gilt **in der Datenbank** (Row Level Security in `schema.sql`), nicht nur in der Oberfläche:
  wer nicht Admin ist, bekommt fremde Zeilen gar nicht erst geliefert.
- Zuordnung im **Demo-Modus**: oben links Umschalter „Ansicht als“ (Admin / Führungskraft / Profiberater), nur zum Zeigen.
- Zuordnung **live**:
  - **Admin**: nach dem User-Anlegen (Schritt 3) eine Zeile in `profiles` eintragen
    (Supabase → Table Editor → profiles): `user_id` (aus Authentication kopieren), `role` = `admin`.
  - **Partner**: E-Mail der Person im Board hinterlegen (Organigramm-Import oder Spalte „E-Mail (Login)“ unter
    „👥 Struktur & Import“), dann in Supabase einen User mit **derselben E-Mail** anlegen (*Auto Confirm User* an).
    Beim ersten Login legt `ub_profil_verknuepfen()` das Profil selbst an. Von Hand geht weiterhin:
    `role` = `fk`, `bereich_id` = die eigene Zeile aus `bereiche`.
  - Profile ändert nur der Admin im Dashboard; aus der App heraus kann niemand seine Rolle ändern.

> **Update bestehender Installationen:** `schema.sql` einfach erneut im SQL-Editor ausführen. Es legt die
> neuen Tabellen und Spalten an, ersetzt die alte Regel „jeder eingeloggte User darf alles“ durch die
> Datentrennung und lässt vorhandene Daten stehen. Danach braucht **jeder** Nutzer eine Zeile in `profiles`
> (bzw. eine E-Mail im Board), sonst sieht er nichts.

## Bedienung
- **📊 Controlling**: Kennzahlen je FK für den gewählten Monat — Interessenten, Kunden, **Abschlussquote**,
  Umsatz (Kunde), **gewichtete Pipeline** (Potenzial × Wahrscheinlichkeit je Stufe). Klick auf FK = Drilldown.
- **🗓 Monatsauswertung**: alle Interessenten des Monats mit Status. Monat per ◀ ▶ wechseln — so siehst du,
  wer im Vormonat **nicht** Kunde wurde. Status je Zeile: **Offen / Kunde / Abgelehnt**.
- **♻ Recycling**: alle Abgelehnten mit Ablehnungsgrund (Dropdown). „↺ Reaktivieren" holt sie in den
  aktuellen Monat zurück. Oben: häufigster Grund + Potenzial-Summe.
- **FK-Bereich**: Interessenten des Monats pflegen. „+ Interessent", „+ Berater", Terminart als Dropdown
  (S1/S2/S3/Service/AEC/TzT/Recruiting + frei). Status „Abgelehnt" blendet das Grund-Feld ein → Recycling.
  Berater-Band **Doppelklick** = umbenennen/löschen. Alles Autosave, live.
- **📅 Monatsplanung**: was im Monat eingereicht werden soll, je Kunde mit Sparte, Volumen und Stand
  (○ Geplant → ◔ Eingereicht → ◑ Policiert → ✓ Vergütet, oder ✕ Entfallen). Ab „Eingereicht“ zählt die
  Position auf das Monatsziel (aus „🎯 Ziele & Planung“, direkt in der Monatsplanung änderbar).
  - **Führungskraft**: Übersicht über das ganze Team (Ziel, geplant, eingereicht, Abstand, Mix nach Sparte),
    Klick auf eine Person öffnet deren Planung. In jedem Personen-Bereich gibt es den Reiter „📅 Monatsplanung“.
  - **Profiberater**: direkt die eigene Planung. „↪ offene aus Vormonat übernehmen“ holt nicht Eingereichtes nach.
  - Die Sparten sind dieselben wie unter `/planung` in der Beratungssuite.

## Profiberater: Geschäftsstand und Berichte
„🏁 Mein Geschäftsstand“ zeigt, was die **Bereichsauswertung Profiberater** (Skill
`prozess-profiberater-bereichsauswertung`) für den Partner ermittelt hat, und stellt es neben die Monatsplanung:
Ampeln, Weg zur nächsten Stufe (rollierendes abgerechnetes Netto-Eigenvolumen, was herausfällt, was im
nächsten Monat nötig ist, nötiges Tempo bis zum Zielmonat, Ausblick), Abgleich mit der Planung, Produktion,
hängende Provision, Aufgaben.
- **Daten kommen** als Kennzahlen-Datei (JSON, Format `wolny-geschaeftsstand`, Version 1) per „⇪ Kennzahlen-Datei
  laden“, oder von Hand („✎ Von Hand eintragen“). Beispiel: `beispiele/geschaeftsstand-muster.json`.
  Die Datei enthält **keine Kundennamen**, nur Zahlen, Ampeln und Aufgaben.
- **Bericht öffnen**: steht in der Datei `bericht.url` (nur https), verlinkt der Knopf „📄 Bericht öffnen“ den
  PDF-Bericht. Ohne Link führt er zur Berichte-Übersicht der Beratungssuite, wenn in `config.js`
  `window.BERICHTE_URL = 'https://…/berichte';` steht.
- Die Stufengrenze im Beispiel ist ein Platzhalter (wie in `positionen.js`). Echte Grenzen und Promille
  gehören nicht in dieses öffentliche Repo.

## Struktur & Organigramm-Import (Führungskräfte)
„👥 Struktur & Import“ zeigt die eigene Struktur (Partnernummer und Login-E-Mail direkt änderbar) und legt
viele Partner auf einmal an:
1. Organigramm aus dem CRM als **Excel oder CSV** exportieren, über „⇪ Datei wählen“ laden, oder die
   Struktur als Text einfügen (Tabelle aus Excel kopieren, oder eingerückte Liste „Name (Position)“).
2. Festlegen, unter wem die oberste Zeile hängt (FK: nur im eigenen Unterbau).
3. Vorschau prüfen (neu / aktualisieren / schon vorhanden / übersprungen, mit Hinweisen), dann übernehmen.

Erkannt werden u. a. die Spalten *Partnernummer / VP-Nr.*, *Name* bzw. *Vorname + Nachname*, *Position / Stufe*,
*FK-Partnernummer* oder *Führungskraft* (Name), *Ebene*, *E-Mail*, *Status*; Kopfzeile darf tiefer stehen
(Titelzeilen davor sind egal). Abgleich mit Bestehenden über Partnernummer, sonst Name. Ausgeschiedene
werden übersprungen, Kreisbezüge abgewiesen. „Vorlage herunterladen“ liefert ein Beispiel.
> ⚠️ Das Format eines echten CRM-Organigramm-Exports ist noch **nicht an einer echten Datei geprüft**.
> Wenn eine Spalte nicht erkannt wird, zeigt die Vorschau das an; dann Spaltenkopf anpassen oder
> den Synonymen in `organigramm.js` (`SPALTEN`) ergänzen.

## Tests
```
node --test                                         # Rechenlogik Monatsplanung/Geschäftsstand, Organigramm-Import
PSQL="psql -h localhost -U postgres" tests/rls/pruefen.sh   # Datentrennung je Partner (lokale Wegwerf-Postgres)
```

## Dateien
| Datei | Zweck |
|-------|-------|
| `index.html` | App-Gerüst (Login + Board) |
| `style.css` | Wolny-Design (Ink/Teal/Gold) |
| `app.js` | Logik (Rollen, Controlling, Monat, Recycling, Monatsplanung, Geschäftsstand, Struktur, Autosave, Live, Im-/Export) |
| `planung.js` | Rechenlogik Monatsplanung und Weg zur nächsten Stufe (ohne DOM, getestet) |
| `organigramm.js` | Organigramm-Import: Spalten erkennen, Hierarchie bauen, Abgleich mit Bestand (ohne DOM, getestet) |
| `beispiele/geschaeftsstand-muster.json` | Beispiel einer Kennzahlen-Datei aus der Bereichsauswertung (Platzhalterwerte) |
| `demo.js` | Demo-Modus (localStorage-Beispieldaten, wenn keine Supabase-Daten) |
| `config.js` | **deine** Supabase-URL + Key |
| `schema.sql` | in Supabase ausführen (Tabellen, `profiles`, Datentrennung je Partner); darf erneut laufen |
| `tests/` | `node --test` (Logik) und `tests/rls/pruefen.sh` (Datentrennung) |

---
*Wolny Finanzberatung · finanzierungmitflori.com*
