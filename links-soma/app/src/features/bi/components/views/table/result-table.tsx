import {
  makeStyles,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  tokens,
} from "@fluentui/react-components";
import {
  type MapWithTableView,
  type TableView,
} from "../../../types/models/view";
import {
  type SelectDataSetDetailArea,
  type SelectDataSetDetailBuilding,
} from "../../../../../db/schema";
import { useSort } from "../../../../../shared/hooks/use-sort";
import { useFetchTableProps } from "../../../hooks";
import { Pagination } from "../../../../../shared/components/ui";
import {
  type MapInitReturn,
  type UsePopupEffectWithFeatureReturn,
} from "../../../hooks/map";

const useStyles = makeStyles({
  root: {
    display: "grid",
    gap: `${tokens.spacingVerticalS}`,
    maxHeight: "600px",
  },
  tableHeader: {
    backgroundColor: tokens.colorNeutralBackground3,
  },
  tableHeaderRow: {
    border: "none",
  },
  tableHeaderCell: {
    fontWeight: tokens.fontWeightSemibold,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
  },
  table: {
    tableLayout: "auto",
  },
  tableContainer: {
    overflowX: "scroll",
    whiteSpace: "nowrap",
  },
  // ジオメトリなし行のグレーアウトスタイル
  disabledRow: {
    backgroundColor: tokens.colorNeutralBackground4,
    color: tokens.colorNeutralForegroundDisabled,
    cursor: "not-allowed",
    opacity: "0.7",
  },
});

/**
 * 行が地図表示可能かどうかを判定
 * bldg_geometry, lat_geocoding, lon_geocodingのいずれかがnullの場合はfalse
 */
const isRowMappable = (
  row: Record<string, unknown>,
  unit: "building" | "area",
): boolean => {
  if (unit === "area") {
    // 地域単位は別のジオメトリカラムを使用するため、現時点では常に表示可能として扱う
    return true;
  }

  // 建物単位: ジオメトリ関連カラムがすべて存在するかチェック
  const bldgGeometry = row._bldg_geometry;
  const latGeocoding = row._lat_geocoding;
  const lonGeocoding = row._lon_geocoding;

  return (
    bldgGeometry !== null &&
    bldgGeometry !== undefined &&
    bldgGeometry !== "" &&
    latGeocoding !== null &&
    latGeocoding !== undefined &&
    lonGeocoding !== null &&
    lonGeocoding !== undefined
  );
};

type Props = {
  view: TableView | MapWithTableView;
  mapInitState: MapInitReturn;

  selectedFeature: UsePopupEffectWithFeatureReturn["selectedFeature"];
  setSelectedFeature: UsePopupEffectWithFeatureReturn["setSelectedFeature"];

  selectedDate?: string;
};

/** 地図ビューでの表表示 */
export const ResultTable = ({
  view,
  selectedFeature,
  setSelectedFeature,
  selectedDate,
}: Props): JSX.Element => {
  const { orderBy, headerSortProps } = useSort<
    keyof SelectDataSetDetailBuilding | keyof SelectDataSetDetailArea
  >();

  const { tableProps, pagination } = useFetchTableProps({
    view,
    orderBy,
    selectedDate,
  });

  const styles = useStyles();

  return (
    <div className={styles.root}>
      <Pagination {...pagination} />
      <div className={styles.tableContainer}>
        <Table className={styles.table} sortable>
          <TableHeader className={styles.tableHeader}>
            <TableRow className={styles.tableHeaderRow}>
              {tableProps.columns.map((column, index) => {
                return (
                  <TableHeaderCell
                    key={index}
                    className={styles.tableHeaderCell}
                    {...headerSortProps(column.key)}
                  >
                    {column.label}
                  </TableHeaderCell>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {tableProps.data
              .map((row, index) => {
                const isSelected = row.id === selectedFeature?.properties.id;
                const isMappable = isRowMappable(row, view.unit);

                return (
                  <TableRow
                    key={index}
                    className={!isMappable ? styles.disabledRow : undefined}
                    onClick={async () => {
                      // ジオメトリなしの行はクリック不可
                      if (!isMappable) return;
                      if (!row.id) return;
                      const feature =
                        view.unit === "area"
                          ? await window.ipcRenderer.invoke("selectArea", {
                              dataSetDetailAreasId: Number(row.id),
                            })
                          : await window.ipcRenderer.invoke("selectBuilding", {
                              dataSetDetailBuildingsId: Number(row.id),
                            });
                      if (!feature) return;
                      // テーブルからの選択時はカメラを移動する
                      setSelectedFeature(feature, { flyTo: true });
                    }}
                    style={
                      isSelected
                        ? {
                            backgroundColor:
                              tokens.colorNeutralBackground1Selected,
                          }
                        : {}
                    }
                  >
                    {tableProps.columns.map((column, index) => {
                      return (
                        <TableCell key={index}>
                          {row[column.key] !== null &&
                          row[column.key] !== undefined ? (
                            `${row[column.key]}${column.unit ?? ""}`
                          ) : (
                            <span style={{ color: "#999" }}>--</span>
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })
              .flat(-1)}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
