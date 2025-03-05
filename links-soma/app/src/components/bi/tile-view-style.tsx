import { type View } from "../../bi-modules/interfaces/view";
import { ViewTable } from "./view-table";
import { ViewBar } from "./view-bar";
import { ViewLine } from "./view-line";
import { ViewPie } from "./view-pie";
import { Map } from "./map";

type Props = {
  view: View;
};

export const TileViewStyle = ({ view }: Props): JSX.Element => {
  const { style, unit, dataSetResultId } = view;

  switch (true) {
    case style === "pie" && unit === "building":
      return (
        <div>
          <ViewPie view={view} />
        </div>
      );
    case style === "bar" && unit === "area":
      return (
        <div>
          <ViewBar view={view} />
        </div>
      );
    case style === "line" && unit === "building":
      return (
        <div>
          <ViewLine view={view} />
        </div>
      );
    case style === "table": {
      return (
        <div>
          <ViewTable view={view} />
        </div>
      );
    }
    case style === "map": {
      return (
        <div>
          <Map dataSetResultId={dataSetResultId} view={view} />
        </div>
      );
    }
  }

  return <>未設定</>;
};
