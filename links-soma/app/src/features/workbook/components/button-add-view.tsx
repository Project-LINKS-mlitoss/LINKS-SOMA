/**
 * 「ビューを追加」統合ボタン + 2 ステップダイアログ（FR021 要件 #1-3, #5-6）。
 *
 * 設計（issue #1763 ①B / ASCII モック / 要件確定 YAML open_points A=後続2ステップ, C/E=統合）に準拠:
 * - 入口は「ビューを追加」1 ボタンに統合。押下でダイアログを開く。
 * - Step1「何を追加」: 「空から作る」+ プリセットを #1763 ASCII モックのカードグリッドで並べる。
 *   各カードは名前 + memo（業務的意図）+ ビュー数。「空から作る」カードのみ幅狭（束ではないため）。
 * - Step2「データ選択」: 「空から作る」・プリセットとも共通。既存「データセットを選択」
 *   (edit-result-view-fields) と同じ Field + Select を踏襲。要件 R2/R6「同一の任意の推定結果データ」を満たす。
 *   「空から作る」は選んだデータで空ビューを 1 つ作り、編集画面へ遷移して種別・パラメータを設定する。
 */

import { useEffect, useRef, useState } from "react";
import {
  makeStyles,
  mergeClasses,
  tokens,
  Dialog,
  DialogTrigger,
  Card,
  Field,
  Select,
  Spinner,
  Text,
  Tooltip,
  Menu,
  MenuTrigger,
  MenuPopover,
  MenuList,
  MenuItem,
} from "@fluentui/react-components";
import {
  AddFilled,
  Dismiss24Regular,
  MoreHorizontalRegular,
  EditRegular,
  DeleteRegular,
} from "@fluentui/react-icons";
import { useNavigate } from "react-router-dom";
import {
  Button,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
} from "../../../shared/components/ui";
import { lang } from "../../../shared/config/lang";
import { ROUTES } from "../../../shared/config/routes";
import { useFetchResultViews } from "../../../shared/hooks/use-fetch-result-views";
import { useFetchDataSetResults } from "../../dataset/hooks/use-fetch-data-set-results";
import {
  useFetchViewTemplates,
  useWorkbookIdsSearchQuery,
} from "../../bi/hooks";
import { TemplateFormFields } from "./template-form-fields";

const t = lang.components["view-preset"];

/** Step1 で「空から作る」を選んだことを表す番兵値（プリセット id と衝突しない） */
const BLANK_OPTION = "__blank__";

const useStyles = makeStyles({
  button: {
    border: `1px dashed ${tokens.colorNeutralStroke2}`,
    padding: tokens.spacingHorizontalL,
    margin: `${tokens.spacingVerticalM} 0`,
  },
  surface: {
    maxWidth: "640px",
  },
  cardGrid: {
    // 形を揃えるため flex-wrap でなく Grid。全カード同幅 + 行ごとに同高（align stretch）。
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: tokens.spacingHorizontalM,
    marginTop: tokens.spacingVerticalS,
  },
  card: {
    cursor: "pointer",
    // タイトル長・memo 行数の差を吸収して最小高さを統一（不揃い防止）。
    minHeight: "168px",
    gap: tokens.spacingVerticalXS,
    // ユーザーテンプレの操作メニューを右上に重ねるための基準。
    position: "relative",
  },
  cardMenu: {
    position: "absolute",
    top: tokens.spacingVerticalXS,
    right: tokens.spacingHorizontalXS,
  },
  editContent: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalM,
  },
  cardBlank: {
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
  },
  cardSelected: {
    border: `2px solid ${tokens.colorBrandStroke1}`,
  },
  cardTitle: {
    // Badge にインライン圧迫されないようタイトルは独立行・全幅。
    display: "block",
  },
  memo: {
    flexGrow: 1,
    color: tokens.colorNeutralForeground3,
  },
  // テンプレ説明: ユーザーが入れた改行を活かし（pre-line）、長文は 4 行でクランプ。
  // 省略時のみ全文を Tooltip で見せる（ClampedDescription が overflow を検出）。
  // flexGrow は付けない: 付けるとボックスが縦に伸び、-webkit-line-clamp の高さ制約が
  // 無効化されて全文が出てしまう。フッターは cardFooter の marginTop:auto で下端固定済み。
  // maxHeight は pre-line の明示改行でクランプが緩む場合の保険（4 行ぶんで硬くクリップ）。
  description: {
    color: tokens.colorNeutralForeground3,
    whiteSpace: "pre-line",
    lineHeight: tokens.lineHeightBase200,
    maxHeight: `calc(${tokens.lineHeightBase200} * 4)`,
    display: "-webkit-box",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: 4,
    overflow: "hidden",
  },
  cardFooter: {
    marginTop: "auto",
    paddingTop: tokens.spacingVerticalXS,
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    color: tokens.colorNeutralForeground3,
  },
  select: {
    width: "100%",
  },
});

