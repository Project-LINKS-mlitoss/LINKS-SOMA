import { LngLat, type LngLatLike } from "maplibre-gl";

/** LngLatLike型 を LngLat型 に変換するユーティリティ関数 */
export const convertToLngLat = (lngLatLike: LngLatLike): LngLat => {
  if (isLngLat(lngLatLike)) {
    return lngLatLike;
  }
  if (!Array.isArray(lngLatLike) || lngLatLike.length !== 2) {
    throw new Error("Invalid LngLatLike format in convertToLngLat function");
  }
  return new LngLat(lngLatLike[0], lngLatLike[1]);
};

// LngLat型のオブジェクトであることを確認する関数
const isLngLat = (obj: object): obj is LngLat => {
  return (
    obj instanceof LngLat ||
    (typeof obj === "object" &&
      "lng" in obj &&
      "lat" in obj &&
      typeof obj.lng === "number" &&
      typeof obj.lat === "number")
  );
};
