/*
 * 問題マスタの契約。181件まで基本テンプレートを登録できる。
 * production では question/choices/answer を実問題に差し替え、必要なら variants を追加する。
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

function makeQuestion({ id, domain, viewpoint, format, points, itPassport = false, visualType = "none", variantGroup = null, skill, question, answer, choices, visual, explanation, adviceTag }) {
  return { id, domain, viewpoint, format, points, difficulty: "basic", source: itPassport ? "itp_similar" : "textbook_original", source_ref: "CBT骨格サンプル", it_passport: itPassport, visual_type: visualType, variant_group: variantGroup, skill, question, answer: String(answer), acceptable_answers: [String(answer)], choices, visual, explanation, advice_tag: adviceTag };
}

const QUESTION_BANK = [
  makeQuestion({ id:"A001",domain:"A",viewpoint:"knowledge",format:"choice",points:2,itPassport:true,visualType:"flowchart",skill:"フローチャート",question:"開始・終了を表すフローチャート記号として最も適切なものはどれか。",choices:["端子","処理","判断","入出力"],answer:"端子",visual:"[開始] → 処理 → [終了]",adviceTag:"algorithm" }),
  makeQuestion({ id:"A002",domain:"A",viewpoint:"knowledge",format:"choice",points:2,itPassport:false,visualType:"state",skill:"状態遷移",question:"状態遷移図で、状態間を結ぶ矢印が表すものはどれか。",choices:["状態の変化","変数の型","配列の要素","繰返し回数"],answer:"状態の変化",visual:"待機 ──押す──> 動作",adviceTag:"algorithm" }),
  makeQuestion({ id:"A003",domain:"A",viewpoint:"knowledge",format:"choice",points:2,itPassport:false,skill:"アルゴリズム",question:"アルゴリズムの説明として適切なものはどれか。",choices:["問題を解く手順","画面の色","記憶装置の容量","通信の速さ"],answer:"問題を解く手順",adviceTag:"algorithm" }),
  makeQuestion({ id:"A004",domain:"A",viewpoint:"thinking",format:"choice",points:2,itPassport:false,skill:"処理順序",question:"処理を上から順に一度ずつ実行する基本構造はどれか。",choices:["順次","分岐","反復","再帰"],answer:"順次",adviceTag:"algorithm" }),
  makeQuestion({ id:"A005",domain:"A",viewpoint:"thinking",format:"input",points:4,skill:"手順追跡",question:"変数 x を 3 とし、x ← x + 4 を実行した後の x を半角数字で答えなさい。",answer:"7",adviceTag:"calculation" }),
  makeQuestion({ id:"B001",domain:"B",viewpoint:"knowledge",format:"choice",points:2,itPassport:true,skill:"コンパイラ",question:"高水準言語で書かれたプログラムを機械語へ変換するソフトウェアはどれか。",choices:["コンパイラ","ブラウザ","表計算ソフト","OS"],answer:"コンパイラ",adviceTag:"language" }),
  makeQuestion({ id:"B002",domain:"B",viewpoint:"knowledge",format:"choice",points:2,skill:"プログラミング言語",question:"プログラミング言語を用いる主な目的はどれか。",choices:["コンピュータに処理を指示する","画像を印刷する","通信速度を上げる","電源を入れる"],answer:"コンピュータに処理を指示する",adviceTag:"language" }),
  makeQuestion({ id:"B003",domain:"B",viewpoint:"knowledge",format:"choice",points:4,itPassport:false,skill:"擬似言語",question:"擬似言語を用いる利点として適切なものはどれか。",choices:["処理の考え方を言語に依存せず表せる","必ず高速に実行できる","機械語になる","OSが不要になる"],answer:"処理の考え方を言語に依存せず表せる",adviceTag:"language" }),
  makeQuestion({ id:"C001",domain:"C",viewpoint:"knowledge",format:"choice",points:2,itPassport:true,skill:"変数",question:"値を一時的に保存し、後から変更できる名前付きの箱を何というか。",choices:["変数","定数","関数","配列"],answer:"変数",adviceTag:"variables" }),
  makeQuestion({ id:"C002",domain:"C",viewpoint:"knowledge",format:"choice",points:2,skill:"演算子",question:"余りを求める演算子として使われることが多いものはどれか。",choices:["%","+","=","/"],answer:"%",adviceTag:"variables" }),
  makeQuestion({ id:"C003",domain:"C",viewpoint:"knowledge",format:"choice",points:4,skill:"データ型",question:"小数を含む数値を扱うのに適したデータ型はどれか。",choices:["実数型","論理型","文字列型","整数型だけ"],answer:"実数型",adviceTag:"variables" }),
  makeQuestion({ id:"C004",domain:"C",viewpoint:"thinking",format:"choice",points:2,itPassport:true,variantGroup:"arithmetic",skill:"演算",question:"a ← 10、b ← 3 のとき、a % b の値はどれか。",choices:["1","3","7","10"],answer:"1",adviceTag:"calculation" }),
  makeQuestion({ id:"C005",domain:"C",viewpoint:"thinking",format:"input",points:4,variantGroup:"arithmetic",skill:"代入",question:"x ← 5、x ← x × 3 のとき、最後の x を半角数字で答えなさい。",answer:"15",adviceTag:"calculation" }),
  makeQuestion({ id:"C006",domain:"C",viewpoint:"thinking",format:"input",points:4,skill:"論理演算",question:"真 AND 偽 の結果を、真または偽で答えなさい。",answer:"偽",adviceTag:"logic" }),
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
      QUESTION_BANK.push(makeQuestion({ id:`${domain}${String(index + 1).padStart(3,"0")}`, domain, viewpoint:thinking ? "thinking" : "knowledge", format:input ? "input" : "choice", points: thinking ? (input ? 4 : 2) : (index === 1 ? 4 : 2), itPassport: !input && index < 2, visualType:visualIndexes.includes(index) ? (domain === "E" ? "table" : "sort_trace") : "none", variantGroup:thinking ? `${domain.toLowerCase()}-trace` : null, skill:tag, question: input ? `${text} 正答を入力しなさい。` : text, answer:correct, choices:input ? undefined : [correct, "反復", "配列", "変数"], visual:visualIndexes.includes(index) ? "図表を用いる問題の表示領域（問題バンク投入時に図表データへ置換）" : undefined, adviceTag:tag }));
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
