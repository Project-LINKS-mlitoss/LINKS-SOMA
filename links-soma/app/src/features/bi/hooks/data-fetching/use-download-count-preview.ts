import { useEffect, useState } from "react";
import { type MapWithTableView } from "../../types/models/view";
import { type ParameterBase } from "../../types/models/parameter";
import { rendererLogger } from "../../../../shared/utils/renderer-logger";

type Params = {
  dataSetResultId: number;
  unit: "building" | "area";
  /** プレビュー対象のフィルター/カラム等。保存前の編集中の値も渡せる */
  parameters: ParameterBase[];
  /** ダイアログが開いている等、取得が必要なときだけ true にする */
  enabled: boolean;
};

type ReturnType = {
  /** フィルター適用後の件数。未取得・失敗時は null */
  count: number | null;
  isLoading: boolean;
};

/**
 * ダウンロード対象（フィルター適用後）の件数をプレビュー取得する。
 *
 * 出力本体は view_id 経由の保存済みパラメータを読むが、件数IPC
 * (`filterDataSetForTable`) は view オブジェクトを引数に取るため、
 * 保存前の編集中パラメータでも件数を算出できる。building/area の分岐は
 * IPC 内部で行われる（ADR-0002）。
 */
export const useDownloadCountPreview = ({
  dataSetResultId,
  unit,
  parameters,
  enabled,
}: Params): ReturnType => {
  const [count, setCount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // parameters は値で比較する（編集のたびに新しい配列になるため）
  const parametersKey = JSON.stringify(parameters);

  useEffect(() => {
    if (!enabled) return;

    // 連続編集で件数IPCを叩きすぎないようデバウンスし、
    // 古い応答が新しい件数を上書きしないよう cancelled で破棄する
    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        setIsLoading(true);
        try {
          const view = {
            id: 0,
            dataSetResultId,
            style: "map-with-table",
            title: "",
            unit,
            parameters,
          } as MapWithTableView;
          const result = await window.ipcRenderer.invoke(
            "filterDataSetForTable",
            { view, pagination: { limit: 1, offset: 0 } },
          );
          if (!cancelled) setCount(result.totalCount);
        } catch (error) {
          rendererLogger.error("Download count preview fetch failed", error, {
            component: "useDownloadCountPreview",
          });
          if (!cancelled) setCount(null);
        } finally {
          if (!cancelled) setIsLoading(false);
        }
      })();
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- parameters は parametersKey で比較する
  }, [enabled, dataSetResultId, unit, parametersKey]);

  return { count, isLoading };
};
