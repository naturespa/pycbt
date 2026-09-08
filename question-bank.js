/*
 * 情報I CBT 問題マスタ
 * 35個の出題スロットを維持しつつ、受験番号をseedとして各スロットを個別化する。
 * これにより、同じ受験番号では常に同じ問題セットを再現し、隣接番号では
 * variant・選択肢順・問題順が変わる。将来は各スロットの実問題variantsを追加可能。
 */
const QUESTION_BANK_CAPACITY = 181;
const EXAM_BLUEPRINT = {
  totalQuestions: 35, totalPoints: 100, durationSeconds: 40 * 60,
  domains: { A: 5, B: 3, C: 6, D: 7, E: 6, F: 8 },
  viewpoints: { knowledge: { questions: 15, points: 40 }, thinking: { questions: 20, points: 60 } },
  formats: { choice: 25, input: 10 }, itPassport: 10,
  visuals: { A: 2, E: 2, F: 2 }
};

const DOMAIN_NAMES = { A: "アルゴリズム基礎・表現", B: "コンピュータ言語", C: "変数・データ型・演算", D: "条件分岐・反復", E: "配列・データ構造", F: "擬似言語・総合アルゴリズム" };

function makeQuestion({ id, domain, viewpoint, format, points, itPassport = false, visualType = "none", variantGroup = null, variantId = null, renderType = variantGroup ? "parameter" : "fixed", skill, question, answer, choices, visual, explanation, adviceTag }) {
  return { id, domain, viewpoint, format, points, difficulty: "basic", source: itPassport ? "itp_similar" : "textbook_original", source_ref: "CBT問題バンク", it_passport: itPassport, render_type: renderType, visual_type: visualType, variant_group: variantGroup, variant_id: variantId, skill, question, answer: String(answer), acceptable_answers: [String(answer)], choices, visual, explanation, advice_tag: adviceTag };
}

const QUESTION_BANK = [
  makeQuestion({ id:"A001",domain:"A",viewpoint:"knowledge",format:"choice",points:2,itPassport:true,visualType:"flowchart",skill:"フローチャート",question:"開始・終了を表すフローチャート記号として最も適切なものはどれか。",choices:["端子","処理","判断","入出力"],answer:"端子",visual:"[開始] → 処理 → [終了]",adviceTag:"algorithm" }),
  makeQuestion({ id:"A002",domain:"A",viewpoint:"knowledge",format:"choice",points:2,itPassport:false,visualType:"state",skill:"状態遷移",question:"状態遷移図で、状態間を結ぶ矢印が表すものはどれか。",choices:["状態の変化","変数の型","配列の要素","繰返し回数"],answer:"状態の変化",visual:"待機 ──押す──> 動作",adviceTag:"algorithm" }),
  makeQuestion({ id:"A003",domain:"A",viewpoint:"knowledge",format:"choice",points:2,itPassport:false,skill:"アルゴリズム",question:"アルゴリズムの説明として適切なものはどれか。",choices:["問題を解く手順","画面の色","記憶装置の容量","通信の速さ"],answer:"問題を解く手順",adviceTag:"algorithm" }),
  makeQuestion({ id:"A004",domain:"A",viewpoint:"thinking",format:"choice",points:2,itPassport:false,skill:"処理順序",question:"処理を上から順に一度ずつ実行する基本構造はどれか。",choices:["順次","分岐","反復","再帰"],answer:"順次",adviceTag:"algorithm" }),
  makeQuestion({ id:"A005",domain:"A",viewpoint:"thinking",format:"input",points:4,variantGroup:"a-trace",skill:"手順追跡",question:"変数 x を 3 とし、x ← x + 4 を実行した後の x を半角数字で答えなさい。",answer:"7",adviceTag:"calculation" }),
  makeQuestion({ id:"B001",domain:"B",viewpoint:"knowledge",format:"choice",points:2,itPassport:true,skill:"コンパイラ",question:"高水準言語で書かれたプログラムを機械語へ変換するソフトウェアはどれか。",choices:["コンパイラ","ブラウザ","表計算ソフト","OS"],answer:"コンパイラ",adviceTag:"language" }),
  makeQuestion({ id:"B002",domain:"B",viewpoint:"knowledge",format:"choice",points:2,skill:"プログラミング言語",question:"プログラミング言語を用いる主な目的はどれか。",choices:["コンピュータに処理を指示する","画像を印刷する","通信速度を上げる","電源を入れる"],answer:"コンピュータに処理を指示する",adviceTag:"language" }),
  makeQuestion({ id:"B003",domain:"B",viewpoint:"knowledge",format:"choice",points:4,itPassport:false,skill:"擬似言語",question:"擬似言語を用いる利点として適切なものはどれか。",choices:["処理の考え方を言語に依存せず表せる","必ず高速に実行できる","機械語になる","OSが不要になる"],answer:"処理の考え方を言語に依存せず表せる",adviceTag:"language" }),
  makeQuestion({ id:"C001",domain:"C",viewpoint:"knowledge",format:"choice",points:2,itPassport:true,skill:"変数",question:"値を一時的に保存し、後から変更できる名前付きの箱を何というか。",choices:["変数","定数","関数","配列"],answer:"変数",adviceTag:"variables" }),
  makeQuestion({ id:"C002",domain:"C",viewpoint:"knowledge",format:"choice",points:2,skill:"演算子",question:"余りを求める演算子として使われることが多いものはどれか。",choices:["%","+","=","/"],answer:"%",adviceTag:"variables" }),
  makeQuestion({ id:"C003",domain:"C",viewpoint:"knowledge",format:"choice",points:4,skill:"データ型",question:"小数を含む数値を扱うのに適したデータ型はどれか。",choices:["実数型","論理型","文字列型","整数型だけ"],answer:"実数型",adviceTag:"variables" }),
  makeQuestion({ id:"C004",domain:"C",viewpoint:"thinking",format:"choice",points:2,itPassport:true,variantGroup:"arithmetic",skill:"演算",question:"a ← 10、b ← 3 のとき、a % b の値はどれか。",choices:["1","3","7","10"],answer:"1",adviceTag:"calculation" }),
  makeQuestion({ id:"C005",domain:"C",viewpoint:"thinking",format:"input",points:4,variantGroup:"arithmetic",skill:"代入",question:"x ← 5、x ← x × 3 のとき、最後の x を半角数字で答えなさい。",answer:"15",adviceTag:"calculation" }),
  makeQuestion({ id:"C006",domain:"C",viewpoint:"thinking",format:"input",points:4,variantGroup:"logic",skill:"論理演算",question:"真 AND 偽 の結果を、真または偽で答えなさい。",answer:"偽",adviceTag:"logic" }),
];

