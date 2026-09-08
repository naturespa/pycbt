(() => {
  const VERSION = "2026-09-08-pool175";
  const VARIANT_COUNT = 5;
  const slots = window.PYCBT_POOL_SLOTS || [];

  function hashSeed(text) {
    let h = 2166136261 >>> 0;
    for (const ch of String(text)) {
      h ^= ch.charCodeAt(0);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function seededRandom(seed) {
    let a = seed >>> 0;
    return () => {
      a |= 0;
      a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function shuffled(values, rng) {
    const result = [...values];
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  function parseStudentCode(studentId) {
    const value = String(studentId || "").trim();
    const m = value.match(/^([1-3])([1-9])(\d{2})$/);
    if (!m) return null;
    return {
      grade: Number(m[1]),
      classNo: Number(m[2]),
      attendance: Number(m[3]),
      classKey: `${m[1]}${m[2]}`
    };
  }

  function variantSequence(classKey, slotId, length) {
    const rng = seededRandom(hashSeed(`${VERSION}:${classKey}:${slotId}:variant-sequence`));
    const sequence = [];
    const counts = [0, 0, 0, 0, 0];
    for (let i = 0; i < length; i += 1) {
      const banned = new Set(sequence.slice(-2));
      const candidates = [0, 1, 2, 3, 4].filter(v => !banned.has(v));
      const minCount = Math.min(...candidates.map(v => counts[v]));
      const balanced = candidates.filter(v => counts[v] === minCount);
      const selected = balanced[Math.floor(rng() * balanced.length)];
      sequence.push(selected);
      counts[selected] += 1;
    }
    return sequence;
  }

  function chooseVariantIndex(studentId, slotId) {
    const parsed = parseStudentCode(studentId);
    if (!parsed || parsed.attendance < 1) return hashSeed(`${VERSION}:${studentId}:${slotId}`) % VARIANT_COUNT;
    return variantSequence(parsed.classKey, slotId, parsed.attendance)[parsed.attendance - 1];
  }

  function buildQuestion(slot, variantIndex, studentId) {
    const variant = slot.variants[variantIndex];
    const id = `${slot.slot_id}-${variantIndex + 1}`;
    const acceptable = variant.acceptable_answers?.length ? variant.acceptable_answers : [variant.answer];
    const q = {
      id,
      base_question_id: slot.slot_id,
      domain: slot.domain,
      viewpoint: slot.viewpoint,
      format: slot.format,
      points: slot.points,
      difficulty: slot.viewpoint === "knowledge" ? "basic" : "standard",
      source: slot.it_passport ? "itp_similar" : "textbook_original",
      source_ref: slot.it_passport ? "ITパスポート出題領域に準拠した類似問題" : "情報I CBT オリジナル",
      it_passport: slot.it_passport,
      render_type: "pool",
      visual_type: slot.visual_type,
      variant_group: slot.slot_id,
      variant_id: `v${variantIndex + 1}`,
      skill: slot.skill,
      question: variant.question,
      answer: String(variant.answer),
      acceptable_answers: acceptable.map(String),
      choices: variant.choices ? [...variant.choices].map(String) : undefined,
      visual: variant.visual,
      explanation: variant.explanation,
      advice_tag: slot.skill
    };
    if (q.format === "choice") {
      q.choices = shuffled(q.choices, seededRandom(hashSeed(`${VERSION}:${studentId}:${id}:choices`)));
    }
    return q;
  }

  function generateExam(studentId) {
    const id = String(studentId || "").trim();
    const questions = slots.map(slot => buildQuestion(slot, chooseVariantIndex(id, slot.slot_id), id));
    return shuffled(questions, seededRandom(hashSeed(`${VERSION}:${id}:question-order`)));
  }

  function validatePool() {
    const errors = [];
    if (slots.length !== 35) errors.push(`出題スロットが35ではありません（${slots.length}）。`);
    const poolSize = slots.reduce((sum, slot) => sum + slot.variants.length, 0);
    if (poolSize !== 175) errors.push(`問題プールが175問ではありません（${poolSize}）。`);
    const ids = new Set();
    for (const slot of slots) {
      if (slot.variants.length !== 5) errors.push(`${slot.slot_id} のvariantが5問ではありません。`);
      slot.variants.forEach((v, i) => {
        const id = `${slot.slot_id}-${i + 1}`;
        if (ids.has(id)) errors.push(`${id} が重複しています。`);
        ids.add(id);
        if (!v.question || v.answer === undefined) errors.push(`${id} の問題文または正答がありません。`);
        if (slot.format === "choice") {
          if (!Array.isArray(v.choices) || v.choices.length !== 4) errors.push(`${id} の選択肢が4つではありません。`);
          if (!v.choices?.map(String).includes(String(v.answer))) errors.push(`${id} の正答が選択肢にありません。`);
        }
        if (slot.visual_type !== "none" && !v.visual) errors.push(`${id} に図表データがありません。`);
      });
    }
    for (const id of ["1111","1221","1222","1739","2140","3140"]) {
      const e = validateBlueprint(generateExam(id));
      errors.push(...e.map(x => `${id}: ${x}`));
    }
    return errors;
  }

  function auditExamSets(studentIds) {
    const sets = studentIds.map(id => {
      const questions = generateExam(String(id));
      return { id: String(id), questions, ids: new Set(questions.map(q => q.id)) };
    });
    return sets.map((item, index) => {
      if (index === 0) return { student:item.id, previous:null, sameExactQuestions:0, exactOverlapRate:0 };
      const prev = sets[index - 1];
      const same = item.questions.filter(q => prev.ids.has(q.id)).length;
      return {
        student:item.id,
        previous:prev.id,
        sameExactQuestions:same,
        exactOverlapRate:Math.round(same / 35 * 1000) / 10
      };
    });
  }

  function auditClass(grade, classNo, maxAttendance = 40) {
    const ids = Array.from({length:maxAttendance}, (_,i) => `${grade}${classNo}${String(i+1).padStart(2,"0")}`);
    const adjacent = auditExamSets(ids).slice(1);
    const overlaps = adjacent.map(x => x.sameExactQuestions);
    const signatures = ids.map(id => generateExam(id).map(q => q.id).sort().join("|"));
    return {
      grade, classNo, students:ids.length, poolSize:175,
      adjacent:{
        average: overlaps.length ? Math.round(overlaps.reduce((a,b)=>a+b,0)/overlaps.length*100)/100 : 0,
        max: overlaps.length ? Math.max(...overlaps) : 0,
        min: overlaps.length ? Math.min(...overlaps) : 0
      },
      duplicateFullSets:signatures.length-new Set(signatures).size
    };
  }

  function auditGrade(grade=1, classes=7, maxAttendance=40) {
    const classAudits = Array.from({length:classes}, (_,i)=>auditClass(grade,i+1,maxAttendance));
    return {
      version:VERSION,
      grade, classes, students:classes*maxAttendance, poolSize:175,
      classAudits,
      maxAdjacentOverlap:Math.max(...classAudits.map(a=>a.adjacent.max)),
      duplicateFullSets:classAudits.reduce((s,a)=>s+a.duplicateFullSets,0),
      poolValidationErrors:validatePool()
    };
  }

  generateExamForStudent = generateExam;
  window.generateExamForStudent = generateExam;
  window.PYCBT_POOL_VERSION = VERSION;
  window.PYCBT_POOL_SIZE = 175;
  window.validateQuestionPool = validatePool;
  window.auditExamSets = auditExamSets;
  window.auditClass = auditClass;
  window.auditGrade = auditGrade;

  Object.defineProperty(QUESTION_BANK, Symbol.iterator, {
    configurable:true,
    value:function* () {
      const id = document.getElementById("student-id")?.value?.trim() || "1221";
      yield* generateExam(id);
    }
  });

  const errors = validatePool();
  if (errors.length) console.error("CBT問題プール検証エラー", errors);
  else console.info(`CBT問題プール ${VERSION}: 175問 / 検証OK`);
})();