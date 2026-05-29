import { ErrorCircleFilled } from "@fluentui/react-icons";
import {
  makeStyles,
  TableRow,
  tokens,
  TableCell,
  mergeClasses,
} from "@fluentui/react-components";
import { useNavigate } from "react-router-dom";
import { type SelectJob } from "../../../db/schema";
import { formatDate } from "../../../shared/utils/format-date";
import {
  type JobType,
  TYPE_DISPLAY_MAP,
} from "../../../shared/config/job-type-display-map";
import { LoaderIcon } from "../../../shared/components/ui/loader-icon";
import { TableRowMenu } from "./table-row-menu";

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
    color: tokens.colorBrandForeground1,
    backgroundColor: tokens.colorBrandBackground2,
  },
  statusCellPending: {
    color: tokens.colorNeutralForeground4,
    backgroundColor: tokens.colorNeutralBackground3,
  },
  statusCellError: {
    color: tokens.colorPaletteRedForeground1,
    backgroundColor: tokens.colorPaletteRedBackground1,
  },
  statusCellComplete: {
    color: tokens.colorPaletteGreenForeground1,
    backgroundColor: tokens.colorPaletteGreenBackground1,
  },
  statusCellDraft: {
    color: tokens.colorNeutralForeground4,
    backgroundColor: tokens.colorNeutralBackground3,
  },
  noData: {
    color: tokens.colorNeutralForeground3,
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
  /** type が null でなければクリック(遷移)可能 */
  const clickable = item.type !== null;

  const handleDelete = (itemId: number): void => {
    onDeleteSuccess(itemId);
  };

  const handleRowClick = (): void => {
    if (!clickable) return;
    if (item.status === "draft") {
      // 下書きの場合はウィザードへ遷移（確認画面から開始）
      navigator(`/normalization/create/${item.id}?step=confirm`);
    } else {
      // 完了/エラー/処理中の場合は詳細画面へ遷移
      navigator(`/job/detail/${item.id}/${item.type}`);
    }
  };

  return (
    <TableRow
      className={clickable ? styles.tableRow : ""}
      onClick={handleRowClick}
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
                item.status === "" && styles.statusCellPending,
                item.status === "draft" && styles.statusCellDraft,
              )}
            >
              {statusInfo.label}
            </span>
            {statusInfo.icon}
          </div>
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
  if (status === "draft") {
    return {
      label: "下書き",
    };
  } else if (status === "error") {
    return {
      label: "エラー",
      icon: (
        <ErrorCircleFilled
          style={{ color: tokens.colorPaletteRedForeground1 }}
        />
      ),
    };
  } else if (status === "") {
    return { label: "待機中", icon: <LoaderIcon style={{ margin: "2px" }} /> };
  } else if (status === "complete") {
    return { label: "完了" };
  } else {
    return {
      label: status ? `進行中 ${Math.round(status)}%` : "",
    };
  }
}
