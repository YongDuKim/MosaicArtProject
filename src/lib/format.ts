import type { MosaicDone } from './types'

/** 使用割合の表示用フォーマット。toPrecision(2) が 100 を "1.0e+2" にするのを避ける */
export function formatPercent(percentage: number): string {
  return Number(percentage.toPrecision(2)).toString()
}

/** ファイル名用タイムスタンプ (Python版と同じ YYYYMMDD_HHMMSS 形式) */
export function formatTimestamp(date = new Date()): string {
  const pad = (v: number) => String(v).padStart(2, '0')
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  )
}

/** 使用統計のテキストを組み立てる (Python版の統計ファイルと同等の内容) */
export function buildStatsText(result: MosaicDone, inputName: string): string {
  const lines: string[] = []
  lines.push('=== プリセット画像使用統計 ===')
  lines.push(`入力画像: ${inputName}`)
  lines.push(`処理日時: ${new Date().toLocaleString('ja-JP')}`)
  lines.push('')
  for (const stat of result.stats) {
    lines.push(`${stat.name}: ${stat.count}回 (${formatPercent(stat.percentage)}%)`)
  }
  lines.push('')
  lines.push(`使用されたプリセット画像の種類: ${result.usedTileKinds} / ${result.tileKindsTotal}`)
  lines.push(`総タイル数: ${result.totalTiles}`)
  lines.push(`グリッドサイズ: ${result.gridWidth} × ${result.gridHeight}`)
  return lines.join('\n')
}

/** Blob をファイルとしてダウンロードする */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
