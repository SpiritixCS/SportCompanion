-- Repos entre séries propre à chaque exercice du programme Tracking
-- (refonte « Agrès », phase 5). NULL = réglage global « Repos entre séries » :
-- les exercices déjà composés ne changent pas.
ALTER TABLE tracking_program_day_exercises ADD COLUMN rest_seconds INTEGER;
