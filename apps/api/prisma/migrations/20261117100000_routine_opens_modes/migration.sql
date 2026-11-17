-- « À partir du »: an object ({ mode, ... }) instead of "DD" (monthly) or "MM-DD" (yearly).
ALTER TABLE "Routine" ALTER COLUMN "opensOn" TYPE JSONB USING (
  CASE
    WHEN "opensOn" ~ '^\d{2}$' THEN jsonb_build_object('mode', 'DAY', 'day', "opensOn"::INTEGER, 'month', NULL)
    WHEN "opensOn" ~ '^\d{2}-\d{2}$' THEN jsonb_build_object('mode', 'DAY', 'day', substr("opensOn", 4, 2)::INTEGER, 'month', substr("opensOn", 1, 2)::INTEGER)
    ELSE NULL
  END
);
