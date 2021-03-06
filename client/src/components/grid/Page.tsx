import React from 'react';

import Grid from '@material-ui/core/Grid';

type Props = {
  component?: React.ElementType;
};

const PageGrid: React.FC<Props> = ({ children, component = 'div' }) => {
  return (
    <Grid container>
      <Grid item xs={1} sm={2} md={3} />
      <Grid item xs={10} sm={8} md={6} component={component}>
        {children}
      </Grid>
      <Grid item xs={1} sm={2} md={3} />
    </Grid>
  );
};

export default PageGrid;
