import { makeStyles } from "@fluentui/react-components";

const useStyles = makeStyles({
  container: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
  },
});

type Props = {
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>;

export const TagContainer = ({ children, ...props }: Props): JSX.Element => {
  const styles = useStyles();
  return (
    <div className={styles.container} {...props}>
      {children}
    </div>
  );
};
