import { Link as FUILink, makeStyles } from "@fluentui/react-components";
import useSWR from "swr";
import { Link } from "react-router-dom";
import { formatDate } from "../utils/format-date";
import { type SelectWorkbook } from "../schema";
import { ROUTES } from "../routes";
import { Table, type ColumnDefinition } from "./ui/table";

const useStyles = makeStyles({
  tableHeaderCell: {
    width: "140px",
    fontSize: "14px",
    tableLayout: "fixed",
  },
});

const fetcher = (): Promise<SelectWorkbook[]> => {
  return window.ipcRenderer.invoke("selectWorkbooks");
};

export const TableWorkbook = (): JSX.Element => {
  const { data } = useSWR("TableWorkbook-selectWorkbooks", fetcher);

  const columns: ColumnDefinition<SelectWorkbook>[] = [
    {
      key: "title",
      name: "名前",
      onRender: (item) => (
        <Link to={ROUTES.ANALYSIS.WORKBOOK_DETAIL(String(item.id))}>
          <FUILink
            as="span"
            style={{
              fontWeight: 600,
            }}
          >
            {item.title}
          </FUILink>
        </Link>
      ),
    },
    {
      key: "created_at",
      name: "作成日",
      className: useStyles().tableHeaderCell,
      onRender: (item) => formatDate(item.created_at),
    },
    {
      key: "updated_at",
      name: "更新日",
      className: useStyles().tableHeaderCell,
      onRender: (item) => formatDate(item.updated_at),
    },
  ];

  return <Table columns={columns} items={data || []} />;
};
