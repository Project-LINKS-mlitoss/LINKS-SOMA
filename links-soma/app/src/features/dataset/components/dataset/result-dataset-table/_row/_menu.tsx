import {
  Menu,
  MenuTrigger,
  MenuPopover,
  MenuList,
  MenuItem,
} from "@fluentui/react-components";
import { MoreVerticalRegular } from "@fluentui/react-icons";
import { Button } from "../../../../../../shared/components/ui/button";
import { useFetchDataSetResults } from "../../../../hooks/use-fetch-data-set-results";
import { type SelectDataSetResult } from "../../../../../../db/schema";
import { useDialogState } from "../../../../../../shared/hooks/use-dialog-state";

import { DeleteDataSetRowDialog } from "../../delete-dataset-row-dialog";
import { EditNameDialog } from "../../edit-name-dialog";

export function RowMenu({
  item,
  onDelete,
}: {
  item: SelectDataSetResult;
  onDelete: () => void;
}): JSX.Element {
  const editNameDialogState = useDialogState(false);
  const deleteDialogState = useDialogState(false);
  const { mutate } = useFetchDataSetResults();

  const handleEditName = async (
    newTitle: SelectDataSetResult["title"],
  ): Promise<void> => {
    await window.ipcRenderer.invoke("updateDataSetResult", {
      id: item.id,
      title: newTitle,
    });
    void mutate();
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
            <MenuItem
              onClick={() => {
                editNameDialogState.setIsOpen(true);
              }}
            >
              データ名の編集
            </MenuItem>
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
      <EditNameDialog
        dialogState={editNameDialogState}
        initialName={item.title}
        onSubmit={handleEditName}
      />
      <DeleteDataSetRowDialog
        dialogState={deleteDialogState}
        fileName={item.title || ""}
        onDelete={onDelete}
      />
    </>
  );
}
