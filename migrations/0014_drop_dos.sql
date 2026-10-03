-- Retrait du module Dos (refonte V1, chantier 3). Vérifié en prod avant
-- suppression : aucune séance, série ni évaluation Dos enregistrée — seule une
-- date de début de cycle part. Tables enfants d'abord (clés étrangères).
DROP TABLE dos_sets_logged;
DROP TABLE dos_skipped_exercises;
DROP TABLE dos_seances;
DROP TABLE dos_evaluations;
DROP TABLE dos_start_date;
