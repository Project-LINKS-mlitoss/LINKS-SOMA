import "maplibre-gl/dist/maplibre-gl.css";
import "./maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import {
  addProtocol,
  type FilterSpecification,
  type LngLatLike,
  Map,
  removeProtocol,
} from "maplibre-gl";
import { Protocol } from "pmtiles";
import { makeStyles } from "@fluentui/react-components";
import { wktToGeoJSON } from "betterknown";
import {
  type VacancyLevel,
  type VacancyLevels,
} from "../vacancy-level-checkbox";
import { type MapProps } from "..";
import { type SelectDataSetDetailBuilding } from "../../../../schema";
import { addBuildingLayer } from "./add-building-layer";
import { type BuildingProperties } from "./building-popup";
import { addAreaLayer } from "./add-area-layer";

export const PREDICTED_PROBABILITY: Record<
  MapProps["view"]["unit"],
  Record<VacancyLevel, number>
> = {
  building: {
    low: 0,
    medium: 0.3,
    high: 0.8,
  },
  area: {
    low: 0,
    medium: 0.04,
    high: 0.11,
  },
};

const INITIAL_CENTER: LngLatLike = [139.7671, 35.6812]; // 東京駅

const useMapComponentStyles = makeStyles({
  map: {
    width: "100%",
    height: "600px",
  },
});

interface Props {
  dataSetResultId: number;
  unit: MapProps["view"]["unit"];
  selectedDate: string | undefined;
  vacancyLevels: VacancyLevels;
  areas: string[] | undefined;
}

export function MapComponent({
  dataSetResultId,
  unit,
  selectedDate,
  vacancyLevels,
  areas,
}: Props): JSX.Element {
  const styles = useMapComponentStyles();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [mapInstance, setMapInstance] = useState<Map | null>(null);
  const [layerIds, setLayerIds] = useState<string[] | null>(null);
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

      const protocol = new Protocol();
      addProtocol("pmtiles", protocol.tile);

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
        removeProtocol("pmtiles");
      };
    },
    [isMounted],
  );

  useEffect(
    function setMapCenterEffect() {
      if (!mapInstance) return;
      void (async () => {
        const geometry = await getGeometry({
          unit,
          dataSetResultId,
          selectedDate,
          areas,
        });
        const center = await getCenter(geometry);
        mapInstance.setCenter(center || INITIAL_CENTER);
      })();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 地図の中心を維持するために地図の初期化時のみ実行する
    [mapInstance],
  );

  useEffect(
    function updateMapEffect() {
      if (!mapInstance || !selectedDate) return;
      let ignore = false;
      const batchSize = 1000;

      switch (unit) {
        case "building":
          {
            const addBuildingLayers = async (): Promise<void> => {
              let lastId = 0;

              try {
                // eslint-disable-next-line no-constant-condition -- 無限ループでデータを全量取得する
                while (true) {
                  if (ignore) break;

                  const batch = await window.ipcRenderer.invoke(
                    "selectBuildingsInBatches",
                    {
                      dataSetResultId,
                      referenceDate: selectedDate,
                      batchSize,
                      lastId,
                      areas,
                    },
                  );

                  if (!batch) {
                    throw new Error("Network response was not ok");
                  }

                  const layerId = `building-${lastId.toString()}`;
                  const filteredBatch: BuildingProperties[] = batch.map(
                    (building) => ({
                      geometry: building.geometry,
                      predicted_probability: building.predicted_probability,
                      normalized_address: building.normalized_address,
                      household_size: building.household_size,
                      members_under_15: building.members_under_15,
                      members_15_to_64: building.members_15_to_64,
                      members_over_65: building.members_over_65,
                      total_water_usage: building.total_water_usage,
                      water_disconnection_flag:
                        building.water_disconnection_flag,
                      registration_date: building.registration_date,
                      structure_name: building.structure_name,
                    }),
                  );
                  addBuildingLayer(mapInstance, layerId, filteredBatch);
                  setLayerIds((prevLayerIds) =>
                    prevLayerIds ? [...prevLayerIds, layerId] : [layerId],
                  );

                  if (batch.length < batchSize) {
                    // 最後のバッチを取得完了
                    break;
                  }

                  lastId = batch[batch.length - 1].id;
                  await new Promise((resolve) => setTimeout(resolve, 10));
                }
              } catch (error) {
                console.error("Error fetching data: ", error);
              }
            };

            void addBuildingLayers();
          }
          break;

        case "area":
          {
            const addAreaLayers = async (): Promise<void> => {
              let lastId = 0;

              try {
                // eslint-disable-next-line no-constant-condition -- 無限ループでデータを全量取得する
                while (true) {
                  if (ignore) break;

                  const batch = await window.ipcRenderer.invoke(
                    "selectAreasInBatches",
                    {
                      dataSetResultId,
                      referenceDate: selectedDate,
                      batchSize,
                      lastId,
                      areas,
                    },
                  );

                  if (!batch) {
                    throw new Error("Network response was not ok");
                  }

                  const layerId = `area-${lastId.toString()}`;
                  addAreaLayer(mapInstance, layerId, batch);
                  setLayerIds((prevLayerIds) =>
                    prevLayerIds ? [...prevLayerIds, layerId] : [layerId],
                  );

                  if (batch.length < batchSize) {
                    // 最後のバッチを取得完了
                    break;
                  }

                  lastId = batch[batch.length - 1].id;
                }
              } catch (error) {
                console.error("Error fetching data: ", error);
              }
            };

            void addAreaLayers();
          }
          break;

        default: {
          const exhaustiveCheck: never = unit;
          throw new Error(`Unhandled type: ${exhaustiveCheck}`);
        }
      }

      return () => {
        ignore = true;
        mapInstance.fire("closeAllPopups");
        setLayerIds((prevLayerIds) => {
          prevLayerIds?.forEach((layerId) => {
            if (mapInstance.getLayer(layerId)) {
              mapInstance.removeLayer(layerId);
            }
            if (mapInstance.getSource(layerId)) {
              mapInstance.removeSource(layerId);
            }
          });
          return null;
        });
      };
    },
    [areas, dataSetResultId, mapInstance, selectedDate, unit],
  );

  useEffect(
    function applyFiltersEffect() {
      if (!mapInstance || !layerIds?.length) return;

      const allFalse =
        !vacancyLevels.low && !vacancyLevels.medium && !vacancyLevels.high;
      if (allFalse) {
        for (const layerId of layerIds) {
          if (!mapInstance.getLayer(layerId)) return;
          mapInstance.setLayoutProperty(layerId, "visibility", "none");
        }
        return;
      }

      for (const layerId of layerIds) {
        if (!mapInstance.getLayer(layerId)) return;
        const filters = [];
        if (vacancyLevels.low) {
          filters.push([
            "<",
            ["get", "predicted_probability"],
            PREDICTED_PROBABILITY[unit].medium,
          ]);
        }
        if (vacancyLevels.medium) {
          filters.push([
            "all",
            [
              ">=",
              ["get", "predicted_probability"],
              PREDICTED_PROBABILITY[unit].medium,
            ],
            [
              "<",
              ["get", "predicted_probability"],
              PREDICTED_PROBABILITY[unit].high,
            ],
          ]);
        }
        if (vacancyLevels.high) {
          filters.push([
            ">=",
            ["get", "predicted_probability"],
            PREDICTED_PROBABILITY[unit].high,
          ]);
        }

        const mapLibreFilter = ["any", ...filters] as FilterSpecification;

        mapInstance.setLayoutProperty(layerId, "visibility", "visible");
        mapInstance.setFilter(layerId, mapLibreFilter);
      }
    },
    [
      layerIds,
      mapInstance,
      unit,
      vacancyLevels.high,
      vacancyLevels.low,
      vacancyLevels.medium,
    ],
  );

  return <div ref={containerRef} className={styles.map} />;
}

