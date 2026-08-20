/**
 * 出力CSVの「位置レベル」列の語彙と、各ジオコーダ固有値からの変換。
 *
 * 位置レベルは緯度経度がどの住所階層の代表点かを表す。ジオコーダごとに
 * 異なる判定値を共通語彙へ畳むため、変換前の値は「判定値」列に保持する。
 * 対応関係は docs/spec/geocoding-output-format.md の対応表に対応する。
 */

export const POSITION_LEVELS = [
  '号・地番',
  '番地・街区',
  '丁目・小字',
  '大字・町',
  '市区町村',
  '都道府県',
  '特定できず',
] as const;

export type PositionLevel = (typeof POSITION_LEVELS)[number];

export const UNKNOWN_POSITION_LEVEL: PositionLevel = '特定できず';

/** ABR ジオコーダの coordinate_level（代表点のレベル）に対応する。 */
const ABR_COORDINATE_LEVEL: Record<string, PositionLevel> = {
  parcel: '号・地番',
  residential_detail: '号・地番',
  residential_block: '番地・街区',
  machiaza_detail: '丁目・小字',
  machiaza: '大字・町',
  city: '市区町村',
  prefecture: '都道府県',
  unknown: '特定できず',
  error: '特定できず',
};

/** AWS Places API v2 の PlaceType に対応する。 */
const AWS_PLACE_TYPE: Record<string, PositionLevel> = {
  PointAddress: '号・地番',
  InterpolatedAddress: '号・地番',
  SecondaryAddress: '号・地番',
  InferredSecondaryAddress: '号・地番',
  SubBlock: '番地・街区',
  Street: '番地・街区',
  Intersection: '番地・街区',
  Block: '丁目・小字',
  SubDistrict: '大字・町',
  District: '大字・町',
  Locality: '市区町村',
  SubRegion: '市区町村',
  Region: '都道府県',
};

/** NTT GEOSPACE ジオコーディングAPIの level（1〜7）に対応する。 */
const NTT_LEVEL: Record<string, PositionLevel> = {
  '7': '号・地番',
  '6': '号・地番',
  '5': '番地・街区',
  '4': '丁目・小字',
  '3': '大字・町',
  '2': '市区町村',
  '1': '都道府県',
};

export function positionLevelFromAbr(coordinateLevel?: string): PositionLevel {
  if (!coordinateLevel) return UNKNOWN_POSITION_LEVEL;
  return ABR_COORDINATE_LEVEL[coordinateLevel] ?? UNKNOWN_POSITION_LEVEL;
}

export function positionLevelFromAws(placeType?: string): PositionLevel {
  if (!placeType) return UNKNOWN_POSITION_LEVEL;
  return AWS_PLACE_TYPE[placeType] ?? UNKNOWN_POSITION_LEVEL;
}

export function positionLevelFromNtt(level?: string | number): PositionLevel {
  if (level === undefined || level === null || level === '') return UNKNOWN_POSITION_LEVEL;
  return NTT_LEVEL[String(level)] ?? UNKNOWN_POSITION_LEVEL;
}

export interface PositionLevelCount {
  level: PositionLevel;
  count: number;
  /** 全体に占める割合（0〜1）。 */
  ratio: number;
}

/**
 * 位置レベルごとの件数を、細かい順に集計する。件数 0 のレベルは含めない。
 * 「号・地番」の割合が、緯度経度が建物にどれだけ近いかの指標になる。
 */
export function summarizePositionLevels(
  results: { positionLevel: PositionLevel }[]
): PositionLevelCount[] {
  if (results.length === 0) return [];

  const counts = new Map<PositionLevel, number>();
  for (const result of results) {
    counts.set(result.positionLevel, (counts.get(result.positionLevel) ?? 0) + 1);
  }

  return POSITION_LEVELS.filter((level) => counts.has(level)).map((level) => ({
    level,
    count: counts.get(level)!,
    ratio: counts.get(level)! / results.length,
  }));
}

/** 判定値列の表記。どのジオコーダの値かを接頭辞で示す。 */
export function formatJudgmentValue(
  source: 'AWS' | 'NTT' | 'ABR' | 'Zenrin',
  rawValue?: string | number
): string {
  if (rawValue === undefined || rawValue === null || rawValue === '') return '';
  return `${source}:${rawValue}`;
}
