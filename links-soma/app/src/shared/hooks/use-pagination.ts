import { useState } from "react";

export type UsePaginationReturnType = {
  page: number;
  limitPerPage: number;
  totalPages: number;
  total: number;
  handlePageChange: (newPage: number) => void;
  handleLimitPerPageChange: (newLimitPerPage: number) => void;
};

export const usePagination = (initialState: {
  total: number;
  perPage: number;
}): UsePaginationReturnType => {
  const { total, perPage } = initialState;
  const [page, setPage] = useState(1);
  const [limitPerPage, setLimitPerPage] = useState(perPage);

  const totalPages = Math.ceil(total / limitPerPage);

  const handlePageChange = (newPage: number): void => {
    setPage(newPage);
  };

  const handleLimitPerPageChange = (newLimitPerPage: number): void => {
    setLimitPerPage(newLimitPerPage);
    setPage(1);
  };

  return {
    page,
    limitPerPage,
    totalPages,
    total,
    handlePageChange,
    handleLimitPerPageChange,
  };
};
