// Supabase Edge Function for pycbt.
// Deploy as "exam-api" after running supabase/schema.sql.
import { createClient } from "npm:@supabase/supabase-js@2";

const encoder = new TextEncoder();
const jsonHeaders = { "content-type": "application/json; charset=utf-8" };
const allowedOrigin = "https://naturespa.github.io";
const db = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const now = () => new Date().toISOString();
const apiError = (error: unknown) => error instanceof Error ? error.message : String(error);

function cors(request: Request) {
  const origin = request.headers.get("origin");
  return origin === allowedOrigin
    ? { "access-control-allow-origin": origin, "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-allow-headers": "content-type, authorization", vary: "Origin" }
    : {};
}
function respond(request: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...jsonHeaders, ...cors(request) } });
}
function validStudent(student: unknown): student is { id: string; name: string; grade: number; classNo: number; attendance: number } {
  if (!student || typeof student !== "object") return false;
  const s = student as Record<string, unknown>;
  return /^[1-3][1-9]\d{2}$/.test(String(s.id ?? ""))
    && typeof s.name === "string" && s.name.trim().length > 0 && s.name.length <= 60
    && Number.isInteger(s.grade) && Number.isInteger(s.classNo) && Number.isInteger(s.attendance);
}
async function sha256(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return diff === 0;
}
function tokenFrom(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
}
async function audit(action: string, studentId: string | null = null, detail: string | null = null) {
  const { error } = await db.from("audit_log").insert({ action, student_id: studentId, detail, created_at: now() });
  if (error) throw error;
}
async function requireAdmin(request: Request) {
  const token = tokenFrom(request);
  if (!token) return null;
  const tokenHash = await sha256(token);
  const { data: session } = await db.from("admin_sessions").select("token_hash").eq("token_hash", tokenHash).gt("expires_at", now()).maybeSingle();
  if (!session) return null;
  const { data: actor } = await db.from("admin_session_actors").select("teacher_id").eq("token_hash", tokenHash).maybeSingle();
  return actor;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: cors(request) });
  if (request.headers.get("origin") && request.headers.get("origin") !== allowedOrigin) return respond(request, { error: "origin_not_allowed" }, 403);
  const url = new URL(request.url);
  if (request.method === "GET" && url.pathname.endsWith("/health")) return respond(request, { ok: true });
  let body: Record<string, unknown> | null = null;
  if (request.method === "POST") { try { body = await request.json(); } catch { /* endpoint validates its body */ } }
  const path = url.pathname.replace(/^\/functions\/v1\/exam-api/, "") || "/";

  try {
    if (request.method === "POST" && path === "/v1/exams/start") {
      if (!validStudent(body?.student)) return respond(request, { error: "invalid_student" }, 400);
      const s = body.student;
      const { data: row, error: findError } = await db.from("exam_sessions").select("status,started_at").eq("student_id", s.id).maybeSingle();
      if (findError) throw findError;
      if (row?.status === "submitted") return respond(request, { error: "already_submitted" }, 409);
      if (row?.status === "active") return respond(request, { status: "active", started_at: row.started_at });
      const { error } = await db.from("exam_sessions").insert({ student_id: s.id, grade: s.grade, class_no: s.classNo, attendance: s.attendance, student_name: s.name.trim(), status: "active", started_at: now() });
      if (error) throw error;
      await audit("exam_started", s.id);
      return respond(request, { status: "started" }, 201);
    }

    if (request.method === "POST" && path === "/v1/exams/submit") {
      if (!validStudent(body?.student) || !body?.result) return respond(request, { error: "invalid_submission" }, 400);
      const student = body.student;
      const { data: row, error: findError } = await db.from("exam_sessions").select("status").eq("student_id", student.id).maybeSingle();
      if (findError) throw findError;
      if (!row) return respond(request, { error: "session_not_found" }, 404);
      if (row.status === "submitted") return respond(request, { error: "already_submitted" }, 409);
      const { error } = await db.from("exam_sessions").update({ status: "submitted", submitted_at: now(), result_json: body.result }).eq("student_id", student.id);
      if (error) throw error;
      await audit("exam_submitted", student.id);
      return respond(request, { status: "submitted" });
    }

    if (request.method === "POST" && path === "/v1/admin/login") {
      const teacherId = String(body?.teacher_id ?? "admin").trim();
      const password = body?.password;
      const initialPassword = Deno.env.get("TEACHER_PASSWORD") ?? "";
      let valid = teacherId === "admin" && typeof password === "string" && initialPassword && constantTimeEqual(password, initialPassword);
      if (!valid && typeof password === "string") {
        const { data: account, error } = await db.from("teacher_accounts").select("password_hash").eq("teacher_id", teacherId).maybeSingle();
        if (error) throw error;
        valid = Boolean(account && account.password_hash === await sha256(password));
      }
      if (!valid) return respond(request, { error: "invalid_credentials" }, 401);
      const token = crypto.randomUUID() + crypto.randomUUID();
      const tokenHash = await sha256(token);
      const expires = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
      const { error: sessionError } = await db.from("admin_sessions").insert({ token_hash: tokenHash, expires_at: expires, created_at: now() });
      if (sessionError) throw sessionError;
      const { error: actorError } = await db.from("admin_session_actors").insert({ token_hash: tokenHash, teacher_id: teacherId });
      if (actorError) throw actorError;
      await audit("admin_login", null, teacherId);
      return respond(request, { token, expires_at: expires });
    }

    if (request.method === "GET" && path === "/v1/admin/students") {
      if (!await requireAdmin(request)) return respond(request, { error: "unauthorized" }, 401);
      const { data, error } = await db.from("exam_sessions").select("student_id,grade,class_no,attendance,student_name,status,started_at,submitted_at,result_json").order("student_id");
      if (error) throw error;
      const students = (data ?? []).map(({ result_json, ...s }) => ({ ...s, total_score: (result_json as any)?.scores?.total?.earned ?? null, max_score: (result_json as any)?.scores?.total?.max ?? null }));
      return respond(request, { students });
    }

    const detailMatch = path.match(/^\/v1\/admin\/students\/([1-3][1-9]\d{2})$/);
    if (request.method === "GET" && detailMatch) {
      if (!await requireAdmin(request)) return respond(request, { error: "unauthorized" }, 401);
      const { data: row, error } = await db.from("exam_sessions").select("student_id,grade,class_no,attendance,student_name,status,started_at,submitted_at,result_json").eq("student_id", detailMatch[1]).maybeSingle();
      if (error) throw error;
      if (!row) return respond(request, { error: "student_not_found" }, 404);
      const { result_json, ...student } = row;
      return respond(request, { student, result: result_json });
    }

    if (request.method === "GET" && path === "/v1/admin/audit") {
      if (!await requireAdmin(request)) return respond(request, { error: "unauthorized" }, 401);
      const { data: logs, error } = await db.from("audit_log").select("id,action,student_id,detail,created_at").order("id", { ascending: false }).limit(100);
      if (error) throw error;
      return respond(request, { logs });
    }

    if (request.method === "POST" && path === "/v1/admin/reset") {
      const admin = await requireAdmin(request);
      const studentId = String(body?.student_id ?? "");
      const reason = String(body?.reason ?? "").trim();
      if (!admin) return respond(request, { error: "unauthorized" }, 401);
      if (!/^[1-3][1-9]\d{2}$/.test(studentId)) return respond(request, { error: "invalid_student_id" }, 400);
      if (!reason || reason.length > 180) return respond(request, { error: "invalid_reason" }, 400);
      const { data: deleted, error } = await db.from("exam_sessions").delete().eq("student_id", studentId).select("student_id");
      if (error) throw error;
      if (!deleted?.length) return respond(request, { error: "student_not_found" }, 404);
      await audit("student_reset", studentId, `${admin.teacher_id}: ${reason}`);
      return respond(request, { reset: true });
    }

    if (request.method === "POST" && path === "/v1/admin/reset-all") {
      const admin = await requireAdmin(request);
      const reason = String(body?.reason ?? "").trim();
      if (!admin) return respond(request, { error: "unauthorized" }, 401);
      if (!reason || reason.length > 180 || body?.confirmation !== "全件削除") return respond(request, { error: "invalid_confirmation" }, 400);
      const { count, error: countError } = await db.from("exam_sessions").select("*", { count: "exact", head: true });
      if (countError) throw countError;
      const { error } = await db.from("exam_sessions").delete().neq("student_id", "");
      if (error) throw error;
      await audit("reset_all", null, `${admin.teacher_id}: ${reason} (${count ?? 0} records)`);
      return respond(request, { reset: true, deleted: count ?? 0 });
    }

    if (request.method === "GET" && path === "/v1/admin/export") {
      if (!await requireAdmin(request)) return respond(request, { error: "unauthorized" }, 401);
      const { data, error } = await db.from("exam_sessions").select("student_id,grade,class_no,attendance,student_name,status,started_at,submitted_at,result_json").eq("status", "submitted").order("student_id");
      if (error) throw error;
      const submissions = (data ?? []).map(({ result_json, ...s }) => ({ ...s, result: result_json }));
      return respond(request, { submissions });
    }

    if (request.method === "GET" && path === "/v1/admin/teachers") {
      if (!await requireAdmin(request)) return respond(request, { error: "unauthorized" }, 401);
      const { data: teachers, error } = await db.from("teacher_accounts").select("teacher_id,display_name,created_at").order("teacher_id");
      if (error) throw error;
      return respond(request, { teachers });
    }

    if (request.method === "POST" && path === "/v1/admin/teachers") {
      if (!await requireAdmin(request)) return respond(request, { error: "unauthorized" }, 401);
      const id = String(body?.teacher_id ?? "").trim();
      const name = String(body?.display_name ?? "").trim();
      const password = body?.password;
      if (!/^[A-Za-z0-9_-]{3,32}$/.test(id) || !name || name.length > 60 || typeof password !== "string" || password.length < 12) return respond(request, { error: "invalid_teacher" }, 400);
      const { error } = await db.from("teacher_accounts").insert({ teacher_id: id, display_name: name, password_hash: await sha256(password), created_at: now() });
      if (error) return respond(request, { error: error.code === "23505" ? "teacher_exists" : "invalid_teacher" }, 400);
      await audit("teacher_created", null, id);
      return respond(request, { created: true }, 201);
    }
    return respond(request, { error: "not_found" }, 404);
  } catch (error) {
    console.error(apiError(error));
    return respond(request, { error: "server_error" }, 500);
  }
});
