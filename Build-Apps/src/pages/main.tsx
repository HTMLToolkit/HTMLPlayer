import React from "react";
import ReactDOM from "react-dom/client";
import IndexPage from "./_index";
import "../global.css";
import { Toaster } from "sonner";
import { ThemeLoader } from "../helpers/themeLoader";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeLoader themeDir="../themes" defaultTheme="Blue">
      <>
        <Toaster />
        <IndexPage />
      </>
    </ThemeLoader>
  </React.StrictMode>
);
