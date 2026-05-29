import { POPUP_ELEMENT_IDS } from "../const";
import styles from "./popup-shared.module.css";

interface PopupToggleButtonProps {
  buttonText: string;
}

/**
 * ポップアップ内のトグルボタン
 * renderToString（SSR）でレンダリングされるため、
 * Fluent UI Buttonではなくプレーンなbutton要素を使用
 */
export const PopupToggleButton = ({
  buttonText,
}: PopupToggleButtonProps): JSX.Element => {
  return (
    <div className={styles.toggleButtonContainer}>
      <button
        className={styles.toggleButton}
        id={POPUP_ELEMENT_IDS.TOGGLE_BUTTON}
        type="button"
      >
        {buttonText}
      </button>
    </div>
  );
};
