const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };
const encoder = new TextEncoder();
const now = () => new Date().toISOString();

function cors(request, env) {
  const origin = request.headers.get("Origin");
  return origin === env.ALLOWED_ORIGIN ? { "access-control-allow-origin": origin, "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-allow-headers": "content-type, authorization", vary: "Origin" } : {};
}
function respond(request, env, body, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, ...cors(request, env) } }); }
function validStudent(student) { return student && /^[1-3][1-9]\d{2}$/.test(student.id) && typeof student.name === "string" && student.name.trim().length > 0 && student.name.length <= 60; }
async function hash(value) { const bytes = await crypto.subtle.digest("SHA-256", encoder.encode(value)); return [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, "0")).join(""); }
function constantTimeEqual(left, right) { if (left.length !== right.length) return false; let diff = 0; for (let i = 0; i < left.length; i += 1) diff |= left.charCodeAt(i) ^ right.charCodeAt(i); return diff === 0; }
function tokenFrom(request) { const header = request.headers.get("Authorization") || ""; return header.startsWith("Bearer ") ? header.slice(7) : ""; }
async function requireAdmin(request, env) {
  const token = tokenFrom(request); if (!token) return false;
  return env.DB.prepare("SELECT a.teacher_id FROM admin_sessions s LEFT JOIN admin_session_actors a ON a.token_hash = s.token_hash WHERE s.token_hash = ?1 AND s.expires_at > ?2").bind(await hash(token), now()).first();
}
async function audit(env, action, studentId = null, detail = null) { await env.DB.prepare("INSERT INTO audit_log(action, student_id, detail, created_at) VALUES(?1, ?2, ?3, ?4)").bind(action, studentId, detail, now()).run(); }
let schemaReady;
function ensureSchema(env) {
  if (!schemaReady) schemaReady = env.DB.batch([
    env.DB.prepare("CREATE TABLE IF NOT EXISTS exam_sessions (student_id TEXT PRIMARY KEY, grade INTEGER NOT NULL, class_no INTEGER NOT NULL, attendance INTEGER NOT NULL, student_name TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('active','submitted')), started_at TEXT NOT NULL, submitted_at TEXT, result_json TEXT)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS admin_sessions (token_hash TEXT PRIMARY KEY, expires_at TEXT NOT NULL, created_at TEXT NOT NULL)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS teacher_accounts (teacher_id TEXT PRIMARY KEY, display_name TEXT NOT NULL, password_hash TEXT NOT NULL, created_at TEXT NOT NULL)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS admin_session_actors (token_hash TEXT PRIMARY KEY, teacher_id TEXT NOT NULL)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, action TEXT NOT NULL, student_id TEXT, detail TEXT, created_at TEXT NOT NULL)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_exam_sessions_status ON exam_sessions(status)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires ON admin_sessions(expires_at)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at DESC)")
  ]);
  return schemaReady;
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: cors(request, env) });
    if (request.headers.get("Origin") && request.headers.get("Origin") !== env.ALLOWED_ORIGIN) return respond(request, env, { error: "origin_not_allowed" }, 403);
    await ensureSchema(env);
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") return respond(request, env, { ok: true });
    let body = null; try { body = await request.json(); } catch { /* checked per endpoint */ }

    if (request.method === "POST" && url.pathname === "/v1/exams/start") {
      if (!validStudent(body?.student)) return respond(request, env, { error: "invalid_student" }, 400);
      const s = body.student; const row = await env.DB.prepare("SELECT status, started_at FROM exam_sessions WHERE student_id = ?1").bind(s.id).first();
      if (row?.status === "submitted") return respond(request, env, { error: "already_submitted" }, 409);
      if (row?.status === "active") return respond(request, env, { status: "active", started_at: row.started_at }, 200);
      await env.DB.prepare("INSERT INTO exam_sessions(student_id, grade, class_no, attendance, student_name, status, started_at) VALUES(?1, ?2, ?3, ?4, ?5, 'active', ?6)").bind(s.id, s.grade, s.classNo, s.attendance, s.name.trim(), now()).run();
      await audit(env, "exam_started", s.id); return respond(request, env, { status: "started" }, 201);
    }
    if (request.method === "POST" && url.pathname === "/v1/exams/submit") {
      if (!validStudent(body?.student) || !body?.result) return respond(request, env, { error: "invalid_submission" }, 400);
      const id = body.student.id; const row = await env.DB.prepare("SELECT status FROM exam_sessions WHERE student_id = ?1").bind(id).first();
      if (!row) return respond(request, env, { error: "session_not_found" }, 404);
      if (row.status === "submitted") return respond(request, env, { error: "already_submitted" }, 409);
      await env.DB.prepare("UPDATE exam_sessions SET status = 'submitted', submitted_at = ?1, result_json = ?2 WHERE student_id = ?3").bind(now(), JSON.stringify(body.result), id).run();
      await audit(env, "exam_submitted", id); return respond(request, env, { status: "submitted" });
    }
    if (request.method === "POST" && url.pathname === "/v1/admin/login") {
      const teacherId = String(body?.teacher_id || "admin").trim();
      const password = body?.password;
      let valid = teacherId === "admin" && env.TEACHER_PASSWORD && typeof password === "string" && constantTimeEqual(password, env.TEACHER_PASSWORD);
      if (!valid && typeof password === "string") { const account = await env.DB.prepare("SELECT password_hash FROM teacher_accounts WHERE teacher_id = ?1").bind(teacherId).first(); valid = Boolean(account && account.password_hash === await hash(password)); }
      if (!valid) return respond(request, env, { error: "invalid_credentials" }, 401);
      const token = crypto.randomUUID() + crypto.randomUUID(); const expires = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
      const tokenHash = await hash(token); await env.DB.prepare("INSERT INTO admin_sessions(token_hash, expires_at, created_at) VALUES(?1, ?2, ?3)").bind(tokenHash, expires, now()).run(); await env.DB.prepare("INSERT INTO admin_session_actors(token_hash, teacher_id) VALUES(?1, ?2)").bind(tokenHash, teacherId).run(); await audit(env, "admin_login", null, teacherId);
      return respond(request, env, { token, expires_at: expires });
    }
    if (request.method === "GET" && url.pathname === "/v1/admin/students") {
      if (!await requireAdmin(request, env)) return respond(request, env, { error: "unauthorized" }, 401);
      const rows = await env.DB.prepare("SELECT student_id, grade, class_no, attendance, student_name, status, started_at, submitted_at, json_extract(result_json, '$.scores.total.earned') AS total_score, json_extract(result_json, '$.scores.total.max') AS max_score FROM exam_sessions ORDER BY student_id").all(); return respond(request, env, { students: rows.results });
    }
    const studentDetail = url.pathname.match(/^\/v1\/admin\/students\/([1-3][1-9]\d{2})$/);
    if (request.method === "GET" && studentDetail) {
      if (!await requireAdmin(request, env)) return respond(request, env, { error: "unauthorized" }, 401);
      const row = await env.DB.prepare("SELECT student_id, grade, class_no, attendance, student_name, status, started_at, submitted_at, result_json FROM exam_sessions WHERE student_id = ?1").bind(studentDetail[1]).first();
      if (!row) return respond(request, env, { error: "student_not_found" }, 404);
      let result = null; try { result = row.result_json ? JSON.parse(row.result_json) : null; } catch { return respond(request, env, { error: "invalid_result_data" }, 500); }
      const { result_json, ...student } = row; return respond(request, env, { student, result });
    }
    if (request.method === "GET" && url.pathname === "/v1/admin/audit") {
      if (!await requireAdmin(request, env)) return respond(request, env, { error: "unauthorized" }, 401);
      const rows = await env.DB.prepare("SELECT id, action, student_id, detail, created_at FROM audit_log ORDER BY id DESC LIMIT 100").all(); return respond(request, env, { logs: rows.results });
    }
    if (request.method === "POST" && url.pathname === "/v1/admin/reset") {
      const admin = await requireAdmin(request, env); if (!admin) return respond(request, env, { error: "unauthorized" }, 401);
      const id = body?.student_id; const reason = String(body?.reason || "").trim();
      if (!/^[1-3][1-9]\d{2}$/.test(id || "")) return respond(request, env, { error: "invalid_student_id" }, 400);
      if (!reason || reason.length > 180) return respond(request, env, { error: "invalid_reason" }, 400);
      const deleted = await env.DB.prepare("DELETE FROM exam_sessions WHERE student_id = ?1").bind(id).run();
      if (deleted.meta.changes !== 1) return respond(request, env, { error: "student_not_found" }, 404);
      await audit(env, "student_reset", id, `${admin.teacher_id}: ${reason}`); return respond(request, env, { reset: true });
    }
    if (request.method === "POST" && url.pathname === "/v1/admin/reset-all") {
      const admin = await requireAdmin(request, env); if (!admin) return respond(request, env, { error: "unauthorized" }, 401);
      const reason = String(body?.reason || "").trim();
      if (!reason || reason.length > 180 || body?.confirmation !== "全件削除") return respond(request, env, { error: "invalid_confirmation" }, 400);
      const count = await env.DB.prepare("SELECT COUNT(*) AS total FROM exam_sessions").first(); const total = Number(count?.total || 0);
      await env.DB.batch([
        env.DB.prepare("DELETE FROM exam_sessions"),
        env.DB.prepare("INSERT INTO audit_log(action, student_id, detail, created_at) VALUES('reset_all', NULL, ?1, ?2)").bind(`${admin.teacher_id}: ${reason} (${total} records)`, now())
      ]);
      return respond(request, env, { reset: true, deleted: total });
    }
    if (request.method === "GET" && url.pathname === "/v1/admin/export") {
      if (!await requireAdmin(request, env)) return respond(request, env, { error: "unauthorized" }, 401);
      const rows = await env.DB.prepare("SELECT student_id, grade, class_no, attendance, student_name, status, started_at, submitted_at, result_json FROM exam_sessions WHERE status = 'submitted' ORDER BY student_id").all();
      const submissions = rows.results.map(row => { let result = null; try { result = JSON.parse(row.result_json || "null"); } catch { /* damaged legacy record */ } return { ...row, result }; });
      return respond(request, env, { submissions });
    }
    if (request.method === "GET" && url.pathname === "/v1/admin/teachers") {
      if (!await requireAdmin(request, env)) return respond(request, env, { error: "unauthorized" }, 401);
      const rows = await env.DB.prepare("SELECT teacher_id, display_name, created_at FROM teacher_accounts ORDER BY teacher_id").all(); return respond(request, env, { teachers: rows.results });
    }
    if (request.method === "POST" && url.pathname === "/v1/admin/teachers") {
      if (!await requireAdmin(request, env)) return respond(request, env, { error: "unauthorized" }, 401);
      const id = String(body?.teacher_id || "").trim(); const name = String(body?.display_name || "").trim(); const password = body?.password;
      if (!/^[a-zA-Z0-9_-]{3,32}$/.test(id) || !name || name.length > 60 || typeof password !== "string" || password.length < 12) return respond(request, env, { error: "invalid_teacher" }, 400);
      await env.DB.prepare("INSERT INTO teacher_accounts(teacher_id, display_name, password_hash, created_at) VALUES(?1, ?2, ?3, ?4)").bind(id, name, await hash(password), now()).run(); await audit(env, "teacher_created", null, id); return respond(request, env, { created: true }, 201);
    }
    return respond(request, env, { error: "not_found" }, 404);
  }
};
