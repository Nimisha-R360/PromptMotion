-- original file name of an uploaded asset (images / video clips the user attaches for the agent to use)
ALTER TABLE assets ADD COLUMN name TEXT NOT NULL DEFAULT '';
