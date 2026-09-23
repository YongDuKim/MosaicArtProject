import type {
  AnalysisRequest,
  WorkerRequest,
  WorkerResponse,
} from "../lib/types";
import { generateMosaic } from "../lib/mosaic";
import {
  analyzeMosaic,
  hasLimitedPalette,
  type MosaicAnalysis,
} from "../lib/mosaicModes";

// DOM lib と WebWorker lib の型競合を避けるため Worker 型にキャストして使う
const ctx = self as unknown as Worker;

const post = (message: WorkerResponse) => ctx.postMessage(message);

let analysis: MosaicAnalysis | null = null;
let analysisId = -1;

ctx.onmessage = async (
  event: MessageEvent<WorkerRequest | AnalysisRequest>,
) => {
  try {
    const req = event.data;
    if (req.type === "analyze") {
      analysis = null;
      let small: OffscreenCanvas | null = null;
      try {
        small = new OffscreenCanvas(req.gridWidth, req.gridHeight);
        const drawing = small.getContext("2d", { willReadFrequently: true });
        if (!drawing) throw new Error("2Dコンテキストを取得できませんでした");
        drawing.imageSmoothingQuality = "high";
        drawing.drawImage(req.input, 0, 0, req.gridWidth, req.gridHeight);
        const cells = drawing.getImageData(
          0,
          0,
          req.gridWidth,
          req.gridHeight,
        ).data;
        analysis = analyzeMosaic(
          cells,
          req.gridWidth,
          req.gridHeight,
          req.tileColors,
        );
        analysisId = req.analysisId;
        post({
          type: "analyzed",
          analysisId,
          limitedPalette: hasLimitedPalette(analysis),
        });
      } finally {
        req.input.close();
        if (small) small.width = small.height = 1;
      }
      return;
    }
    if (!analysis || req.analysisId !== analysisId) {
      req.tiles.forEach((tile) => tile.bitmap.close());
      throw new Error("画像の解析が更新されました。もう一度生成してください。");
    }
    const result = await generateMosaic(
      req,
      (percent, label) => post({ type: "progress", percent, label }),
      analysis,
    );
    post(result);
  } catch (err) {
    post({
      type: "error",
      message: err instanceof Error ? err.message : String(err),
    });
  }
};
