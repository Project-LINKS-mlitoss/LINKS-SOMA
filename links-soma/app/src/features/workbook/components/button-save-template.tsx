/**
 * 現在のシートのビュー群を「テンプレートとして保存」するボタン + 命名ダイアログ（FR021 名前付き保存）。
 *
 * 配置はシートタブ直下・ビュー一覧直上（ユーザー指定の導線）。保存後は「ビューを追加」ダイアログの
 * 一覧（kind=user）に現れ、別シート・別ワークブックから再適用できる。
 * 保存単位はシート内の全ビュー（result_views から sheet_id / data_set_result_id を抜いた定義）。
 *
 * UX 上の要点（FB 対応）:
 * - 保存ボタンは「読込/前回保存からビュー設定が変わったとき」だけ有効（無変更の再保存を防ぐ）。
 * - 保存後はダイアログを即閉じず成功表示を残す（Gulf of Evaluation を埋める。Norman 1988）。
 * - 名前・説明の入力体裁は編集ダイアログと TemplateFormFields で共有する。
 */

import { useEffect, useState } from "react";
import {
  makeStyles,
  Dialog,
  DialogTrigger,
  tokens,
} from "@fluentui/react-components";
import {
  SaveRegular,
  Dismiss24Regular,
  CheckmarkCircleFilled,
} from "@fluentui/react-icons";
import {
  Button,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
} from "../../../shared/components/ui";
import { lang } from "../../../shared/config/lang";
import { THEME_COLORS } from "../../../shared/config/theme-colors";
import { rendererLogger } from "../../../shared/utils/renderer-logger";
import { useFetchResultViews } from "../../../shared/hooks/use-fetch-result-views";
import { useFetchViewTemplates } from "../../bi/hooks";
import {
  TemplateFormFields,
  type TemplateFormValues,
} from "./template-form-fields";

const t = lang.components["view-preset"];

const useStyles = makeStyles({
  button: {
    // 独立行のまま右端へ寄せる。タブ行に置くとタブが保存対象に見える誤解を避けるため、
    // ビュー一覧直上の補助操作として右端に控えめに置く（Utility Navigation）。
    alignSelf: "flex-end",
  },
  content: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalM,
  },
  // 既存の完了バナー（job/detail の ml/preprocess/result）と同じトーンに揃える。
  // 背景は淡ティント、前景（アイコン・文字）に成功色を寄せる（THEME_COLORS が SSOT）。
  successBanner: {
    display: "flex",
    gap: tokens.spacingHorizontalS,
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalL}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: THEME_COLORS.successBackground,
    color: THEME_COLORS.success,
  },
  successIcon: {
    flexShrink: 0,
    fontSize: "20px",
    marginTop: "2px",
  },
  successTitle: {
    fontWeight: tokens.fontWeightSemibold,
  },
});

/** 保存対象ビューから、テンプレ定義に含まれる項目だけを安定した署名文字列にする（変更検知用）。 */
const signViews = (
  views: {
    title: string;
    unit: string;
    style: string;
    layoutIndex: number;
    parameters: unknown;
  }[],
): string =>
  JSON.stringify(
    views.map((v) => ({
      title: v.title,
      unit: v.unit,
      style: v.style,
      layoutIndex: v.layoutIndex,
      parameters: v.parameters,
    })),
  );

export const ButtonSaveTemplate = ({
  sheetId,
}: {
  sheetId: string | number | null | undefined;
}): JSX.Element => {
  const styles = useStyles();
  const { data: resultViews } = useFetchResultViews({
    sheetId: sheetId != null ? Number(sheetId) : null,
  });
  const { mutate } = useFetchViewTemplates();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<TemplateFormValues>({
    name: "",
    description: "",
  });
  const [saving, setSaving] = useState(false);
  // 保存完了後にダイアログ内へ残す成功表示（null=未保存）。
  const [savedName, setSavedName] = useState<string | null>(null);
  // 「変更があったか」の基準。読込時と保存成功時に現在の署名へ更新する。
  const [baselineSig, setBaselineSig] = useState<string | null>(null);

  // テンプレートは unit/style が確定したビューのみ保存対象（schema 検証を満たすため）。
  const validViews = (resultViews ?? [])
    .filter((v) => v.unit && v.style)
    .map((v, index) => ({
      title: v.title ?? "",
      unit: v.unit as "building" | "area",
      style: v.style as NonNullable<typeof v.style>,
      layoutIndex: v.layoutIndex ?? index + 1,
      parameters: v.parameters,
    }));
  const currentSig = signViews(validViews);

  // 読込完了時に基準署名を確定（以降の編集で「変更あり」になる）。
  useEffect(() => {
    if (resultViews != null && baselineSig == null) {
      setBaselineSig(currentSig);
    }
  }, [resultViews, baselineSig, currentSig]);

  const hasViews = validViews.length > 0;
  const isDirty = baselineSig != null && currentSig !== baselineSig;
  // 保存できるのは「保存対象があり」「読込/前回保存から変更があった」とき。
  const canSave = hasViews && isDirty;

  const resetDialog = (): void => {
    setOpen(false);
    setForm({ name: "", description: "" });
    setSavedName(null);
  };

  const handleSave = async (): Promise<void> => {
    if (!form.name.trim() || !canSave) return;
    setSaving(true);
    try {
      await window.ipcRenderer.invoke("insertViewTemplate", {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        views: validViews,
      });
      await mutate();
      // 保存した内容を新しい基準にして、無変更での再保存を無効化。
      setBaselineSig(currentSig);
      setSavedName(form.name.trim());
    } catch (error) {
      rendererLogger.error("View template save failed", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      onOpenChange={(_, data) => {
        if (data.open) {
          setOpen(true);
        } else {
          resetDialog();
        }
      }}
      open={open}
    >
      <DialogTrigger disableButtonEnhancement>
        <Button
          className={styles.button}
          disabled={!canSave}
          icon={<SaveRegular fontSize={16} />}
          size="small"
          title={canSave ? undefined : hasViews ? t.saveNoChanges : t.saveEmpty}
        >
          {t.saveButton}
        </Button>
      </DialogTrigger>
      <DialogSurface>
        <DialogBody>
          <DialogTitle
            action={
              <DialogTrigger action="close">
                <Button
                  appearance="subtle"
                  aria-label={t.close}
                  icon={<Dismiss24Regular />}
                />
              </DialogTrigger>
            }
          >
            {t.saveDialogTitle}
          </DialogTitle>
          <DialogContent className={styles.content}>
            {savedName != null ? (
              <div className={styles.successBanner}>
                <CheckmarkCircleFilled className={styles.successIcon} />
                <div>
                  <div className={styles.successTitle}>
                    {t.saveSuccess.replace("{name}", savedName)}
                  </div>
                  <div>{t.saveSuccessHint}</div>
                </div>
              </div>
            ) : (
              <TemplateFormFields onChange={setForm} values={form} />
            )}
          </DialogContent>
          <DialogActions>
            {savedName != null ? (
              <Button appearance="primary" onClick={resetDialog}>
                {t.close}
              </Button>
            ) : (
              <>
                <Button appearance="outline" onClick={resetDialog}>
                  {t.cancel}
                </Button>
                <Button
                  appearance="primary"
                  disabled={!form.name.trim() || !canSave || saving}
                  onClick={handleSave}
                >
                  {t.save}
                </Button>
              </>
            )}
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
};