const getGeometry = async ({
  unit,
  dataSetResultId,
  selectedDate,
  areas,
}: {
  unit: MapProps["view"]["unit"];
  dataSetResultId: MapProps["dataSetResultId"];
  selectedDate: string | undefined;
  areas: string[] | undefined;
}): Promise<string | undefined> => {
  switch (unit) {
    case "building": {
      const result = await window.ipcRenderer.invoke(
        "selectBuildingsInBatches",
        {
          dataSetResultId,
          referenceDate: selectedDate,
          batchSize: 1,
          areas,
        },
      );
      return result?.[0].geometry;
    }
    case "area": {
      const result = await window.ipcRenderer.invoke("selectAreasInBatches", {
        dataSetResultId,
        referenceDate: selectedDate,
        batchSize: 1,
        areas,
      });
      return result?.[0].geometry;
    }
    default: {
      const exhaustiveCheck: never = unit;
      throw new Error(`Unhandled type: ${exhaustiveCheck}`);
    }
  }
};

async function getCenter(
  geometry: SelectDataSetDetailBuilding["geometry"] | undefined,
): Promise<LngLatLike | undefined> {
  if (!geometry) return;

  const geojson = wktToGeoJSON(geometry);
  if (!geojson) return;
  const center: LngLatLike | undefined = (() => {
    if (!geojson) return;
    if (geojson.type === "Polygon") {
      const [lng, lat] = geojson.coordinates[0][0];
      return [lng, lat];
    }
    if (geojson.type === "MultiPolygon") {
      const [lng, lat] = geojson.coordinates[0][0][0];
      return [lng, lat];
    }
    return;
  })();

  return center;
}
