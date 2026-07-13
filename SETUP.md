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
   (Legt Tabellen, Rechte, Live-Updates und die 10 Bereiche an.)

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

## Rollen (Admin / Führungskraft)
- **Admin** (du): sieht alle FKs, alle Auswertungen, Recycling gesamt.
- **Führungskraft (FK)**: sieht nur den eigenen Bereich + eigenes Team.
- Zuordnung im **Demo-Modus**: oben links Umschalter „Ansicht als" (Admin / FK …) — nur zum Zeigen.
- Zuordnung **live**: nach dem User-Anlegen (Schritt 3) eine Zeile in Tabelle `profiles` eintragen
  (Supabase → Table Editor → profiles): `user_id` (aus Authentication kopieren), `role` = `admin` oder `fk`,
  bei FK zusätzlich `bereich_id` (ihre Führungskraft-Zeile aus `bereiche`).

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

## Dateien
| Datei | Zweck |
|-------|-------|
| `index.html` | App-Gerüst (Login + Board) |
| `style.css` | Wolny-Design (Ink/Teal/Gold) |
| `app.js` | Logik (Rollen, Controlling, Monat, Recycling, Autosave, Live, Im-/Export) |
| `demo.js` | Demo-Modus (localStorage-Beispieldaten, wenn keine Supabase-Daten) |
| `config.js` | **deine** Supabase-URL + Key |
| `schema.sql` | einmalig in Supabase ausführen (Tabellen inkl. `profiles` für Rollen) |
