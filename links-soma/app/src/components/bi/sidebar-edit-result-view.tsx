import {
  makeStyles,
  tokens,
  InlineDrawer,
  DrawerHeaderTitle,
  DrawerHeader,
  DrawerBody,
} from "@fluentui/react-components";
import { useAtom } from "jotai";
import { Suspense } from "react";
import { selectedResultSheetIdAtom } from "../../state/selected-result-sheet-id-atom";
import { FormEditResultView } from "./form-edit-result-view";
import { EditResultViewLayoutSort } from "./edit-result-view-layout-sort";
import { DebugCreateDatasets } from "./_debug-create-datasets";

const useStyles = makeStyles({
  drawer: {
    minHeight: "100vh",
  },
  heading: {
    fontSize: tokens.fontSizeBase400,
    lineHeight: tokens.lineHeightBase600,
    fontWeight: tokens.fontWeightSemibold,
  },
  drawerBodyInner: {
    display: "grid",
    gap: tokens.spacingVerticalXXL,
    padding: `${tokens.spacingVerticalXXL} ${tokens.spacingHorizontalNone}`,
  },
  isAddView: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXXL,
  },
});

export const SidebarEditResultView = (): JSX.Element => {
  const styles = useStyles();
  const [selectedResultSheetId] = useAtom(selectedResultSheetIdAtom);

  return (
    <InlineDrawer className={styles.drawer} open>
      <DrawerHeader>
        <DrawerHeaderTitle className={styles.heading}>
          ビューの設定
        </DrawerHeaderTitle>
      </DrawerHeader>
      <DrawerBody>
        <div className={styles.drawerBodyInner}>
          <Suspense>
            <FormEditResultView selectedResultSheetId={selectedResultSheetId} />
            <EditResultViewLayoutSort />
          </Suspense>
        </div>

        <DebugCreateDatasets />
      </DrawerBody>
    </InlineDrawer>
  );
};
