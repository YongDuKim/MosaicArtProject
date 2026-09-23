import { useEffect, useRef, useState } from "react";
import { MODE_ORDER, MOSAIC_MODES } from "./mosaicModes";
import type {
  AnalysisRequest,
  MosaicDone,
  MosaicMode,
  MosaicParams,
  MosaicPlan,
  TileInfo,
  WorkerRequest,
  WorkerResponse,
} from "./types";

export interface MosaicResult extends MosaicDone {
  url: string;
  inputName: string;
}

function describeError(message: string): string {
  if (/invalid state|out of memory/i.test(message)) {
    return `生成に失敗しました: ${message} — 端末のメモリまたはキャンバス上限を超えた可能性があります。グリッド解像度 x を大きくするか、タイル解像度 n を小さくしてお試しください。`;
  }
  return message;
}

/** 解析の世代と Worker の寿命を対応させ、古い入力の解析・生成結果を混在させない。 */
export function useMosaicGeneration(
  input: { file: File; bitmap: ImageBitmap } | null,
  tiles: TileInfo[] | null,
  plan: MosaicPlan | null,
  params: MosaicParams,
  tileLoading: boolean,
) {
  const workerRef = useRef<Worker | null>(null);
  const epoch = useRef({ id: 0 }).current;
  const pendingReject = useRef<{ reject: ((error: Error) => void) | null }>({
    reject: null,
  });
  const [analysis, setAnalysis] = useState<{
    id: number;
    limitedPalette: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState<string | null>(null);
  const [results, setResults] = useState<MosaicResult[]>([]);
  const [activeMode, setActiveMode] = useState<MosaicMode>("color");
  const bitmap = input?.bitmap;
  const width = plan?.gridWidth,
    height = plan?.gridHeight;

  useEffect(() => {
    const id = ++epoch.id;
    const pending = pendingReject.current;
    setAnalysis(null);
    setError(null);
    setGenerating(false);
    if (!bitmap || !tiles?.length || !width || !height || tileLoading) return;
    let worker: Worker;
    let cancelled = false;
    try {
      worker = new Worker(
        new URL("../workers/mosaicWorker.ts", import.meta.url),
        { type: "module" },
      );
      workerRef.current = worker;
      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const message = event.data;
        if (message.type === "analyzed" && message.analysisId === id)
          setAnalysis({ id, limitedPalette: message.limitedPalette });
        if (message.type === "error") setError(describeError(message.message));
      };
      worker.onerror = (event) => setError(describeError(event.message));
      void createImageBitmap(bitmap)
        .then((copy) => {
          if (cancelled) {
            copy.close();
            return;
          }
          const request: AnalysisRequest = {
            type: "analyze",
            analysisId: id,
            input: copy,
            tileColors: tiles.map((t) => t.avgColor),
            gridWidth: width,
            gridHeight: height,
          };
          try {
            worker.postMessage(request, [copy]);
          } catch (e) {
            copy.close();
            throw e;
          }
        })
        .catch((e: unknown) => {
          if (!cancelled)
            setError(describeError(e instanceof Error ? e.message : String(e)));
        });
    } catch (e) {
      setError(describeError(e instanceof Error ? e.message : String(e)));
    }
    return () => {
      cancelled = true;
      epoch.id++;
      pending.reject?.(new Error("解析対象が変更されました"));
      pending.reject = null;
      worker?.terminate();
      workerRef.current = null;
    };
  }, [bitmap, tiles, width, height, tileLoading, epoch]);

  // モードの切り替えだけなら比較結果を保持する。他の条件の変更で結果を破棄する。
  const tolerance = params.colorTolerance[params.colorComparison];
  useEffect(() => {
    setResults([]);
  }, [
    bitmap,
    tiles,
    width,
    height,
    params.n,
    params.rotate,
    params.colorAdjust,
    params.colorComparison,
    tolerance,
    params.format,
    params.jpegResolution,
  ]);
  useEffect(
    () => () => results.forEach((result) => URL.revokeObjectURL(result.url)),
    [results],
  );

  const generate = async (compare = false) => {
    const worker = workerRef.current;
    if (
      !worker ||
      !input ||
      !tiles?.length ||
      !plan ||
      !analysis ||
      generating ||
      tileLoading
    )
      return;
    const id = analysis.id;
    if (epoch.id !== id) return;
    const modes = compare ? MODE_ORDER : [params.mode];
    const seed = compare ? Math.floor(Math.random() * 4294967296) : undefined;
    const completed: MosaicResult[] = [];
    setError(null);
    setGenerating(true);
    setProgress(0);
    setProgressLabel("生成を準備中…");
    try {
      // 原寸キャンバスは1モード分だけ確保する。比較結果は圧縮済み Blob として保持。
      for (let index = 0; index < modes.length; index++) {
        const mode = modes[index];
        const copies: ImageBitmap[] = [];
        try {
          for (const tile of tiles) {
            copies.push(await createImageBitmap(tile.bitmap));
            if (epoch.id !== id) throw new Error("生成対象が変更されました");
          }
          const request: WorkerRequest = {
            type: "generate",
            analysisId: id,
            mode,
            seed,
            tiles: tiles.map((tile, i) => ({
              name: tile.name,
              avgColor: tile.avgColor,
              bitmap: copies[i],
            })),
            n: plan.effectiveN,
            rotate: params.rotate,
            colorAdjust: params.colorAdjust / 100,
            colorComparison: params.colorComparison,
            colorTolerance: tolerance,
            format: params.format,
            jpegResolution: params.jpegResolution,
          };
          const result = await new Promise<MosaicDone>((resolve, reject) => {
            pendingReject.current.reject = reject;
            worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
              const message = event.data;
              if (message.type === "done") resolve(message);
              else if (message.type === "error")
                reject(new Error(message.message));
              else if (message.type === "progress") {
                setProgress(
                  Math.round((index * 100 + message.percent) / modes.length),
                );
                setProgressLabel(
                  `${MOSAIC_MODES[mode].label} (${index + 1}/${modes.length})${message.label ? `：${message.label}` : ""}`,
                );
              }
            };
            worker.onerror = (event) => reject(new Error(event.message));
            worker.postMessage(request, copies);
          });
          completed.push({
            ...result,
            url: URL.createObjectURL(result.blob),
            inputName: input.file.name,
          });
        } finally {
          copies.forEach((copy) => copy.close());
          pendingReject.current.reject = null;
          // 完了した Promise とその結果 Blob をイベントハンドラから保持しない。
          worker.onmessage = null;
          worker.onerror = null;
        }
      }
      if (epoch.id !== id) throw new Error("生成対象が変更されました");
      setResults(completed);
      setActiveMode(params.mode);
      setProgress(100);
    } catch (e) {
      completed.forEach((result) => URL.revokeObjectURL(result.url));
      if (epoch.id === id)
        setError(describeError(e instanceof Error ? e.message : String(e)));
    } finally {
      if (epoch.id === id) setGenerating(false);
    }
  };

  return {
    ready: !!analysis,
    analysis,
    error,
    generating,
    progress,
    progressLabel,
    results,
    activeMode,
    setActiveMode,
    generate,
    result:
      results.find((result) => result.mode === activeMode) ??
      results[0] ??
      null,
    analyzing:
      !!bitmap && !!tiles?.length && !tileLoading && !analysis && !error,
  };
}
