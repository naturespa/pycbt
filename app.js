(() => {
  const $ = (id) => document.getElementById(id);
  const STORAGE_PREFIX = "pycbt:v1:";
  const API_BASE_URL = "https://pycbt-exam-api.curry-grapes.workers.dev";
  const state = { student: null, questions: [], answers: {}, current: 0, startedAt: null, endsAt: null, timer: null, submitted: false, record: null, pending: null };
  const formatScore = (score, total) => `${score} / ${total} 点`;
  const activeKey = (id) => `${STORAGE_PREFIX}active:${id}`;
  const completedKey = (id) => `${STORAGE_PREFIX}completed:${id}`;
  const getLocal = (key) => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } };
  const setLocal = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  async function api(path, options = {}) {
    const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers: { "content-type": "application/json", ...(options.headers || {}) } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { const error = new Error(data.error || "network_error"); error.status = response.status; throw error; }
    return data;
  }
  function parseStudentId(value) { const v = value.trim(); if (!/^[1-3][1-9]\d{2}$/.test(v)) return null; return { id: v, grade: Number(v[0]), classNo: Number(v[1]), attendance: Number(v.slice(2)) }; }
  function normalize(value) { return String(value ?? "").trim().replace(/\s+/g, "").normalize("NFKC"); }
  function studentText(student) { return `${student.grade}年${student.classNo}組${student.attendance}番　${student.name}`; }
  function persistActive() {
    if (!state.student || state.submitted) return;
    setLocal(activeKey(state.student.id), { schema_version: 1, student: state.student, answers: state.answers, current: state.current, started_at: state.startedAt, ends_at: state.endsAt, question_ids: state.questions.map(q => q.id) });
  }
  function renderQuestion() {
    const q = state.questions[state.current]; const answer = state.answers[q.id] ?? "";
    $("progress-label").textContent = `第 ${state.current + 1} 問 / ${state.questions.length} 問`;
    const visual = q.visual_type !== "none" ? `<div class="visual" aria-label="${q.visual_type}図表">${q.visual ?? "図表データ未登録"}</div>` : "";
    const input = q.format === "choice" ? `<div class="answer-area">${q.choices.map((choice, i) => `<label class="choice"><input type="radio" name="answer" value="${choice}" ${answer === choice ? "checked" : ""}/><span>${String.fromCharCode(65 + i)}. ${choice}</span></label>`).join("")}</div>` : `<div class="answer-area"><label>解答<input class="answer-input" id="answer-input" value="${answer}" autocomplete="off" /></label></div>`;
    $("question-card").innerHTML = `<p class="question-meta">${q.id}　${DOMAIN_NAMES[q.domain]}　${q.points}点　${q.format === "choice" ? "4択" : "入力"}${q.it_passport ? "　ITパスポート関連" : ""}</p><div class="question-body"><h2>${q.question}</h2>${visual}${input}</div>`;
    document.querySelectorAll('input[name="answer"]').forEach(el => el.addEventListener("change", () => { state.answers[q.id] = el.value; persistActive(); renderNav(); }));
    $("answer-input")?.addEventListener("input", event => { state.answers[q.id] = event.target.value; persistActive(); renderNav(); });
    $("previous-button").disabled = state.current === 0;
    $("next-button").textContent = state.current === state.questions.length - 1 ? "最後の問題" : "次の問題";
    renderNav();
  }
  function renderNav() {
    $("question-dots").innerHTML = state.questions.map((q, i) => `<button type="button" class="${i === state.current ? "active" : ""} ${normalize(state.answers[q.id]) ? "answered" : ""}" data-index="${i}" aria-label="第${i + 1}問">${i + 1}</button>`).join("");
    document.querySelectorAll("[data-index]").forEach(button => button.addEventListener("click", () => { state.current = Number(button.dataset.index); persistActive(); renderQuestion(); }));
  }
  function tick() {
    const remaining = Math.max(0, Math.ceil((new Date(state.endsAt).getTime() - Date.now()) / 1000));
    const m = Math.floor(remaining / 60); const s = remaining % 60;
    $("timer").textContent = `残り ${m}:${String(s).padStart(2, "0")}`;
    if (remaining <= 0) submit(true);
  }
  function beginExam(session) {
    state.student = session.student; state.questions = [...QUESTION_BANK]; state.answers = session.answers ?? {}; state.current = session.current ?? 0;
    state.startedAt = session.started_at ?? new Date().toISOString();
    state.endsAt = session.ends_at ?? new Date(Date.now() + EXAM_BLUEPRINT.durationSeconds * 1000).toISOString();
    state.submitted = false;
    $("student-label").textContent = studentText(state.student); $("entry-screen").hidden = true; $("exam-screen").hidden = false;
    persistActive(); clearInterval(state.timer); tick();
    if (state.submitted) return;
    state.timer = setInterval(tick, 1000); renderQuestion();
  }
  function confirmSubmission() {
    const missing = state.questions.filter(q => !normalize(state.answers[q.id])).length;
    $("unanswered-message").textContent = missing ? `未回答が${missing}問あります。提出後は解答を変更できません。` : "35問すべてに解答済みです。提出後は解答を変更できません。";
    $("confirm-submit").showModal();
  }
  function scoreExam() {
    return state.questions.map(q => {
      const response = state.answers[q.id] ?? "";
      const correct = q.acceptable_answers.some(a => normalize(a) === normalize(response));
      return { ...q, response, correct, earned: correct ? q.points : 0 };
    });
  }
  function calculateStats(results) {
    const group = (label, filter) => { const items = results.filter(filter); const earned = items.reduce((s, q) => s + q.earned, 0); const max = items.reduce((s, q) => s + q.points, 0); return { label, earned, max, correct: items.filter(q => q.correct).length, count: items.length }; };
    return { total: group("総合", () => true), knowledge: group("知識・技能", q => q.viewpoint === "knowledge"), thinking: group("思考・判断・表現", q => q.viewpoint === "thinking"), it: group("ITパスポート関連", q => q.it_passport), domains: Object.keys(DOMAIN_NAMES).map(d => group(`${d} ${DOMAIN_NAMES[d]}`, q => q.domain === d)) };
  }
  function makeRecord(results, stats, auto) {
    return {
      schema_version: 1,
      assessment: { title: "情報I CBT", blueprint: EXAM_BLUEPRINT, question_bank_capacity: QUESTION_BANK_CAPACITY },
      student: { id: state.student.id, grade: state.student.grade, class: state.student.classNo, attendance: state.student.attendance, name: state.student.name },
      session: { started_at: state.startedAt, submitted_at: new Date().toISOString(), auto_submitted: auto, duration_seconds: EXAM_BLUEPRINT.durationSeconds },
      scores: { total: stats.total, knowledge: stats.knowledge, thinking: stats.thinking, domains: Object.fromEntries(stats.domains.map(item => [item.label.slice(0, 1), item])), it_passport: stats.it },
      questions: results.map(q => ({ question_id: q.id, variant_group: q.variant_group, variant_id: q.variant_id, render_type: q.render_type, visual_type: q.visual_type, domain: q.domain, viewpoint: q.viewpoint, format: q.format, response: q.response, correct: q.correct, points: q.points, earned: q.earned }))
    };
  }
  async function submit(auto = false) {
    if (state.submitted) return;
    state.submitted = true; clearInterval(state.timer);
    const results = scoreExam(); const stats = calculateStats(results); state.record = makeRecord(results, stats, auto);
    try { await api("/v1/exams/submit", { method: "POST", body: JSON.stringify({ student: state.student, result: state.record }) }); }
    catch (error) { state.submitted = false; alert(error.status === 409 ? "この受験番号は、すでに提出済みです。" : "提出を保存できませんでした。通信を確認して、もう一度提出してください。"); return; }
    localStorage.removeItem(activeKey(state.student.id)); setLocal(completedKey(state.student.id), { submitted_at: state.record.session.submitted_at, total: stats.total.earned });
    $("exam-screen").hidden = true; $("result-screen").hidden = false;
    $("result-student").textContent = `${studentText(state.student)}${auto ? "（時間終了により自動提出）" : ""}`;
    $("result-time").textContent = new Date(state.record.session.submitted_at).toLocaleString("ja-JP");
    $("total-score").textContent = formatScore(stats.total.earned, stats.total.max); $("correct-count").textContent = `正答数　${stats.total.correct} / 35 問`;
    $("result-details").innerHTML = [stats.knowledge, stats.thinking].map(s => `<div><span>${s.label}</span><strong>${formatScore(s.earned, s.max)}</strong><small>${s.correct} / ${s.count} 問正答</small></div>`).join("");
    $("domain-results").innerHTML = stats.domains.map(s => `<div><span>${s.label}</span><strong>${Math.round(s.earned / s.max * 100)}%</strong><small>${formatScore(s.earned, s.max)}</small></div>`).join("");
    $("it-result").innerHTML = `<strong>${stats.it.correct} / ${stats.it.count} 問</strong><span>${Math.round(stats.it.earned / stats.it.max * 100)}%　${formatScore(stats.it.earned, stats.it.max)}</span>`;
    const weak = [...stats.domains, stats.it].filter(s => s.max && s.earned / s.max < .7);
    $("advice-list").innerHTML = (weak.length ? weak.map(s => `<li><strong>${s.label}</strong>を復習しましょう。基本用語と代表的な問題をもう一度確認します。</li>`) : ["<li>全分野でおおむね到達しています。間違えた問題の解説を確認して、考え方を定着させましょう。</li>"]).join("");
    $("download-json").onclick = downloadJson; window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function downloadJson() {
    const blob = new Blob([JSON.stringify(state.record, null, 2)], { type: "application/json;charset=utf-8" });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob);
    link.download = `pycbt_${state.student.id}_${state.record.session.submitted_at.slice(0, 10)}.json`;
    link.click(); URL.revokeObjectURL(link.href);
  }
  $("entry-form").addEventListener("submit", event => {
    event.preventDefault(); const student = parseStudentId($("student-id").value); const name = $("student-name").value.trim();
    if (!student) { $("student-id-hint").textContent = "受験番号は「学年1桁・組1桁・出席番号2桁」の4桁で入力してください（例：1215）。"; return; }
    if (!name) return;
    const errors = validateBlueprint(QUESTION_BANK);
    if (errors.length) { alert(`問題マスタの検証に失敗しました。\n${errors.join("\n")}`); return; }
    if (getLocal(completedKey(student.id))) { $("student-id-hint").textContent = "この受験番号は、すでに提出済みです。再受験する場合は先生に申し出てください。"; return; }
    const active = getLocal(activeKey(student.id));
    state.pending = active?.student ? { ...active, student: active.student, resume: true } : { student: { ...student, name }, resume: false };
    $("start-summary").textContent = studentText(state.pending.student); $("resume-message").hidden = !state.pending.resume;
    $("resume-message").textContent = state.pending.resume ? "この受験番号には中断中の試験があります。前回の解答と残り時間を復元します。" : "受験番号と氏名を確認してから開始してください。";
    $("confirm-start").showModal();
  });
  $("confirm-start").addEventListener("close", async () => {
    if ($("confirm-start").returnValue !== "confirm" || !state.pending) { state.pending = null; return; }
    const pending = state.pending;
    try {
      const remote = await api("/v1/exams/start", { method: "POST", body: JSON.stringify({ student: pending.student }) });
      if (remote.status === "active" && !pending.resume) { $("student-id-hint").textContent = "この受験番号は、別の端末で受験中です。先生に申し出てください。"; return; }
      beginExam(pending);
    } catch (error) { $("student-id-hint").textContent = error.status === 409 ? "この受験番号は、すでに提出済みです。再受験する場合は先生に申し出てください。" : "受験の開始を確認できません。通信環境を確認して、もう一度試してください。"; }
    finally { state.pending = null; }
  });
  $("previous-button").onclick = () => { if (state.current > 0) { state.current -= 1; persistActive(); renderQuestion(); } };
  $("next-button").onclick = () => { if (state.current < state.questions.length - 1) { state.current += 1; persistActive(); renderQuestion(); } else { $("exam-notice").hidden = false; $("exam-notice").textContent = "最後の問題です。問題番号を押すと任意の問題へ移動できます。"; } };
  $("submit-button").onclick = confirmSubmission;
  $("status-submit-button").onclick = confirmSubmission;
  $("confirm-submit").addEventListener("close", () => { if ($("confirm-submit").returnValue === "confirm") submit(false); });
})();
