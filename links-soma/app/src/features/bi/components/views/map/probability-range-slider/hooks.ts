import { useState } from "react";
import { type MapWithTableView } from "../../../../types";
import { useFetchAreaProbabilityMax } from "../../../../hooks";
import { CHANGE_RATE_BOUND } from "../../../../util/map/layer-styles";
import {
  isChangeRateColumn,
  type MapColorColumn,
} from "../../../../util/map/color-column";
import {
  BUILDING_DOMAIN_MAX,
  changeRateDomain,
  roundUpAreaDomain,
} from "./domain";

/** 表示する値の範囲 [min, max]（色分けの基準と同じ量。確率なら 0〜domainMax、変化率なら負を含む） */
export type ProbabilityRange = [number, number];

export type UseProbabilityRangeReturn = {
  range: ProbabilityRange;
  setRange: (range: ProbabilityRange) => void;
  /** 目盛り下限。確率は 0、変化率は -CHANGE_RATE_BOUND */
  domainMin: number;
  /** 目盛り上限。確率の building は 1、area はデータ最大値に合わせて動的。変化率は +CHANGE_RATE_BOUND */
  domainMax: number;
  /**
   * 確率グラデーションの上限。色分けの基準を変えても変わらない。
   * スライダーの目盛り（domainMax）と混ぜるとレイヤーが作り直され再取得が走るため分ける。
   */
  probabilityDomainMax: number;
  unit: MapWithTableView["unit"];
};

/**
 * 絞り込みの軸は色分けの基準に追従する。色が増減の両方向を表しているのに
 * 絞り込みが確率の片方向しか動かせないと、凡例の -50% を選べず意味が通らないため。
 */
export const useProbabilityRange = ({
  dataSetResultId,
  unit,
  colorColumn,
}: {
  dataSetResultId: MapWithTableView["dataSetResultId"];
  unit: MapWithTableView["unit"];
  colorColumn: MapColorColumn;
}): UseProbabilityRangeReturn => {
  // building は確率 0〜1 で固定。area は割合の上限が一定でないため、
  // データ最大値（building 時は取得しない）に目盛りを合わせる。
  const { data: areaMax } = useFetchAreaProbabilityMax({
    dataSetResultId: unit === "area" ? dataSetResultId : null,
  });

  const probabilityDomainMax =
    unit === "building"
      ? BUILDING_DOMAIN_MAX
      : roundUpAreaDomain(areaMax ?? null);

  // 変化率の列は building にしか存在しない（area は確率へ落ちる）
  const isChangeRate = isChangeRateColumn(colorColumn) && unit === "building";
  const domain = isChangeRate
    ? changeRateDomain(CHANGE_RATE_BOUND)
    : { min: 0, max: probabilityDomainMax };

  // 目盛りが変わったら範囲を全域に戻す。Effect ではなくレンダリング中に同期する
  // （React 推奨「props 変化時の state 調整」。code-review.md §9）
  const [range, setRange] = useState<ProbabilityRange>([
    domain.min,
    domain.max,
  ]);
  const [prevDomain, setPrevDomain] = useState(domain);
  if (prevDomain.min !== domain.min || prevDomain.max !== domain.max) {
    setPrevDomain(domain);
    setRange([domain.min, domain.max]);
  }

  return {
    range,
    setRange,
    domainMin: domain.min,
    domainMax: domain.max,
    probabilityDomainMax,
    unit,
  };
};
