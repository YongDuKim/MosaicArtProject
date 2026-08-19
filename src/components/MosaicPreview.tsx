import { useEffect, useRef } from "react";
import type { MosaicDone } from "../lib/types";
import {
  downloadBlob,
  extensionForMimeType,
  formatTimestamp,
} from "../lib/format";

interface Props {
  result: MosaicDone;
  resultUrl: string;
  /** ハイライト中のタイル名 (null なら通常表示) */
  selectedTile: string | null;
  onClearSelection: () => void;
}

export default function MosaicPreview({
  result,
  resultUrl,
  selectedTile,
  onClearSelection,
}: Props) {
  const overlayRef = useRef<HTMLCanvasElement>(null);

  // 選択タイル以外のセルを暗くするオーバーレイを描画する。
  // canvas はグリッド解像度のまま CSS で拡大し (image-rendering: pixelated)、
  // セル境界にぴったり揃える。
  useEffect(() => {
    const canvas = overlayRef.current;
    if (!canvas || !selectedTile) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { gridWidth, gridHeight, assignments, tileNames } = result;
    const tileIndex = tileNames.indexOf(selectedTile);
    const imageData = ctx.createImageData(gridWidth, gridHeight);
    const data = imageData.data;
    for (let i = 0; i < assignments.length; i++) {
      if (assignments[i] !== tileIndex) {
        data[i * 4 + 3] = 210; // 非該当セルを黒でほぼ塗りつぶす (RGB は 0 のまま)
      }
    }
    ctx.putImageData(imageData, 0, 0);
  }, [result, selectedTile]);

  // 実際にエンコードされた形式に合わせる (要求した形式が使えないとブラウザは PNG を返す)
  const extension = extensionForMimeType(result.blob.type);

  const selectedCount = selectedTile
    ? result.stats.find((s) => s.name === selectedTile)?.count
    : undefined;

  return (
    <div className="preview card">
      <h2>生成結果</h2>
      <div className="preview-image-wrap">
        <img
          className="preview-image"
          src={resultUrl}
          alt="生成されたモザイクアート"
        />
        {selectedTile && (
          <canvas
            ref={overlayRef}
            className="preview-overlay"
            width={result.gridWidth}
            height={result.gridHeight}
          />
        )}
      </div>
      {selectedTile ? (
        <p className="preview-meta highlight-info">
          <strong>{selectedTile}</strong> の使用箇所をハイライト中 (
          {selectedCount?.toLocaleString()}箇所){" "}
          <button
            type="button"
            className="link-button"
            onClick={onClearSelection}
          >
            解除
          </button>
        </p>
      ) : (
        <p className="preview-meta">
          {result.outputWidth.toLocaleString()} ×{" "}
          {result.outputHeight.toLocaleString()} px / グリッド{" "}
          {result.gridWidth} × {result.gridHeight}
        </p>
      )}
      <button
        type="button"
        onClick={() =>
          downloadBlob(
            result.blob,
            `mosaic_output_${formatTimestamp()}.${extension}`,
          )
        }
      >
        {extension.toUpperCase()}をダウンロード
      </button>
    </div>
  );
}
