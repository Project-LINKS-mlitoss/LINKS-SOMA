import { LngLat, type Map } from "maplibre-gl";
import { useEffect, useState } from "react";
import { POLYGON_RENDER_MIN_ZOOM } from "../../components/views/map/map-container/const";
import { type MapWithTableView } from "../../types/models";
import {
  getCenter,
  convertToLngLat,
  getGeometry,
  type GetGeometryParams,
} from "../../util";
import { type UsePopupEffectWithFeatureReturn } from "./use-popup-effect-with-feature";

const INITIAL_CENTER: LngLat = new LngLat(139.7671, 35.6812); // 東京駅

type Params = {
  resultViewId: number;
  mapInstance: Map | null;
  getGeometryParams: GetGeometryParams;
  clearPopup: UsePopupEffectWithFeatureReturn["clearPopup"];
  unit: MapWithTableView["unit"];
};

type Return = {
  resetCenter: () => void;
  centerIsDirty: boolean;
  saveCurrentCenter: () => Promise<void>;
};

/** マップの中心位置をデータセット情報をもとに設定 */
export const useSetMapCenterEffect = ({
  mapInstance,
  getGeometryParams,
  resultViewId,
  clearPopup,
  unit,
}: Params): Return => {
  // 単位に応じたデフォルトズームレベルを使用
  const defaultZoom = POLYGON_RENDER_MIN_ZOOM[unit];
  const [center, setCenter] = useState<LngLat>(INITIAL_CENTER);
  const [zoom, setZoom] = useState<number>(defaultZoom);
  const [centerIsDirty, setCenterIsDirty] = useState(false);

  const handleCenterChange = (lngLat: LngLat, zoomLevel?: number): void => {
    if (!mapInstance) return;
    setCenter(lngLat);
    mapInstance.setCenter(lngLat);
    if (zoomLevel !== undefined) {
      setZoom(zoomLevel);
      mapInstance.setZoom(zoomLevel);
    }
    /* 座標比較の回避策として明示的にdirtyフラグをリセット */
    setCenterIsDirty(false);
    clearPopup();
  };

  const saveCurrentCenter = async (): Promise<void> => {
    if (!mapInstance) return;
    const currentCenter = mapInstance.getCenter();
    const currentZoom = mapInstance.getZoom();
    setCenter(currentCenter);
    setZoom(currentZoom);
    setCenterIsDirty(false);

    await window.ipcRenderer.invoke("updateMapCenter", {
      resultViewId,
      mapCenter: {
        key: "map_center",
        type: "map",
        value: {
          lng: currentCenter.lng,
          lat: currentCenter.lat,
          zoom: currentZoom,
        },
      },
    });
  };

  // 地図操作時のダーティフラグ監視用Effect
  useEffect(
    function watchMapCenterEffect() {
      if (!mapInstance) return;

      const handleMapChange = (): void => {
        const currentCenter = mapInstance.getCenter();
        const currentZoom = mapInstance.getZoom();

        // 基準位置またはズームと異なる場合のみダーティにする
        // 一致しても自動でOFFにはしない（保存/リセット操作でのみOFFになる）
        const centerChanged = !isEqualLngLat(
          currentCenter,
          convertToLngLat(center),
        );
        const zoomChanged = !isEqualZoom(currentZoom, zoom);

        if (centerChanged || zoomChanged) {
          setCenterIsDirty(true);
        }
      };

      mapInstance.on("drag", handleMapChange);
      mapInstance.on("moveend", handleMapChange);
      mapInstance.on("zoom", handleMapChange);

      return () => {
        mapInstance.off("drag", handleMapChange);
        mapInstance.off("moveend", handleMapChange);
        mapInstance.off("zoom", handleMapChange);
      };
    },
    [mapInstance, center, zoom],
  );

  /** 推定結果データの1行目のポリゴンの緯度経度を取得している */
  useEffect(
    function setMapCenterEffect() {
      if (!mapInstance) return;
      void (async () => {
        const { mapCenter } = await window.ipcRenderer.invoke(
          "selectMapCenter",
          {
            resultViewId: Number(resultViewId),
          },
        );

        if (mapCenter && mapCenter.value) {
          // 取得したmapCenterが存在する場合は、地図の中心とズームを設定
          handleCenterChange(
            new LngLat(mapCenter.value.lng, mapCenter.value.lat),
            mapCenter.value.zoom ?? defaultZoom,
          );
          return;
        }

        // geometryの文字列を取得する
        const geometry = await getGeometry(getGeometryParams);

        // betterknownでgeometryをGeoJSONに変換する(緯度経度の表現)
        const center = await getCenter(geometry);

        handleCenterChange(center ? convertToLngLat(center) : INITIAL_CENTER);
      })();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 地図の中心を維持するために地図の初期化時のみ実行する
    [mapInstance],
  );

  return {
    resetCenter: () => handleCenterChange(center || INITIAL_CENTER, zoom),
    centerIsDirty,
    saveCurrentCenter,
  };
};

// LngLat型のオブジェクトを同等かどうかを比較する関数. ただし、値は厳密に比較しない
const isEqualLngLat = (a: LngLat, b: LngLat): boolean => {
  const precision = 10000; // 小数点以下4桁までの精度で比較
  // 許容する誤差の値
  const tolerance = 10;

  return (
    Math.abs(a.lng - b.lng) * precision < tolerance &&
    Math.abs(a.lat - b.lat) * precision < tolerance
  );
};

// ズームレベルが同等かどうかを比較する関数
const isEqualZoom = (a: number, b: number): boolean => {
  const tolerance = 0.1; // ズームレベルの許容誤差
  return Math.abs(a - b) < tolerance;
};
