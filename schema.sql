-- Umsatzboard Web — Supabase Schema
-- Einmalig im Supabase SQL-Editor ausführen (Projekt → SQL Editor → New query → Run).

-- ── Tabellen ────────────────────────────────────────────────────────────────
create table if not exists bereiche (
  id           bigint generated always as identity primary key,
  name         text not null unique,
  gruppe       text not null check (gruppe in ('SN','RM','MZ','TR')),  -- Farb-Tier (Mgmt/Senior/Junior/Trainee)
  rolle        text,          -- Klartext-Rolle (Anzeige)
  position     text,          -- Schlüssel aus dem Positionskatalog (Anlage 5), z.B. 'senior', 'branch'
  karriereweg  text,          -- 'fuehrung' | 'profi' — Weg nach der Berater-Ebene
  parent_id    bigint references bereiche(id) on delete set null,  -- übergeordnete FK (Hierarchie)
  quartalsziel numeric not null default 0,
  sortierung   int not null default 0
);

create table if not exists sub_leiter (
  id         bigint generated always as identity primary key,
  bereich_id bigint not null references bereiche(id) on delete cascade,
  name       text not null,
  sortierung int not null default 0
);

create table if not exists eintraege (
  id            bigint generated always as identity primary key,
  bereich_id    bigint not null references bereiche(id) on delete cascade,
  sub_leiter_id bigint references sub_leiter(id) on delete set null,
  kunde         text,
  monat         text,          -- 'YYYY-MM' — Monat der Auswertung
  status        text not null default 'offen',   -- offen / kunde / abgelehnt
  ablehnungsgrund text,        -- bei status=abgelehnt (→ Recycling)
  erfasst_am    date,          -- seit wann auf der Liste (Lead-Alter)
  potenzial     numeric not null default 0,
  datum         text,          -- Freitext (Excel enthält "offen", "01.02." etc.)
  terminart     text,          -- S1/S2/S3/Service/AEC/TzT/Recruiting oder frei
  notiz         text,
  sortierung    int not null default 0,
  updated_at    timestamptz not null default now(),
  updated_by    uuid references auth.users(id)
);

create index if not exists eintraege_bereich_idx on eintraege(bereich_id, sortierung);
create index if not exists subleiter_bereich_idx on sub_leiter(bereich_id, sortierung);

