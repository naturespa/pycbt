# pycbt

情報I向け CBT の最小構成です。ブラウザで `index.html` を開くだけで動作し、外部サービスやビルドは不要です。

## 実装済み

- 4桁受験番号（学年・組・出席番号）と氏名の入力
- 40分タイマー、35問の回答移動、時間切れ時の自動提出
- 100点満点（知識・技能 40点／思考・判断・表現 60点）
- 4択25問・入力10問、ITパスポート関連10問、図表6問のブループリント検証
- 総合・2観点・A〜F・ITパスポート関連・学習アドバイスの結果画面
- 問題ごとの回答を含む UTF-8 BOM 付き CSV のダウンロード

## 問題マスタ

`question-bank.js` の `QUESTION_BANK` が問題マスタです。各問題は次の項目を持ちます。

`id`, `domain`, `viewpoint`, `format`, `points`, `difficulty`, `source`, `source_ref`, `it_passport`, `visual_type`, `variant_group`, `skill`, `question`, `choices`, `answer`, `acceptable_answers`, `explanation`, `advice_tag`

`variant_group` は数値や条件を変える同系統問題の識別子、`visual_type` は `none` / `flowchart` / `state` / `table` / `sort_trace` などの図表種別です。実問題投入時は、181件まで同じ形式で追加できます。開始時に `validateBlueprint` が35問・100点・観点別配点・形式数・ITパスポート関連数・図表数を検査します。

現在の35問は試験フロー確認用のサンプルです。`A001`〜`C006` は具体例、D〜F は問題バンク投入時に置換するプレースホルダーです。
