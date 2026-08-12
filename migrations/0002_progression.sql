CREATE TABLE current_position (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  parcours TEXT NOT NULL,
  level INTEGER NOT NULL,
  day_index INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);
