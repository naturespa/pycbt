// IPA公式公開問題から、問題文・選択肢・正答を照合済みの実問題だけを登録する。
(() => {
  const slots = window.PYCBT_POOL_SLOTS || [];
  const sourceUrl = "https://www3.jitec.ipa.go.jp/JitesCbt/html/openinfo/pdf/questions/2024r06_ip_qs.pdf";
  const sourceAnswerUrl = "https://www3.jitec.ipa.go.jp/JitesCbt/html/openinfo/pdf/questions/2024r06_ip_ans.pdf";
  const sourceYear = "令和6年度";
  const sourcePeriod = "公開問題";

  const esc = value => String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[character]));
  const svg = (label, body, height = 190) => `<svg class="official-support-diagram" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 ${height}" role="img" aria-label="${esc(label)}"><title>${esc(label)}</title><defs><marker id="actual-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L10 5 L0 10Z" fill="#29485f"/></marker></defs><g stroke="#29485f" stroke-width="2" fill="#f7fbfc">${body}</g><style>text{fill:#142d40;stroke:none;font:16px sans-serif}.caption{font-size:13px;fill:#52616d}.accent{fill:#dceff0}.warm{fill:#fff0c7}</style></svg>`;
  const text = (x, y, value, className = "") => `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" class="${className}">${esc(value)}</text>`;
  const box = (x, y, width, height, value, className = "") => `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="6" class="${className}"/>${text(x + width / 2, y + height / 2, value)}`;
  const arrow = (x1, y1, x2, y2) => `<path d="M${x1},${y1} L${x2},${y2}" fill="none" marker-end="url(#actual-arrow)"/>`;

  const diagrams = {
    door: svg("ドアノブの形が操作方法を示唆する例", `${box(230, 18, 180, 135, "ドア", "accent")}<circle cx="365" cy="86" r="13" fill="#fff0c7"/>${arrow(475, 86, 405, 86)}${text(520, 62, "手掛かり")}${text(520, 84, "から操作を")}${text(520, 106, "判断", "caption")}${text(320, 174, "補助図（オリジナル）", "caption")}`),
    touch: svg("指をタッチパネルに近づけて位置を検出する例", `${box(145, 98, 350, 42, "タッチパネル", "accent")}<path d="M315 18 C330 38 337 57 337 83" fill="none" marker-end="url(#actual-arrow)"/><path d="M300 32 C310 46 315 59 315 78" fill="none"/><path d="M350 32 C345 47 344 60 344 78" fill="none"/>${text(320, 15, "指")}${text(320, 169, "補助図（オリジナル）", "caption")}`),
    raid: svg("4台のHDDで構成するRAID5の模式図", `${[0,1,2,3].map(i => box(70 + i * 130, 42, 100, 82, `HDD ${i + 1}`, i === 3 ? "warm" : "accent")).join("")}${text(460, 92, "パリティ")}${text(320, 150, "4台のうち1台分をパリティ情報に使用", "caption")}`),
    log: svg("トランザクションと更新履歴の模式図", `${box(45, 60, 150, 58, "更新処理", "accent")}${arrow(195, 89, 300, 89)}${box(300, 34, 150, 48, "データベース")}${box(300, 105, 150, 48, "更新履歴", "warm")}${arrow(260, 89, 300, 129)}${text(530, 129, "記録", "caption")}${text(320, 177, "補助図（オリジナル）", "caption")}`),
    biometrics: svg("認証時に観察する入力動作の例", `${box(35, 38, 130, 58, "画像文字")}${box(185, 38, 130, 58, "打鍵動作", "accent")}${box(335, 38, 130, 58, "手書き動作", "accent")}${box(485, 38, 120, 58, "点の順序")}${text(100, 122, "a")}${text(250, 122, "b")}${text(400, 122, "c")}${text(545, 122, "d")}${text(320, 166, "各方式で利用者を確認する情報を比較", "caption")}`),
    cia: svg("アクセス制御、デジタル署名、ディスク二重化と情報セキュリティ3要素の対応表", `${box(52, 18, 150, 42, "対策")}${box(202, 18, 128, 42, "a")}${box(330, 18, 128, 42, "b")}${box(458, 18, 128, 42, "c")}${box(52, 60, 150, 42, "内容")}${box(202, 60, 128, 42, "アクセス制御")}${box(330, 60, 128, 42, "デジタル署名")}${box(458, 60, 128, 42, "ディスク二重化")}${text(320, 136, "機密性・完全性・可用性との組合せを選ぶ", "caption")}`),
    domain: svg("ドメイン名によるコンピュータやネットワークの識別例", `${box(60, 62, 150, 55, "example.jp", "accent")}${arrow(210, 89, 305, 89)}${box(305, 35, 135, 44, "Webサーバ")}${box(305, 101, 135, 44, "メールサーバ")}${arrow(440, 57, 545, 57)}${arrow(440, 123, 545, 123)}${text(575, 57, "識別")}${text(575, 123, "識別")}${text(320, 174, "補助図（オリジナル）", "caption")}`),
    essid: svg("無線LANアクセスポイントと周辺端末の模式図", `${box(245, 65, 150, 58, "アクセスポイント", "accent")}${box(35, 20, 120, 44, "端末A")}${box(485, 20, 120, 44, "端末B")}${box(35, 130, 120, 44, "端末C")}${box(485, 130, 120, 44, "端末D")}${arrow(155, 42, 245, 77)}${arrow(485, 42, 395, 77)}${arrow(155, 152, 245, 111)}${arrow(485, 152, 395, 111)}`),
    disposal: svg("IoT機器の利用から廃棄までの流れ", `${box(45, 70, 130, 55, "利用中")}${arrow(175, 97, 255, 97)}${box(255, 70, 130, 55, "利用終了", "warm")}${arrow(385, 97, 465, 97)}${box(465, 70, 130, 55, "廃棄")}${text(320, 158, "ライフサイクル全体で対策を検討", "caption")}`),
    speech: svg("スマートスピーカーの応答処理の流れ", `${box(20, 65, 125, 55, "利用者の音声", "accent")}${arrow(145, 92, 180, 92)}${box(180, 65, 115, 55, "テキスト")}${arrow(295, 92, 330, 92)}${box(330, 65, 115, 55, "意味解析")}${arrow(445, 92, 480, 92)}${box(480, 65, 140, 55, "音声で応答", "accent")}${text(320, 155, "（1）から（4）の処理手順を図示", "caption")}`)
  };

  function actual(questionNo, skill, question, answer, choices, visual) {
    return {
      question,
      answer,
      choices,
      visual,
      visual_type: "official_question_support",
      explanation: null,
      skill,
      source_type: "it_passport_actual",
      source_year: sourceYear,
      source_period: sourcePeriod,
      source_question_no: questionNo,
      source_label: `ITパスポート試験 ${sourceYear} ${sourcePeriod}／第${questionNo}問（IPA）`,
      source_url: sourceUrl,
      source_answer_url: sourceAnswerUrl,
      source_modified: false,
      source_supplemental_visual: true
    };
  }

  const replacements = {
    "A01-2": actual(68, "情報デザイン・シグニファイア", "情報デザインで用いられる概念であり，部屋のドアノブの形で開閉の仕方を示唆するというような，人間の適切な行動を誘発する知覚可能な手掛かりのことを何と呼ぶか。", "シグニファイア", ["NUI (Natural User Interface)", "ウィザード", "シグニファイア", "マルチタッチ"], diagrams.door),
    "A01-3": actual(76, "ユーザインタフェース・タッチパネル", "スマートフォンなどのタッチパネルで広く採用されている方式であり，指がタッチパネルの表面に近づいたときに，その位置を検出する方式はどれか。", "静電容量方式", ["感圧式", "光学式", "静電容量方式", "電磁誘導方式"], diagrams.touch),
    "E01-1": actual(69, "記憶装置・RAID", "障害に備えるために，4台のHDDを使い，1台分の容量をパリティ情報の記録に使用するRAID5を構成する。1台のHDDの容量が1Tバイトのとき，実効データ容量はおよそ何バイトか。", "3T", ["2T", "3T", "4T", "5T"], diagrams.raid),
    "E01-5": actual(74, "データベース・トランザクション", "トランザクション処理に関する記述のうち，適切なものはどれか。", "ログとは，データベースの更新履歴を記録したファイルのことである。", ["コミットとは，トランザクションが正常に処理されなかったときに，データベースをトランザクション開始前の状態に戻すことである。", "排他制御とは，トランザクションが正常に処理されたときに，データベースの内容を確定させることである。", "ロールバックとは，複数のトランザクションが同時に同一データを更新しようとしたときに，データの矛盾が起きないようにすることである。", "ログとは，データベースの更新履歴を記録したファイルのことである。"], diagrams.log),
    "E02-4": actual(72, "情報セキュリティ・バイオメトリクス認証", "次の記述のうち，バイオメトリクス認証の例だけを全て挙げたものはどれか。\n\na　Webページに歪んだ文字の列から成る画像を表示し，読み取った文字列を利用者に入力させることによって，認証を行う。\nb　キーボードで特定文字列を入力させ，そのときの打鍵の速度やタイミングの変化によって，認証を行う。\nc　タッチパネルに手書きで氏名を入力させ，そのときの筆跡，筆圧，運筆速度などによって，認証を行う。\nd　タッチパネルに表示された複数の点をあらかじめ決められた順になぞらせることによって，認証を行う。", "b，c", ["a，b", "a，d", "b，c", "c，d"], diagrams.biometrics),
    "E02-5": actual(75, "情報セキュリティの3要素", "情報セキュリティの3要素である機密性，完全性及び可用性と，それらを確保するための対策の例a～cの適切な組合せはどれか。\n\na　アクセス制御\nb　デジタル署名\nc　ディスクの二重化", "機密性／完全性／可用性", ["可用性／完全性／機密性", "可用性／機密性／完全性", "完全性／機密性／可用性", "機密性／完全性／可用性"], diagrams.cia),
    "F01-2": actual(71, "ネットワーク・ドメイン名", "インターネットで使用されているドメイン名の説明として，適切なものはどれか。", "コンピュータやネットワークなどを識別するための名前", ["Web閲覧や電子メールを送受信するアプリケーションが使用する通信規約の名前", "コンピュータやネットワークなどを識別するための名前", "通信を行うアプリケーションを識別するための名前", "電子メールの宛先として指定する相手の名前"], diagrams.domain),
    "F01-3": actual(70, "ネットワーク・無線LAN", "ESSIDをステルス化することによって得られる効果として，適切なものはどれか。", "アクセスポイントへの不正接続リスクを低減できる。", ["アクセスポイントと端末間の通信を暗号化できる。", "アクセスポイントに接続してくる端末を認証できる。", "アクセスポイントへの不正接続リスクを低減できる。", "アクセスポイントを介さず，端末同士で直接通信できる。"], diagrams.essid),
    "F02-2": actual(73, "情報セキュリティ・ソーシャルエンジニアリング", "IoT機器のセキュリティ対策のうち，ソーシャルエンジニアリング対策として，最も適切なものはどれか。", "IoT機器を廃棄するときは，内蔵されている記憶装置からの情報漏えいを防止するために物理的に破壊する。", ["IoT機器とサーバとの通信は，盗聴を防止するために常に暗号化通信で行う。", "IoT機器の脆弱性を突いた攻撃を防止するために，機器のメーカーから最新のファームウェアを入手してアップデートを行う。", "IoT機器へのマルウェア感染を防止するためにマルウェア対策ソフトを導入する。", "IoT機器を廃棄するときは，内蔵されている記憶装置からの情報漏えいを防止するために物理的に破壊する。"], diagrams.disposal),
    "F02-3": actual(78, "AI・音声認識", "利用者がスマートスピーカーに向けて話し掛けた内容に対して，スマートスピーカーから音声で応答するための処理手順が（1）～（4）のとおりであるとき，音声認識に該当する処理はどれか。\n\n（1）利用者の音声をテキストデータに変換する。\n（2）テキストデータを解析して，その意味を理解する。\n（3）応答する内容を決定して，テキストデータを生成する。\n（4）生成したテキストデータを読み上げる。", "（1）", ["（1）", "（2）", "（3）", "（4）"], diagrams.speech)
  };

  for (const [id, replacement] of Object.entries(replacements)) {
    const [slotId, variantText] = id.split("-");
    const slot = slots.find(item => item.slot_id === slotId);
    const variantIndex = Number(variantText) - 1;
    if (!slot || !slot.variants[variantIndex]) throw new Error(`実問題の登録先が見つかりません: ${id}`);
    slot.variants[variantIndex] = replacement;
  }

  window.PYCBT_ACTUAL_SOURCE_COUNT = Object.keys(replacements).length;
})();
