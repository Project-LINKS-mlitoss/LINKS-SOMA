import { makeStyles } from "@fluentui/react-components";
import { type UsePaginationReturnType } from "../../../../shared/hooks/use-pagination";

const useStyles = makeStyles({
  root: {
    fontSize: "11px",
  },
  bottomContainer: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  filteredCount: {
    fontSize: "16px",
    fontWeight: "700",
  },
  currentCount: {
    fontSize: "16px",
    fontWeight: "700",
  },
});

type Props = {
  allCount: number;
  filteredCount: number;
};

export const QueryHeader = ({
  allCount,
  filteredCount,
}: Props): JSX.Element => {
  const styles = useStyles();

  const isFiltered = filteredCount !== allCount;

  return (
    <div className={styles.root}>
      {isFiltered && <div>フィルター結果: </div>}
      <div className={styles.bottomContainer}>
        <div>
          <span className={styles.currentCount}>{filteredCount}</span>{" "}
          件のデータを表示中
        </div>
        {isFiltered && <span>(総件数:{allCount})</span>}
      </div>
    </div>
  );
};

type PropsWithPagination = {
  currentDataLength: number;
  pagination: UsePaginationReturnType;
  allCount: number;
};

export const QueryHeaderWithPagination = ({
  pagination,
  currentDataLength,
  allCount,
}: PropsWithPagination): JSX.Element => {
  const styles = useStyles();
  const { page, limitPerPage, total } = pagination;

  const isFiltered = total !== allCount;

  return (
    <div className={styles.root}>
      {isFiltered && <div>フィルター結果: </div>}
      <div className={styles.bottomContainer}>
        <div>
          <span className={styles.filteredCount}>{total}</span> 件中{" "}
          <span className={styles.currentCount}>
            {limitPerPage * (page - 1) + 1} -{" "}
            {limitPerPage * (page - 1) + currentDataLength}
          </span>{" "}
          件目を表示中
        </div>
        {isFiltered && <span>(総件数:{allCount})</span>}
      </div>
    </div>
  );
};

const useStylesWrapper = makeStyles({
  root: {
    display: "flex",
    justifyContent: "space-between",
    flexWrap: "wrap",
    padding: "8px 4px",
  },
});

export const QueryHeaderWrapper = ({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element => {
  const styles = useStylesWrapper();
  return <div className={styles.root}>{children}</div>;
};
