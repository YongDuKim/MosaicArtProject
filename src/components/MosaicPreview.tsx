import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { MosaicDone } from "../lib/types";
import { MOSAIC_MODES } from "../lib/mosaicModes";
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
  const viewportRef = useRef<HTMLDivElement>(null);
  const center = useRef({ x: 0.5, y: 0.5 });
  const [zoom, setZoom] = useState("fit");
  const [availableWidth, setAvailableWidth] = useState(640);
  const [availableHeight, setAvailableHeight] = useState(600);
  const ratio = result.outputWidth / result.outputHeight;
  const fitWidth = Math.min(availableWidth, availableHeight * ratio);
  const imageWidth =
    zoom === "actual"
      ? result.outputWidth
      : fitWidth * (zoom === "fit" ? 1 : Number(zoom));

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const resize = () => {
      setAvailableWidth(viewport.clientWidth);
      setAvailableHeight(Math.min(600, window.innerHeight * 0.65));
    };
    const observer = new ResizeObserver(resize);
    observer.observe(viewport);
    window.addEventListener("resize", resize);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, []);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    viewport.scrollLeft =
      center.current.x * viewport.scrollWidth - viewport.clientWidth / 2;
    viewport.scrollTop =
      center.current.y * viewport.scrollHeight - viewport.clientHeight / 2;
  }, [imageWidth, resultUrl]);

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
      <h2>生成結果：{MOSAIC_MODES[result.mode].label}</h2>
      <label className="preview-zoom">
        表示倍率
        <select value={zoom} onChange={(event) => setZoom(event.target.value)}>
          <option value="fit">全体</option>
          <option value="2">2倍</option>
          <option value="4">4倍</option>
          <option value="actual">原寸</option>
        </select>
        <span>拡大後はスクロールして写真を確認できます。</span>
      </label>
      <div
        ref={viewportRef}
        className="preview-viewport"
        role="region"
        aria-label="モザイクの拡大表示"
        tabIndex={0}
        style={{ height: Math.min(fitWidth / ratio, availableHeight) }}
        onScroll={(event) => {
          const viewport = event.currentTarget;
          center.current = {
            x:
              (viewport.scrollLeft + viewport.clientWidth / 2) /
              viewport.scrollWidth,
            y:
              (viewport.scrollTop + viewport.clientHeight / 2) /
              viewport.scrollHeight,
          };
        }}
      >
        <div
          className="preview-image-wrap"
          style={{ width: imageWidth, aspectRatio: ratio }}
        >
          <img
            className="preview-image"
            src={resultUrl}
            alt={`${MOSAIC_MODES[result.mode].label}で生成されたモザイクアート`}
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
            `mosaic_${result.mode}_${formatTimestamp()}.${extension}`,
          )
        }
      >
        {extension.toUpperCase()}をダウンロード
      </button>
    </div>
  );
}
