#!/bin/bash
# Datentrennung je Partner (schema.sql) gegen eine lokale Wegwerf-Postgres prüfen.
#   PSQL="psql -h localhost -U postgres" tests/rls/pruefen.sh
# Legt die Datenbank $DB neu an, spielt schema.sql zweimal ein (muss wiederholbar sein),
# prüft Lesen/Schreiben je Rolle und löscht die Datenbank wieder. Nie gegen Supabase laufen lassen.
set -u
cd "$(dirname "$0")/../.."
PSQL=${PSQL:-psql}; DB=${DB:-umsatzboard_rls_test}
$PSQL -q -c "drop database if exists $DB" -c "create database $DB" >/dev/null 2>&1 || { echo "Keine Postgres erreichbar ($PSQL)"; exit 2; }
P="$PSQL -d $DB -tA -q"
$P -v ON_ERROR_STOP=1 -f tests/rls/supabase-nachbau.sql >/dev/null 2>&1 || { echo "Nachbau fehlgeschlagen"; exit 2; }
for i in 1 2; do $P -v ON_ERROR_STOP=1 -f schema.sql >/dev/null 2>&1 || { echo "schema.sql Lauf $i fehlgeschlagen"; $P -v ON_ERROR_STOP=1 -f schema.sql 2>&1 | grep ERROR; exit 1; }; done
ADMIN=00000000-0000-0000-0000-00000000000a; FK=00000000-0000-0000-0000-00000000000b
NEU=00000000-0000-0000-0000-00000000000c; UNBEST=00000000-0000-0000-0000-00000000000d; FREMD=00000000-0000-0000-0000-00000000000e
$P -c "insert into auth.users values ('$ADMIN','admin@example.invalid',now()), ('$FK','fk@example.invalid',now())" \
   -c "insert into profiles values ('$ADMIN','admin',null,'Admin'), ('$FK','fk',(select id from bereiche where name='FK Team D'),'FK D')" \
   -c "insert into ziele (bereich_id,jahr,monat,wert) select id,2026,10,1000 from bereiche" >/dev/null
fail=0
als() { local uid=$1; shift; $P -c "set role authenticated" -c "select set_config('request.jwt.claim.sub','$uid',false)" -c "$*" 2>&1 | sed '1{/^$/d}' | grep -v "^$uid$" | tr '\n' ' ' | sed 's/ *$//'; }
erwarte() { local name=$1 soll=$2 ist=$3; if [[ "$ist" == $soll ]]; then echo "ok   $name"; else echo "FAIL $name: erwartet [$soll], bekommen [$ist]"; fail=1; fi; }
bid() { $P -c "select id from bereiche where name='$1'"; }
D=$(bid 'FK Team D'); D1=$(bid 'FK Team D1'); D1A=$(bid 'FK Team D1a'); A=$(bid 'FK Team A')

