import {
  Menu,
  MenuTrigger,
  MenuPopover,
  MenuList,
  MenuItem,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { MoreVerticalRegular } from "@fluentui/react-icons";
import { Button } from "../../../../shared/components/ui";
import { useDialogState } from "../../../../shared/hooks/use-dialog-state";
import { DownloadDialog } from "../dialogs/dialog-download";
import { DeleteDialog } from "../dialogs/dialog-delete";

const useStyles = makeStyles({
  menuButton: {
    padding: `${tokens.spacingHorizontalXXS} ${tokens.spacingVerticalXXS}`,
    border: "none",
    minWidth: "24px",
    minHeight: "24px",
  },
});

type Props = {
  /** データダウンロード時のコールバック */
  onDownload: (fileType: string, coordinate: string) => Promise<void>;
  /** ビュー削除時のコールバック */
  onDelete: () => void;
  /** チャートCSVエクスポート時のコールバック（チャートビューのみ） */
  onChartCsvExport?: () => Promise<void>;
  /** データセット結果IDが存在するかどうか */
  hasDataSetResultId: boolean;
};

export function ViewActionMenu({
  onDownload,
  onDelete,
  onChartCsvExport,
  hasDataSetResultId,
}: Props): JSX.Element {
  const styles = useStyles();
  const downloadDialogState = useDialogState(false);
  const deleteDialogState = useDialogState(false);

  const handleChartCsvExport = async (): Promise<void> => {
    if (onChartCsvExport) {
      await onChartCsvExport();
    }
  };

  return (
    <>
      <Menu>
        <MenuTrigger disableButtonEnhancement>
          <Button
            appearance="subtle"
            aria-label="アクションメニュー"
            className={styles.menuButton}
            icon={<MoreVerticalRegular />}
            onClick={(e) => e.stopPropagation()}
          />
        </MenuTrigger>
        <MenuPopover onClick={(e) => e.stopPropagation()}>
          <MenuList>
            {hasDataSetResultId && (
              <MenuItem onClick={() => downloadDialogState.setIsOpen(true)}>
                GISデータをダウンロード
              </MenuItem>
            )}
            {onChartCsvExport && (
              <MenuItem onClick={() => void handleChartCsvExport()}>
                集計結果をダウンロード
              </MenuItem>
            )}
            <MenuItem onClick={() => deleteDialogState.setIsOpen(true)}>
              ビューを削除
            </MenuItem>
          </MenuList>
        </MenuPopover>
      </Menu>
      <DownloadDialog dialogState={downloadDialogState} onSubmit={onDownload} />
      <DeleteDialog dialogState={deleteDialogState} onSubmit={onDelete} />
    </>
  );
}
