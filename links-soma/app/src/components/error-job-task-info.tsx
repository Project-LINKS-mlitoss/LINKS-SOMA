import { Caption1Strong, makeStyles, tokens } from "@fluentui/react-components";
import { useFetchJobTasks } from "../hooks/use-fetch-job-tasks";

const useStyles = makeStyles({
  li: {
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
  },
});

type Props = {
  jobId: number;
};

export const ErrorJobTaskInfo = ({ jobId }: Props): JSX.Element => {
  const styles = useStyles();
  const { data } = useFetchJobTasks({ jobId });
  if (!data) return <></>;
  return (
    <>
      {data.map((task) => {
        return (
          task.error_msg && (
            <li key={task.id} className={styles.li}>
              <Caption1Strong>
                {task.error_msg}
                {task.result?.taskResultType === "preprocess" &&
                task.result.input_source
                  ? `(${task.result.input_source.join(", ")})`
                  : ""}
              </Caption1Strong>
            </li>
          )
        );
      })}
    </>
  );
};
