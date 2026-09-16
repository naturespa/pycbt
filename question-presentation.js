// Plain-text presentation data; rendering always escapes text before inserting HTML.
window.questionPresentation = function(q) {
  const codeQuestions = {
    'C03-5': ['次のプログラムの表示結果はどれか。', 'name = "Kai"\nprint(name + "さん")'],
    'C04-4': ['標準入力に12を入力する。\n次のプログラムの表示結果はどれか。', 'number = int(input())\nprint(number * 10)'],
    'C04-5': ['標準入力に7を入力する。\n次のプログラムの表示結果はどれか。', 'print("点数" + str(int(input())))'],
    'D02-3': ['次のプログラムの表示結果はどれか。', 'x = 5\nif x > 3:\n    print("A")\nelse:\n    print("B")'],
    'D02-4': ['次のプログラムの表示結果はどれか。', 'x = 2\nif x > 3:\n    print("A")\nelse:\n    print("B")'],
    'D04-4': ['次のプログラムで、Aは何回表示されるか。', 'for i in range(3):\n    print("A")'],
    'D04-5': ['次のプログラムで、最後に表示される値はどれか。', 'for i in range(4):\n    print(i)'],
    'F06-1': ['次のプログラムの出力順として適切なものはどれか。', 'a = [2, 5, 8]\nfor x in a:\n    print(x)'],
    'F06-2': ['次のプログラムを実行した後のsはどれか。', 'a = [3, 6, 9]\ns = 0\nfor x in a:\n    s = s + x'],
    'F06-3': ['次のプログラムを実行した後のmはどれか。', 'a = [4, 1, 7]\nm = a[0]\nfor x in a:\n    if x > m:\n        m = x']
  };
  if (/^C05-[3-6]$/.test(q.id)) {
    const variants = [[6,'* 2'],[15,'- 4'],[9,'+ 1'],[20,'/ 4']];
    const [value, op] = variants[Number(q.id.split('-')[1])-3];
    return {text:`標準入力に${value}を入力する。\n次のプログラムが出力する値を答えなさい。`,code:`n = int(input())\nprint(n ${op})`};
  }
  if (codeQuestions[q.id]) { const [text,code]=codeQuestions[q.id];return {text,code}; }
  return {text:q.question.replace(/。\s*(?=\S)/g,'。\n').replace(/、(?=[a-zA-Z]\w*←)/g,'、\n').replace(/(とし、|のとき、)\s*(?=[a-zA-Z])/g,'$1\n'),code:null};
};
