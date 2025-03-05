import { ErrorCircleFilled } from "@fluentui/react-icons";
import {
  makeStyles,
  TableRow,
  tokens,
  TableCell,
  mergeClasses,
  Spinner,
} from "@fluentui/react-components";
import { useNavigate } from "react-router-dom";
import { type SelectJob } from "../schema";
import { formatDate } from "../utils/format-date";
import { type JobType, TYPE_DISPLAY_MAP } from "../config/job-type-display-map";
import { TableRowMenu } from "./ui/table-row-menu";

const useStyles = makeStyles({
  table: {
    width: "100%",
  },
  tableHeader: {
    backgroundColor: tokens.colorNeutralBackground3,
  },
  headerCell: {
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase300,
  },
  tableCell: {
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    fontSize: tokens.fontSizeBase200,
  },
  tableRow: {
    ":hover": {
      backgroundColor: tokens.colorNeutralBackground1Hover,
      cursor: "pointer",
    },
  },
  statusContainer: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  statusCellContainer: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
  },
  statusCell: {
    display: "inline-flex",
    alignItems: "center",
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase200,
    padding: tokens.spacingVerticalXS,
    borderRadius: tokens.borderRadiusSmall,
    color: "#6264A7",
    backgroundColor: "#6264a71f",
  },
  statusCellError: {
    color: "#C4314B",
    backgroundColor: "#c4314b14",
  },
  statusCellComplete: {
    color: "#09583B",
    backgroundColor: "#ecf2ef",
  },
  noData: {
    color: "#616161",
    fontSize: tokens.fontSizeBase300,
  },
  tableCellMenu: {
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    fontSize: tokens.fontSizeBase200,
    display: "flex",
    justifyContent: "flex-end",
  },
});

export const TableRowJobs = ({
  item,
  onDeleteSuccess,
}: {
  item: SelectJob;
  onDeleteSuccess: (id: number) => void;
}): JSX.Element => {
  const styles = useStyles();
  const navigator = useNavigate();

  const statusInfo = getStatusInfo(item.status);
  /** result か null ではないかつ、 status が complete または error であればクリック(遷移)可能 */
  const clickable =
    !(item.type === null) &&
    (item.status === "complete" || item.status === "error");

  const handleDelete = (itemId: number): void => {
    onDeleteSuccess(itemId);
  };

  return (
    <TableRow
      className={clickable ? styles.tableRow : ""}
      onClick={() => {
        if (!clickable) return;
        navigator(`/job/detail/${item.id}/${item.type}`);
      }}
    >
      <TableCell className={styles.tableCell}>
        {formatDate(item.created_at)}
      </TableCell>
      <TableCell className={styles.tableCell}>
        {item.type && TYPE_DISPLAY_MAP[item.type as JobType]
          ? TYPE_DISPLAY_MAP[item.type as JobType]
          : "不明"}
      </TableCell>
      <TableCell className={styles.tableCell}>
        <div className={styles.statusContainer}>
          <div className={styles.statusCellContainer}>
            <span
              className={mergeClasses(
                styles.statusCell,
                item.status === "error" && styles.statusCellError,
                item.status === "complete" && styles.statusCellComplete,
              )}
            >
              {statusInfo.label}
            </span>
            {statusInfo.icon}
          </div>
          {item.status === "" && <Spinner size="tiny" />}
        </div>
      </TableCell>
      <TableCell className={styles.tableCell}>
        <span
          className={mergeClasses(
            styles.statusCell,
            item.is_named && styles.statusCellComplete,
          )}
        >
          {item.is_named ? "完了" : "未"}
        </span>
      </TableCell>
      <TableCell className={styles.tableCellMenu}>
        <TableRowMenu item={item} onDelete={handleDelete} />
      </TableCell>
    </TableRow>
  );
};

function getStatusInfo(status: SelectJob["status"]): {
  label: string;
  icon?: JSX.Element;
} {
  if (status === "error") {
    return {
      label: "エラー",
      icon: <ErrorCircleFilled style={{ color: "#C4314B", fontSize: 18 }} />,
    };
  } else if (status === "") {
    return { label: "進行中 0%" };
  } else if (status === "complete") {
    return { label: "完了" };
  } else {
    /** "" | "error" | "complete"以外はそのまま表示、という型表現をSchemaで書けなかったためignore */
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment -- 理由は上段の通り
    // @ts-ignore
    return {
      label: status ? `進行中 ${Math.round(status)}%` : "",
    };
  }
}
