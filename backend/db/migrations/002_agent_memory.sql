-- Director agent conversation memory (Strands message window), one row per project.
CREATE TABLE IF NOT EXISTS agent_memory (
  project_id    TEXT PRIMARY KEY REFERENCES projects (id) ON DELETE CASCADE,
  messages_json TEXT NOT NULL DEFAULT '[]',
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
