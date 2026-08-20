import {
  makeStyles,
  tokens,
  InlineDrawer,
  DrawerHeaderTitle,
  DrawerHeader,
  DrawerBody,
  Button,
  Tooltip,
} from "@fluentui/react-components";
import { PanelLeftContract24Regular } from "@fluentui/react-icons";
import { Suspense } from "react";
import { FormEditResultView } from "./form-edit-result-view";
import { EditResultViewLayoutSort } from "./edit-result-view-layout-sort";

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

type Props = {
  open: boolean;
  onClose: () => void;
};

export const SidebarEditResultView = ({
  open,
  onClose,
}: Props): JSX.Element => {
  const styles = useStyles();

  return (
    <InlineDrawer className={styles.drawer} open={open} surfaceMotion={null}>
      <DrawerHeader>
        <DrawerHeaderTitle
          action={
            <Tooltip content="ビューの設定を閉じる" relationship="label">
              <Button
                appearance="subtle"
                aria-label="ビューの設定を閉じる"
                icon={<PanelLeftContract24Regular />}
                onClick={onClose}
              />
            </Tooltip>
          }
          className={styles.heading}
        >
          ビューの設定
        </DrawerHeaderTitle>
      </DrawerHeader>
      <DrawerBody>
        <div className={styles.drawerBodyInner}>
          <Suspense>
            <FormEditResultView />
            <EditResultViewLayoutSort />
          </Suspense>
        </div>
      </DrawerBody>
    </InlineDrawer>
  );
};
