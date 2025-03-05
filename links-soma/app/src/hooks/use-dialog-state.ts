import { useState } from "react";

export type ReturnUseDialogState = {
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
};
export const useDialogState = (initialState = false): ReturnUseDialogState => {
  const [isOpen, setIsOpen] = useState(initialState);
  return { isOpen, setIsOpen };
};
