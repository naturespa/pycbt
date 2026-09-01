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
  const row = await env.DB.prepare("SELECT token_hash FROM admin_sessions WHERE token_hash = ?1 AND expires_at > ?2").bind(await hash(token), now()).first();
  return Boolean(row);
}
async function audit(env, action, studentId = null, detail = null) { await env.DB.prepare("INSERT INTO audit_log(action, student_id, detail, created_at) VALUES(?1, ?2, ?3, ?4)").bind(action, studentId, detail, now()).run(); }

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: cors(request, env) });
    if (request.headers.get("Origin") && request.headers.get("Origin") !== env.ALLOWED_ORIGIN) return respond(request, env, { error: "origin_not_allowed" }, 403);
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
      if (!env.TEACHER_PASSWORD || typeof body?.password !== "string" || !constantTimeEqual(body.password, env.TEACHER_PASSWORD)) return respond(request, env, { error: "invalid_credentials" }, 401);
      const token = crypto.randomUUID() + crypto.randomUUID(); const expires = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
      await env.DB.prepare("INSERT INTO admin_sessions(token_hash, expires_at, created_at) VALUES(?1, ?2, ?3)").bind(await hash(token), expires, now()).run(); await audit(env, "admin_login");
      return respond(request, env, { token, expires_at: expires });
    }
    if (request.method === "GET" && url.pathname === "/v1/admin/students") {
      if (!await requireAdmin(request, env)) return respond(request, env, { error: "unauthorized" }, 401);
      const rows = await env.DB.prepare("SELECT student_id, grade, class_no, attendance, student_name, status, started_at, submitted_at FROM exam_sessions ORDER BY student_id").all(); return respond(request, env, { students: rows.results });
    }
    if (request.method === "POST" && url.pathname === "/v1/admin/reset") {
      if (!await requireAdmin(request, env)) return respond(request, env, { error: "unauthorized" }, 401);
      const id = body?.student_id; if (!/^[1-3][1-9]\d{2}$/.test(id || "")) return respond(request, env, { error: "invalid_student_id" }, 400);
      const deleted = await env.DB.prepare("DELETE FROM exam_sessions WHERE student_id = ?1").bind(id).run(); await audit(env, "student_reset", id, body?.reason?.slice(0, 200) || null); return respond(request, env, { reset: deleted.meta.changes === 1 });
    }
    return respond(request, env, { error: "not_found" }, 404);
  }
};
