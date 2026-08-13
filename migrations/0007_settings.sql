CREATE TABLE app_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  rest_between_sets_seconds INTEGER NOT NULL DEFAULT 90,
  rest_between_exercises_seconds INTEGER NOT NULL DEFAULT 120,
  sound_countdown_enabled INTEGER NOT NULL DEFAULT 0,
  start_countdown_enabled INTEGER NOT NULL DEFAULT 0,
  keep_screen_awake_enabled INTEGER NOT NULL DEFAULT 1
);

INSERT INTO app_settings (id) VALUES (1);
