-- Dernière reprise après une pause > 1 h (feuille « Séance en pause depuis
-- longtemps » → Reprendre). Sert d'événement pour la durée active et empêche
-- la feuille de revenir au rechargement. Nullable, additive : aucune ligne
-- existante n'est modifiée.
ALTER TABLE seances ADD COLUMN resumed_at TEXT;
ALTER TABLE tracking_seances ADD COLUMN resumed_at TEXT;
