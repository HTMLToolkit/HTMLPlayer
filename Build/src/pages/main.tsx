import React from 'react';
import ReactDOM from 'react-dom/client';
import IndexPage from './_index';
import { HelmetProvider } from 'react-helmet-async';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HelmetProvider>
      <IndexPage />
    </HelmetProvider>
  </React.StrictMode>
);
