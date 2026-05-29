import { type SortDirection } from "@fluentui/react-components";

/** ページネーションを利用するときにdrizzleクエリが必要とする値 */
export type PaginationQuery = {
  limit: number;
  offset: number;
};

export type OrderByQuery<T> = {
  column: T;
  direction: SortDirection;
};
