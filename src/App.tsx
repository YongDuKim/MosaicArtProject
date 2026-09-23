import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import type {
  MosaicParams,
  TileInfo,
  TileWorkerRequest,
  TileWorkerResponse,
} from "./lib/types";
import { computePlan } from "./lib/mosaic";
import { COLOR_COMPARISONS } from "./lib/colorComparison";
import { useMosaicGeneration } from "./lib/useMosaicGeneration";
import { MOSAIC_MODES } from "./lib/mosaicModes";
import { loadTiles, tileKey } from "./lib/tiles";
import { decodeImageBitmap } from "./lib/decode";
import ImageUploader from "./components/ImageUploader";
import ParamsPanel from "./components/ParamsPanel";
import TileSetPanel from "./components/TileSetPanel";
import ProgressBar from "./components/ProgressBar";
import MosaicPreview from "./components/MosaicPreview";
import StatsTable from "./components/StatsTable";

interface InputImage {
  file: File;
  bitmap: ImageBitmap;
  url: string;
}

const DEFAULT_PARAMS: MosaicParams = {
  mode: "color",
  x: 5,
  n: 24,
  rotate: true,
  colorAdjust: 0,
  colorComparison: "rgb",
  colorTolerance: {
    rgb: COLOR_COMPARISONS.rgb.defaultTolerance,
    oklab: COLOR_COMPARISONS.oklab.defaultTolerance,
  },
  // モザイクの素材は写真が中心で、PNG では出力が数百 MB になりうるため JPG を既定にする
  format: "jpeg",
  jpegResolution: "high",
};

/** 直近のタイル追加バッチの結果 (累計枚数は tiles.length が持つ) */
export interface TilesMeta {
  lastAdded: number;
  lastSkipped: number;
  lastDuplicates: number;
  skippedNames: string[];
}

/**
 * 同時デコード数。スマートフォンはメモリが少なくフル稼働させると
 * タブごと落ちることがあるため控えめにする。
 * WorkerNavigator には maxTouchPoints がないためメインスレッドで判定する。
 */
function tileConcurrency(): number {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const mobile =
    nav.maxTouchPoints > 1 || /iPhone|iPad|Android|Mobile/i.test(nav.userAgent);
  if (mobile || (nav.deviceMemory !== undefined && nav.deviceMemory <= 4))
    return 2;
  return Math.min(4, nav.hardwareConcurrency || 4);
}

