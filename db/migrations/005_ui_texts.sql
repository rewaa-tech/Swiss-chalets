-- v3 §5: editable UI texts. branch_id NULL = site-wide value (super admin).
CREATE TABLE ui_texts (
  id          serial PRIMARY KEY,
  key         text NOT NULL CHECK (char_length(key) <= 80),
  branch_id   int REFERENCES branches(id),
  value       text NOT NULL CHECK (char_length(value) <= 2000),
  updated_by  int REFERENCES app_users(id),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ux_ui_texts ON ui_texts (key, COALESCE(branch_id, 0));

CREATE TABLE ui_text_history (
  id          serial PRIMARY KEY,
  key         text NOT NULL,
  branch_id   int REFERENCES branches(id),
  value       text,                 -- NULL = reset to default
  updated_by  int REFERENCES app_users(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_ui_text_history ON ui_text_history (key, branch_id, created_at DESC);
