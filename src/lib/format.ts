import type { MosaicDone, OutputFormat } from "./types";

/**
 * JPEG のエンコード品質。
 * 0.9 以上を指定するとブラウザがクロマサブサンプリングを無効化し (4:2:0 → 4:4:4)、
 * 色差成分のデータ量が倍近くに増える。モザイクはタイル境界の高周波成分が多いため、
 * 0.9 以上ではファイルサイズが PNG と変わらなくなり、JPG にする意味がなくなる。
 */
export const JPEG_QUALITY = 0.85;

/** 出力形式に対応する MIME タイプ */
export function mimeForFormat(format: OutputFormat): string {
  return format === "jpeg" ? "image/jpeg" : "image/png";
}

/**
 * 実際にエンコードされた MIME タイプに対応する拡張子。
 * convertToBlob は対応しない形式を要求されると PNG を返すため、要求した形式ではなく
 * 結果の type から決める (中身と拡張子の食い違いを防ぐ)。
 */
export function extensionForMimeType(type: string): string {
  return type === "image/jpeg" ? "jpg" : "png";
}

/** 使用割合の表示用フォーマット。toPrecision(2) が 100 を "1.0e+2" にするのを避ける */
export function formatPercent(percentage: number): string {
  return Number(percentage.toPrecision(2)).toString();
}

/** ファイル名用タイムスタンプ (Python版と同じ YYYYMMDD_HHMMSS 形式) */
export function formatTimestamp(date = new Date()): string {
  const pad = (v: number) => String(v).padStart(2, "0");
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}

/** 使用統計のテキストを組み立てる (Python版の統計ファイルと同等の内容) */
export function buildStatsText(result: MosaicDone, inputName: string): string {
  const lines: string[] = [];
  lines.push("=== プリセット画像使用統計 ===");
  lines.push(`入力画像: ${inputName}`);
  lines.push(`処理日時: ${new Date().toLocaleString("ja-JP")}`);
  lines.push("");
  for (const stat of result.stats) {
    lines.push(
      `${stat.name}: ${stat.count}回 (${formatPercent(stat.percentage)}%)`,
    );
  }
  lines.push("");
  lines.push(
    `使用されたプリセット画像の種類: ${result.usedTileKinds} / ${result.tileKindsTotal}`,
  );
  lines.push(`総タイル数: ${result.totalTiles}`);
  lines.push(`グリッドサイズ: ${result.gridWidth} × ${result.gridHeight}`);
  return lines.join("\n");
}

/** Blob をファイルとしてダウンロードする */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