export default function App() {
  const [tiles, setTiles] = useState<TileInfo[] | null>(null);
  const [tilesMeta, setTilesMeta] = useState<TilesMeta | null>(null);
  const [tileLoading, setTileLoading] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [input, setInput] = useState<InputImage | null>(null);
  const [inputLoading, setInputLoading] = useState(false);
  const [params, setParams] = useState<MosaicParams>(DEFAULT_PARAMS);
  const [selectedTile, setSelectedTile] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tileWorkerRef = useRef<Worker | null>(null);
  /** ストリーミング中のタイル置き場。1枚ごとの再レンダリングを避けるため ref に溜める */
  const pendingTilesRef = useRef<TileInfo[]>([]);

  useEffect(
    () => () => {
      tileWorkerRef.current?.terminate();
    },
    [],
  );

  // 生成時のタイルインデックス (result.tileNames) と対応するサムネイル用 bitmap 配列
  const tileBitmaps = useMemo(
    () => (tiles ?? []).map((t) => t.bitmap),
    [tiles],
  );

  const plan = useMemo(
    () =>
      input
        ? computePlan(
            input.bitmap.width,
            input.bitmap.height,
            params.x,
            params.n,
          )
        : null,
    [input, params.x, params.n],
  );

  const generation = useMosaicGeneration(
    input,
    tiles,
    plan,
    params,
    !!tileLoading || inputLoading,
  );
  const { generating, result, progress, progressLabel } = generation;
  useEffect(() => setSelectedTile(null), [result]);

  useEffect(
    () => () => {
      if (input) {
        URL.revokeObjectURL(input.url);
        input.bitmap.close();
      }
    },
    [input],
  );

  const handleSelect = async (file: File) => {
    setInputLoading(true);
    try {
      const bitmap = await decodeImageBitmap(file);
      setInput({ file, bitmap, url: URL.createObjectURL(file) });
      setError(null);
    } catch {
      setError("画像を読み込めませんでした。別のファイルを試してください。");
    } finally {
      setInputLoading(false);
    }
  };

  const handleTileUpload = (files: File[]) => {
    if (tileLoading || generating) return;
    setError(null);

    // 追加式のため、既存タイルとバッチ内の重複を先に除外する
    const knownKeys = new Set(tiles?.map((t) => t.key));
    const fresh: File[] = [];
    let duplicates = 0;
    for (const file of files) {
      const key = tileKey(file);
      if (knownKeys.has(key)) {
        duplicates++;
      } else {
        knownKeys.add(key);
        fresh.push(file);
      }
    }

    if (fresh.length === 0) {
      setTilesMeta({
        lastAdded: 0,
        lastSkipped: 0,
        lastDuplicates: duplicates,
        skippedNames: [],
      });
      return;
    }

    setTileLoading({ done: 0, total: fresh.length });
    pendingTilesRef.current = [];
    const skippedNames: string[] = [];

    const appendPending = () => {
      const pending = pendingTilesRef.current;
      pendingTilesRef.current = [];
      if (pending.length > 0) setTiles((prev) => [...(prev ?? []), ...pending]);
    };

    const finish = (loaded: number, skipped: number) => {
      appendPending();
      setTilesMeta({
        lastAdded: loaded,
        lastSkipped: skipped,
        lastDuplicates: duplicates,
        skippedNames,
      });
      if (loaded === 0 && skipped > 0) {
        setError(
          "タイル画像を1枚も読み込めませんでした。対応形式 (JPEG/PNG など) か確認してください。",
        );
      }
      setTileLoading(null);
    };

    const fail = () => {
      // 途中まで届いたタイルは失わずに追加する
      const loaded = pendingTilesRef.current.length;
      appendPending();
      setTilesMeta({
        lastAdded: loaded,
        lastSkipped: skippedNames.length,
        lastDuplicates: duplicates,
        skippedNames,
      });
      setError(
        "タイルの読み込み中にエラーが発生しました。枚数を減らして再度お試しください。",
      );
      setTileLoading(null);
    };

    let tileWorker = tileWorkerRef.current;
    if (!tileWorker) {
      try {
        tileWorker = new Worker(
          new URL("./workers/tileWorker.ts", import.meta.url),
          {
            type: "module",
          },
        );
        tileWorkerRef.current = tileWorker;
      } catch {
        tileWorker = null;
      }
    }

    if (!tileWorker) {
      // Worker を生成できない環境向けフォールバック (追加式は維持)
      loadTiles(fresh, tileConcurrency(), (done, total) =>
        setTileLoading({ done, total }),
      )
        .then(({ tiles: loaded, skipped }) => {
          pendingTilesRef.current = loaded;
          skippedNames.push(...skipped);
          finish(loaded.length, skipped.length);
        })
        .catch(fail);
      return;
    }

    tileWorker.onmessage = (event: MessageEvent<TileWorkerResponse>) => {
      const msg = event.data;
      if (msg.type === "tile") {
        pendingTilesRef.current.push({
          name: msg.name,
          key: msg.key,
          avgColor: msg.avgColor,
          bitmap: msg.bitmap,
        });
        setTileLoading({ done: msg.done, total: msg.total });
      } else if (msg.type === "skipped") {
        skippedNames.push(msg.name);
        setTileLoading({ done: msg.done, total: msg.total });
      } else if (msg.type === "batch-done") {
        finish(msg.loaded, msg.skipped);
      } else {
        fail();
      }
    };
    tileWorker.onerror = fail;
    const request: TileWorkerRequest = {
      files: fresh,
      concurrency: tileConcurrency(),
    };
    tileWorker.postMessage(request);
  };

  const handleClearTiles = () => {
    if (tileLoading || generating) return;
    setTiles((prev) => {
      prev?.forEach((t) => t.bitmap.close());
      return null;
    });
    setTilesMeta(null);
  };

  return (
    <main className="app">
      <header className="app-header">
        <h1>モザイクアート生成</h1>
        <p>
          アップロードした元画像を、タイル用にアップロードした写真で再構成したモザイクアートに変換します。
          処理はすべてブラウザ内で完結し、画像が外部へ送信されることはありません。
        </p>
      </header>

      {(error || generation.error) && (
        <p className="error" role="alert">
          {error || generation.error}
        </p>
      )}

      <div className="input-row">
        <ImageUploader
          onSelect={handleSelect}
          previewUrl={input?.url ?? null}
          fileName={input?.file.name ?? null}
          disabled={generating || inputLoading}
        />
        <TileSetPanel
          tileCount={tiles?.length ?? 0}
          tilesMeta={tilesMeta}
          loading={tileLoading}
          disabled={generating}
          onUploadFiles={handleTileUpload}
          onClearAll={handleClearTiles}
        />
        <ParamsPanel
          params={params}
          onChange={setParams}
          plan={plan}
          canGenerate={generation.ready && !tileLoading && !inputLoading}
          generating={generating}
          onGenerate={() => void generation.generate()}
          onCompare={() => void generation.generate(true)}
          analyzing={generation.analyzing}
          limitedPalette={generation.analysis?.limitedPalette ?? false}
        />
      </div>

      {generating && <ProgressBar percent={progress} label={progressLabel} />}

      {result && (
        <>
          {generation.results.length > 1 && (
            <div
              className="mode-tabs"
              role="group"
              aria-label="比較する生成結果"
            >
              {generation.results.map((item) => (
                <button
                  type="button"
                  key={item.mode}
                  aria-pressed={result.mode === item.mode}
                  onClick={() => generation.setActiveMode(item.mode)}
                >
                  {MOSAIC_MODES[item.mode].label}
                </button>
              ))}
              <p>
                同じ条件で生成した結果です。切り替えても拡大位置と倍率を保ちます。
              </p>
            </div>
          )}
          <MosaicPreview
            result={result}
            resultUrl={result.url}
            selectedTile={selectedTile}
            onClearSelection={() => setSelectedTile(null)}
          />
          <StatsTable
            result={result}
            inputName={result.inputName}
            selectedTile={selectedTile}
            onSelectTile={setSelectedTile}
            tileBitmaps={tileBitmaps}
          />
        </>
      )}
    </main>
  );
}
