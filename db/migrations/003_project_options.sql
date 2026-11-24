-- "Start faster" options picked on the start screen (template, audience, slide count, mood, language), as JSON.
ALTER TABLE projects ADD COLUMN options_json TEXT NOT NULL DEFAULT '{}';
