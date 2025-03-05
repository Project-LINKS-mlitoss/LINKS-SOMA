import { makeStyles, Card } from '@fluentui/react-components';

const useStyles = makeStyles({
  title: {
    margin: 0,
    borderRadius: '5px',
    borderTop: `10px solid #6164A6`,
  },
});

export const Title = (): JSX.Element => {
  const styles = useStyles();
  return (
    <Card className={styles.title}>
      <h1>ジオコーディング</h1>
    </Card>
  );
};
