-- Reps faites hors séance, ajoutées depuis la fiche Trophées d'un exercice
-- (refonte V1, chantier 5). card_id = id de carte Trophées (« squats »,
-- « tracking-12 »). Additive : aucune donnée existante n'est touchée.
CREATE TABLE extra_reps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount > 0),
  logged_at TEXT NOT NULL
);

CREATE INDEX extra_reps_card ON extra_reps (card_id);
