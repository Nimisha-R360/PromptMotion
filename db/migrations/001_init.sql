CREATE TABLE IF NOT EXISTS projects (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  mode          TEXT NOT NULL CHECK (mode IN ('prompt', 'upload')),
  prompt        TEXT NOT NULL DEFAULT '',
  theme         TEXT NOT NULL DEFAULT 'midnight',
  mood          TEXT NOT NULL DEFAULT 'energetic',
  stage         TEXT NOT NULL DEFAULT 'outline'
                CHECK (stage IN ('outline', 'outline_review', 'designing', 'complete')),
  current_index INTEGER NOT NULL DEFAULT 0,
  source_name   TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_projects_updated ON projects (updated_at DESC);

CREATE TABLE IF NOT EXISTS slides (
  id           INTEGER PRIMARY KEY,
  project_id   TEXT NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  idx          INTEGER NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'review', 'approved')),
  brief_json   TEXT NOT NULL,              -- outline item (prompt mode) or parsed slide content (upload mode)
  spec_json    TEXT,                       -- current design (SlideSpec)
  revision     INTEGER NOT NULL DEFAULT 0,
  history_json TEXT NOT NULL DEFAULT '[]', -- [{spec, feedback, at}]
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (project_id, idx)
);

CREATE TABLE IF NOT EXISTS messages (
  id          INTEGER PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  kind        TEXT NOT NULL DEFAULT 'text',
  content     TEXT NOT NULL,
  meta_json   TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_messages_project ON messages (project_id, id);

CREATE TABLE IF NOT EXISTS assets (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  mime        TEXT NOT NULL,
  file        TEXT NOT NULL,
  bytes       INTEGER NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_assets_project ON assets (project_id);
