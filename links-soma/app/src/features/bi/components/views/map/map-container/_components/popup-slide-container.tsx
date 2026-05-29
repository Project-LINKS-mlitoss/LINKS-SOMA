import { type ReactNode } from "react";
import { POPUP_ELEMENT_IDS, POPUP_TRANSFORM_VALUES } from "../const";
import styles from "./popup-shared.module.css";

interface PopupSlideContainerProps {
  simpleView: ReactNode;
  allColumnsView: ReactNode;
}

export const PopupSlideContainer = ({
  simpleView,
  allColumnsView,
}: PopupSlideContainerProps): JSX.Element => {
  return (
    <div className={styles.slideContainer}>
      <div
        className={styles.slideWrapper}
        id={POPUP_ELEMENT_IDS.SIMPLE_VIEW}
        style={{ transform: POPUP_TRANSFORM_VALUES.SIMPLE_VIEW_VISIBLE }}
      >
        {simpleView}
      </div>
      <div
        className={styles.slideWrapper}
        id={POPUP_ELEMENT_IDS.ALL_COLUMNS_VIEW}
        style={{ transform: POPUP_TRANSFORM_VALUES.ALL_COLUMNS_HIDDEN }}
      >
        {allColumnsView}
      </div>
    </div>
  );
};
