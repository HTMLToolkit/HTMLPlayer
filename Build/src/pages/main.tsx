import React from "react";
import ReactDOM from "react-dom/client";
import IndexPage from "./_index";
import "../global.css";
import { Toaster } from "sonner";
import { ThemeLoader } from "../helpers/themeLoader";
import { InitializationProvider } from "../hooks/useInitialization";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <InitializationProvider>
      <ThemeLoader defaultTheme="Blue">
        <>
          <Toaster />
          <IndexPage />
        </>
      </ThemeLoader>
    </InitializationProvider>
  </React.StrictMode>
);
