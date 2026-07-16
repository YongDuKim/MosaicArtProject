# モザイクアート生成

アップロードした元画像を、タイル用にアップロードした写真群で再構成するモザイクアート生成アプリです。Vite + React + TypeScript 製で、サーバー不要・画像処理はすべてブラウザ内 (Web Worker + OffscreenCanvas) で完結します。**画像が外部へ送信されることはありません。**

公開ページ: https://yongdukim.github.io/MosaicArtProject/

## 使い方

1. モザイク化したい元画像をアップロード
2. タイルにする写真を複数枚アップロード (中央が正方形に切り抜かれます)
3. パラメータを調整して「モザイクアートを生成」
4. 生成された PNG と使用統計をダウンロード

タイル画像はメモリ上にのみ保持され、ページをリロードすると消えます。

## 開発

```bash
npm install
npm run dev      # 開発サーバー起動 (http://localhost:5173)
npm run build    # 本番ビルド (dist/ に出力)
npm run lint     # oxlint
```

## デプロイ

`main` ブランチへの push で GitHub Actions (`.github/workflows/deploy.yml`) が自動ビルドし、GitHub Pages にデプロイします。リポジトリ設定で Pages の Source を「GitHub Actions」にしておく必要があります。

## アルゴリズム

1. 入力画像を `x`(既定5)で割ったグリッドに分割
2. 各セルの平均色に RGB 二乗距離が最も近いタイル画像を選択
3. 0/90/180/270 度のランダム回転で貼り付け(OFF 可)
4. 色補正スライダーで、ディテールを保ったままセル目標色へ色シフト
5. 出力サイズは「グリッド数 × タイル解像度 `n`(既定25)px」。1辺が 16,384px を超える場合は `n` を自動縮小

## 構成

- `src/lib/mosaic.ts` — アルゴリズム本体・レイアウト計算
- `src/lib/tiles.ts` — アップロードされたタイルの読み込みと平均色の事前計算
- `src/workers/mosaicWorker.ts` — 生成処理を行う Web Worker
- `src/components/` — アップローダー・タイル・パラメータ・プレビュー・統計の UI
