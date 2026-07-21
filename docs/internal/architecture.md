# アーキテクチャ

サーバーを持たない静的サイト。画像処理はすべてブラウザ内 (Web Worker + OffscreenCanvas) で完結する。

## 設計原則

1. **すべての画像処理はブラウザ内で完結させ、画像データを外部へ送信しない。** 「画像が外部へ送信されることはない」はユーザーへの製品上の約束 ([README](../../README.md))。
2. **画像のデコードと生成はメインスレッドではなく Web Worker で行う。** メインスレッドで行うと大量読み込み時に UI がフリーズし、iOS Safari では `InvalidStateError` が発生するため。
3. **Worker へ `ImageBitmap` を渡すときは transfer リストで所有権を移す。** structured clone で渡すと iOS Safari で生成結果が空になるため。
4. **出力キャンバスは端末の上限に収まるように設計する。** WebKit はキャンバス面積の上限が PC ブラウザより大幅に小さいため。実装 (`src/lib/mosaic.ts` の `computePlan`) は面積ではなく1辺の長さの上限 (PC: 16,384px / モバイル: 4,096px) として近似判定し、超える場合はタイル解像度 `n` を自動縮小する。

## コード構成

- `src/lib/mosaic.ts` — アルゴリズム本体・レイアウト計算 ([アルゴリズム解説](algorithm.md))
- `src/lib/tiles.ts` — アップロードされたタイルの読み込みと平均色の事前計算
- `src/lib/colorUtils.ts` / `format.ts` / `types.ts` — 色計算・表示フォーマット・共有型
- `src/workers/mosaicWorker.ts` — 生成処理を行う Web Worker
- `src/workers/tileWorker.ts` — タイルのデコードを行う Web Worker
- `src/components/` — アップローダー・タイル・パラメータ・プレビュー・統計の UI

## デプロイ

`main` ブランチへの push で GitHub Actions (`.github/workflows/deploy.yml`) が自動ビルドし、GitHub Pages にデプロイする。リポジトリ設定で Pages の Source を「GitHub Actions」にしておく必要がある。
