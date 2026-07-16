/** タイル画像1枚の情報 (bitmap はセンタークロップ・縮小済みの正方形) */
export interface TileInfo {
  name: string
  avgColor: [number, number, number]
  bitmap: ImageBitmap
}

/** 生成パラメータ */
export interface MosaicParams {
  /** グリッド解像度: 入力画像の辺をこの値で割った数がグリッド数になる (小さいほど細かい) */
  x: number
  /** タイル1枚の出力ピクセルサイズ */
  n: number
  /** ランダム回転 (0/90/180/270度) を行うか */
  rotate: boolean
  /** 色補正の強さ (0-100%)。セル目標色との差分をタイル全ピクセルに加算し、ディテールを保ったまま色味を近づける */
  colorAdjust: number
}

/** タイル使用統計 (1タイル分) */
export interface UsageStat {
  name: string
  count: number
  percentage: number
}

/** 出力レイアウトの計算結果 */
export interface MosaicPlan {
  gridWidth: number
  gridHeight: number
  /** 上限ガードで縮小された実効タイル解像度 (通常は params.n と同じ) */
  effectiveN: number
  outputWidth: number
  outputHeight: number
  /** 上限ガードが働いたか */
  capped: boolean
}

/** Worker へのリクエスト */
export interface WorkerRequest {
  input: ImageBitmap
  tiles: { name: string; avgColor: [number, number, number]; bitmap: ImageBitmap }[]
  gridWidth: number
  gridHeight: number
  n: number
  rotate: boolean
  /** 色補正の強さ (0-1)。ディテール保持型の色シフトに使う */
  colorAdjust: number
}

/** 生成完了時のデータ */
export interface MosaicDone {
  type: 'done'
  blob: Blob
  stats: UsageStat[]
  /** タイル名 (assignments のインデックスに対応) */
  tileNames: string[]
  /** 各セルに使用されたタイルのインデックス (行優先, gridWidth × gridHeight) */
  assignments: Uint16Array
  totalTiles: number
  usedTileKinds: number
  tileKindsTotal: number
  gridWidth: number
  gridHeight: number
  outputWidth: number
  outputHeight: number
}

/** Worker からのレスポンス */
export type WorkerResponse =
  | { type: 'progress'; percent: number; label?: string }
  | MosaicDone
  | { type: 'error'; message: string }
