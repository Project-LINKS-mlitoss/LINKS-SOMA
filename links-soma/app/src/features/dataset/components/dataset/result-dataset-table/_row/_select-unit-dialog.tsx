import {
  Dialog,
  Field,
  Radio,
  RadioGroup,
  DialogTrigger,
  tokens,
  makeStyles,
} from "@fluentui/react-components";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DialogBody } from "../../../../../../shared/components/ui/dialog-body";
import { DialogTitle } from "../../../../../../shared/components/ui/dialog-title";
import { DialogContent } from "../../../../../../shared/components/ui/dialog-content";
import { DialogActions } from "../../../../../../shared/components/ui/dialog-actions";
import { DialogSurface } from "../../../../../../shared/components/ui/dialog-surface";
import { Button } from "../../../../../../shared/components/ui/button";
import { type ResultDataSetUnit } from "../types";
import { ROUTES } from "../../../../../../shared/config/routes";

const useStyles = makeStyles({
  datasetButton: {
    padding: 0,
    justifyContent: "flex-start",
    color: tokens.colorBrandForeground1,
    textDecoration: "underline",
    borderRadius: 0,
    textAlign: "left",
    maxWidth: "100%",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    display: "block",
    "&:hover": {
      textDecoration: "none",
    },
  },
  radioGroup: {
    marginTop: tokens.spacingVerticalM,
    marginLeft: "-8px",
  },
});

export function SelectUnitDialog({
  datasetName,
  dataSetResultId,
  onPreviewSelect,
}: {
  datasetName: string | null;
  dataSetResultId: number;
  onPreviewSelect: () => void;
}): JSX.Element {
  const styles = useStyles();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const [selectedUnit, setSelectedUnit] =
    useState<ResultDataSetUnit>("building");

  return (
    <Dialog
      onOpenChange={(e) => {
        e.stopPropagation();
        setOpen((prev) => !prev);
      }}
      open={open}
    >
      <DialogTrigger disableButtonEnhancement>
        <Button
          appearance="transparent"
          className={styles.datasetButton}
          onClick={(e) => {
            e.stopPropagation();
            onPreviewSelect();
          }}
          title={datasetName ?? undefined}
        >
          {datasetName}
        </Button>
      </DialogTrigger>
      <DialogSurface onClick={(e) => e.stopPropagation()}>
        <DialogBody>
          <DialogTitle>データのプレビュー</DialogTitle>
          <DialogContent>
            <p>
              空き家推定結果データは以下の2つのデータが含まれます。
              どちらか選択してください。
            </p>
            <Field className={styles.radioGroup}>
              <RadioGroup
                defaultValue="building"
                onChange={(_, data) => {
                  setSelectedUnit(data.value as ResultDataSetUnit);
                }}
              >
                <Radio label="建物単位" value="building" />
                <Radio label="地域単位" value="area" />
              </RadioGroup>
            </Field>
          </DialogContent>
          <DialogActions>
            <Button
              appearance="primary"
              onClick={() => {
                setOpen(false);
                navigate(
                  ROUTES.DATASET({
                    queryParams: {
                      tab: "result",
                      previewType: selectedUnit,
                      previewId: String(dataSetResultId),
                    },
                  }),
                );
              }}
              size="medium"
            >
              プレビューを見る
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
