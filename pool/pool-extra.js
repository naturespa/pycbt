window.PYCBT_POOL_SLOTS = window.PYCBT_POOL_SLOTS || [];
window.PYCBT_POOL_SLOTS.push(...[
  {
    slot_id: "A06", domain: "A", viewpoint: "knowledge", format: "choice", points: 2,
    it_passport: false, visual_type: "none", skill: "アルゴリズムの性質",
    variants: [
      { question: "アルゴリズムが有限回の手順で終了する性質を何というか。", answer: "有限性", choices: ["有限性", "可逆性", "冗長性", "互換性"], visual: null, explanation: null },
      { question: "アルゴリズムの各手順が明確で、解釈が一通りに決まる性質として適切なものはどれか。", answer: "明確性", choices: ["明確性", "偶然性", "装飾性", "匿名性"], visual: null, explanation: null },
      { question: "アルゴリズムに与える、処理前のデータを何というか。", answer: "入力", choices: ["入力", "出力", "終了条件", "注釈"], visual: null, explanation: null },
      { question: "アルゴリズムを実行して得られる結果を何というか。", answer: "出力", choices: ["出力", "入力", "変数名", "分岐条件"], visual: null, explanation: null },
      { question: "同じ結果を得る二つのアルゴリズムを比較するときの観点として適切なものはどれか。", answer: "処理時間や使用する記憶容量", choices: ["処理時間や使用する記憶容量", "文字の色だけ", "作成者の名前だけ", "ファイル名の長さだけ"], visual: null, explanation: null }
    ]
  },
  {
    slot_id: "B04", domain: "B", viewpoint: "knowledge", format: "choice", points: 2,
    it_passport: false, visual_type: "none", skill: "プログラムの翻訳と実行",
    variants: [
      { question: "コンピュータが直接実行できる命令で記述された言語はどれか。", answer: "機械語", choices: ["機械語", "自然言語", "マークアップ言語", "擬似言語"], visual: null, explanation: null },
      { question: "人が理解しやすい表現を多く用いるプログラミング言語を一般に何というか。", answer: "高水準言語", choices: ["高水準言語", "機械語", "画像形式", "通信規約"], visual: null, explanation: null },
      { question: "ソースコードを翻訳して得られる、実行に近い形式のコードを何というか。", answer: "オブジェクトコード", choices: ["オブジェクトコード", "コメント", "入力データ", "フローチャート"], visual: null, explanation: null },
      { question: "プログラムの誤りを見つけて修正する作業を何というか。", answer: "デバッグ", choices: ["デバッグ", "バックアップ", "エンコード", "ダウンロード"], visual: null, explanation: null },
      { question: "プログラムの文法上の誤りを何というか。", answer: "構文エラー", choices: ["構文エラー", "通信遅延", "容量不足", "画面解像度"], visual: null, explanation: null }
    ]
  },
  {
    slot_id: "C07", domain: "C", viewpoint: "knowledge", format: "choice", points: 2,
    it_passport: false, visual_type: "none", skill: "比較演算・論理型",
    variants: [
      { question: "二つの値が等しいかを比較する演算子として一般的なものはどれか。", answer: "==", choices: ["==", "=", "+", "%"], visual: null, explanation: null },
      { question: "二つの値が等しくないことを表す比較演算子として一般的なものはどれか。", answer: "!=", choices: ["!=", "==", "<=", "//"], visual: null, explanation: null },
      { question: "論理型が表す値の組合せとして適切なものはどれか。", answer: "真と偽", choices: ["真と偽", "正と負", "整数と小数", "文字と画像"], visual: null, explanation: null },
      { question: "条件 a AND b が真になるのはどのときか。", answer: "aとbがともに真", choices: ["aとbがともに真", "aだけが真", "bだけが真", "aとbがともに偽"], visual: null, explanation: null },
      { question: "条件 a OR b が偽になるのはどのときか。", answer: "aとbがともに偽", choices: ["aとbがともに偽", "aとbがともに真", "aだけが真", "bだけが真"], visual: null, explanation: null }
    ]
  },
  {
    slot_id: "C08", domain: "C", viewpoint: "thinking", format: "choice", points: 2,
    it_passport: false, visual_type: "none", skill: "式と代入の追跡",
    variants: [
      { question: "x=4、y=3のとき、x×y+2 の値はどれか。", answer: "14", choices: ["14", "20", "18", "9"], visual: null, explanation: null },
      { question: "a=17、b=5のとき、a%b の値はどれか。", answer: "2", choices: ["2", "3", "5", "12"], visual: null, explanation: null },
      { question: "xを8とする。x←x+3、続いてx←x×2を実行した後のxはどれか。", answer: "22", choices: ["22", "19", "16", "14"], visual: null, explanation: null },
      { question: "a=6、b=2のとき、(a+b)×b の値はどれか。", answer: "16", choices: ["16", "10", "14", "8"], visual: null, explanation: null },
      { question: "x=25のとき、xを7で割った商と余りの組合せはどれか。", answer: "商3、余り4", choices: ["商3、余り4", "商4、余り3", "商3、余り3", "商4、余り4"], visual: null, explanation: null }
    ]
  },
  {
    slot_id: "D08", domain: "D", viewpoint: "knowledge", format: "choice", points: 2,
    it_passport: false, visual_type: "none", skill: "条件分岐・反復の用語",
    variants: [
      { question: "条件が真か偽かによって実行する処理を変える基本構造はどれか。", answer: "分岐", choices: ["分岐", "順次", "配列", "代入"], visual: null, explanation: null },
      { question: "条件を満たす間、同じ処理を繰り返す構造はどれか。", answer: "反復", choices: ["反復", "分岐", "入力", "出力"], visual: null, explanation: null },
      { question: "Pythonで条件分岐を記述するときに用いる予約語はどれか。", answer: "if", choices: ["if", "for", "print", "input"], visual: null, explanation: null },
      { question: "Pythonで回数を指定した繰返しによく用いる予約語はどれか。", answer: "for", choices: ["for", "if", "else", "print"], visual: null, explanation: null },
      { question: "反復処理を終了させる判定に用いるものとして適切なものはどれか。", answer: "終了条件", choices: ["終了条件", "ファイル名", "画面サイズ", "文字色"], visual: null, explanation: null }
    ]
  },
  {
    slot_id: "D09", domain: "D", viewpoint: "thinking", format: "choice", points: 2,
    it_passport: false, visual_type: "none", skill: "分岐・反復の追跡",
    variants: [
      { question: "x=7とする。x>=5ならx←x+2、それ以外ならx←x-2を実行する。最後のxはどれか。", answer: "9", choices: ["9", "5", "7", "14"], visual: null, explanation: null },
      { question: "sum=0とし、1、2、3を順にsumへ加える。最後のsumはどれか。", answer: "6", choices: ["6", "5", "3", "0"], visual: null, explanation: null },
      { question: "x=4とする。xが10未満の間、xへ2を加える。反復終了時のxはどれか。", answer: "10", choices: ["10", "8", "12", "6"], visual: null, explanation: null },
      { question: "点数が80以上ならA、60以上80未満ならB、それ以外はCとする。点数72の判定はどれか。", answer: "B", choices: ["B", "A", "C", "判定不能"], visual: null, explanation: null },
      { question: "count=0とし、処理を4回繰り返すたびにcountへ1を加える。最後のcountはどれか。", answer: "4", choices: ["4", "3", "5", "0"], visual: null, explanation: null }
    ]
  },
  {
    slot_id: "E07", domain: "E", viewpoint: "knowledge", format: "choice", points: 2,
    it_passport: false, visual_type: "none", skill: "二次元配列",
    variants: [
      { question: "行と列を使って表のようにデータを扱う構造として適切なものはどれか。", answer: "二次元配列", choices: ["二次元配列", "単一の変数", "条件式", "コメント"], visual: null, explanation: null },
      { question: "二次元配列 a の要素を行番号と列番号で指定する表し方として適切なものはどれか。", answer: "a[行][列]", choices: ["a[行][列]", "a+行+列", "a(行だけ)", "行=a"], visual: null, explanation: null },
      { question: "3行4列の二次元配列に格納できる要素数はどれか。", answer: "12", choices: ["12", "7", "4", "3"], visual: null, explanation: null },
      { question: "二次元配列の利用例として最も適切なものはどれか。", answer: "座席表の行と列", choices: ["座席表の行と列", "一人分の氏名だけ", "一つの真偽値だけ", "一回の分岐だけ"], visual: null, explanation: null },
      { question: "添字を0から数える2行3列の配列で、最後の列の添字はどれか。", answer: "2", choices: ["2", "3", "1", "0"], visual: null, explanation: null }
    ]
  },
  {
    slot_id: "E08", domain: "E", viewpoint: "thinking", format: "choice", points: 2,
    it_passport: false, visual_type: "none", skill: "配列の更新",
    variants: [
      { question: "a=[2,4,6]とする。a[1]←9を実行した後のaはどれか。", answer: "[2,9,6]", choices: ["[2,9,6]", "[9,4,6]", "[2,4,9]", "[2,4,6,9]"], visual: null, explanation: null },
      { question: "a=[5,1,8,3]とする。a[0]とa[3]を交換した後のaはどれか。", answer: "[3,1,8,5]", choices: ["[3,1,8,5]", "[5,3,8,1]", "[1,5,8,3]", "[5,1,3,8]"], visual: null, explanation: null },
      { question: "a=[3,6,2]とする。各要素に1を加えた結果はどれか。", answer: "[4,7,3]", choices: ["[4,7,3]", "[3,6,3]", "[4,6,2]", "[3,7,2]"], visual: null, explanation: null },
      { question: "a=[7,2,5,4]の偶数だけを合計した値はどれか。", answer: "6", choices: ["6", "18", "12", "9"], visual: null, explanation: null },
      { question: "a=[4,9,1,7]の最大値を先頭要素と交換した後のaはどれか。", answer: "[9,4,1,7]", choices: ["[9,4,1,7]", "[7,9,1,4]", "[4,1,9,7]", "[9,7,4,1]"], visual: null, explanation: null }
    ]
  },
  {
    slot_id: "F09", domain: "F", viewpoint: "thinking", format: "choice", points: 2,
    it_passport: false, visual_type: "none", skill: "探索アルゴリズム",
    variants: [
      { question: "配列[4,7,2,9]を先頭から線形探索して9を探す。比較回数は何回か。", answer: "4回", choices: ["4回", "1回", "2回", "3回"], visual: null, explanation: null },
      { question: "昇順配列[2,5,8,11,14]を二分探索する。最初に比較する値として適切なものはどれか。", answer: "8", choices: ["8", "2", "5", "14"], visual: null, explanation: null },
      { question: "線形探索で先頭の要素が目的の値だった。比較回数は何回か。", answer: "1回", choices: ["1回", "0回", "2回", "要素数と同じ回数"], visual: null, explanation: null },
      { question: "二分探索を使う前に必要な条件として適切なものはどれか。", answer: "データが整列されている", choices: ["データが整列されている", "要素がすべて同じである", "配列が空である", "文字列を含まない"], visual: null, explanation: null },
      { question: "配列[3,6,9,12,15]を先頭から線形探索して9を探す。見つかる添字はどれか。添字は0から数える。", answer: "2", choices: ["2", "3", "1", "9"], visual: null, explanation: null }
    ]
  },
  {
    slot_id: "F10", domain: "F", viewpoint: "thinking", format: "choice", points: 2,
    it_passport: false, visual_type: "none", skill: "整列アルゴリズムの追跡",
    variants: [
      { question: "配列[5,2,4]で先頭の5と次の2を比較し、昇順になるよう交換した直後の配列はどれか。", answer: "[2,5,4]", choices: ["[2,5,4]", "[5,4,2]", "[4,2,5]", "[2,4,5]"], visual: null, explanation: null },
      { question: "配列[7,3,6]から最小値を選び、先頭と交換した直後の配列はどれか。", answer: "[3,7,6]", choices: ["[3,7,6]", "[6,3,7]", "[7,6,3]", "[3,6,7]"], visual: null, explanation: null },
      { question: "配列[4,1,3]に対する交換法の1巡目で、隣り合う要素を左から比較して昇順に交換した結果はどれか。", answer: "[1,3,4]", choices: ["[1,3,4]", "[1,4,3]", "[3,1,4]", "[4,3,1]"], visual: null, explanation: null },
      { question: "配列[2,8,5]で8と5を比較し、昇順になるよう交換した後の配列はどれか。", answer: "[2,5,8]", choices: ["[2,5,8]", "[5,2,8]", "[8,2,5]", "[2,8,5]"], visual: null, explanation: null },
      { question: "配列[9,4,7,2]から最小値を選んで先頭と交換した直後の配列はどれか。", answer: "[2,4,7,9]", choices: ["[2,4,7,9]", "[4,9,7,2]", "[7,4,9,2]", "[2,9,7,4]"], visual: null, explanation: null }
    ]
  }
]);
