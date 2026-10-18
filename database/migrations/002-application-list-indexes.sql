CREATE INDEX IF NOT EXISTS applications_status_created_at_idx
  ON applications(status, created_at DESC);

CREATE INDEX IF NOT EXISTS users_name_search_idx
  ON users(last_name, first_name);
