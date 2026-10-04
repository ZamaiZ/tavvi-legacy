-- Repair UTF-8 text that was previously decoded as Windows-1252 in
-- installed public routines. This updates function definitions only; it
-- does not reapply the clean-install baseline or change table data.
do $migration$
declare
  routine_row record;
  definition text;
  damaged text;
  repaired text;
  decode_pass integer;
begin
  for routine_row in
    select p.oid
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind in ('f', 'p')
      and p.prosrc ~ U&'[\00C3\00C2\00E2]'
  loop
    definition := pg_catalog.pg_get_functiondef(routine_row.oid);

    -- Repeated passes repair text that was encoded more than once. Only
    -- known mojibake byte sequences are decoded.
    for decode_pass in 1..4 loop
      for damaged in
        select distinct captures[1]
        from pg_catalog.regexp_matches(
          definition,
          U&'(\00C3[\0080-\00FF\0192]|\00C2[\0080-\00FF]|\00E2(\20AC[\2122\0153\00A6\00A2\201C\201D\2018\2019]|\2020\2019))',
          'g'
        ) as matches(captures)
      loop
        repaired := pg_catalog.convert_from(
          pg_catalog.convert_to(damaged, 'WIN1252'),
          'UTF8'
        );
        definition := pg_catalog.replace(definition, damaged, repaired);
      end loop;
    end loop;

    execute definition;
  end loop;
end;
$migration$;
