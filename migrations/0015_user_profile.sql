-- Profil de l'utilisateur (refonte V1, multi-utilisateurs). Prénom demandé au
-- premier accès ; NULL tant qu'il n'a pas été saisi.
CREATE TABLE user_profile (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  prenom TEXT
);

INSERT INTO user_profile (id) VALUES (1);
