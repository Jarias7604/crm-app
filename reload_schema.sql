-- Reload PostgREST schema cache so it detects new tables
NOTIFY pgrst, 'reload schema';
