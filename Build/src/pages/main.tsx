import React from 'react';
import ReactDOM from 'react-dom/client';
import IndexPage from './_index';
import { HelmetProvider } from 'react-helmet-async';
import '../global.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HelmetProvider>
      <IndexPage />
    </HelmetProvider>
  </React.StrictMode>
);
