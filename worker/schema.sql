CREATE TABLE IF NOT EXISTS exam_sessions (
  student_id TEXT PRIMARY KEY,
  grade INTEGER NOT NULL,
  class_no INTEGER NOT NULL,
  attendance INTEGER NOT NULL,
  student_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('active', 'submitted')),
  started_at TEXT NOT NULL,
  submitted_at TEXT,
  result_json TEXT
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  token_hash TEXT PRIMARY KEY,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL,
  student_id TEXT,
  detail TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS exam_sessions_status_idx ON exam_sessions(status);
CREATE INDEX IF NOT EXISTS audit_log_student_idx ON audit_log(student_id, created_at DESC);
