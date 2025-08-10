import React from 'react';
import ReactDOM from 'react-dom/client';
import IndexPage from './_index';
import '../global.css';
import { Toaster } from 'sonner';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <>
      <Toaster />
      <IndexPage />
    </>
  </React.StrictMode>
);
