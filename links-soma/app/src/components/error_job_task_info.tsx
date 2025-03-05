import { makeStyles } from "@fluentui/react-components";
import { useFetchJobTasks } from "../hooks/use-fetch-job-tasks";

const useStyles = makeStyles({
  ul: {
    padding: 0,
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
    <ul className={styles.ul}>
      {data.map((task) => {
        return (
          <li key={task.id}>
            {task.error_code}: {task.error_msg}
          </li>
        );
      })}
    </ul>
  );
};