/**
 * テンプレ説明テキスト。4 行クランプし、はみ出したカードだけ hover で全文 Tooltip を出す。
 * 省略が起きていないカードに冗長な Tooltip を付けないよう、描画後に overflow を実測する。
 */
const ClampedDescription = ({
  text,
  className,
}: {
  text: string;
  className: string;
}): JSX.Element => {
  const ref = useRef<HTMLSpanElement>(null);
  const [truncated, setTruncated] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (el) setTruncated(el.scrollHeight > el.clientHeight + 1);
  }, [text]);

  const node = (
    <Text ref={ref} className={className} size={200}>
      {text}
    </Text>
  );

  if (!truncated) return node;
  return (
    <Tooltip
      content={<div style={{ whiteSpace: "pre-line" }}>{text}</div>}
      relationship="description"
      withArrow
    >
      {node}
    </Tooltip>
  );
};

export const ButtonAddView = (): JSX.Element => {
  const styles = useStyles();
  const navigate = useNavigate();
  const { workbookId, sheetId } = useWorkbookIdsSearchQuery();
  const {
    data: templates,
    isLoading,
    mutate: mutateTemplates,
  } = useFetchViewTemplates();
  const { data: dataSetResults } = useFetchDataSetResults();
  const { data: resultViews, mutate } = useFetchResultViews({
    sheetId: Number(sheetId),
  });

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"choose" | "data">("choose");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // データは最新（先頭）を初期選択。要件 R2「任意の」はユーザーが変更できることで満たす。
  const [selectedDataId, setSelectedDataId] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  // ユーザーテンプレートの編集（名前・説明。このダイアログ内で完結）。
  const [editTarget, setEditTarget] = useState<{
    dbId: number;
    name: string;
    description: string;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);

  const isBlank = selectedId === BLANK_OPTION;
  const isMaxViewLength = !!resultViews && resultViews.length >= 8;

  const reset = (): void => {
    setOpen(false);
    setStep("choose");
    setSelectedId(null);
    setSelectedDataId(null);
  };

  // 「空から作る」: 選んだデータで空ビューを 1 つ作り、編集画面へ遷移して種別・パラメータを設定する。
  const handleCreateBlank = async (dataSetResultId: number): Promise<void> => {
    if (!resultViews) return;
    setApplying(true);
    try {
      const { insertedId } = await window.ipcRenderer.invoke(
        "insertResultViews",
        {
          data_set_result_id: dataSetResultId,
          sheet_id: Number(sheetId),
          layoutIndex: resultViews.length + 1,
          parameters: [],
        },
      );
      await mutate();
      reset();
      navigate(
        ROUTES.ANALYSIS.WORKBOOK_EDIT({
          id: workbookId,
          queryParams: { sheetId, viewId: insertedId },
        }),
      );
    } finally {
      setApplying(false);
    }
  };

  // Step1 の主ボタン: 空・プリセットとも Step2（データ選択）へ進む。
  const handlePrimaryChoose = (): void => {
    if (!selectedId) return;
    setSelectedDataId(
      dataSetResults?.[0]?.id != null ? String(dataSetResults[0].id) : null,
    );
    setStep("data");
  };

  // Step2 の主ボタン: 選んだデータで空ビュー作成（空から作る）またはプリセット複製挿入。
  const handleApply = async (): Promise<void> => {
    if (!selectedId || selectedDataId == null) return;
    if (isBlank) {
      await handleCreateBlank(Number(selectedDataId));
      return;
    }
    setApplying(true);
    try {
      await window.ipcRenderer.invoke("applyViewTemplate", {
        sheetId: Number(sheetId),
        dataSetResultId: Number(selectedDataId),
        templateId: selectedId,
      });
      await mutate();
      reset();
    } finally {
      setApplying(false);
    }
  };

  // テンプレート id "user:<dbId>" から DB の数値 id を取り出す。
  const parseUserDbId = (id: string): number => Number(id.replace("user:", ""));

  // ユーザーテンプレートの名前・説明の編集（FR021 名前付き保存の更新側）。
  // 説明は空入力で消去（null）できる。
  const handleEditSave = async (): Promise<void> => {
    if (!editTarget || !editTarget.name.trim()) return;
    await window.ipcRenderer.invoke("updateViewTemplate", {
      id: editTarget.dbId,
      name: editTarget.name.trim(),
      description: editTarget.description.trim() || null,
    });
    await mutateTemplates();
    setEditTarget(null);
  };

  // ユーザーテンプレートの削除。選択中だった場合は選択も解除する。
  const handleDelete = async (): Promise<void> => {
    if (deleteTarget == null) return;
    await window.ipcRenderer.invoke("deleteViewTemplate", { id: deleteTarget });
    await mutateTemplates();
    if (selectedId === `user:${deleteTarget}`) setSelectedId(null);
    setDeleteTarget(null);
  };

  // カードのキーボード操作（Enter / Space で選択）。role=radio の標準挙動に合わせる。
  const handleCardKeyDown = (e: React.KeyboardEvent, value: string): void => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setSelectedId(value);
    }
  };

  return (
    <>
      <Button
        className={styles.button}
        disabled={isMaxViewLength}
        icon={<AddFilled fontSize={16} />}
        onClick={() => setOpen(true)}
        shape="rounded"
      >
        {t.addButton}
      </Button>
      <Dialog
        onOpenChange={(_, data) => (data.open ? setOpen(true) : reset())}
        open={open}
      >
        <DialogSurface className={styles.surface}>
          <DialogBody>
            <DialogTitle
              action={
                <DialogTrigger action="close">
                  <Button
                    appearance="subtle"
                    aria-label={t.close}
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
              {step === "choose" ? t.dialogTitle : t.dataStepTitle}
            </DialogTitle>
            <DialogContent>
              {step === "choose" ? (
                isLoading ? (
                  <Spinner label={t.loading} />
                ) : (
                  <div
                    aria-label={t.dialogTitle}
                    className={styles.cardGrid}
                    role="radiogroup"
                  >
                    <Card
                      aria-checked={isBlank}
                      className={mergeClasses(
                        styles.card,
                        styles.cardBlank,
                        isBlank && styles.cardSelected,
                      )}
                      onClick={() => setSelectedId(BLANK_OPTION)}
                      onKeyDown={(e) => handleCardKeyDown(e, BLANK_OPTION)}
                      role="radio"
                      tabIndex={0}
                    >
                      <AddFilled fontSize={24} />
                      <Text weight="semibold">{t.blankOption}</Text>
                      <Text className={styles.memo} size={200}>
                        {t.blankMemo}
                      </Text>
                    </Card>
                    {templates?.map((template) => (
                      <Card
                        key={template.id}
                        aria-checked={selectedId === template.id}
                        className={mergeClasses(
                          styles.card,
                          selectedId === template.id && styles.cardSelected,
                        )}
                        onClick={() => setSelectedId(template.id)}
                        onKeyDown={(e) => handleCardKeyDown(e, template.id)}
                        role="radio"
                        tabIndex={0}
                      >
                        <Text className={styles.cardTitle} weight="semibold">
                          {template.name}
                        </Text>
                        {template.description && (
                          <ClampedDescription
                            className={styles.description}
                            text={template.description}
                          />
                        )}
                        <Text className={styles.cardFooter} size={200}>
                          {`${template.views.length} ${t.viewsUnit} ・ ${
                            template.kind === "system"
                              ? t.kindSystem
                              : t.kindUser
                          }`}
                        </Text>
                        {template.kind === "user" && (
                          // 保存済みテンプレのみ編集可。カード選択と競合しないよう伝播を止める。
                          <div
                            className={styles.cardMenu}
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                            role="presentation"
                          >
                            <Menu>
                              <MenuTrigger disableButtonEnhancement>
                                <Button
                                  appearance="subtle"
                                  aria-label={t.templateActions}
                                  icon={<MoreHorizontalRegular />}
                                  size="small"
                                />
                              </MenuTrigger>
                              <MenuPopover>
                                <MenuList>
                                  <MenuItem
                                    icon={<EditRegular />}
                                    onClick={() =>
                                      setEditTarget({
                                        dbId: parseUserDbId(template.id),
                                        name: template.name,
                                        description: template.description ?? "",
                                      })
                                    }
                                  >
                                    {t.rename}
                                  </MenuItem>
                                  <MenuItem
                                    icon={<DeleteRegular />}
                                    onClick={() =>
                                      setDeleteTarget(
                                        parseUserDbId(template.id),
                                      )
                                    }
                                  >
                                    {t.deleteTemplate}
                                  </MenuItem>
                                </MenuList>
                              </MenuPopover>
                            </Menu>
                          </div>
                        )}
                      </Card>
                    ))}
                  </div>
                )
              ) : dataSetResults == null || dataSetResults.length === 0 ? (
                <Text className={styles.memo}>{t.noDataSetResult}</Text>
              ) : (
                <Field label={t.dataSelectLabel}>
                  <Select
                    className={styles.select}
                    onChange={(_, data) => setSelectedDataId(data.value)}
                    value={selectedDataId ?? ""}
                  >
                    {dataSetResults.map((result) => (
                      <option key={result.id} value={String(result.id)}>
                        {result.title || t.dataUntitled}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
            </DialogContent>
            <DialogActions>
              {step === "choose" ? (
                <>
                  <Button appearance="outline" onClick={reset}>
                    {t.cancel}
                  </Button>
                  <Button
                    appearance="primary"
                    disabled={!selectedId || applying}
                    onClick={handlePrimaryChoose}
                  >
                    {t.next}
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    appearance="outline"
                    onClick={() => setStep("choose")}
                  >
                    {t.back}
                  </Button>
                  <Button
                    appearance="primary"
                    disabled={selectedDataId == null || applying}
                    onClick={handleApply}
                  >
                    {t.apply}
                  </Button>
                </>
              )}
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      {/* ユーザーテンプレートの名前・説明の編集（保存ダイアログとフォーム共有） */}
      <Dialog
        onOpenChange={(_, data) => {
          if (!data.open) setEditTarget(null);
        }}
        open={editTarget != null}
      >
        <DialogSurface>
          <DialogBody>
            <DialogTitle>{t.renameTitle}</DialogTitle>
            <DialogContent className={styles.editContent}>
              {editTarget != null && (
                <TemplateFormFields
                  onChange={(values) =>
                    setEditTarget((prev) =>
                      prev ? { ...prev, ...values } : prev,
                    )
                  }
                  values={{
                    name: editTarget.name,
                    description: editTarget.description,
                  }}
                />
              )}
            </DialogContent>
            <DialogActions>
              <Button appearance="outline" onClick={() => setEditTarget(null)}>
                {t.cancel}
              </Button>
              <Button
                appearance="primary"
                disabled={!editTarget?.name.trim()}
                onClick={handleEditSave}
              >
                {t.renameSave}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      {/* ユーザーテンプレートの削除確認 */}
      <Dialog
        onOpenChange={(_, data) => {
          if (!data.open) setDeleteTarget(null);
        }}
        open={deleteTarget != null}
      >
        <DialogSurface>
          <DialogBody>
            <DialogTitle>{t.deleteConfirmTitle}</DialogTitle>
            <DialogContent>{t.deleteConfirmBody}</DialogContent>
            <DialogActions>
              <Button
                appearance="outline"
                onClick={() => setDeleteTarget(null)}
              >
                {t.cancel}
              </Button>
              <Button appearance="primary" onClick={handleDelete}>
                {t.delete}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </>
  );
};
