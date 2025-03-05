import {
  Table,
  TableHeader,
  TableRow,
  TableHeaderCell,
  TableBody,
  TableCell,
  makeStyles,
  tokens,
  Menu,
  MenuTrigger,
  MenuPopover,
  MenuList,
  MenuItem,
  mergeClasses,
  Dialog,
  Textarea,
  Caption1,
} from "@fluentui/react-components";
import { MoreVerticalRegular } from "@fluentui/react-icons";

import { useState } from "react";
import { formatDate } from "../utils/format-date";
import { useFetchModelFiles } from "../hooks/use-fetch-model-files";
import {
  useDialogState,
  type ReturnUseDialogState,
} from "../hooks/use-dialog-state";
import { type SelectModelFile } from "../schema";
import { Button } from "./ui/button";
import { DialogSurface } from "./ui/dialog-surface";
import { DialogBody } from "./ui/dialog-body";
import { DialogTitle } from "./ui/dialog-title";
import { DialogContent } from "./ui/dialog-content";
import { DialogActions } from "./ui/dialog-actions";
import { Input } from "./ui/input";
import { SeeAll } from "./ui/see-all";

const useStyles = makeStyles({
  updatedAtHeaderCell: {
    tableLayout: "fixed",
    width: "140px",
  },
  createdAtHeaderCell: {
    tableLayout: "fixed",
    width: "140px",
  },
  tableHeader: {
    backgroundColor: tokens.colorNeutralBackground3,
  },
  tableHeaderRow: {
    border: "none",
  },
  tableHeaderCell: {
    fontWeight: tokens.fontWeightSemibold,
  },
  modelNotFound: {
    fontSize: "14px",
  },
  actions: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  alert100: {
    color: "#C4314B",
  },
  fileName: {
    width: "220px",
  },
  note: {
    whiteSpace: "pre-wrap",
    overflowWrap: "break-word",
  },
  moreVerticalButton: {
    width: "44px",
  },
});

export const TableModel = (): JSX.Element => {
  const styles = useStyles();

  const { data, mutate } = useFetchModelFiles();

  if (data === undefined) return <></>;

  if (data.length === 0) {
    return (
      <p className={styles.modelNotFound}>現在表示できるモデルはありません</p>
    );
  }

  return (
    <Table>
      <TableHeader className={styles.tableHeader}>
        <TableRow className={styles.tableHeaderRow}>
          <TableHeaderCell
            className={mergeClasses(styles.tableHeaderCell, styles.fileName)}
          >
            モデル名
          </TableHeaderCell>
          <TableHeaderCell className={styles.tableHeaderCell}>
            モデル説明文
          </TableHeaderCell>
          <TableHeaderCell
            className={mergeClasses(
              styles.createdAtHeaderCell,
              styles.tableHeaderCell,
            )}
          >
            作成日
          </TableHeaderCell>
          <TableHeaderCell
            className={mergeClasses(
              styles.updatedAtHeaderCell,
              styles.tableHeaderCell,
            )}
          >
            更新日
          </TableHeaderCell>
          <TableHeaderCell
            className={styles.moreVerticalButton}
          ></TableHeaderCell>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((item) => (
          <TableRowItem key={item.id} item={item} mutate={mutate} />
        ))}
      </TableBody>
    </Table>
  );
};

/** TableRowItemコンポーネントでのみ利用 */
const editModelFileName = async (
  id: number,
  fileName: string,
): Promise<void> => {
  await window.ipcRenderer.invoke("updateModelFiles", {
    modelFileId: id,
    value: {
      file_name: fileName,
    },
  });
};

/** TableRowItemコンポーネントでのみ利用 */
const editModelNote = async (id: number, note: string): Promise<void> => {
  await window.ipcRenderer.invoke("updateModelFiles", {
    modelFileId: id,
    value: {
      note,
    },
  });
};

/** TableRowItemコンポーネントでのみ利用 */
const deleteModelFile = async (id: number): Promise<void> => {
  await window.ipcRenderer.invoke("deleteModelFiles", {
    modelFileId: id,
  });
};

