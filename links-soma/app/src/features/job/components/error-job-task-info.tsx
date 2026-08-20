import { Caption1Strong, makeStyles, tokens } from "@fluentui/react-components";
import { useFetchJobTasks } from "../hooks/use-fetch-job-tasks";
import { formatInputSource } from "../util/input-source";
import { ErrorDetailView } from "./error-detail-view";

const useStyles = makeStyles({
  li: {
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    display: "flex",
    flexDirection: "column",
    rowGap: tokens.spacingVerticalXXS,
  },
});

type Props = {
  jobId: number;
};

export const ErrorJobTaskInfo = ({ jobId }: Props): JSX.Element => {
  const styles = useStyles();
  const { data } = useFetchJobTasks({ jobId });
  if (!data || data.length === 0)
    return <Caption1Strong>不明のエラーが発生しました</Caption1Strong>;
  return (
    <>
      {data.map((task) => {
        if (!task.error_msg) return null;
        const errorDetail = task.result?.error_detail;
        return (
          <li key={task.id} className={styles.li}>
            <Caption1Strong>
              {task.error_msg}
              {task.result?.taskResultType === "preprocess" &&
              formatInputSource(task.result.input_source)
                ? `(${formatInputSource(task.result.input_source)})`
                : ""}
            </Caption1Strong>
            {errorDetail && <ErrorDetailView detail={errorDetail} />}
          </li>
        );
      })}
    </>
  );
};
