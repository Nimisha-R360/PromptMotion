-- voiceover settings per project (on/off, Kokoro voice, speed, captions), as JSON
ALTER TABLE projects ADD COLUMN voice_json TEXT NOT NULL DEFAULT '{}';