-- Termine (echtes Datum → Sortierung, vergangene ausgegraut)
create table if not exists termine (
  id         bigint generated always as identity primary key,
  datum      date,
  berater    text,
  kunde      text,
  terminart  text,
  potenzial  numeric not null default 0,
  notiz      text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
create index if not exists termine_datum_idx on termine(datum);

-- Monatsverlauf (Plan vs. Ist pro Monat, teamweit)
create table if not exists monatswerte (
  id         bigint generated always as identity primary key,
  monat      text not null unique,   -- 'YYYY-MM'
  plan       numeric not null default 0,
  ist        numeric not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

-- Kampagne „Privates Altersvorsorgedepot" — eigene Kandidatenliste je Person
create table if not exists avdepot (
  id         bigint generated always as identity primary key,
  bereich_id bigint not null references bereiche(id) on delete cascade,
  kunde      text,
  status     text not null default 'offen',   -- offen / angesprochen / eroeffnet / kein_interesse
  notiz      text,
  erfasst_am date,
  sortierung int not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
create index if not exists avdepot_bereich_idx on avdepot(bereich_id, sortierung);

-- 30er-Liste / KPÜ — Kundenpotenzialübersicht je Person
create table if not exists kpue (
  id         bigint generated always as identity primary key,
  bereich_id bigint not null references bereiche(id) on delete cascade,
  name       text,
  typ        text not null default 'potenzial',   -- potenzial / interessent / kunde
  prio       text not null default 'B',           -- A / B / C
  notiz      text,
  erfasst_am date,
  sortierung int not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
create index if not exists kpue_bereich_idx on kpue(bereich_id, sortierung);

-- Ziele: Monatsziel je Person; Jahresziel = Summe der 12 Monate
create table if not exists ziele (
  id         bigint generated always as identity primary key,
  bereich_id bigint not null references bereiche(id) on delete cascade,
  jahr       int not null,
  monat      int not null check (monat between 1 and 12),
  wert       numeric not null default 0,   -- Zielwert in € (später: Volumen/Bewertungssumme)
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  unique (bereich_id, jahr, monat)
);
create index if not exists ziele_idx on ziele(jahr, monat);

-- Volumenrechner: Positionen nach Systematik der tecis Anlage 4
-- (Die Volumenfaktoren selbst stehen NICHT hier, sondern in tarife.local.js — vertraulich.)
create table if not exists volumen (
  id         bigint generated always as identity primary key,
  bereich_id bigint not null references bereiche(id) on delete cascade,
  monat      text,            -- 'YYYY-MM'
  kunde      text,
  tarif      text,            -- Name aus dem Tarifkatalog
  betrag     numeric not null default 0,   -- Monatsbeitrag / Summe / Kaufpreis (je Formeltyp)
  jahre      numeric not null default 0,   -- BZD bzw. Spardauer
  einmal     numeric not null default 0,   -- Einmalanlage (Kombianlage)
  satz       numeric not null default 0,   -- Provisionssatz % (Immobilienvermittlung)
  sortierung int not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
create index if not exists volumen_bereich_idx on volumen(bereich_id, sortierung);

-- Rollen/Zuordnung: welcher User ist Admin, welche FK gehört ihm
-- (Zeilen legst du im Supabase-Dashboard an: Authentication → User anlegen, dann hier eintragen.)
create table if not exists profiles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  role       text not null default 'fk',      -- 'admin' | 'fk'
  bereich_id bigint references bereiche(id) on delete set null,  -- Bereich der FK (null bei admin)
  name       text
);
alter table profiles enable row level security;
drop policy if exists profiles_read on profiles;
create policy profiles_read on profiles for select to authenticated using (true);
-- Schreiben nur die eigene Zeile; Rollen-Vergabe macht der Admin im Dashboard.
drop policy if exists profiles_self on profiles;
create policy profiles_self on profiles for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Row Level Security: jeder eingeloggte Team-User darf alles ───────────────
-- (Interne App, keine offene Registrierung → volles Lese-/Schreibrecht.)
-- ponytail: Datentabellen team-weit offen; FK-Beschränkung im Frontend. Echte
-- pro-FK-RLS erst wenn nötig (Berater-Logins) — dann policy je bereich_id via profiles.
alter table bereiche    enable row level security;
alter table sub_leiter  enable row level security;
alter table eintraege   enable row level security;
alter table termine     enable row level security;
alter table monatswerte enable row level security;
alter table avdepot     enable row level security;
alter table kpue        enable row level security;
alter table ziele       enable row level security;
alter table volumen     enable row level security;

do $$
declare t text;
begin
  foreach t in array array['bereiche','sub_leiter','eintraege','termine','monatswerte','avdepot','kpue','ziele','volumen'] loop
    execute format('drop policy if exists team_all on %I', t);
    execute format(
      'create policy team_all on %I for all to authenticated using (true) with check (true)', t);
  end loop;
end$$;

-- ── Realtime (Live-Updates zwischen Nutzern) ────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['bereiche','sub_leiter','eintraege','termine','monatswerte','avdepot','kpue','ziele','volumen'] loop
    begin
      execute format('alter publication supabase_realtime add table %I', t);
    exception when duplicate_object then null;   -- schon drin → ignorieren
    end;
  end loop;
end$$;

-- ── Seed: Platzhalter-Führungskräfte, Hierarchie wie im echten Org (Namen bitte anpassen) ──
-- Erst die oberste Ebene ohne parent, dann Stufe für Stufe (parent_id braucht die id der Zeile davor).
insert into bereiche (name, rolle, gruppe, parent_id, quartalsziel, sortierung) values
  ('Florian Wolny', 'Inhaber · Finanzierung', 'MZ', null, 0, 0)
on conflict (name) do nothing;
insert into bereiche (name, rolle, gruppe, parent_id, quartalsziel, sortierung) values
  ('FK Region 1', 'Regional Manager', 'MZ', null, 0, 1)
on conflict (name) do nothing;
insert into bereiche (name, rolle, gruppe, parent_id, quartalsziel, sortierung) values
  ('FK Niederlassung 1', 'Branch Manager', 'MZ', (select id from bereiche where name = 'FK Region 1'), 0, 2)
on conflict (name) do nothing;
insert into bereiche (name, rolle, gruppe, parent_id, quartalsziel, sortierung) values
  ('FK Repräsentanz 1', 'Repräsentanzleiter', 'MZ', (select id from bereiche where name = 'FK Niederlassung 1'), 0, 3)
on conflict (name) do nothing;
insert into bereiche (name, rolle, gruppe, parent_id, quartalsziel, sortierung) values
  ('FK Team A', 'Seniorberater', 'SN', (select id from bereiche where name = 'FK Repräsentanz 1'), 0, 4),
  ('FK Team B', 'Seniorberater', 'SN', (select id from bereiche where name = 'FK Repräsentanz 1'), 0, 5),
  ('FK Team C', 'Seniorberater', 'SN', (select id from bereiche where name = 'FK Repräsentanz 1'), 0, 6),
  ('FK Team D', 'Seniorberater', 'SN', (select id from bereiche where name = 'FK Repräsentanz 1'), 0, 7)
on conflict (name) do nothing;
insert into bereiche (name, rolle, gruppe, parent_id, quartalsziel, sortierung) values
  ('FK Team B1', 'Juniorberater', 'RM', (select id from bereiche where name = 'FK Team B'), 0, 8),
  ('FK Team C1', 'Juniorberater', 'RM', (select id from bereiche where name = 'FK Team C'), 0, 9),
  ('FK Team D1', 'Juniorberater', 'RM', (select id from bereiche where name = 'FK Team D'), 0, 10)
on conflict (name) do nothing;
insert into bereiche (name, rolle, gruppe, parent_id, quartalsziel, sortierung) values
  ('FK Team D1a', 'Juniorberater', 'RM', (select id from bereiche where name = 'FK Team D1'), 0, 11)
on conflict (name) do nothing;
