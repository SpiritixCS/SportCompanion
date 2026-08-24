-- Le bouton "Refaire ce niveau" repositionnait current_position sur (parcours,
-- level, day 0) sans rien d'autre : isDayValidated retrouvait les séances déjà
-- complétées du premier passage et syncPosition sautait aussitôt de nouveau
-- jusqu'à l'écran de montée de niveau — le bouton semblait ne rien faire.
-- `cycle` distingue les passages successifs d'un même niveau ; il compte pour
-- rien côté Trophées (computeTrophies additionne sets_logged sans filtrer dessus).
ALTER TABLE seances ADD COLUMN cycle INTEGER NOT NULL DEFAULT 0;
ALTER TABLE current_position ADD COLUMN cycle INTEGER NOT NULL DEFAULT 0;
