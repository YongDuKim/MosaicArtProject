# AGENTS.md

アップロードした画像を、タイル用の写真群で再構成するブラウザ完結のモザイクアート生成アプリ。
Vite + React + TypeScript 製。

## Commands

```bash
npm install
npm run dev
npm run format
npm run lint
npm run build
```

テストは存在しない。

## Validation

- 完了前に必ず `npm run format`・`npm run lint`・`npm run build`が通ることを確認すること。
- ビルドが通っても実行時にのみ現れる不具合が多いため、コード変更では `npm run dev` でブラウザでの動作確認まで行うこと。ブラウザを操作できない環境では、その旨を報告してユーザーに動作確認を依頼すること。
- iOS Safari 固有の挙動はローカルでは検証できないため、iOS 固有の影響が疑われる変更では、ブラウザ確認の可否にかかわらず、その旨を報告してユーザーに実機確認を依頼すること。

## Important Rules

- **画像データを外部へ送信しない。**
  - 「画像が外部へ送信されることはない」はユーザーへの製品上の約束。画像を送信するコード・依存・解析ツールを追加してはならない。
- **サーバーレス静的構成を維持する。**
  - GitHub Pages だけで完結させること。
  - バックエンドを必要とする変更は不可とする。
- **iOS Safari 対応は必須要件。**
  - iOS Safariはキャンバス面積上限など制約が多いため気をつけること。
  - 画像パイプラインに触れる際は [docs/internal/architecture.md](docs/internal/architecture.md) の設計原則を確認すること。

## Documentation

ドキュメントは現在の事実のスナップショットである。
ドキュメントを読めば今の姿がわかる状態を保つこと。
過去の変更履歴は git が持つため、ドキュメントに書く必要はない。

- 事実はただ一箇所に書き、他からはリンクで参照すること (Single Source of Truth)。
  - ユーザー向けの事実 → `docs/user/`
  - 開発者向けの事実 → `docs/internal/`
  - エージェント向けの開発規範 → この AGENTS.md
- 挙動・構成・使い方が変わる変更では、その作業の一部として該当ドキュメントを更新すること。
  - 後回しにするとコードとドキュメントが乖離する。
- 事実が変わったら、追記ではなく古い記述を書き換え・削除すること。
  - 変更の経緯や時系列は書かない。ただし、現在も有効な制約の理由は現在の事実なので書いてよい。
    - NG: 「以前は一括描画だったが iOS で失敗するため分割描画に変更した」
    - OK: 「iOS のキャンバス面積上限があるため分割描画する」
- 作業範囲外で陳腐化した記述に気づいたら、黙って修正せず、ユーザーに報告すること。

これらのルールはリポジトリ内の全 Markdown ドキュメント (この AGENTS.md・README・docs/) に適用する。

## Commit Message

コミットメッセージはConventional Commits に従い、英語で簡潔に書くこと。
例: `fix: transfer ImageBitmap to worker to avoid empty output on iOS`
