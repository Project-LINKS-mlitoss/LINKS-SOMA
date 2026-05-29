import { type FeatureData } from "../../types";

/**
 * MapLibreから渡されるoverlapIdsをパースする
 * MapLibreは配列をJSON文字列として渡す場合があるため、両方のケースに対応
 *
 * @param raw - MapLibreのプロパティから取得した値（配列 or JSON文字列 or undefined）
 * @param fallbackId - パース失敗時のフォールバックID
 * @returns パースされたID配列
 */
export function parseOverlapIds(
  raw: number[] | string | undefined,
  fallbackId?: number,
): number[] {
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as number[];
    } catch {
      return fallbackId !== undefined ? [fallbackId] : [];
    }
  }
  if (Array.isArray(raw)) {
    return raw;
  }
  return fallbackId !== undefined ? [fallbackId] : [];
}

/**
 * 重複検知結果を含むFeatureのプロパティ拡張
 */
export interface OverlapProperties {
  /** 重複フラグ（同一ジオメトリの他のレコードが存在する） */
  hasOverlap: boolean;
  /** 重複件数（自身を含む） */
  overlapCount: number;
  /** 重複レコードのID一覧（自身を含む） */
  overlapIds: number[];
}

/**
 * Feature配列から重複（同一ジオメトリ）を検知し、フラグを付与する
 *
 * 処理の流れ:
 * 1. bldg_geometryでFeatureをグループ化
 * 2. 各Featureに重複情報（hasOverlap, overlapCount, overlapIds）を付与
 *
 * @param features - 検知対象のFeature配列
 * @returns 重複情報が付与されたFeature配列
 */
export function detectOverlaps<
  T extends { id: number; bldg_geometry?: string | null },
>(features: FeatureData<T>[]): FeatureData<T & OverlapProperties>[] {
  // 1. bldg_geometryでグループ化（IDを収集）
  const geometryGroups = new Map<string, number[]>();

  for (const feature of features) {
    const geomKey = feature.properties.bldg_geometry ?? "";
    if (!geomKey) continue;

    const ids = geometryGroups.get(geomKey);
    if (ids) {
      ids.push(feature.properties.id);
    } else {
      geometryGroups.set(geomKey, [feature.properties.id]);
    }
  }

  // 2. 重複フラグを付与
  return features.map((feature) => {
    const geomKey = feature.properties.bldg_geometry ?? "";
    const group = geometryGroups.get(geomKey);

    // ジオメトリがない場合は重複なしとして扱う
    if (!group) {
      return {
        ...feature,
        properties: {
          ...feature.properties,
          hasOverlap: false,
          overlapCount: 1,
          overlapIds: [feature.properties.id],
        },
      };
    }

    return {
      ...feature,
      properties: {
        ...feature.properties,
        hasOverlap: group.length > 1,
        overlapCount: group.length,
        overlapIds: group,
      },
    };
  });
}
