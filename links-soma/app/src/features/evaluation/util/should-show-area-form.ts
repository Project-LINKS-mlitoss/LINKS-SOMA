import { type NormalizedDatasetGeometrySource } from "../../dataset/ipc/select-normalized-dataset-geometry-sources";

/**
 * 推定画面で地域集計フォームを表示するか判定する（issue #1924）。
 *
 * 地域集計（E032）は建物ジオメトリを地域ポリゴンへ空間結合する。建物ジオメトリは名寄せの空間結合
 * （E016）で付くが、E016 はジオコーディングが無いと丸ごとスキップされる（IF001.py: if has_geocoding）。
 * よってジオコーディングを使っていない名寄せデータでは地域集計は無意味なのでフォームを出さない。
 *
 * 表示に倒す条件（安全側）:
 * - fetch 失敗（hasError）: 判定できないので隠して黙って落とさず、ユーザーに委ねる
 * - 判定不能（determinable=false, アップロード直挿し等）
 * - ジオコーディングあり（hasGeocoding=true）
 * - ソースに無いパス（!info, 名寄せ登録前の一時状態等）
 *
 * 非表示に倒す条件:
 * - 未選択（paths 空）
 * - 初回判定ロード中（sources=undefined かつ error なし）: フォームの点滅を避ける
 * - 選択中の全データがジオコーディング未使用と確定
 *
 * 複数選択時は1つでも表示側に該当すれば表示する。
 */
export const shouldShowAreaForm = (
  paths: string[],
  sources: NormalizedDatasetGeometrySource[] | undefined,
  hasError: boolean,
): boolean => {
  if (paths.length === 0) return false;
  if (hasError) return true;
  if (!sources) return false;
  return paths.some((path) => {
    const info = sources.find((g) => g.path === path);
    return !info || !info.determinable || info.hasGeocoding;
  });
};
