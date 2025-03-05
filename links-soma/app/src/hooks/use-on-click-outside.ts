/** @ref https://designcode.io/react-hooks-handbook-useonclickoutside-hook */
import { useEffect } from "react";

export const useOnClickOutside = (
  ref: React.RefObject<HTMLElement>,
  handler: (event: MouseEvent | TouchEvent) => void,
): void => {
  useEffect(() => {
    const listener = (event: MouseEvent | TouchEvent): void => {
      /** @fixme as 使わずにすむ方法あれば修正したい */
      if (!ref.current || ref.current.contains(event.target as Node)) {
        return;
      }
      handler(event);
    };

    document.addEventListener("mousedown", listener);
    document.addEventListener("touchstart", listener);

    return (): void => {
      document.removeEventListener("mousedown", listener);
      document.removeEventListener("touchstart", listener);
    };
  }, [ref, handler]);
};
