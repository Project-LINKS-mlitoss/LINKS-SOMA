import { makeStyles, mergeClasses, tokens } from "@fluentui/react-components";
import { ArrowLeftRegular } from "@fluentui/react-icons";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "../../../../components/ui/button";
import { useFetchJobs } from "../../../../hooks/use-fetch-jobs";
import { ErrorJobTaskInfo } from "../../../../components/error-job-task-info";
import {
  BreadcrumbBase,
  BreadcrumbItem,
} from "../../../../components/ui/breadcrumb";
import { ROUTES } from "../../../../routes";

const useStyles = makeStyles({
  root: {
    display: "grid",
    gap: tokens.spacingVerticalXXL,
  },
  pageContainer: {
    display: "flex",
    flexDirection: "column",
    minHeight: "calc(100vh - 48px)",
    justifyContent: "space-between",
  },
  heading: {
    fontSize: tokens.fontSizeBase500,
    lineHeight: tokens.lineHeightBase600,
    display: "flex",
    width: "fit-content",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
  },
  result: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalL}`,
    backgroundColor: "#ecf2ef",
    borderRadius: tokens.borderRadiusSmall,
  },
  info: {
    backgroundColor: "#ecf2ef",
    color: "#09583B",
  },
  error: {
    backgroundColor: "rgba(196, 49, 75, 0.08)",
    color: "rgb(196, 49, 75)",
  },
  restartButtonWrapper: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    backgroundColor: "#fff",
    height: "68px",
    width: "100%",
    padding: tokens.spacingHorizontalXXL,
  },
});

export function ResultDetail(): JSX.Element {
  const styles = useStyles();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { data: job } = useFetchJobs(Number(id));

  const isError = job && job[0].status === "error";

  const handleBack = (): void => {
    navigate(-1);
  };

  return (
    <div className={styles.pageContainer}>
      <div className={styles.root}>
        <BreadcrumbBase
          breadcrumbItem={[
            {
              children: "処理一覧",
              href: ROUTES.JOB.ROOT,
            },
            {
              children: "処理結果 - 推定結果",
              current: true,
              href: ROUTES.JOB.DETAIL_RESULT(id || ""),
            },
          ].map((item) => (
            <BreadcrumbItem key={item.href} {...item} />
          ))}
        />
        <h2 className={styles.heading}>
          <Button
            appearance="subtle"
            icon={<ArrowLeftRegular />}
            onClick={handleBack}
          />
          処理結果
        </h2>

        <div
          className={mergeClasses(
            styles.result,
            isError ? styles.error : styles.info,
          )}
        >
          <span>
            {isError
              ? "空き家推定に失敗しました。"
              : "処理が完了しました。推定結果はデータセット>空き家推定結果データタブから確認できます。"}
          </span>
          {id && <ErrorJobTaskInfo jobId={Number(id)} />}
        </div>
      </div>
      <div className={styles.restartButtonWrapper}>
        <Button appearance="primary" onClick={() => navigate(`/evaluation`)}>
          空き家推定画面へ
        </Button>
      </div>
    </div>
  );
}
