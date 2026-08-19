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

/** 出力サイズのプリセット (目標とする出力長辺) */
export type OutputSize = "low" | "medium" | "high";

/** 生成パラメータ */
export interface MosaicParams {
  /** グリッド解像度: 入力画像の辺をこの値で割った数がグリッド数になる (小さいほど細かい) */
  x: number;
  /** 出力サイズのプリセット。ここからタイル解像度 n を逆算する */
  outputSize: OutputSize;
  /** ランダム回転 (0/90/180/270度) を行うか */
  rotate: boolean;
  /** 色補正の強さ (0-100%)。セル目標色との差分をタイル全ピクセルに加算し、ディテールを保ったまま色味を近づける */
  colorAdjust: number;
  /** 出力画像の形式 */
  format: OutputFormat;
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
  /** 実際に使うタイル解像度 (出力サイズと端末上限から決まる) */
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
  input: ImageBitmap;
  tiles: {
    name: string;
    avgColor: [number, number, number];
    bitmap: ImageBitmap;
  }[];
  gridWidth: number;
  gridHeight: number;
  n: number;
  rotate: boolean;
  /** 色補正の強さ (0-1)。ディテール保持型の色シフトに使う */
  colorAdjust: number;
  format: OutputFormat;
}

/** 生成完了時のデータ */
export interface MosaicDone {
  type: "done";
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
  outputWidth: number;
  outputHeight: number;
}

/** Worker からのレスポンス */
export type WorkerResponse =
  | { type: "progress"; percent: number; label?: string }
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
