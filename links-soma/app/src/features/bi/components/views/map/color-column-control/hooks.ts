import { useEffect, useState } from "react";
import { type MapColorColumn } from "../../../../util/map/color-column";

type Params = {
  /** 推定結果が持つ推定基準日。2件以上で変化率が算出されている */
  referenceDates: string[] | undefined;
  /** 表示中の推定基準日 */
  selectedDate: string | undefined;
  /** 対象結果の最古推定基準日。最古年度の行は比較対象を持たない */
  oldestReferenceDate: string | undefined;
  unit: "building" | "area";
};

export type ColorColumnControlReturn = {
  colorColumn: MapColorColumn;
  setColorColumn: (column: MapColorColumn) => void;
  /** 変化率を選べるか。単一年度・地域単位では選択肢を出さない */
  isChangeRateSelectable: boolean;
};

/**
 * 地図の色分け指標の選択状態を持つ。
 *
 * 変化率は複数年度かつ建物単位でしか値を持たないため、条件を満たさない場合は
 * 選択肢を隠し、選択済みだった場合は確率へ戻す（年度を減らす操作で色が消えるのを防ぐ）。
 *
 * 表示中が最古年度のときも隠す。最古年度の行は前年度比が NULL（地図が全面グレーになり
 * データ取得失敗と区別が付かない）、最古年度比が一律 0（全面が横ばい色になる）で、
 * どちらも増減を読み取れない。BuildingPopup が同じ条件で変化行を伏せるのと揃える。
 */
export const useColorColumnControl = ({
  referenceDates,
  selectedDate,
  oldestReferenceDate,
  unit,
}: Params): ColorColumnControlReturn => {
  const [colorColumn, setColorColumn] = useState<MapColorColumn>("probability");

  const isOldestSelected =
    !!oldestReferenceDate && selectedDate === oldestReferenceDate;

  const isChangeRateSelectable =
    unit === "building" &&
    (referenceDates?.length ?? 0) >= 2 &&
    !isOldestSelected;

  useEffect(
    function resetToProbabilityWhenChangeRateUnavailable() {
      if (!isChangeRateSelectable) {
        setColorColumn("probability");
      }
    },
    [isChangeRateSelectable],
  );

  return { colorColumn, setColorColumn, isChangeRateSelectable };
};
