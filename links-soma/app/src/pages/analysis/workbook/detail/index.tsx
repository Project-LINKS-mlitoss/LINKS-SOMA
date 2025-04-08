import {
  EditFilled,
  DeleteRegular,
  Dismiss24Regular,
} from "@fluentui/react-icons";
import { Suspense, useEffect } from "react";
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogSurface,
  DialogTitle,
  DialogTrigger,
  makeStyles,
  TabList,
  tokens,
} from "@fluentui/react-components";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "../../../../components/ui/button";
import { useFetchWorkbook } from "../../../../hooks/use-fetch-workbook";
import { useFetchResultSheets } from "../../../../hooks/use-fetch-result-sheets";
import { useTabs } from "../../../../hooks/use-tabs";
import { ResultSheet } from "../../../../components/result-sheet";
import { Tab } from "../../../../components/ui/tab";
import { DialogContent } from "../../../../components/ui/dialog-content";
import {
  BreadcrumbBase,
  BreadcrumbItem,
} from "../../../../components/ui/breadcrumb";
import { ROUTES, withHash } from "../../../../routes";

const useStyles = makeStyles({
  root: {
    display: "grid",
    gap: `${tokens.spacingVerticalXXL} ${tokens.spacingHorizontalXXL}`,
  },
  heading: {
    fontSize: tokens.fontSizeBase500,
    lineHeight: tokens.lineHeightBase600,
  },
  buttons: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalM,
  },
  resultSheets: {
    padding: 0,
  },
  headingWithAction: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  tabList: {
    gap: tokens.spacingHorizontalM,
  },
  button: {
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    "&:hover, &:active, &:focus, &:focus-within": {
      border: `1px solid ${tokens.colorNeutralStroke1Selected}`,
    },
  },
});

export function DetailWorkbook(): JSX.Element {
  const styles = useStyles();
  const { id } = useParams();
  const { data: workbook } = useFetchWorkbook({ id: Number(id) });
  const { data: resultSheets } = useFetchResultSheets({
    workbookId: Number(id),
  });
  const { onTabSelect, selectedValue, setSelectedValue } = useTabs();

  useEffect(() => {
    setSelectedValue(resultSheets?.[0]?.id);
  }, [resultSheets, setSelectedValue]);

  return (
    <div className={styles.root}>
      <BreadcrumbBase
        breadcrumbItem={[
          {
            href: ROUTES.ANALYSIS.WORKBOOK,
            children: "分析",
          },
          {
            href: ROUTES.ANALYSIS.WORKBOOK_DETAIL(id || ""),
            current: true,
            children: workbook?.title ?? "詳細",
          },
        ].map((item) => (
          <BreadcrumbItem key={item.href} {...item} />
        ))}
      />
      <div className={styles.headingWithAction}>
        <h2 className={styles.heading}>{workbook?.title}</h2>
        <div className={styles.buttons}>
          <a
            href={withHash(
              ROUTES.ANALYSIS.WORKBOOK_EDIT({
                id: id || "",
              }),
            )}
          >
            <Button
              appearance="outline"
              className={styles.button}
              icon={<EditFilled />}
              shape="square"
            />
          </a>
          <DeleteWorkbookButton workbookId={workbook?.id} />
        </div>
      </div>

      {selectedValue ? (
        <TabList
          className={styles.tabList}
          onTabSelect={onTabSelect}
          selectedValue={selectedValue}
        >
          {resultSheets?.map((item) => (
            <Tab key={item.id} id={item.title || ""} value={item.id}>
              {item.title}
            </Tab>
          ))}
        </TabList>
      ) : null}
      <div>
        {resultSheets?.map((item) => (
          <div
            key={item.id}
            className={styles.resultSheets}
            hidden={selectedValue !== item.id}
          >
            <Suspense>
              <ResultSheet sheetId={item.id} />
            </Suspense>
          </div>
        ))}
      </div>
    </div>
  );
}

function DeleteWorkbookButton({
  workbookId,
}: {
  workbookId: number | undefined;
}): JSX.Element {
  const navigate = useNavigate();
  const styles = useStyles();

  const handleDelete = async (): Promise<void> => {
    const deleteWorkbook = (): Promise<void> =>
      window.ipcRenderer.invoke("deleteWorkbook", {
        workbookId,
      });

    await deleteWorkbook()
      .then(() => {
        navigate("/analysis/workbook");
      })
      .catch(console.error);
  };

  return (
    <Dialog>
      <DialogTrigger disableButtonEnhancement>
        <Button
          appearance="outline"
          className={styles.button}
          icon={<DeleteRegular />}
          shape="square"
        />
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
            ワークブックを削除しますか？
          </DialogTitle>
          <DialogContent>削除したワークブックはもとに戻せません</DialogContent>
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
  );
}
