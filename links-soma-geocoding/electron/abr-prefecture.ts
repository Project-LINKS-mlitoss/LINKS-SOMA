// ABR ジオコーディングの前処理。入力住所へ都道府県名を補完する。
import { AbrGeocoderDiContainer } from '@digital-go-jp/abr-geocoder/build/index';

const PREFECTURE_NAMES = [
  '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
  '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
  '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県',
  '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県',
  '奈良県', '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県',
  '徳島県', '香川県', '愛媛県', '高知県', '福岡県', '佐賀県', '長崎県',
  '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県',
];

export interface PrefectureCompleter {
  /** 住所が都道府県から始まらない場合に、市区町村名から特定した都道府県を前置する。 */
  complete(address: string): string;
  /** 補完表に載っている市区町村名の数。 */
  readonly size: number;
}

/**
 * 市区町村名から都道府県名を引く表を、ダウンロード済みの ABR データから構築する。
 *
 * abr-geocoder は入力住所に都道府県が含まれていないと市区町村を特定できず、
 * 上位階層の代表点を返すか、座標を返さない。ダウンロード範囲が1都道府県分に
 * 満たない場合は都道府県の補完も働かない。
 *
 * 同名の市区町村が複数の都道府県に存在する場合（府中市＝東京都/広島県 など）は
 * 特定できないため表に含めない。
 */
export async function buildPrefectureByMunicipality(
  container: InstanceType<typeof AbrGeocoderDiContainer>
): Promise<Map<string, string>> {
  const candidates = new Map<string, Set<string>>();
  const add = (name: string, pref: string) => {
    if (!name || !pref) return;
    if (!candidates.has(name)) candidates.set(name, new Set());
    candidates.get(name)!.add(pref);
  };

  let commonDb: Awaited<
    ReturnType<InstanceType<typeof AbrGeocoderDiContainer>['database']['openCommonDb']>
  > | null = null;
  try {
    commonDb = await container.database.openCommonDb();
    const cities = await commonDb.getCityList();
    for (const city of cities) {
      const county = city.county ?? '';
      const name = `${city.city ?? ''}${city.ward ?? ''}`;
      add(`${county}${name}`, city.pref);
      add(name, city.pref); // 郡を省略した表記
    }
  } catch (error: any) {
    console.warn(`[ABR] 都道府県の補完表を構築できません: ${error?.message ?? error}`);
    return new Map();
  } finally {
    await commonDb?.close().catch(() => undefined);
  }

  const resolved = new Map<string, string>();
  for (const [name, prefs] of candidates) {
    if (prefs.size === 1) resolved.set(name, [...prefs][0]);
  }
  return resolved;
}

export function createPrefectureCompleter(
  byMunicipality: Map<string, string>
): PrefectureCompleter {
  let maxNameLength = 0;
  for (const name of byMunicipality.keys()) {
    maxNameLength = Math.max(maxNameLength, name.length);
  }

  return {
    size: byMunicipality.size,
    complete(address: string): string {
      const trimmed = address.trim();
      if (!trimmed) return address;
      if (PREFECTURE_NAMES.some((pref) => trimmed.startsWith(pref))) return address;

      // 「横浜市中区」と「横浜市」の双方が候補になりうるため、長い方から照合する
      for (let length = Math.min(maxNameLength, trimmed.length); length > 0; length--) {
        const pref = byMunicipality.get(trimmed.slice(0, length));
        if (pref) return `${pref}${trimmed}`;
      }
      return address;
    },
  };
}

let cached: PrefectureCompleter | null = null;

/** ABR データのダウンロード・削除後に呼ぶ。次回の照会で補完表を作り直す。 */
export function clearPrefectureCompleterCache(): void {
  cached = null;
}

/**
 * 補完表はジオコーディング1回あたり複数バッチで共有する。
 * バッチごとに構築すると common.sqlite を開く回数が件数に比例して増える。
 */
export async function getPrefectureCompleter(
  container: InstanceType<typeof AbrGeocoderDiContainer>
): Promise<PrefectureCompleter> {
  if (!cached) {
    cached = createPrefectureCompleter(await buildPrefectureByMunicipality(container));
  }
  return cached;
}
