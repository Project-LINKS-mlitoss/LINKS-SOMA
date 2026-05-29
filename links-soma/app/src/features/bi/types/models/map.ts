import { type Geometry } from "geojson";
import { type BuildingProperties } from "../../components/views/map/map-container/_components/building-popup";
import { type AreaProperties } from "../../components/views/map/map-container/_components/area-popup";
import { type ViewportBounds } from "../../util/map/viewport-utils";
import { type ThresholdValue } from "../../util/threshold-column-utils";
import { type FilterCondition } from "./parameter";

/**
 * マップのフィーチャーデータ型
 */
export type FeatureData<TProperties = BuildingProperties | AreaProperties> = {
  type: "Feature";
  geometry: Geometry;
  properties: TProperties;
};

/**
 * 統一クエリパラメータ（建物・地域両対応）
 */
export type UnifiedQueryParams = {
  dataSetResultId: number;
  areas?: string[];
  filterConditions: FilterCondition[];
  referenceDate?: string;
  unit: "building" | "area";
  threshold?: ThresholdValue;
};

/**
 * 統一クエリパラメータ（lastId付き）
 */
export type UnifiedQueryParamsWithLastId = UnifiedQueryParams & {
  lastId?: number;
};

/**
 * ビューポート範囲での統一クエリパラメータ
 */
export type UnifiedQueryParamsWithViewport = UnifiedQueryParams & {
  viewport?: ViewportBounds;
};

/**
 * ビューポート範囲での統一クエリパラメータ（lastId付き）
 */
export type UnifiedQueryParamsWithViewportAndLastId =
  UnifiedQueryParamsWithViewport & {
    lastId?: number;
  };

/**
 * 建物検索のクエリパラメータ（後方互換性のため）
 */
export type BuildingQueryParams = Omit<UnifiedQueryParams, "unit">;

/**
 * 建物検索のクエリパラメータ（lastId付き）
 */
export type BuildingQueryParamsWithLastId = BuildingQueryParams & {
  lastId?: number;
  /** trueの場合、ジオメトリ情報がすべて存在するレコードのみを取得 */
  geometryNotNull?: boolean;
};

/**
 * ビューポート範囲での建物検索クエリパラメータ
 */
export type BuildingQueryParamsWithViewport = BuildingQueryParams & {
  viewport?: ViewportBounds;
};

/**
 * ビューポート範囲での建物検索クエリパラメータ（lastId付き）
 */
export type BuildingQueryParamsWithViewportAndLastId =
  BuildingQueryParamsWithViewport & {
    lastId?: number;
  };

/**
 * 地域検索のクエリパラメータ
 */
export type AreaQueryParams = Omit<UnifiedQueryParams, "unit">;

/**
 * 地域検索のクエリパラメータ（lastId付き）
 */
export type AreaQueryParamsWithLastId = AreaQueryParams & {
  lastId?: number;
};

/**
 * ビューポート範囲での地域検索クエリパラメータ
 */
export type AreaQueryParamsWithViewport = AreaQueryParams & {
  viewport?: ViewportBounds;
};

/**
 * ビューポート範囲での地域検索クエリパラメータ（lastId付き）
 */
export type AreaQueryParamsWithViewportAndLastId =
  AreaQueryParamsWithViewport & {
    lastId?: number;
  };

/**
 * チャンク処理の結果
 */
export type ChunkResult<TData = unknown> = {
  processedCount: number;
  viewportRecordCount?: number;
  chunk: TData[];
  chunkLastId: number;
};
