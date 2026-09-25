(() => {
  const $ = (id) => document.getElementById(id);
  // 試験IDは配布URLの ?exam= から受け取る。
  // パラメータが無い従来URLは DEFAULT_EXAM_ID を使うため、いつでも旧運用へ戻せる。
  const DEFAULT_EXAM_ID = "Practice-2026-09-25test";
  const EXAM_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
  const requestedExamId = new URLSearchParams(location.search).get("exam");
  const EXAM_ID = requestedExamId && EXAM_ID_PATTERN.test(requestedExamId)
    ? requestedExamId
    : DEFAULT_EXAM_ID;
  const STORAGE_PREFIX = `pycbt:v2:${EXAM_ID}:`;
  // 校内サーバのアドレスは各受験端末で入力し、その端末内にだけ保存する。
  const SERVER_IP_KEY = "pycbt:server-ip";
  const serverUrl = () => `http://${localStorage.getItem(SERVER_IP_KEY)}:3000`;
  const SERVER_TIMEOUT_MS = 12000;
  $("exam-id-label").textContent = `試験ID：${EXAM_ID}${EXAM_ID.startsWith("practice-") ? "（練習用）" : ""}`;
  $("server-ip").value = localStorage.getItem(SERVER_IP_KEY) || "";
  const validIPv4 = value => /^\d{1,3}(?:\.\d{1,3}){3}$/.test(value) &&
    value.split(".").every(part => Number(part) <= 255);
  const state = { student: null, questions: [], answers: {}, current: 0, startedAt: null, endsAt: null, timer: null, submitted: false, record: null, pending: null };
  const formatScore = (score, total) => `${score} / ${total} 点`;
  const activeKey = (id) => `${STORAGE_PREFIX}active:${id}`;
  const completedKey = (id) => `${STORAGE_PREFIX}completed:${id}`;
  const getLocal = (key) => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } };
  const setLocal = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, character => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[character]));
  const hasSourceAttribution = (q) => q.source_type === "it_passport_actual" && q.source_label;
  function parseStudentId(value) { const v = value.trim(); if (!/^[1-3][1-9]\d{2}$/.test(v) || Number(v.slice(2)) === 0) return null; return { id: v, grade: Number(v[0]), classNo: Number(v[1]), attendance: Number(v.slice(2)) }; }
  function normalize(value) { return String(value ?? "").trim().replace(/\s+/g, "").normalize("NFKC"); }
  function studentText(student) { return `${student.grade}年${student.classNo}組${student.attendance}番　${student.name}`; }
  function persistActive() {
    if (!state.student || state.submitted) return;
    setLocal(activeKey(state.student.id), { schema_version: 1, student: state.student, answers: state.answers, current: state.current, started_at: state.startedAt, ends_at: state.endsAt, question_ids: state.questions.map(q => q.id) });
  }
  function renderQuestion() {
    $("exam-notice").hidden = state.current !== state.questions.length - 1;
    $("exam-notice").textContent = state.current === state.questions.length - 1 ? "最後の問題です。問題番号を押すと任意の問題へ移動できます。" : "";
    const q = state.questions[state.current]; const answer = state.answers[q.id] ?? "";
    const presentation = window.questionPresentation(q);
    const attribution = hasSourceAttribution(q);
    const sourceName = q.source_url
      ? `<a href="${escapeHtml(q.source_url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(q.source_label)}</a>`
      : escapeHtml(q.source_label);
    const sourceNote = q.source_supplemental_visual ? "（問題文・選択肢は原文、補助図は本サイト作成）" : q.source_modified ? "（一部改変）" : "";
    $("progress-label").textContent = `第 ${state.current + 1} 問 / ${state.questions.length} 問`;
    const visual = q.visual_type !== "none" ? `<div class="visual" aria-label="${escapeHtml(q.visual_type)}図表">${q.visual ?? "図表データ未登録"}</div>` : "";
    const input = q.format === "choice" ? `<div class="answer-area">${q.choices.map((choice, i) => `<label class="choice"><input type="radio" name="answer" value="${escapeHtml(choice)}" ${answer === choice ? "checked" : ""}/><span>${String.fromCharCode(65 + i)}. ${escapeHtml(choice)}</span></label>`).join("")}</div>` : `<div class="answer-area"><label>解答<input class="answer-input" id="answer-input" value="${escapeHtml(answer)}" autocomplete="off" /></label></div>`;
    $("question-card").innerHTML = `<p class="question-meta">${escapeHtml(q.id)}　${escapeHtml(DOMAIN_NAMES[q.domain])}　${q.points}点　${q.format === "choice" ? "4択" : "入力"}${q.it_passport ? "　ITパスポート関連" : ""}${q.paiza_chapter ? `　Python体験編 Chap.${q.paiza_chapter}` : ""}</p><div class="question-body"><h2 id="question-heading" tabindex="-1">${escapeHtml(presentation.text)}</h2>${attribution ? `<p class="source-attribution">出典：${sourceName}${escapeHtml(sourceNote)}</p>` : ""}${presentation.code ? `<pre class="question-code"><code>${escapeHtml(presentation.code)}</code></pre>` : ''}${visual}${input}</div>`;
    document.querySelectorAll('input[name="answer"]').forEach(el => el.addEventListener("change", () => { state.answers[q.id] = el.value; persistActive(); renderNav(); }));
    $("answer-input")?.addEventListener("input", event => { state.answers[q.id] = event.target.value; persistActive(); renderNav(); });
    $("previous-button").disabled = state.current === 0;
    $("next-button").textContent = state.current === state.questions.length - 1 ? "解答を確認して提出" : "次の問題";
    renderNav();
  }
  function renderNav() {
    $("question-dots").innerHTML = state.questions.map((q, i) => `<button type="button" class="${i === state.current ? "active" : ""} ${normalize(state.answers[q.id]) ? "answered" : ""}" data-index="${i}" aria-label="第${i + 1}問">${i + 1}</button>`).join("");
    document.querySelectorAll("[data-index]").forEach(button => {
      const i = Number(button.dataset.index);
      button.setAttribute('aria-label', `第${i + 1}問・${normalize(state.answers[state.questions[i].id]) ? '解答済み' : '未解答'}`);
      if (i === state.current) button.setAttribute('aria-current', 'step');
      button.addEventListener("click", () => { state.current = i; persistActive(); renderQuestion(); $("question-heading").focus(); });
    });
  }
  function tick() {
    const remaining = Math.max(0, Math.ceil((new Date(state.endsAt).getTime() - Date.now()) / 1000));
    const m = Math.floor(remaining / 60); const s = remaining % 60;
    $("timer").textContent = `残り ${m}:${String(s).padStart(2, "0")}`;
    if (remaining <= 0) submit(true);
  }
  function beginExam(session) {
    state.student = session.student;
    state.questions = generateExamForStudent(state.student.id);
    state.answers = session.answers ?? {};
    state.current = session.current ?? 0;
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
    $("unanswered-message").textContent = missing ? `未回答が${missing}問あります。提出後は解答を変更できません。` : `${state.questions.length}問すべてに解答済みです。提出後は解答を変更できません。`;
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

  function scoreRate(item) {
    return item?.max ? item.earned / item.max : 0;
  }

  function uniqueIncorrectSkills(questions) {
    const seen = new Set();
    const skills = [];
    for (const q of questions || []) {
      if (q.correct || !q.skill) continue;
      const skill = String(q.skill).trim();
      if (!skill || seen.has(skill)) continue;
      seen.add(skill);
      skills.push(skill);
    }
    return skills;
  }

  function domainItems(scores) {
    const domains = Array.isArray(scores?.domains)
      ? scores.domains
      : Object.values(scores?.domains || {});
    return domains
      .filter(item => item?.max)
      .map(item => ({
        ...item,
        rate: scoreRate(item),
        misses: Math.max(0, Number(item.count || 0) - Number(item.correct || 0))
      }))
      .sort((a, b) => a.rate - b.rate || b.misses - a.misses || String(a.label).localeCompare(String(b.label), "ja"));
  }

  function renderAdvice(scores, questions) {
    const total = scores.total;
    const totalRate = scoreRate(total);
    const totalPct = Math.round(totalRate * 100);
    const perfect = total?.count > 0 && total.correct === total.count;
    const skills = uniqueIncorrectSkills(questions);
    const domains = domainItems(scores);
    const items = [];

    if (perfect) {
      items.push("<strong>全問正解です。</strong>今回の範囲は十分に定着しています。分野全体を復習する必要はありません。");
    } else if (totalRate >= 0.9) {
      items.push(`<strong>高い到達度です（${totalPct}％）。</strong>基礎から学び直すより、今回の取りこぼしを絞って確認する段階です。`);
    } else if (totalRate >= 0.8) {
      items.push(`<strong>十分に到達しています（${totalPct}％）。</strong>全体を復習するのではなく、誤答した内容を中心に確認しましょう。`);
    } else if (totalRate >= 0.6) {
      items.push(`<strong>おおむね到達しています（${totalPct}％）。</strong>できている内容を維持しながら、誤答が重なった分野を優先して補強しましょう。`);
    } else {
      items.push(`<strong>基礎の定着を優先しましょう（${totalPct}％）。</strong>広く解き直すより、優先順位を付けて基本事項から確認する方が効果的です。`);
    }

    if (!perfect) {
      const skillLimit = totalRate >= 0.8 ? 3 : 2;
      const focusSkills = skills.slice(0, skillLimit);
      const focusDomains = domains.filter(d => d.rate < 0.7 && d.misses >= 2).slice(0, 2);

      if (totalRate >= 0.9 && focusSkills.length) {
        items.push(`今回の誤答では <strong>${focusSkills.map(escapeHtml).join("・")}</strong> を確認すると、取りこぼしを減らせます。`);
      } else if (focusDomains.length) {
        const labels = focusDomains.map(d => escapeHtml(d.label)).join("・");
        const skillText = focusSkills.length
          ? ` 特に <strong>${focusSkills.map(escapeHtml).join("・")}</strong> を解き直してください。`
          : "";
        items.push(`優先して見直したい分野は <strong>${labels}</strong> です。${skillText}`);
      } else if (focusSkills.length) {
        items.push(`今回の誤答に関係する <strong>${focusSkills.map(escapeHtml).join("・")}</strong> を中心に解き直しましょう。`);
      }
    }

    const knowledgeRate = scoreRate(scores.knowledge);
    const thinkingRate = scoreRate(scores.thinking);
    const viewpointGap = Math.abs(knowledgeRate - thinkingRate);

    if (viewpointGap >= 0.15) {
      if (knowledgeRate > thinkingRate) {
        items.push("<strong>知識・技能の得点率が高めです。</strong>次は、条件を整理し、処理を1行ずつ追って「なぜその答えになるか」を説明する問題に取り組みましょう。");
      } else {
        items.push("<strong>思考・判断・表現の得点率が高めです。</strong>問題を考えて解く力を生かしつつ、用語・Pythonの基本構文・演算規則を整理すると得点がさらに安定します。");
      }
    } else if (perfect || totalRate >= 0.9) {
      items.push("次は、処理結果を答えるだけでなく、<strong>理由を説明する・別解を考える・条件を変えて確かめる</strong>学習に進みましょう。");
    } else if (totalRate >= 0.8) {
      items.push("解き直しでは答えだけを覚えず、<strong>どの条件・規則を使ったか</strong>を言葉で説明できるか確認しましょう。");
    } else if (totalRate >= 0.6) {
      items.push("誤答は、<strong>問題文の条件 → 処理の途中経過 → 答え</strong>の順に書き出して解き直すと理解を整理しやすくなります。");
    } else {
      items.push("まずは、例題を使って<strong>用語・基本構文・処理の流れ</strong>を確認し、その後に同じ型の問題をもう一度解きましょう。");
    }

    $("advice-list").innerHTML = items.slice(0, 3).map(item => `<li>${item}</li>`).join("");
  }
  function makeRecord(results, stats, auto) {
    return {
      schema_version: 1,
      assessment: { title: "情報I CBT", exam_id: EXAM_ID, pool_version: window.PYCBT_POOL_VERSION,
        blueprint: EXAM_BLUEPRINT, question_bank_capacity: QUESTION_BANK_CAPACITY },
      student: { id: state.student.id, grade: state.student.grade, class: state.student.classNo, attendance: state.student.attendance, name: state.student.name },
      session: { started_at: state.startedAt, submitted_at: new Date().toISOString(), auto_submitted: auto, duration_seconds: EXAM_BLUEPRINT.durationSeconds },
      scores: { total: stats.total, knowledge: stats.knowledge, thinking: stats.thinking, domains: Object.fromEntries(stats.domains.map(item => [item.label.slice(0, 1), item])), it_passport: stats.it },
      questions: results.map(q => ({ question_id: q.id, base_question_id: q.base_question_id || q.id, variant_group: q.variant_group, variant_id: q.variant_id, render_type: q.render_type, visual_type: q.visual_type, domain: q.domain, viewpoint: q.viewpoint, format: q.format, skill: q.skill, paiza_chapter: q.paiza_chapter, curriculum_ref: q.curriculum_ref, source_type: q.source_type, source_year: q.source_year, source_period: q.source_period, source_question_no: q.source_question_no, source_label: q.source_label, source_url: q.source_url, source_answer_url: q.source_answer_url, source_modified: q.source_modified, source_supplemental_visual: q.source_supplemental_visual, response: q.response, correct: q.correct, points: q.points, earned: q.earned }))
    };
  }

  // 試験結果を校内サーバへ送信する。応答が途絶えた場合も結果画面を待たせ続けない。
  async function sendResultToServer(record) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SERVER_TIMEOUT_MS);
    try {
      const response = await fetch(`${serverUrl()}/api/results`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          studentCode: record.student.id,
          studentName: record.student.name,
          examId: record.assessment.exam_id,
          poolVersion: record.assessment.pool_version,
          className: `${record.student.grade}年${record.student.class}組`,
          score: record.scores.total.earned,
          knowledgeScore: record.scores.knowledge.earned,
          thinkingScore: record.scores.thinking.earned,
          answers: record.questions,
          startedAt: record.session.started_at
        })
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      if (!result.success) throw new Error(result.message || "保存に失敗しました");
      return { success: true, result };
    } catch (error) {
      console.error("校内サーバへの成績送信に失敗しました", error);
      return { success: false, error: error.message };
    } finally {
      clearTimeout(timeout);
    }
  }

  async function submit(auto = false) {
    if (state.submitted) return;
    state.submitted = true; clearInterval(state.timer);
    if ($("confirm-submit").open) $("confirm-submit").close('timeout');
    const results = scoreExam(); const stats = calculateStats(results); state.record = makeRecord(results, stats, auto);
    // 通信の前に端末へ結果を残す。サーバが応答しなくてもダウンロードできる。
    setLocal(`${STORAGE_PREFIX}result:${state.student.id}`, state.record);
    localStorage.removeItem(activeKey(state.student.id)); setLocal(completedKey(state.student.id), { submitted_at: state.record.session.submitted_at, total: stats.total.earned });
    $("exam-screen").hidden = true; $("result-screen").hidden = false;
    $("server-save-status").textContent = "学校サーバへ送信中です…";
    $("result-student").textContent = `${studentText(state.student)}${auto ? "（時間終了により自動提出）" : ""}`;
    $("result-time").textContent = new Date(state.record.session.submitted_at).toLocaleString("ja-JP");
    $("total-score").textContent = formatScore(stats.total.earned, stats.total.max); $("correct-count").textContent = `正答数　${stats.total.correct} / ${stats.total.count} 問`;
    $("result-details").innerHTML = [stats.knowledge, stats.thinking].map(s => `<div><span>${s.label}</span><strong>${formatScore(s.earned, s.max)}</strong><small>${s.correct} / ${s.count} 問正答</small></div>`).join("");
    $("domain-results").innerHTML = stats.domains.map(s => `<div><span>${s.label}</span><strong>${Math.round(s.earned / s.max * 100)}%</strong><small>${formatScore(s.earned, s.max)}</small></div>`).join("");
    $("it-result").innerHTML = `<strong>${stats.it.correct} / ${stats.it.count} 問</strong><span>${Math.round(stats.it.earned / stats.it.max * 100)}%　${formatScore(stats.it.earned, stats.it.max)}</span>`;
    renderAdvice(stats, results);
    window.scrollTo({ top: 0, behavior: "smooth" });
    const serverResult = await sendResultToServer(state.record);
    if (serverResult.success && serverResult.result.verified) {
      const verified = serverResult.result;
      const mismatch = verified.scores.total.earned !== stats.total.earned ||
        verified.scores.knowledge.earned !== stats.knowledge.earned ||
        verified.scores.thinking.earned !== stats.thinking.earned;
      state.record.scores = verified.scores;
      const byId = new Map(verified.questionResults.map(q => [q.question_id, q]));
      state.record.questions = state.record.questions.map(q => ({ ...q,
        correct: byId.get(q.question_id).correct, points: byId.get(q.question_id).points,
        earned: byId.get(q.question_id).earned }));
      state.record.assessment.server_verified = true;
      setLocal(`${STORAGE_PREFIX}result:${state.student.id}`, state.record);
      $("total-score").textContent = formatScore(verified.scores.total.earned, verified.scores.total.max);
      $("correct-count").textContent = `正答数　${verified.scores.total.correct} / ${verified.scores.total.count} 問`;
      $("result-details").innerHTML = [verified.scores.knowledge, verified.scores.thinking].map(s => `<div><span>${s.label}</span><strong>${formatScore(s.earned, s.max)}</strong><small>${s.correct} / ${s.count} 問正答</small></div>`).join("");
      $("domain-results").innerHTML = Object.values(verified.scores.domains).map(s => `<div><span>${s.label}</span><strong>${Math.round(s.earned / s.max * 100)}%</strong><small>${formatScore(s.earned, s.max)}</small></div>`).join("");
      const it = verified.scores.it_passport;
      $("it-result").innerHTML = `<strong>${it.correct} / ${it.count} 問</strong><span>${Math.round(it.earned / it.max * 100)}%　${formatScore(it.earned, it.max)}</span>`;
      renderAdvice(verified.scores, state.record.questions);
      $("server-save-status").textContent = mismatch
        ? "✅ 学校サーバで再採点して保存しました。端末側の点数と差があるため先生に知らせてください。"
        : "✅ 学校サーバで再採点し、成績を保存しました。";
    } else {
      $("server-save-status").textContent = serverResult.success
        ? "⚠ 成績は保存されましたが、サーバで採点を確認できません。先生へ知らせてください。"
        : "⚠ 学校サーバへ送信できませんでした。結果JSONをダウンロードし、画面を閉じずに先生へ知らせてください。";
    }
  }
  $("entry-form").addEventListener("submit", event => {
    event.preventDefault(); const student = parseStudentId($("student-id").value); const name = $("student-name").value.trim();
    const serverIp = $("server-ip").value.trim();
    if (!validIPv4(serverIp)) {
      $("server-ip-hint").textContent = "先生から指定された学校サーバのIPv4アドレスを入力してください。";
      return;
    }
    localStorage.setItem(SERVER_IP_KEY, serverIp);
    if (!student) { $("student-id-hint").textContent = "受験番号は「学年1桁・組1桁・出席番号2桁」の4桁で入力してください（例：1215）。"; return; }
    if (!name) return;
    const errors = validateBlueprint(generateExamForStudent(student.id));
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
    beginExam(pending);
    state.pending = null;
  });
  $("previous-button").onclick = () => { if (state.current > 0) { state.current -= 1; persistActive(); renderQuestion(); $("question-heading").focus(); } };
  $("next-button").onclick = () => { if (state.current < state.questions.length - 1) { state.current += 1; persistActive(); renderQuestion(); $("question-heading").focus(); } else { confirmSubmission(); } };
  $("submit-button").onclick = confirmSubmission;
  $("status-submit-button").onclick = confirmSubmission;
  $("confirm-submit").addEventListener("close", () => { if ($("confirm-submit").returnValue === "confirm") submit(false); });
  $("download-result").onclick = () => {
    if (!state.record) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(state.record, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `CBT_${state.student.id}_${state.record.session.submitted_at.replace(/[:.]/g, "-")}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
})();
