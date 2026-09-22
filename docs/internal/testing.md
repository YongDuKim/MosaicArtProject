# テスト

Vitest による単体テスト。`npm test` で1回実行し、`npm run test:watch` で監視実行する。

## 方針

ブラウザ API に依存しない純粋なロジックだけを対象とする。テスト環境は Node (`vitest.config.ts`) で、canvas も DOM も用意しない。

モザイク生成の中心は `OffscreenCanvas` / `ImageBitmap` / Web Worker であり、これらは Node 環境では動かない。ヘッドレスブラウザを持ち込めば動かせるが、実行時間と依存が増えるうえ、本当に確かめたい iOS Safari のキャンバス面積上限は結局そこでも再現できない。そのため描画結果と UI の確認は `npm run dev` での手動確認と実機確認に委ね、テストは壊れやすく機械判定できる部分に絞る。

## 配置

テストは対象と同じディレクトリに `*.test.ts` として置く (`src/lib/format.ts` に対して `src/lib/format.test.ts`)。`vitest.config.ts` の `include` は `src/**/*.test.ts`。

## 対象

| ファイル                          | 対象                                                                                                                             |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/format.test.ts`          | 表示フォーマット・統計テキストの組み立て・出力形式と拡張子の対応                                                                 |
| `src/lib/colorUtils.test.ts`      | 最近傍タイルの選択・許容色差内の候補抽出とランダム選択                                                                           |
| `src/lib/colorComparison.test.ts` | 独立した参照値による Oklab 変換・sRGB 線形化・方式による選択の違い・Oklab の境界とランダム選択・RGB の選択結果と乱数消費の互換性 |
| `src/lib/mosaic.test.ts`          | 出力レイアウト計算・JPG 書き出し時の縮小サイズ・端末別の出力上限判定                                                             |
| `src/lib/decode.test.ts`          | マジックナンバーによる HEIC/HEIF 判定                                                                                            |
| `src/lib/tiles.test.ts`           | タイルの重複判定キー                                                                                                             |
| `src/lib/resize.test.ts`          | 段階的縮小で経由する中間サイズ                                                                                                   |

`src/components/` と `src/workers/`、および canvas を使う `colorUtils.ts` の平均色計算・`tiles.ts` のデコードと縮小・`mosaic.ts` の `generateMosaic` はテスト対象外。

Oklab の参照値は Color.js の独立した変換結果を固定値として使用する。参照実装のバージョンと生成方法はテスト内に記載し、アプリやテストの依存には追加しない。

色比較方式のブラウザ確認では、初期値、方式別のばらつきの保持、切り替え後の再生成、回転・色補正との併用を確認する。

## CI

Pull Request では `.github/workflows/ci.yml` が `npm run format:check`・`npm run lint`・`npm test`・`npm run build` を実行する。

`main` への push では `.github/workflows/deploy.yml` の build ジョブがビルド前に `npm test` を実行する。テストが失敗すると GitHub Pages へデプロイされない。
