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
  partnernummer text,         -- tecis-Partnernummer (Organigramm-Import gleicht darüber ab)
  email        text,          -- Login-E-Mail des Partners → „Zugang je Partner“
  quartalsziel numeric not null default 0,
  sortierung   int not null default 0
);
-- Bestehende Installationen: neue Spalten nachziehen (schema.sql darf erneut laufen)
alter table bereiche add column if not exists position text;
alter table bereiche add column if not exists karriereweg text;
alter table bereiche add column if not exists partnernummer text;
alter table bereiche add column if not exists email text;
create unique index if not exists bereiche_partnernummer_uq on bereiche(partnernummer) where partnernummer is not null;
create unique index if not exists bereiche_email_uq on bereiche(lower(email)) where email is not null;

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
  gesellschaft text,          -- Produktpartner aus dem Tarifkatalog
  tarif      text,            -- Tarifname innerhalb dieser Gesellschaft
  betrag     numeric not null default 0,   -- Monatsbeitrag / Summe / Kaufpreis (je Formeltyp)
  jahre      numeric not null default 0,   -- BZD bzw. Spardauer
  einmal     numeric not null default 0,   -- Einmalanlage (Kombianlage)
  satz       numeric not null default 0,   -- Provisionssatz % (Immobilienvermittlung)
  sortierung int not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
create index if not exists volumen_bereich_idx on volumen(bereich_id, sortierung);

-- Aktivitäten-Funnel: Vorlaufkennzahlen je Person und Monat
create table if not exists aktivitaeten (
  id         bigint generated always as identity primary key,
  bereich_id bigint not null references bereiche(id) on delete cascade,
  monat      text not null,                  -- 'YYYY-MM'
  kontakte   int not null default 0,         -- Ansprachen / Erstkontakte
  s1         int not null default 0,         -- Erstgespräch
  s2         int not null default 0,         -- Konzeptpräsentation
  s3         int not null default 0,         -- Abschlussgespräch
  abschluss  int not null default 0,         -- Abschlüsse
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  unique (bereich_id, monat)
);
create index if not exists aktivitaeten_idx on aktivitaeten(monat);

-- Monatsplanung: was im Monat eingereicht werden soll (Kunde, Sparte, Volumen, Stand)
-- Ab „eingereicht“ zählt die Position auf das Monatsziel aus `ziele`.
create table if not exists planpositionen (
  id         bigint generated always as identity primary key,
  bereich_id bigint not null references bereiche(id) on delete cascade,
  monat      text not null,            -- 'YYYY-MM'
  kunde      text,
  sparte     text,                     -- Sparten wie /planung in der Beratungssuite
  betrag     numeric not null default 0,
  status     text not null default 'geplant'
             check (status in ('geplant','eingereicht','policiert','verguetet','entfallen')),
  notiz      text,
  sortierung int not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
create index if not exists planpositionen_idx on planpositionen(bereich_id, monat);

-- Geschäftsstand der Profiberater: Kennzahlen aus der Bereichsauswertung
-- (Format „wolny-geschaeftsstand“, Beispiel in beispiele/geschaeftsstand-muster.json)
create table if not exists kennzahlen (
  id         bigint generated always as identity primary key,
  bereich_id bigint not null references bereiche(id) on delete cascade,
  stand      date not null,
  monat      text,                     -- Auswertungsmonat 'YYYY-MM'
  quelle     text,                     -- 'datei' | 'hand'
  daten      jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  unique (bereich_id, stand)
);

-- Rollen/Zuordnung: welcher User ist Admin, welche Person im Board gehört ihm
-- (Admin: Zeile im Supabase-Dashboard anlegen. Partner mit E-Mail im Organigramm
--  bekommen ihr Profil beim ersten Login automatisch, siehe ub_profil_verknuepfen.)
create table if not exists profiles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  role       text not null default 'fk',      -- 'admin' | 'fk'
  bereich_id bigint references bereiche(id) on delete set null,  -- eigene Person im Board (null bei admin)
  name       text
);

-- ── Row Level Security: Datentrennung je Partner ────────────────────────────
-- Admin sieht alles. Alle anderen sehen nur die eigene Person und ihren Unterbau
-- (über bereiche.parent_id). Ein Profiberater ohne Team sieht damit nur sich selbst.
-- Die Funktionen laufen als security definer, damit die Prüfung nicht selbst an RLS hängt.
create or replace function ub_ist_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where user_id = auth.uid() and role = 'admin');
$$;

create or replace function ub_eigener_bereich() returns bigint
language sql stable security definer set search_path = public as $$
  select bereich_id from profiles where user_id = auth.uid();
$$;

create or replace function ub_eigene_fk() returns bigint
language sql stable security definer set search_path = public as $$
  select b.parent_id from bereiche b join profiles p on p.bereich_id = b.id where p.user_id = auth.uid();
$$;

create or replace function ub_sichtbare_bereiche() returns setof bigint
language sql stable security definer set search_path = public as $$
  with recursive baum(id) as (
    select id from bereiche where ub_ist_admin() or id = ub_eigener_bereich()
    union                                   -- union (nicht union all): bricht bei Kreisbezug ab
    select b.id from bereiche b join baum on b.parent_id = baum.id
  )
  select id from baum;
$$;

