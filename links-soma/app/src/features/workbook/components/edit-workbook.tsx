import {
  Button,
  makeStyles,
  mergeClasses,
  tokens,
  Tooltip,
} from "@fluentui/react-components";
import { PanelLeftExpand24Regular } from "@fluentui/react-icons";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useFetchWorkbook } from "../hooks/use-fetch-workbook";
import { ROUTES } from "../../../shared/config/routes";
import { tutorialStore, useTutorial } from "../../../shared/tutorial/store";
import { SidebarEditResultView } from "../../bi/components";
import { useWorkbookIdsSearchQuery } from "../../bi/hooks";
import { BreadcrumbBase, BreadcrumbItem } from "../../../shared/components/ui";
import { TabListEditResultSheet } from "./tab-list-edit-result-sheet";
import { PreviewResultSheet } from "./preview-result-sheet";
import { ButtonSaveTemplate } from "./button-save-template";

const useStyles = makeStyles({
  root: {
    overflow: "hidden",
    display: "flex",
  },
  heading: {
    fontSize: tokens.fontSizeBase400,
    lineHeight: tokens.lineHeightBase600,
    fontWeight: tokens.fontWeightSemibold,
  },
  content: {
    flex: "1",
    padding: tokens.spacingHorizontalXXL,
    backgroundColor: tokens.colorNeutralBackground3,
    minHeight: "100vh",
    display: "flex",
    flexFlow: "column",
    gap: `${tokens.spacingVerticalXXL} ${tokens.spacingHorizontalXXL}`,
  },
  // サイドバーは position:fixed で content 上に重なるため、開いている間だけ
  // 幅(320px)分を左パディングで空ける。閉じたら詰めて表示エリアを広げる（#1783）。
  contentOpen: {
    paddingLeft: `calc(320px + ${tokens.spacingHorizontalXXL})`,
  },
  sidebar: {
    minWidth: "320px", // 現状チャート部分は無限に拡大するため、最小値を設定
    position: "fixed",
  },
  // 閉じると InlineDrawer は幅0になる。fixed ラッパの minWidth を解除して
  // 左端に空の当たり判定が残らないようにする。
  sidebarClosed: {
    minWidth: 0,
  },
  // パンくずと開くボタンを並べる先頭行。開くボタンは content フロー内に置き、
  // グローバル左ナビ帯（fixed）と重ならない予測可能な左上位置に固定する。
  topBar: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
  },
});

export const EditWorkbook = (): JSX.Element => {
  const styles = useStyles();
  const { phase, stage } = useTutorial();
  const { workbookId, sheetId } = useWorkbookIdsSearchQuery();
  const [searchParams] = useSearchParams();
  const viewId = searchParams.get("viewId");

  // ビュー設定サイドバーの開閉。閉じると表示エリア（地図/表）が左端まで広がる（#1783）。
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // ガイド進行中のみ: 分析stageで開いた workbook/sheet/view を resume 情報に記録する。
  // 完了は進行ポップオーバーの「完了」ボタンで明示的に行う。任意の WB 表示で完了 Dialog が
  // 誤発火する旧 useEffect は廃止した（ダイアログ既定クローズ・誤発火排除, ADR-0024）。
  useEffect(() => {
    if (phase !== "running" || stage !== "analysis" || workbookId == null) {
      return;
    }
    tutorialStore.setResumeState({
      stage: "analysis",
      workbookId: Number(workbookId),
      sheetId: sheetId != null ? Number(sheetId) : null,
      viewId: viewId != null ? Number(viewId) : null,
    });
  }, [phase, stage, workbookId, sheetId, viewId]);

  return (
    <div className={styles.root}>
      <div
        className={mergeClasses(
          styles.sidebar,
          !isSidebarOpen && styles.sidebarClosed,
        )}
      >
        <SidebarEditResultView
          onClose={() => setIsSidebarOpen(false)}
          open={isSidebarOpen}
        />
      </div>
      <Content
        isSidebarOpen={isSidebarOpen}
        onOpenSidebar={() => setIsSidebarOpen(true)}
      />
    </div>
  );
};

function Content({
  isSidebarOpen,
  onOpenSidebar,
}: {
  isSidebarOpen: boolean;
  onOpenSidebar: () => void;
}): JSX.Element {
  const styles = useStyles();

  const { workbookId, sheetId } = useWorkbookIdsSearchQuery();

  const { data: workbook } = useFetchWorkbook({ id: Number(workbookId) });

  return (
    <div
      className={mergeClasses(
        styles.content,
        isSidebarOpen && styles.contentOpen,
      )}
    >
      <div className={styles.topBar}>
        {!isSidebarOpen && (
          <Tooltip content="ビューの設定を開く" relationship="label">
            <Button
              appearance="subtle"
              aria-label="ビューの設定を開く"
              icon={<PanelLeftExpand24Regular />}
              onClick={onOpenSidebar}
            />
          </Tooltip>
        )}
        <BreadcrumbBase
          breadcrumbItem={[
            {
              children: "分析",
              href: ROUTES.ANALYSIS.WORKBOOK,
            },
            {
              children: "詳細",
              href: ROUTES.ANALYSIS.WORKBOOK_DETAIL(workbookId),
            },
            {
              children: "編集",
              current: true,
              href: ROUTES.ANALYSIS.WORKBOOK_EDIT({
                id: workbookId,
              }),
            },
          ].map((item) => (
            <BreadcrumbItem key={item.href} {...item} />
          ))}
        />
      </div>
      <h2 className={styles.heading}>{workbook?.title}</h2>
      {workbook && (
        <TabListEditResultSheet sheetId={sheetId} workbookId={workbook.id} />
      )}
      {/* シートタブ直下・ビュー一覧直上: 現シートのビュー群をテンプレ保存（FR021）
          key=sheetId: シート切替で再マウントし baselineSig 等の state をリセット（変更検知の基準を新シートに合わせる） */}
      {sheetId && <ButtonSaveTemplate key={sheetId} sheetId={sheetId} />}
      <div>{sheetId && <PreviewResultSheet sheetId={sheetId} />}</div>
    </div>
  );
}
