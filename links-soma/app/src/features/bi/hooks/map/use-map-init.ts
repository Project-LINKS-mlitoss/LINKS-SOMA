import { addProtocol, Map, removeProtocol } from "maplibre-gl";
import { Protocol } from "pmtiles";
import { useEffect, useRef, useState } from "react";
import { rendererLogger } from "../../../../shared/utils/renderer-logger";

// PMTilesプロトコルのグローバル管理
let pmtilesProtocolInstance: Protocol | null = null;
let protocolReferenceCount = 0;

export type MapInitReturn = {
  containerRef: React.RefObject<HTMLDivElement>;
  mapInstance: Map | null;
};

/** マップインスタンスを初期化・参照先を返却するHooks */
export const useMapInit = (): MapInitReturn => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [mapInstance, setMapInstance] = useState<Map | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  // 初期表示時にマップのサイズがおかしくなるので、親要素がマウントされた後にマップを初期化する
  useEffect(function setIsMountedEffect() {
    setIsMounted(true);
  }, []);

  useEffect(
    function initializeMapEffect() {
      if (!isMounted) return;

      const containerEl = containerRef.current;
      if (!containerEl) return;

      // PMTilesプロトコルの安全な登録
      if (!pmtilesProtocolInstance) {
        pmtilesProtocolInstance = new Protocol();
        addProtocol("pmtiles", pmtilesProtocolInstance.tile);
      }
      protocolReferenceCount++;

      const initializedMap = new Map({
        container: containerEl,
        style: "protomaps-basemaps.json",
        zoom: 14,
        maxZoom: 22,
        minZoom: 6,
      });

      initializedMap.on("load", () => {
        setMapInstance(initializedMap);
      });

      return () => {
        // マップインスタンスの完全な破棄
        if (initializedMap) {
          try {
            initializedMap.remove();
          } catch (error) {
            rendererLogger.warn("Map instance removal failed", error, {
              component: "useMapInit",
            });
          }
        }

        // PMTilesプロトコルの安全な削除（参照カウント管理）
        protocolReferenceCount--;
        if (protocolReferenceCount <= 0 && pmtilesProtocolInstance) {
          try {
            removeProtocol("pmtiles");
            pmtilesProtocolInstance = null;
            protocolReferenceCount = 0;
          } catch (error) {
            rendererLogger.warn("Protocol removal failed", error, {
              component: "useMapInit",
            });
          }
        }

        // マップインスタンスをnullに設定
        setMapInstance(null);
      };
    },
    [isMounted],
  );

  return { containerRef, mapInstance };
};
