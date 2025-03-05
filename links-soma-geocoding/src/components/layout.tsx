import { makeStyles } from '@fluentui/react-components';
import React from 'react';

const useStyles = makeStyles({
  root: {
    width: '100%',
    backgroundColor: '#F1ECF8',
  },
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    borderRadius: '5px',
    margin: 'auto',
    width: '70%',
    padding: '20px',
  },
});

type LayoutProps = {
  children: React.ReactNode;
};

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const styles = useStyles();
  return (
    <div className={styles.root}>
      <div className={styles.wrapper}>{children}</div>
    </div>
  );
};