const DOMAIN_PLAN = { D: ["条件が真のとき実行される構造はどれか。", "分岐", "condition"], E: ["配列の先頭要素の添字として一般的なものはどれか。", "0", "array"], F: ["2つの値を比較して必要なら入れ替える処理に関係する整列法はどれか。", "交換法", "pseudocode"] };
function fillDemoQuestions() {
  const target = { D:7, E:6, F:8 };
  for (const domain of Object.keys(target)) {
    const visualIndexes = domain === "D" ? [] : [0, 1];
    for (let index = 0; index < target[domain]; index += 1) {
      const [text, correct, tag] = DOMAIN_PLAN[domain];
      const thinking = index >= 2;
      const input = thinking && index >= target[domain] - (domain === "D" ? 3 : 2);
      QUESTION_BANK.push(makeQuestion({ id:`${domain}${String(index + 1).padStart(3,"0")}`, domain, viewpoint:thinking ? "thinking" : "knowledge", format:input ? "input" : "choice", points: thinking ? (input ? 4 : 2) : (index === 1 ? 4 : 2), itPassport: !input && index < 2, visualType:visualIndexes.includes(index) ? (domain === "E" ? "table" : "sort_trace") : "none", variantGroup:`${domain.toLowerCase()}-slot-${index + 1}`, skill:tag, question: input ? `${text} 正答を入力しなさい。` : text, answer:correct, choices:input ? undefined : [correct, "反復", "配列", "変数"], visual:visualIndexes.includes(index) ? "図表を用いる問題の表示領域" : undefined, adviceTag:tag }));
    }
  }
}
fillDemoQuestions();

