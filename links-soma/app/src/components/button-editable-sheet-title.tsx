import { DeleteRegular, Dismiss24Regular } from "@fluentui/react-icons";
import {
  Dialog,
  DialogTrigger,
  makeStyles,
  tokens,
  Input,
} from "@fluentui/react-components";
import { useRef, useState } from "react";
import { useNavigate, type FormProps } from "react-router-dom";
import { type SelectResultSheet } from "../schema";
import { useOnClickOutside } from "../hooks/use-on-click-outside";
import { useFetchResultSheets } from "../hooks/use-fetch-result-sheets";
import { ROUTES } from "../routes";
import { DialogSurface } from "./ui/dialog-surface";
import { DialogBody } from "./ui/dialog-body";
import { DialogTitle } from "./ui/dialog-title";
import { DialogActions } from "./ui/dialog-actions";
import { Button } from "./ui/button";
import { DialogContent } from "./ui/dialog-content";

type Props = {
  resultSheet: Pick<SelectResultSheet, "id" | "title" | "workbook_id">;
};

const useStyles = makeStyles({
  root: {
    padding: tokens.spacingVerticalNone,
  },
  title: {
    display: "flex",
    flexDirection: "row",
  },
});

export const ButtonEditableSheetTitle = ({
  resultSheet,
}: Props): JSX.Element => {
  const styles = useStyles();
  const navigate = useNavigate();

  const [isEditing, setIsEditing] = useState(false);
  // Dialogの開閉でonClickOutsideを制御するためのstate
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);

  const { mutate } = useFetchResultSheets({
    workbookId: resultSheet.workbook_id,
  });

  const [title, setTitle] = useState(resultSheet.title || "");
  const updateTitle = (): void => {
    if (title.length === 0) return; // 仮のバリデーション
    const asyncSubmit = async (): Promise<void> => {
      await window.ipcRenderer.invoke("updateResultSheets", {
        resultSheetId: resultSheet.id,
        value: { title },
      });
    };
    asyncSubmit()
      .catch(console.error)
      .finally(() => setIsEditing(false));
  };

  const handleSubmit: FormProps["onSubmit"] = (e) => {
    e.preventDefault();
    updateTitle();
  };

  const deleteResultSheet = async (): Promise<void> => {
    await window.ipcRenderer.invoke("deleteResultSheet", {
      resultSheetId: resultSheet.id,
    });
  };

  const handleDelete = async (): Promise<void> => {
    await deleteResultSheet();
    // 削除後にシート一覧を再取得する
    void mutate();
    navigate(
      ROUTES.ANALYSIS.WORKBOOK_EDIT({
        id: String(resultSheet.workbook_id),
      }),
    );
  };

  const ref = useRef(null);
  useOnClickOutside(ref, () => {
    // Dialogが開いている間はタイトルを更新しない
    if (!openDeleteDialog) {
      updateTitle();
    }
  });

  if (isEditing) {
    return (
      <div ref={ref} className={styles.title}>
        <form onSubmit={handleSubmit}>
          <Input
            maxLength={100}
            minLength={1}
            name="title"
            onChange={(e): void => setTitle(e.target.value)}
            size="small"
            value={title}
          />
        </form>
        <Dialog
          onOpenChange={() => {
            setOpenDeleteDialog((prev) => !prev);
          }}
          open={openDeleteDialog}
        >
          <DialogTrigger disableButtonEnhancement>
            <Button appearance="subtle" icon={<DeleteRegular />} />
          </DialogTrigger>
          <DialogSurface>
            <DialogBody>
              <DialogTitle
                action={
                  <DialogTrigger action="close">
                    <Button
                      appearance="subtle"
                      aria-label="close"
                      icon={
                        <Dismiss24Regular
                          color={tokens.colorNeutralForeground1}
                          strokeWidth={2}
                        />
                      }
                    />
                  </DialogTrigger>
                }
              >
                シートを削除しますか？
              </DialogTitle>
              <DialogContent>削除したシートはもとに戻せません</DialogContent>
              <DialogActions position="start">
                <Button>キャンセル</Button>
              </DialogActions>
              <DialogActions position="end">
                <Button appearance="primary" onClick={handleDelete}>
                  削除
                </Button>
              </DialogActions>
            </DialogBody>
          </DialogSurface>
        </Dialog>
      </div>
    );
  }

  return (
    <Button
      appearance="subtle"
      /* @ts-expect-error -- block要素にするのが目的。期待通りの動作をしているため無視。本来はaかbuttonのみ許容するよう。 */
      as="div"
      className={styles.root}
      onDoubleClick={(): void => setIsEditing(true)}
      shape="square"
      style={{
        lineHeight: "24px",
        padding: 0,
        margin: 0,
        minWidth: "auto",
      }}
    >
      {title}
    </Button>
  );
};
