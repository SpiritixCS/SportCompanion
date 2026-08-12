-- dos_sets_logged has no way to attribute a logged set back to the exercise
-- that was actually performed. Unlike Programme days (static composition —
-- (parcours, level, day_index, exercise_order) always replays the same
-- exercise), a Dos day's composition is dynamic: buildDosDay resolves each
-- arbre exercise through getCurrentCran, which changes every time a montée
-- is recorded. Replaying exercise_order against a freshly-rebuilt day later
-- would resolve to the wrong cran. Store the exact exercise id at log time.
--
-- This table is brand new (feature just built, not yet released) and holds
-- no real session data in any deployment, so there is nothing to backfill —
-- drop and recreate rather than the usual create-copy-drop-rename pattern.
DROP TABLE dos_sets_logged;

CREATE TABLE dos_sets_logged (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seance_id INTEGER NOT NULL REFERENCES dos_seances(id),
  exercise_order INTEGER NOT NULL,
  exercise_id TEXT NOT NULL,
  set_number INTEGER NOT NULL,
  valeur_target TEXT NOT NULL,
  valeur_actual INTEGER NOT NULL,
  rest_seconds INTEGER NOT NULL,
  completed_at TEXT NOT NULL
);
