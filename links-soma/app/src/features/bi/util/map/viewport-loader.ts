import {
  BATCH_SIZE,
  IPC_CHANNELS,
} from "../../components/views/map/map-container/const";
import {
  type FeatureData,
  type UnifiedQueryParamsWithViewportAndLastId,
  type ChunkResult,
} from "../../types";
import { type ViewportBounds, isGeometryInViewport } from "./viewport-utils";
import {
  buildFeatureFromMinimal,
  type MinimalBuildingData,
} from "./build-feature-from-minimal";
import { detectOverlaps } from "./detect-overlaps";

export class ViewportLoader {
  private shouldStop = false;
  private lastId = 0;
  private processedCount = 0;
  private viewportRecordCount = 0;
  private abortController: AbortController | null = null;
  private queryParams: UnifiedQueryParamsWithViewportAndLastId | null = null;

  private filteredCount = 0;

  private async *fetchChunked({
    totalRecordLastId,
  }: {
    totalRecordLastId: number;
  }): AsyncGenerator<ChunkResult<FeatureData>, void, unknown> {
    if (!this.queryParams) {
      throw new Error("Query parameters are not initialized");
    }

    let chunkCount = 0;
    const windowWithGC = window as unknown as { gc?: () => void };

    while (this.lastId < totalRecordLastId) {
      if (this.shouldStop || this.abortController?.signal.aborted) {
        break;
      }

      // 単位に応じてIPCチャンネルを選択
      const isBuilding = this.queryParams.unit !== "area";
      const ipcChannel = isBuilding
        ? IPC_CHANNELS.SELECT_BUILDINGS_VIEWPORT_CHUNK
        : IPC_CHANNELS.SELECT_AREAS_VIEWPORT_CHUNK;

      // 建物: MinimalBuildingData[], 地域: FeatureData[]
      const rawChunk = await window.ipcRenderer.invoke(ipcChannel, {
        ...this.queryParams,
        batchSize: BATCH_SIZE,
        lastId: this.lastId,
      });

      // フィルタリング + 変換処理
      const chunk: FeatureData[] = [];
      let rawChunkLength = 0;
      let lastRawId = this.lastId;

      if (isBuilding) {
        // 建物: MinimalBuildingData[] → FeatureData[] 変換（レンダラー側）
        const buildingRawChunk = rawChunk as MinimalBuildingData[];
        rawChunkLength = buildingRawChunk.length;

        for (const record of buildingRawChunk) {
          // ビューポートフィルタリング
          if (this.queryParams.viewport && record.bldg_geometry) {
            if (
              !isGeometryInViewport(
                record.bldg_geometry,
                this.queryParams.viewport,
              )
            ) {
              continue;
            }
          }

          // WKT→GeoJSON変換（レンダラー側）
          const feature = buildFeatureFromMinimal(record);
          if (feature) {
            chunk.push(feature as FeatureData);
          }
        }

        if (buildingRawChunk.length > 0) {
          lastRawId = buildingRawChunk[buildingRawChunk.length - 1].id;
        }

        // 建物データの重複検知（同一ジオメトリの検出）
        // splice で配列を効率的に置換（単一操作）
        chunk.splice(0, chunk.length, ...detectOverlaps(chunk));
      } else {
        // 地域: FeatureData[] そのまま使用（IPC側で変換・フィルタリング済み）
        const areaRawChunk = rawChunk as FeatureData[];
        rawChunkLength = areaRawChunk.length;
        chunk.push(...areaRawChunk);

        if (areaRawChunk.length > 0) {
          const lastFeature = areaRawChunk[areaRawChunk.length - 1];
          lastRawId =
            (lastFeature.properties as { id?: number })?.id || this.lastId;
        }
      }

      this.processedCount += chunk.length;
      chunkCount++;

      const result = {
        processedCount: this.processedCount,
        chunk,
        chunkLastId: chunk[chunk.length - 1]?.properties?.id || this.lastId,
        viewportRecordCount: this.viewportRecordCount,
      };

      // lastIdは元のrawChunkから取得（フィルタ後のchunkは空の可能性があるため）
      this.lastId = lastRawId;
      yield result;

      // メモリ管理：5チャンクごとにGCを実行
      if (chunkCount % 5 === 0 && windowWithGC.gc) {
        setTimeout(() => windowWithGC.gc?.(), 0);
      }

      // チャンクデータをクリア
      rawChunk.length = 0;
      chunk.length = 0;

      // 短い待機時間でメモリ圧迫を軽減
      await new Promise((resolve) => setTimeout(resolve, 50));

      // 元のrawChunkが空の場合は終了（データベースの終端）
      if (rawChunkLength === 0) {
        break;
      }
    }
  }

  async initWithViewport(
    queryParams: UnifiedQueryParamsWithViewportAndLastId,
    viewport: ViewportBounds,
  ): Promise<void> {
    this.abortController = new AbortController();
    this.queryParams = { ...queryParams, viewport };

    // 単位に応じてIPCチャンネルを選択（件数取得）
    const countChannel =
      this.queryParams.unit === "area"
        ? IPC_CHANNELS.SELECT_AREAS_VIEWPORT_COUNT
        : IPC_CHANNELS.SELECT_BUILDINGS_VIEWPORT_COUNT;

    // フィルター結果件数（viewportを除く）= フィルター条件に合致する全データの件数
    this.filteredCount =
      (await window.ipcRenderer.invoke(countChannel, queryParams)) || 0;

    // ビューポート内件数（viewportを含む）= 現在の地図表示範囲内のデータ件数
    const viewportRecordCount = await window.ipcRenderer.invoke(
      countChannel,
      this.queryParams,
    );
    this.viewportRecordCount = viewportRecordCount || 0;
  }

  stop(): void {
    this.shouldStop = true;
    this.abortController?.abort();
  }

  reset(): void {
    this.shouldStop = false;
    this.lastId = 0;
    this.processedCount = 0;
    this.abortController = new AbortController();
  }

  async loadFeatures({
    process,
  }: {
    process: (params: ChunkResult<FeatureData>) => void;
  }): Promise<void> {
    if (!this.queryParams) {
      throw new Error("Query parameters are not initialized");
    }

    // ビューポート検索では lastId の概念が異なるため、
    // 総レコード数を使用して処理
    const maxIterations = Math.ceil(this.viewportRecordCount / BATCH_SIZE);
    let iterationCount = 0;

    for await (const chunk of this.fetchChunked({
      totalRecordLastId: Number.MAX_SAFE_INTEGER, // 制限なしで処理
    })) {
      process(chunk);
      iterationCount++;

      // 無限ループ防止
      if (iterationCount >= maxIterations) {
        break;
      }
    }
  }

  getStats(): {
    processedCount: number;
    viewportRecordCount: number;
    viewport: ViewportBounds | undefined;
    filteredCount: number;
  } {
    return {
      processedCount: this.processedCount,
      viewportRecordCount: this.viewportRecordCount,
      viewport: this.queryParams?.viewport,
      filteredCount: this.filteredCount,
    };
  }
}
