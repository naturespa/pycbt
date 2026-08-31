# pycbt

情報I向け CBT の最小構成です。ブラウザで `index.html` を開くだけで動作し、外部サービスやビルドは不要です。

## 実装済み

- 4桁受験番号（学年・組・出席番号）と氏名の入力・開始前確認
- 40分タイマー、固定サイズの問題表示、35問の回答移動、時間切れ時の自動提出
- 同一ブラウザ内の中断復元と、提出済み番号の再受験防止
- 100点満点（知識・技能 40点／思考・判断・表現 60点）
- 4択25問・入力10問、ITパスポート関連10問、図表6問のブループリント検証
- 総合・2観点・A〜F・ITパスポート関連・学習アドバイスの結果画面
- 問題ごとの `question_id`・`variant_id`・回答・正誤・得点を含む JSON のダウンロード

## 問題マスタ

`question-bank.js` の `QUESTION_BANK` が問題マスタです。各問題は次の項目を持ちます。

`id`, `domain`, `viewpoint`, `format`, `points`, `difficulty`, `source`, `source_ref`, `it_passport`, `render_type`, `visual_type`, `variant_group`, `variant_id`, `skill`, `question`, `choices`, `answer`, `acceptable_answers`, `explanation`, `advice_tag`

`render_type` は `fixed` / `parameter` / `visual`、`variant_group` は数値や条件を変える同系統問題の識別子、`variant_id` は実際に出題した監査済みバリエーション、`visual_type` は `none` / `flowchart` / `state` / `table` / `sort_trace` などの図表種別です。実問題投入時は、181件まで同じ形式で追加できます。開始時に `validateBlueprint` が35問・100点・観点別配点・形式数・ITパスポート関連数・図表数を検査します。

## 受験制御の範囲

GitHub Pages版はサーバーを持たないため、同一ブラウザ内では提出後の再受験を止め、中断時は同じ受験を復元します。ただし、別端末・別ブラウザ・ブラウザデータ消去まで防ぐには、ログインとサーバー側の受験台帳が必要です。

現在の35問は試験フロー確認用のサンプルです。`A001`〜`C006` は具体例、D〜F は問題バンク投入時に置換するプレースホルダーです。