-- Kein Kreisbezug in der Hierarchie (z. B. durch einen Import, der jemanden unter seinen eigenen Unterbau hängt)
create or replace function ub_kein_zyklus() returns trigger
language plpgsql security definer set search_path = public as $$
declare p bigint := new.parent_id; schritte int := 0;
begin
  while p is not null loop
    if p = new.id then raise exception 'Kreisbezug: % kann nicht unter dem eigenen Unterbau hängen', new.name; end if;
    select parent_id into p from bereiche where id = p;
    schritte := schritte + 1;
    if schritte > 100 then raise exception 'Hierarchie zu tief oder Kreisbezug'; end if;
  end loop;
  return new;
end$$;
drop trigger if exists bereiche_kein_zyklus on bereiche;
create trigger bereiche_kein_zyklus before insert or update of parent_id on bereiche
  for each row execute function ub_kein_zyklus();

-- Erster Login eines Partners: Profil über die E-Mail aus dem Organigramm anlegen.
-- Nur bei bestätigter E-Mail und nur, wenn die E-Mail genau einer Person im Board gehört.
create or replace function ub_profil_verknuepfen() returns setof profiles
language plpgsql security definer set search_path = public, auth as $$
declare mail text; bid bigint; bname text;
begin
  if auth.uid() is null then return; end if;
  if exists (select 1 from profiles where user_id = auth.uid()) then
    return query select * from profiles where user_id = auth.uid(); return;
  end if;
  select lower(u.email) into mail from auth.users u where u.id = auth.uid() and u.email_confirmed_at is not null;
  if mail is null then return; end if;
  select b.id, b.name into bid, bname from bereiche b where lower(b.email) = mail;
  if bid is null then return; end if;
  return query insert into profiles (user_id, role, bereich_id, name)
    values (auth.uid(), 'fk', bid, bname) returning *;
end$$;
revoke all on function ub_profil_verknuepfen() from public;
grant execute on function ub_profil_verknuepfen() to authenticated;

alter table profiles enable row level security;
drop policy if exists profiles_read on profiles;
create policy profiles_read on profiles for select to authenticated
  using (user_id = auth.uid() or ub_ist_admin());
-- Kein Schreibrecht aus der App: sonst könnte sich jemand selbst zum Admin machen.
-- Rollen vergibt der Admin im Dashboard, Partner-Profile entstehen über ub_profil_verknuepfen.
drop policy if exists profiles_self on profiles;

alter table bereiche    enable row level security;
alter table sub_leiter  enable row level security;
alter table eintraege   enable row level security;
alter table termine     enable row level security;
alter table monatswerte enable row level security;
alter table avdepot     enable row level security;
alter table kpue        enable row level security;
alter table ziele       enable row level security;
alter table volumen     enable row level security;
alter table aktivitaeten enable row level security;
alter table planpositionen enable row level security;
alter table kennzahlen  enable row level security;

-- Alte Regel „jeder eingeloggte User darf alles“ entfernen
do $$
declare t text;
begin
  foreach t in array array['bereiche','sub_leiter','eintraege','termine','monatswerte','avdepot','kpue','ziele','volumen','aktivitaeten','planpositionen','kennzahlen'] loop
    execute format('drop policy if exists team_all on %I', t);
  end loop;
end$$;

-- Personen: eigene Person + Unterbau lesen; neue Personen nur im eigenen Unterbau anlegen.
-- (Lesen auch über parent_id, damit insert … returning die gerade angelegte Zeile sieht.)
drop policy if exists bereiche_lesen on bereiche;
create policy bereiche_lesen on bereiche for select to authenticated
  using (id in (select ub_sichtbare_bereiche()) or parent_id in (select ub_sichtbare_bereiche()));
drop policy if exists bereiche_anlegen on bereiche;
create policy bereiche_anlegen on bereiche for insert to authenticated
  with check (ub_ist_admin() or parent_id in (select ub_sichtbare_bereiche()));
-- Ändern: im Unterbau frei; die eigene Zeile nur ohne Umhängen (die eigene FK bleibt).
drop policy if exists bereiche_aendern on bereiche;
create policy bereiche_aendern on bereiche for update to authenticated
  using (id in (select ub_sichtbare_bereiche()))
  with check (ub_ist_admin() or parent_id in (select ub_sichtbare_bereiche())
              or (id = ub_eigener_bereich() and parent_id is not distinct from ub_eigene_fk()));
drop policy if exists bereiche_loeschen on bereiche;
create policy bereiche_loeschen on bereiche for delete to authenticated
  using (ub_ist_admin() or (id in (select ub_sichtbare_bereiche()) and id <> ub_eigener_bereich()));

-- Daten je Person: nur für sichtbare Personen
do $$
declare t text;
begin
  foreach t in array array['sub_leiter','eintraege','avdepot','kpue','ziele','volumen','aktivitaeten','planpositionen','kennzahlen'] loop
    execute format('drop policy if exists partner_daten on %I', t);
    execute format(
      'create policy partner_daten on %I for all to authenticated
         using (bereich_id in (select ub_sichtbare_bereiche()))
         with check (bereich_id in (select ub_sichtbare_bereiche()))', t);
  end loop;
end$$;

-- Teamweite Tabellen ohne Personenbezug: nur Admin
do $$
declare t text;
begin
  foreach t in array array['termine','monatswerte'] loop
    execute format('drop policy if exists nur_admin on %I', t);
    execute format('create policy nur_admin on %I for all to authenticated using (ub_ist_admin()) with check (ub_ist_admin())', t);
  end loop;
end$$;

-- ── Realtime (Live-Updates zwischen Nutzern; Supabase wendet die RLS oben an) ─
do $$
declare t text;
begin
  foreach t in array array['bereiche','sub_leiter','eintraege','termine','monatswerte','avdepot','kpue','ziele','volumen','aktivitaeten','planpositionen','kennzahlen'] loop
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