/** TableModelコンポーネントでのみ利用 */
const TableRowItem = ({
  item,
  mutate,
}: {
  item: SelectModelFile;
  mutate: () => void;
}): JSX.Element => {
  const styles = useStyles();

  const editModelFileNameDialogState = useDialogState(false);
  const editNoteDialogState = useDialogState(false);
  const deleteDialogState = useDialogState(false);

  return (
    <TableRow key={item.id}>
      <TableCell>{item.file_name}</TableCell>
      <TableCell>
        {item.note && (
          <Caption1 className={styles.note}>
            <SeeAll content={item.note} />
          </Caption1>
        )}
      </TableCell>
      <TableCell>
        <Caption1>{formatDate(item.created_at)}</Caption1>
      </TableCell>
      <TableCell>
        <Caption1>{formatDate(item.updated_at)}</Caption1>
      </TableCell>
      <TableCell className={styles.actions}>
        <Menu>
          <MenuTrigger disableButtonEnhancement>
            <Button
              appearance="subtle"
              aria-label="詳細メニュー"
              icon={<MoreVerticalRegular />}
              shape="rounded"
            />
          </MenuTrigger>
          <MenuPopover>
            <MenuList>
              <MenuItem
                onClick={() => editModelFileNameDialogState.setIsOpen(true)}
              >
                モデル名の編集
              </MenuItem>
              <MenuItem onClick={() => editNoteDialogState.setIsOpen(true)}>
                モデル説明文の編集
              </MenuItem>
              <MenuItem
                className={styles.alert100}
                onClick={() => deleteDialogState.setIsOpen(true)}
              >
                削除
              </MenuItem>
            </MenuList>
          </MenuPopover>
        </Menu>
        <EditModelFileNameDialog
          dialogState={editModelFileNameDialogState}
          initialFileName={item.file_name || ""}
          onSubmit={async (name) => {
            await editModelFileName(item.id, name);
            mutate();
            editModelFileNameDialogState.setIsOpen(false);
          }}
        />
        <EditNoteDialog
          dialogState={editNoteDialogState}
          initialNote={item.note || ""}
          onSubmit={async (note) => {
            await editModelNote(item.id, note);
            mutate();
            editNoteDialogState.setIsOpen(false);
          }}
        />
        <DeleteMenuWithDialog
          dialogState={deleteDialogState}
          modelFileName={item.file_name}
          onDelete={async () => {
            await deleteModelFile(item.id);
            mutate();
            deleteDialogState.setIsOpen(false);
          }}
        />
      </TableCell>
    </TableRow>
  );
};

/** TableModelコンポーネントでのみ利用 */
const EditModelFileNameDialog = ({
  initialFileName,
  onSubmit,
  dialogState,
}: {
  initialFileName: string;
  onSubmit: (name: string) => void;
  dialogState: ReturnUseDialogState;
}): JSX.Element => {
  const [fileName, setFileName] = useState(initialFileName);
  const { isOpen, setIsOpen } = dialogState;

  return (
    <Dialog onOpenChange={(_, data) => setIsOpen(data.open)} open={isOpen}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>モデル名の編集</DialogTitle>
          <DialogContent>
            <Input
              onChange={(e) => setFileName(e.target.value)}
              style={{ width: "100%" }}
              value={fileName}
            />
          </DialogContent>
          <DialogActions>
            <Button appearance="primary" onClick={() => onSubmit(fileName)}>
              保存
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
};

/** TableModelコンポーネントでのみ利用 */
const EditNoteDialog = ({
  initialNote,
  onSubmit,
  dialogState,
}: {
  initialNote: string;
  onSubmit: (note: string) => void;
  dialogState: ReturnUseDialogState;
}): JSX.Element => {
  const [note, setNote] = useState(initialNote);
  const { isOpen, setIsOpen } = dialogState;

  return (
    <Dialog onOpenChange={(_, data) => setIsOpen(data.open)} open={isOpen}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>モデル説明文の編集</DialogTitle>
          <DialogContent>
            <Textarea
              onChange={(e) => setNote(e.target.value)}
              style={{ width: "100%" }}
              value={note}
            />
          </DialogContent>
          <DialogActions>
            <Button appearance="primary" onClick={() => onSubmit(note)}>
              保存
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
};

/** TableModelコンポーネントでのみ利用 */
const DeleteMenuWithDialog = ({
  onDelete,
  dialogState,
  modelFileName,
}: {
  onDelete: () => void;
  dialogState: ReturnUseDialogState;
  modelFileName: string | null;
}): JSX.Element => {
  const { isOpen, setIsOpen } = dialogState;

  return (
    <Dialog onOpenChange={(_, data) => setIsOpen(data.open)} open={isOpen}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>
            {modelFileName
              ? `「${modelFileName}」を削除しますか？`
              : "このモデルを削除しますか？"}
          </DialogTitle>
          <DialogContent>
            削除したモデルを復元することはできません
          </DialogContent>
          <DialogActions>
            <Button appearance="primary" onClick={onDelete}>
              削除
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
};
