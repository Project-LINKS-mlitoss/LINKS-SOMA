import {
  Menu,
  MenuTrigger,
  MenuPopover,
  MenuList,
  MenuItem,
  Button,
} from "@fluentui/react-components";
import { MoreVerticalRegular } from "@fluentui/react-icons";
import { useNavigate } from "react-router-dom";
import { useDialogState } from "../../../shared/hooks/use-dialog-state";
import { type SelectJob } from "../../../db/schema";
import {
  type JobType,
  TYPE_DISPLAY_MAP,
} from "../../../shared/config/job-type-display-map";
import { DialogDeleteJob } from "./dialog-delete-job";

export function TableRowMenu({
  item,
  onDelete,
}: {
  item: SelectJob;
  onDelete?: (id: number) => void;
}): JSX.Element {
  const navigator = useNavigate();
  const deleteDialogState = useDialogState(false);
  const itemName =
    item.type && TYPE_DISPLAY_MAP[item.type as JobType]
      ? TYPE_DISPLAY_MAP[item.type as JobType]
      : "不明";

  const isDraft = item.status === "draft";

  const handleConfirmDelete = async (id: number): Promise<void> => {
    if (!onDelete) return;
    try {
      await onDelete(id);
    } finally {
      deleteDialogState.setIsOpen(false);
    }
  };

  const handleContinueEdit = (): void => {
    navigator(`/normalization/create/${item.id}?step=confirm`);
  };

  return (
    <>
      <Menu>
        <MenuTrigger disableButtonEnhancement>
          <Button
            appearance="subtle"
            aria-label="詳細メニュー"
            icon={<MoreVerticalRegular />}
            onClick={(e) => e.stopPropagation()}
          />
        </MenuTrigger>
        <MenuPopover onClick={(e) => e.stopPropagation()}>
          <MenuList>
            {isDraft && (
              <MenuItem onClick={handleContinueEdit}>編集を続ける</MenuItem>
            )}
            <MenuItem
              onClick={() => {
                deleteDialogState.setIsOpen(true);
              }}
            >
              削除
            </MenuItem>
          </MenuList>
        </MenuPopover>
      </Menu>
      <DialogDeleteJob
        dialogState={deleteDialogState}
        fileName={isDraft ? "下書き" : itemName}
        id={item.id}
        onDelete={handleConfirmDelete}
      />
    </>
  );
}
