import { useState } from "react";

export type UsePaginationReturnType = {
  page: number;
  limitPerPage: number;
  //   totalPages: number;
  handlePageChange: (newPage: number) => void;
  handleLimitPerPageChange: (newLimitPerPage: number) => void;
};

export const usePagination = (
  //   total: number,
  perPage: number,
): UsePaginationReturnType => {
  const [page, setPage] = useState(1);
  const [limitPerPage, setLimitPerPage] = useState(perPage);

  //   const totalPages = Math.ceil(total / limitPerPage);

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
    // totalPages,
    handlePageChange,
    handleLimitPerPageChange,
  };
};
