import { useState } from "react";

type ReturnType = {
  isLoading: boolean;
  handleIsLoading: (value: boolean) => void;
};

export const useIsLoading = ({
  init = false,
}: {
  init?: boolean;
}): ReturnType => {
  const [isLoading, setIsLoading] = useState<boolean>(init);
  const handleIsLoading = (value: boolean): void => {
    setIsLoading(value);
  };

  return {
    isLoading,
    handleIsLoading,
  };
};
