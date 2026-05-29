import type { Map as MapLibreMap } from "maplibre-gl";

/**
 * ビューポート境界情報
 */
export type ViewportBounds = {
  /** 南西角の経度 */
  minLng: number;
  /** 南西角の緯度 */
  minLat: number;
  /** 北東角の経度 */
  maxLng: number;
  /** 北東角の緯度 */
  maxLat: number;
};

/**
 * MapLibreのビューポート境界を取得
 */
export function getViewportBounds(mapInstance: MapLibreMap): ViewportBounds {
  const bounds = mapInstance.getBounds();

  return {
    minLng: bounds.getWest(),
    minLat: bounds.getSouth(),
    maxLng: bounds.getEast(),
    maxLat: bounds.getNorth(),
  };
}

/**
 * WKT形式のMULTIPOLYGONがビューポート範囲内にあるかチェック
 * 簡易的な実装（完全な空間演算ではなく境界ボックスベースの判定）
 */
export function isGeometryInViewport(
  wktGeometry: string,
  viewport: ViewportBounds,
): boolean {
  // WKTからおおまかな座標を抽出（簡易パターンマッチング）
  const coordPattern = /(-?\d+\.\d+)\s+(-?\d+\.\d+)/g;
  const matches = [...wktGeometry.matchAll(coordPattern)];

  if (matches.length === 0) return false;

  // 全ての座標点がビューポート外にある場合はfalse
  // 一つでもビューポート内にある場合はtrueとする簡易判定
  for (const match of matches) {
    const lng = parseFloat(match[1]);
    const lat = parseFloat(match[2]);

    if (
      lng >= viewport.minLng &&
      lng <= viewport.maxLng &&
      lat >= viewport.minLat &&
      lat <= viewport.maxLat
    ) {
      return true;
    }
  }

  return false;
}

/**
 * バッファ付きビューポート境界情報
 */
export type BufferedViewport = {
  /** 現在のビューポート（内側） */
  inner: ViewportBounds;
  /** バッファ領域を含むビューポート（外側） - データ取得に使用 */
  outer: ViewportBounds;
};

/** バッファ比率（各方向に20%の余白を追加） */
const BUFFER_RATIO = 0.2;

/**
 * バッファ付きビューポートを作成
 * データ取得時はouterを使用し、innerがouterを超えたら再取得
 */
export function createBufferedViewport(
  viewport: ViewportBounds,
): BufferedViewport {
  const width = viewport.maxLng - viewport.minLng;
  const height = viewport.maxLat - viewport.minLat;

  return {
    inner: viewport,
    outer: {
      minLng: viewport.minLng - width * BUFFER_RATIO,
      maxLng: viewport.maxLng + width * BUFFER_RATIO,
      minLat: viewport.minLat - height * BUFFER_RATIO,
      maxLat: viewport.maxLat + height * BUFFER_RATIO,
    },
  };
}

/**
 * 現在のビューポートがバッファ領域を超えているかチェック
 * trueの場合、データの再取得が必要
 */
export function shouldRefetchData(
  currentViewport: ViewportBounds,
  bufferedViewport: BufferedViewport,
): boolean {
  const { outer } = bufferedViewport;

  // 現在のビューポートの端がバッファ外に出ているかチェック
  return (
    currentViewport.minLng < outer.minLng ||
    currentViewport.maxLng > outer.maxLng ||
    currentViewport.minLat < outer.minLat ||
    currentViewport.maxLat > outer.maxLat
  );
}
