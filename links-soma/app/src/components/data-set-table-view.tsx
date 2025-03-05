import {
  Table,
  TableBody,
  TableHeader,
  TableHeaderCell,
  TableRow,
} from "@fluentui/react-components";
import { type TableProps } from "../@types/charts";

type TableViewProps = {
  columns: string[];
  data: TableProps["data"];
};

export const DataSetTableView = ({
  columns,
  data,
}: TableViewProps): JSX.Element => {
  if (columns.length === 0 || data.length === 0) {
    return <div>未設定</div>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {columns.map((column, index) => (
            <TableHeaderCell key={index}>{column}</TableHeaderCell>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((row, rowIndex) => (
          <TableRow key={rowIndex}>
            {Object.entries(row).map(([key, value]) => (
              <TableHeaderCell key={key}>{value}</TableHeaderCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