function validateBlueprint(questions) {
  const count = (predicate) => questions.filter(predicate).length;
  const sum = (predicate) => questions.filter(predicate).reduce((total, q) => total + q.points, 0);
  const errors = [];
  if (questions.length !== EXAM_BLUEPRINT.totalQuestions) errors.push("問題数が35問ではありません。");
  if (sum(() => true) !== EXAM_BLUEPRINT.totalPoints) errors.push("合計点が100点ではありません。");
  for (const [domain, expected] of Object.entries(EXAM_BLUEPRINT.domains)) if (count(q => q.domain === domain) !== expected) errors.push(`${domain}分野の問題数が一致しません。`);
  for (const [viewpoint, spec] of Object.entries(EXAM_BLUEPRINT.viewpoints)) if (count(q => q.viewpoint === viewpoint) !== spec.questions || sum(q => q.viewpoint === viewpoint) !== spec.points) errors.push(`${viewpoint}の配点が一致しません。`);
  for (const [format, expected] of Object.entries(EXAM_BLUEPRINT.formats)) if (count(q => q.format === format) !== expected) errors.push(`${format}問題数が一致しません。`);
  if (count(q => q.it_passport) !== EXAM_BLUEPRINT.itPassport) errors.push("ITパスポート関連が10問ではありません。");
  if (questions.some(q => q.it_passport && q.format !== "choice")) errors.push("ITパスポート関連はすべて4択にしてください。");
  if (questions.some(q => q.format === "choice" && (!Array.isArray(q.choices) || q.choices.length !== 4))) errors.push("4択問題には選択肢を4つ登録してください。");
  for (const [domain, expected] of Object.entries(EXAM_BLUEPRINT.visuals)) if (count(q => q.domain === domain && q.visual_type !== "none") !== expected) errors.push(`${domain}分野の図表数が一致しません。`);
  return errors;
}

