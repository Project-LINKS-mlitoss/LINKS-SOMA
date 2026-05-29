import { type IpcMainInvokeEvent } from "electron";
import {
  fetchAreaBarChartData,
  fetchBuildingLineChartData,
  fetchBuildingPieChartData,
} from "../services";
import { type View, type ChartProps } from "../types";

import { type IpcMainListener } from "../../../ipc-main-listeners";

type Params = {
  view: View;
};

export const fetchChartData = (async (
  _event: IpcMainInvokeEvent,
  { view }: Params,
): Promise<ChartProps> => {
  switch (true) {
    case view.style === "bar" && view.unit === "area":
      return await fetchAreaBarChartData({ view });
    case view.style === "line" && view.unit === "building":
      return await fetchBuildingLineChartData({ view });
    case view.style === "pie" && view.unit === "building":
      return await fetchBuildingPieChartData({ view });
    default:
      throw new Error(`style: ${view.style} は未対応です`);
  }
}) satisfies IpcMainListener;