erwarte "Admin sieht alle Personen"            12 "$(als $ADMIN 'select count(*) from bereiche')"
erwarte "FK sieht sich + Unterbau"             3  "$(als $FK 'select count(*) from bereiche')"
erwarte "Ohne Profil sieht man nichts"         0  "$(als $FREMD 'select count(*) from bereiche')"
erwarte "FK sieht nur Ziele im Unterbau"       3  "$(als $FK 'select count(*) from ziele')"
erwarte "Admin sieht alle Ziele"               12 "$(als $ADMIN 'select count(*) from ziele')"
erwarte "FK legt Person im Unterbau an (returning)" "Neu Test*" "$(als $FK "insert into bereiche (name,gruppe,parent_id) values ('Neu Test','TR',$D1) returning name")"
erwarte "FK darf nicht fremd anlegen"          "*row-level security*" "$(als $FK "insert into bereiche (name,gruppe,parent_id) values ('Fremd Test','TR',$A) returning id")"
erwarte "FK darf keine neue Wurzel anlegen"    "*row-level security*" "$(als $FK "insert into bereiche (name,gruppe,parent_id) values ('Wurzel Test','TR',null) returning id")"
als $FK "update bereiche set parent_id=$D where id=$D1A" >/dev/null
erwarte "FK hängt im Unterbau um"              "$D" "$($P -c "select parent_id from bereiche where id=$D1A")"
erwarte "FK hängt nicht nach fremd um"         "*row-level security*" "$(als $FK "update bereiche set parent_id=$A where id=$D1A")"
als $FK "update bereiche set partnernummer='900099' where id=$D" >/dev/null
erwarte "FK ändert eigene Partnernummer"       900099 "$($P -c "select partnernummer from bereiche where id=$D")"
erwarte "FK hängt sich nicht selbst um"        "*row-level security*" "$(als $FK "update bereiche set parent_id=null where id=$D")"
erwarte "Kreisbezug wird abgewiesen"           "*Kreisbezug*" "$(als $FK "update bereiche set parent_id=$D1A where id=$D")"
erwarte "Kreisbezug auch für Admin"            "*Kreisbezug*" "$(als $ADMIN "update bereiche set parent_id=$D1 where id=$D")"
erwarte "FK sieht nur das eigene Profil"       1  "$(als $FK 'select count(*) from profiles')"
erwarte "Admin sieht alle Profile"             2  "$(als $ADMIN 'select count(*) from profiles')"
als $FK "update profiles set role='admin'" >/dev/null
erwarte "FK kann sich nicht zum Admin machen"  fk "$($P -c "select role from profiles where user_id='$FK'")"
erwarte "FK kann sich nicht selbst löschen"    0  "$($P -c "set role authenticated" -c "select set_config('request.jwt.claim.sub','$FK',false)" -c "with x as (delete from bereiche where id=$D returning 1) select count(*) from x" | tail -1)"
erwarte "Planposition im Unterbau"             "1*" "$(als $FK "insert into planpositionen (bereich_id,monat,betrag) values ($D1,'2026-10',5000) returning 1")"
erwarte "Planposition fremd abgewiesen"        "*row-level security*" "$(als $FK "insert into planpositionen (bereich_id,monat,betrag) values ($A,'2026-10',5000)")"
erwarte "Planstatus geprüft"                   "*check constraint*" "$(als $FK "insert into planpositionen (bereich_id,monat,status) values ($D1,'2026-10','quatsch')")"
$P -c "insert into planpositionen (bereich_id,monat,betrag) values ($A,'2026-10',7000)"
erwarte "FK sieht fremde Planung nicht"        1  "$(als $FK 'select count(*) from planpositionen')"
erwarte "Termine nur Admin (FK liest nichts)"  0  "$(als $FK 'select count(*) from termine')"
erwarte "Termine Admin schreibt"               "1*" "$(als $ADMIN "insert into termine (kunde) values ('X') returning 1")"
# Zugang je Partner: E-Mail aus dem Organigramm
$P -c "update bereiche set email='Profi@Example.invalid' where id=$D1A"
$P -c "insert into auth.users values ('$NEU','profi@example.invalid',now()), ('$UNBEST','neu@example.invalid',null), ('$FREMD','fremd@example.invalid',now())"
erwarte "Unbekannte E-Mail: kein Profil"       "" "$(als $FREMD 'select bereich_id from ub_profil_verknuepfen()')"
$P -c "update bereiche set email='neu@example.invalid' where id=$D1"
erwarte "Unbestätigte E-Mail: kein Profil"     "" "$(als $UNBEST 'select bereich_id from ub_profil_verknuepfen()')"
erwarte "E-Mail verknüpft (Groß/klein egal)"   "$D1A" "$(als $NEU 'select bereich_id from ub_profil_verknuepfen()')"
erwarte "Zweiter Login: gleiches Profil"       "$D1A fk" "$(als $NEU "select bereich_id||' '||role from ub_profil_verknuepfen()")"
erwarte "Profiberater sieht nur sich"          1  "$(als $NEU 'select count(*) from bereiche')"
erwarte "Profiberater speichert Kennzahlen"    "1*" "$(als $NEU "insert into kennzahlen (bereich_id,stand,daten) values ($D1A,'2026-10-02','{}') returning 1")"
erwarte "Kennzahlen je Stand eindeutig"        "*duplicate key*" "$(als $NEU "insert into kennzahlen (bereich_id,stand,daten) values ($D1A,'2026-10-02','{}')")"
erwarte "Profiberater liest keine fremden Ziele" 1 "$(als $NEU 'select count(*) from ziele')"
erwarte "Doppelte Partnernummer abgewiesen"    "*duplicate key*" "$(als $ADMIN "update bereiche set partnernummer='900099' where id=$A")"
erwarte "Doppelte E-Mail abgewiesen"           "*duplicate key*" "$(als $ADMIN "update bereiche set email='PROFI@example.invalid' where id=$A")"
erwarte "Anonym sieht nichts"                  "0" "$($P -c "set role anon" -c 'select count(*) from bereiche' 2>&1 | tr '\n' '|' | sed 's/|$//')"
erwarte "FK löscht im Unterbau"                1  "$($P -c "set role authenticated" -c "select set_config('request.jwt.claim.sub','$FK',false)" -c "with x as (delete from bereiche where name='Neu Test' returning 1) select count(*) from x" | tail -1)"
$PSQL -q -c "drop database if exists $DB" >/dev/null 2>&1
[ $fail = 0 ] && echo "Alle Prüfungen bestanden."
exit $fail