// ---------- 受験番号seedによる個別化 ----------
function hashSeed(text) {
  let h = 2166136261 >>> 0;
  for (const ch of String(text)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
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

const WORDING_VARIANTS = {
  A001:["開始・終了を表すフローチャート記号として最も適切なものはどれか。","フローチャートで処理の開始点と終了点に用いる記号はどれか。","処理の始まり・終わりを示す端子記号に該当するものを選びなさい。"],
  A002:["状態遷移図で、状態間を結ぶ矢印が表すものはどれか。","状態遷移図の矢印は何を表しているか。","ある状態から別の状態へ移ることを示す矢印の意味として適切なものはどれか。"],
  A003:["アルゴリズムの説明として適切なものはどれか。","問題解決のための手順を表す用語はどれか。","コンピュータで問題を解く際の処理手順を何というか。"],
  A004:["処理を上から順に一度ずつ実行する基本構造はどれか。","命令を記述された順番に実行する構造を何というか。","分岐や反復を行わず、処理を順番に進める基本構造はどれか。"],
  B001:["高水準言語で書かれたプログラムを機械語へ変換するソフトウェアはどれか。","プログラム全体を機械語などへ翻訳する処理系として最も適切なものはどれか。","高水準言語をコンピュータが実行できる形式へ変換するものはどれか。"],
  B002:["プログラミング言語を用いる主な目的はどれか。","プログラミング言語は主に何のために利用するか。","コンピュータに処理内容を記述して指示するために用いるものはどれか。"],
  B003:["擬似言語を用いる利点として適切なものはどれか。","擬似言語を使ってアルゴリズムを表現するメリットはどれか。","特定のプログラミング言語に依存せず処理手順を表す方法の利点を選びなさい。"],
  C001:["値を一時的に保存し、後から変更できる名前付きの箱を何というか。","プログラムで値を保持し、処理中に内容を変更できるものを何というか。","値に名前を付けて保存し、必要に応じて更新できるものはどれか。"],
  C002:["余りを求める演算子として使われることが多いものはどれか。","整数の除算で余りを求める際によく使う演算子はどれか。","剰余を求める演算子として一般的な記号を選びなさい。"],
  C003:["小数を含む数値を扱うのに適したデータ型はどれか。","3.14のような小数を格納するのに適した型はどれか。","整数だけでなく小数部分をもつ数値を扱う型として適切なものはどれか。"]
};

function setChoice(q, question, answer, choices) {
  q.question = question; q.answer = String(answer); q.acceptable_answers = [String(answer)]; q.choices = choices.map(String); return q;
}
function setInput(q, question, answer) {
  q.question = question; q.answer = String(answer); q.acceptable_answers = [String(answer)]; q.choices = undefined; return q;
}

function applyGeneratedVariant(base, variant, rng) {
  const q = { ...base, acceptable_answers:[...base.acceptable_answers], choices:base.choices ? [...base.choices] : undefined };
  q.base_question_id = base.id;
  q.variant_id = `v${variant + 1}`;
  q.id = `${base.id}-V${variant + 1}`;
  q.render_type = "parameter";

  if (WORDING_VARIANTS[base.id]) q.question = WORDING_VARIANTS[base.id][variant % WORDING_VARIANTS[base.id].length];

  if (base.id === "A005") {
    const starts=[3,6,8,4,9,7,5], adds=[4,5,3,7,2,6,8]; const x=starts[variant], y=adds[variant];
    setInput(q, `変数 x を ${x} とし、x ← x + ${y} を実行した後の x を半角数字で答えなさい。`, x+y);
  }
  if (base.id === "C004") {
    const a=[10,14,17,22,26,31,38][variant], b=[3,4,5,6,7,8,9][variant], ans=a%b;
    setChoice(q, `a ← ${a}、b ← ${b} のとき、a % b の値はどれか。`, ans, [ans,b,a-b,a]);
  }
  if (base.id === "C005") {
    const x=[5,4,6,7,8,9,3][variant], m=[3,5,4,2,3,2,6][variant];
    setInput(q, `x ← ${x}、x ← x × ${m} のとき、最後の x を半角数字で答えなさい。`, x*m);
  }
  if (base.id === "C006") {
    const cases=[['真','AND','偽','偽'],['真','OR','偽','真'],['偽','OR','偽','偽'],['真','AND','真','真'],['偽','AND','真','偽'],['偽','OR','真','真'],['真','OR','真','真']][variant];
    setInput(q, `${cases[0]} ${cases[1]} ${cases[2]} の結果を、真または偽で答えなさい。`, cases[3]);
  }

  const n = Number(base.id.slice(1));
  if (base.domain === "D") {
    if (base.format === "choice") {
      const variants=[
        [`条件によって実行する処理を切り替える基本構造はどれか。`,`分岐`,["分岐","反復","順次","配列"]],
        [`同じ処理を条件が成り立つ間、繰り返す構造はどれか。`,`反復`,["反復","分岐","順次","変数"]],
        [`if 文が主に表す基本構造はどれか。`,`分岐`,["分岐","反復","配列","関数"]],
        [`for 文が主に利用される処理はどれか。`,`反復`,["反復","分岐","代入","入力"]],
        [`条件式の結果に応じて処理A・処理Bを選ぶ構造はどれか。`,`分岐`,["分岐","反復","順次","探索"]],
        [`回数を指定して同じ処理を実行するとき適切な基本構造はどれか。`,`反復`,["反復","分岐","順次","状態遷移"]],
        [`条件が偽になるまで処理を続けるとき用いる構造はどれか。`,`反復`,["反復","分岐","配列","変数"]]
      ][(variant+n)%7]; setChoice(q,...variants);
    } else {
      const x=variant+2, limit=8+(n%3)+variant;
      setInput(q, `x ← ${x} とする。x < ${limit} の間、x ← x + 2 を繰り返す。終了時の x を半角数字で答えなさい。`, x + Math.ceil(Math.max(0,limit-x)/2)*2);
    }
  }
  if (base.domain === "E") {
    if (base.format === "choice") {
      const variants=[
        [`配列 a = [4, 7, 2, 9] の a[0] の値はどれか。`,`4`,["4","7","2","9"]],
        [`配列 b = [3, 8, 5, 1] の b[2] の値はどれか。`,`5`,["3","8","5","1"]],
        [`LIFO（後入れ先出し）のデータ構造はどれか。`,`スタック`,["スタック","キュー","配列","木"]],
        [`FIFO（先入れ先出し）のデータ構造はどれか。`,`キュー`,["キュー","スタック","配列","木"]],
        [`スタックから要素を取り出す操作として一般的なものはどれか。`,`pop`,["pop","push","enqueue","sort"]],
        [`キューへ要素を追加する操作として一般的なものはどれか。`,`enqueue`,["enqueue","dequeue","pop","search"]],
        [`配列の要素数を表す「長さ」に最も関係するものはどれか。`,`要素の個数`,["要素の個数","最大値","添字の値","データ型"]]
      ][(variant+n)%7]; setChoice(q,...variants);
    } else {
      const arr=[variant+2, variant+5, variant+1, variant+7, variant+3]; const idx=(variant+n)%arr.length;
      setInput(q, `配列 a = [${arr.join(', ')}] とする。a[${idx}] の値を半角数字で答えなさい。`, arr[idx]);
    }
    if (q.visual_type !== "none") q.visual = `添字: 0 | 1 | 2 | 3 | 4<br>値: ${[variant+2,variant+5,variant+1,variant+7,variant+3].join(' | ')}`;
  }
  if (base.domain === "F") {
    if (base.format === "choice") {
      const variants=[
        [`隣り合う要素を比較し、必要に応じて交換を繰り返す整列法はどれか。`,`バブルソート`,["バブルソート","二分探索","線形探索","ハッシュ法"]],
        [`整列済みデータで中央の値と比較し、探索範囲を半分ずつ狭める方法はどれか。`,`二分探索`,["二分探索","線形探索","バブルソート","スタック"]],
        [`先頭から順番に目的の値と比較して探す方法はどれか。`,`線形探索`,["線形探索","二分探索","選択ソート","キュー"]],
        [`未整列部分から最小値を選んで先頭側へ移す整列法はどれか。`,`選択ソート`,["選択ソート","線形探索","二分探索","スタック"]],
        [`アルゴリズムの処理回数がデータ数 n にほぼ比例するときの計算量はどれか。`,`O(n)`,["O(n)","O(1)","O(n²)","O(2ⁿ)"]],
        [`データ数が2倍になっても処理回数がほぼ変わらない計算量はどれか。`,`O(1)`,["O(1)","O(n)","O(n²)","O(log n)"]],
        [`探索対象が整列済みであることを前提とする代表的な探索法はどれか。`,`二分探索`,["二分探索","線形探索","バブルソート","選択ソート"]]
      ][(variant+n)%7]; setChoice(q,...variants);
    } else {
      const values=[variant+3,variant+1,variant+6,variant+2]; const max=Math.max(...values);
      setInput(q, `配列 [${values.join(', ')}] を先頭から順に走査して最大値を求める。得られる最大値を半角数字で答えなさい。`, max);
    }
    if (q.visual_type !== "none") q.visual = `処理対象: [${[variant+4,variant+1,variant+6,variant+2].join(', ')}]`;
  }

  if (q.format === "choice") q.choices = shuffled(q.choices, rng);
  return q;
}

function generateExamForStudent(studentId) {
  const seed = hashSeed(`pycbt-2026:${studentId}`);
  const rng = seededRandom(seed);
  const questions = QUESTION_BANK.map((base, index) => {
    // 7種類のvariant。連番受験番号でも単純な+1にならないようslot番号を混ぜる。
    const variant = hashSeed(`${studentId}:${base.id}:${index}`) % 7;
    return applyGeneratedVariant(base, variant, rng);
  });
  return shuffled(questions, rng);
}

// app.js の [...QUESTION_BANK] はこのiteratorを通る。
// validateBlueprint() の filter/reduce は元の35スロットを検証するため従来どおり動く。
Object.defineProperty(QUESTION_BANK, Symbol.iterator, {
  configurable: true,
  value: function* () {
    const studentId = (typeof document !== "undefined" ? document.getElementById("student-id")?.value : "") || "preview";
    yield* generateExamForStudent(String(studentId).trim());
  }
});

// 本番前監査用。ブラウザのコンソールから auditExamSets(['1221','1222']) などで確認できる。
function auditExamSets(studentIds) {
  const sets = studentIds.map(id => ({ id:String(id), questions:generateExamForStudent(String(id)) }));
  return sets.map((item, i) => {
    if (i === 0) return { student:item.id, previous:null, sameVariantIds:0, sameBaseQuestions:0 };
    const prev = sets[i-1];
    const variantIds = new Set(prev.questions.map(q => q.id));
    const baseIds = new Set(prev.questions.map(q => q.base_question_id || q.id));
    return {
      student:item.id,
      previous:prev.id,
      sameVariantIds:item.questions.filter(q => variantIds.has(q.id)).length,
      sameBaseQuestions:item.questions.filter(q => baseIds.has(q.base_question_id || q.id)).length
    };
  });
}
if (typeof window !== "undefined") {
  window.generateExamForStudent = generateExamForStudent;
  window.auditExamSets = auditExamSets;
}
