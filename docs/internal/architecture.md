# アーキテクチャ

サーバーを持たない静的サイト。画像処理はすべてブラウザ内 (Web Worker + OffscreenCanvas) で完結する。

## 設計原則

1. **すべての画像処理はブラウザ内で完結させ、画像データを外部へ送信しない。** 「画像が外部へ送信されることはない」はユーザーへの製品上の約束 ([README](../../README.md))。
2. **画像のデコードと生成はメインスレッドではなく Web Worker で行う。** メインスレッドで行うと大量読み込み時に UI がフリーズし、iOS Safari では `InvalidStateError` が発生するため。
3. **Worker へ `ImageBitmap` を渡すときは transfer リストで所有権を移す。** structured clone で渡すと iOS Safari で生成結果が空になるため。
4. **出力キャンバスは端末の上限に収まるように設計する。** WebKit はキャンバス面積の上限が PC ブラウザより大幅に小さいため。実装 (`src/lib/mosaic.ts` の `computePlan`) は面積ではなく1辺の長さの上限 (PC: 16,384px / モバイル: 4,096px) として近似判定し、超える場合はタイル解像度 `n` を自動縮小する。
5. **画像の縮小は `src/lib/resize.ts` に集約する。** 縮小は3か所 (タイル読み込み・生成時のタイル配置・JPG 書き出し) にあり、実装が分かれると品質も分かれるため。目標の2倍を超える間は1/2ずつ縮小するが、これは大きな縮小率をエンジンのリサンプラ任せにしないための措置であり、Chrome では一回で縮小した場合との差は画質・JPEG のファイルサイズとも確認できていない。
6. **HEIC/HEIF のデコードは自己完結する `heic-to` の既定ビルドを使う。** 既定ビルドは wasm を JavaScript にコンパイル (wasm2js) して同梱するため、別 `.wasm` ファイルを実行時に取得せず、GitHub Pages のサブパス配信でも読み込み先を気にせず動く。外部 wasm を取得する `heic-to/csp` や `heic-to/next` に切り替えると base パス解決が必要になるため使わない。`heic-to` 本体は数 MB あるので、HEIC を検出したときだけ動的 import する (`src/lib/decode.ts`)。

## コード構成

- `src/lib/mosaic.ts` — アルゴリズム本体・レイアウト計算 ([アルゴリズム解説](algorithm.md))
- `src/lib/tiles.ts` — アップロードされたタイルの読み込みと平均色の事前計算
- `src/lib/decode.ts` — 画像の共通デコード。HEIC/HEIF はブラウザ内 (heic-to) で変換する
- `src/lib/resize.ts` — 画像縮小の共通処理 (段階的縮小)
- `src/lib/colorComparison.ts` — 色比較方式の設定・sRGB と Oklab の変換・タイル比較色の準備
- `src/lib/mosaicModes.ts` — 配色解析・モード別の目標配色と隣接セルの関係を含むタイル選択
- `src/lib/useMosaicGeneration.ts` — 解析の世代管理・生成と比較の進行・結果の保持
- `src/lib/random.ts` — モード比較で同じ乱数列を使うための生成器
- `src/lib/colorUtils.ts` / `format.ts` / `types.ts` — 色計算・表示フォーマット・共有型
- `src/workers/mosaicWorker.ts` — 生成処理を行う Web Worker
- `src/workers/tileWorker.ts` — タイルのデコードを行う Web Worker
- `src/components/` — アップローダー・タイル・パラメータ・プレビュー・統計の UI
- `src/lib/*.test.ts` — 単体テスト ([テスト](testing.md))

## 解析と結果の寿命

元画像・素材・グリッドが揃うと、生成 Worker に元画像のコピーを transfer し、セルの代表色と配色の分布を解析する。Worker は代表色と解析結果を保持し、読み終えた元画像のコピーを解放する。生成リクエストは解析の世代番号と素材のコピーを渡すため、元画像を生成のたびに複製しない。

解析対象を変更すると Worker を終了して解析を作り直す。非同期で準備したコピーや結果は世代番号を確認し、古い入力に属するものを破棄する。解析が完了するまで生成ボタンは無効にする。

比較は同じ解析を使って3モードを順番に生成する。描画キャンバスは各モードのエンコード後に解放し、メインスレッドには圧縮済みの結果と使用統計を保持する。画面に出す画像は1枚だけで、切り替え時にスクロール位置と倍率を維持する。結果の入れ替え・生成条件の変更・アンマウントでは対応する Blob URL を解放する。

## デプロイ

`main` ブランチへの push で GitHub Actions (`.github/workflows/deploy.yml`) がテストとビルドを実行し、GitHub Pages にデプロイする。リポジトリ設定で Pages の Source を「GitHub Actions」にしておく必要がある。
