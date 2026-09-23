/** タイル選択で使う色比較方式。仕上がりの評価方針とは独立した設定 */
export type ColorComparison = "rgb" | "oklab";
export type MosaicMode = "color" | "balanced" | "structure";

/** タイル画像1枚の情報 (bitmap はセンタークロップ・縮小済みの正方形) */
export interface TileInfo {
  name: string;
  /** 重複判定キー (ファイル名:サイズ)。同じ写真の再追加をスキップするために使う */
  key: string;
  avgColor: [number, number, number];
  bitmap: ImageBitmap;
}

/** 出力画像の形式 */
export type OutputFormat = "png" | "jpeg";

/**
 * JPG で書き出すときの解像度。
 * 生成そのものは常に原寸で行い、JPG のエンコード直前に縮小する。
 */
export type JpegResolution = "low" | "medium" | "high";

/** 生成パラメータ */
export interface MosaicParams {
  mode: MosaicMode;
  /** グリッド解像度: 入力画像の辺をこの値で割った数がグリッド数になる (小さいほど細かい) */
  x: number;
  /** タイル1枚の出力ピクセルサイズ */
  n: number;
  /** ランダム回転 (0/90/180/270度) を行うか */
  rotate: boolean;
  /** 色補正の強さ (0-100%)。セル目標色との差分をタイル全ピクセルに加算し、ディテールを保ったまま色味を近づける */
  colorAdjust: number;
  colorComparison: ColorComparison;
  /**
   * 方式ごとのばらつき。色優先は元色への距離、他モードは周囲との関係を含む
   * 評価値の許容差。方式を切り替えてもそれぞれの調整値を保持する
   */
  colorTolerance: Record<ColorComparison, number>;
  /** 出力画像の形式 */
  format: OutputFormat;
  /** JPG の書き出し解像度 (PNG では使わない) */
  jpegResolution: JpegResolution;
}

/** タイル使用統計 (1タイル分) */
export interface UsageStat {
  name: string;
  /** 生成時のタイルインデックス (tileNames と対応)。サムネイル取得に使う */
  index: number;
  count: number;
  percentage: number;
}

/** 出力レイアウトの計算結果 */
export interface MosaicPlan {
  gridWidth: number;
  gridHeight: number;
  /** 上限ガードで縮小された実効タイル解像度 (通常は params.n と同じ) */
  effectiveN: number;
  outputWidth: number;
  outputHeight: number;
  /** 上限ガードが働いたか */
  capped: boolean;
  /** この計算に使った出力1辺の上限 (端末により異なる) */
  maxDim: number;
}

/** Worker へのリクエスト */
export interface WorkerRequest {
  type: "generate";
  analysisId: number;
  mode: MosaicMode;
  /** 3モードの比較では同じ乱数列を使う。通常生成では省略する。 */
  seed?: number;
  tiles: {
    name: string;
    avgColor: [number, number, number];
    bitmap: ImageBitmap;
  }[];
  n: number;
  rotate: boolean;
  /** 色補正の強さ (0-1)。ディテール保持型の色シフトに使う */
  colorAdjust: number;
  colorComparison: ColorComparison;
  /** 選択した方式の尺度で表す許容差。0 なら乱数を使わず最良の候補を選ぶ */
  colorTolerance: number;
  format: OutputFormat;
  jpegResolution: JpegResolution;
}

export interface AnalysisRequest {
  type: "analyze";
  analysisId: number;
  input: ImageBitmap;
  tileColors: [number, number, number][];
  gridWidth: number;
  gridHeight: number;
}

/** 生成完了時のデータ */
export interface MosaicDone {
  type: "done";
  mode: MosaicMode;
  blob: Blob;
  stats: UsageStat[];
  /** タイル名 (assignments のインデックスに対応) */
  tileNames: string[];
  /** 各セルに使用されたタイルのインデックス (行優先, gridWidth × gridHeight) */
  assignments: Uint16Array;
  totalTiles: number;
  usedTileKinds: number;
  tileKindsTotal: number;
  gridWidth: number;
  gridHeight: number;
  /** 実際に書き出された画像の幅 (JPG の縮小後のサイズ) */
  outputWidth: number;
  /** 実際に書き出された画像の高さ (JPG の縮小後のサイズ) */
  outputHeight: number;
}

/** Worker からのレスポンス */
export type WorkerResponse =
  | { type: "progress"; percent: number; label?: string }
  | { type: "analyzed"; analysisId: number; limitedPalette: boolean }
  | MosaicDone
  | { type: "error"; message: string };

/** タイルデコード Worker へのリクエスト */
export interface TileWorkerRequest {
  files: File[];
  /** 同時デコード数 (モバイル判定はメインスレッド側でしかできないため、ここで渡す) */
  concurrency: number;
}

/**
 * タイルデコード Worker からのレスポンス。
 * タイルは1枚完了するごとに bitmap を transfer して返す (Worker 側のメモリを平坦に保ち、
 * 途中でエラーが起きても処理済みのタイルを失わないため)。
 */
export type TileWorkerResponse =
  | {
      type: "tile";
      name: string;
      key: string;
      avgColor: [number, number, number];
      bitmap: ImageBitmap;
      done: number;
      total: number;
    }
  | { type: "skipped"; name: string; done: number; total: number }
  | { type: "batch-done"; loaded: number; skipped: number; total: number }
  | { type: "batch-error"; message: string };
