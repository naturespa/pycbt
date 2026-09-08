// Reviewed diagrams for all 30 visual variants. Values match each question.
(() => {
  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const text = (x,y,s) => `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle">${esc(s)}</text>`;
  const box = (x,y,w,h,s,round=0) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${round}"/>${text(x+w/2,y+h/2,s)}`;
  const arrow = (x,y,X,Y) => `<path d="M${x},${y} L${X},${Y}" fill="none" marker-end="url(#diagram-arrow)"/>`;
  const svg = (label,body,h=210,className="") => `<svg class="${esc(className)}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 ${h}" role="img" aria-label="${esc(label)}" style="display:block;width:100%;max-width:640px;margin:auto;font:16px sans-serif"><title>${esc(label)}</title><defs><marker id="diagram-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10Z" fill="#29485f"/></marker></defs><g stroke="#29485f" stroke-width="2" fill="#edf5fa">${body}</g><style>text{fill:#142d40;stroke:none}text{font-weight:500}</style></svg>`;
  const row = (values,y=70,highlight=[]) => values.map((v,i)=>`<g>${highlight.includes(i)?`<rect x="${60+i*72}" y="${y}" width="64" height="44" fill="#ffe5a3"/>`:''}${box(60+i*72,y,64,44,v)}${text(92+i*72,y-15,i)}</g>`).join('');
  const array = values => svg(`配列。添字は0から。値は${values.join('、')}`,text(310,22,'添字と要素')+row(values));
  const flow = (kind) => {
    const start=box(250,12,140,44,'開始',22);
    if(kind===2) {
      const decision=`<polygon points="320,88 410,133 320,178 230,133"/>${text(320,133,'条件？')}`;
      const branches=`<path d="M230,133 H135 V210" fill="none" marker-end="url(#diagram-arrow)"/><path d="M410,133 H505 V210" fill="none" marker-end="url(#diagram-arrow)"/>${text(185,112,'偽')}${text(455,112,'真')}${box(65,210,140,48,'処理B')}${box(435,210,140,48,'処理A')}<path d="M135,258 V292 H320" fill="none"/><path d="M505,258 V292 H320" fill="none"/>${arrow(320,292,320,326)}`;
      return svg('開始から条件を判断し、真と偽の処理に分岐した後、終了へ進むフローチャート。',start+arrow(320,56,320,86)+decision+branches+box(250,328,140,44,'終了',22),390,'flowchart-diagram');
    }
    const first=kind===3?`<polygon points="235,105 405,105 385,159 215,159"/>${text(310,132,'値を入力')}`:box(235,105,170,54,kind===1?'x ← x + 1':'処理1');
    let body=start+arrow(320,56,320,103)+first;
    if(kind===4) body+=arrow(320,159,320,205)+box(235,207,170,54,'処理2')+arrow(320,261,320,305)+box(250,307,140,44,'終了',22);
    else body+=arrow(320,159,320,215)+box(250,217,140,44,'終了',22);
    return svg('開始から処理を経て終了へ、上から下に進むフローチャート。',body,kind===4?365:275,'flowchart-diagram');
  };
  const state = (i) => {
    if(i===2) return svg('待機、動作、停止の順に状態が変わる。',box(25,80,140,55,'待機',15)+arrow(165,107,245,107)+box(245,80,140,55,'動作',15)+arrow(385,107,465,107)+box(465,80,140,55,'停止',15));
    const login=i===4;
    let body=box(25,80,170,55,login?'未ログイン':'待機',15)+arrow(195,107,435,107)+text(315,80,login?'認証成功':'ボタン押下')+box(435,80,180,55,login?'ログイン済み':'動作',15);
    if(i===3) body+=`<path d="M525,135 V180 H110 V138" fill="none" marker-end="url(#diagram-arrow)"/>${text(315,166,'タイマー終了')}`;
    return svg('状態と遷移条件を示す図',body);
  };
  const structure = i => {
    if(i===1||i===4) return svg('左が取出し口、右が追加口のデータ構造',box(200,80,65,50,'A')+box(265,80,65,50,'B')+box(330,80,65,50,'C')+arrow(200,105,90,105)+text(130,65,'取出し')+(i===1?arrow(540,105,395,105)+text(490,65,'追加'):''));
    const top=i===2?'新規':'C';
    return svg('上が操作位置。下からA、B、'+top+'。',box(270,40,100,45,top)+box(270,85,100,45,'B')+box(270,130,100,45,'A')+text(400,62,'上')+(i===2?arrow(120,62,270,62)+text(170,35,'追加'):arrow(270,62,120,62)+text(170,35,'取出し')));
  };
  const searchValues=[[2,5,8,12,16,21,30],[8,3,6,1,9],[3,7,11,18,24,31],[4,7,2,9],[5,1,8,3,6]];
  const search = i => {
    let body=row(searchValues[i]);
    if(i===0) body+=arrow(308,165,308,118)+text(308,187,'中央と比較');
    if(i===1||i===4) body+=arrow(92,150,380,150)+text(235,181,'先頭から順に比較');
    if(i===3) body+=text(315,160,'目的値：7');
    return svg('探索対象の配列',body);
  };
  const sort = i => {
    const before=[[5,2,4,1],[5,2,4,1],[7,3,9,2],[2,4,6,9],[9,6,4,2]][i];
    let body=row(before,55);
    if(i<3){body+=arrow(320,112,320,165)+text(490,138,['隣り合う2要素を交換','最小値1を先頭と交換','並べ替え'][i])+row([[2,5,4,1],[1,2,4,5],[2,3,7,9]][i],195);}
    return svg('並べ替えの様子',body,i<3?265:150);
  };
  const renderers={A01:flow,A02:state,E01:i=>array([[4,7,2,9],[6,1,8,3],[5,9,4,2,7],[3,8,6,1],[12,15,11]][i]),E02:structure,F01:search,F02:sort};
  for(const slot of window.PYCBT_POOL_SLOTS||[]) {
    if(slot.visual_type==='none') continue;
    if(!renderers[slot.slot_id]) throw new Error(`図表未対応: ${slot.slot_id}`);
    slot.variants.forEach((v,i)=>{v.visual=renderers[slot.slot_id](i);});
  }
})();
