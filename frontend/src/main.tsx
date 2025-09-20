import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./styles/global.css";
import { ThemeProvider } from "./components/layout/theme-provider";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider defaultTheme="light" storageKey="litepos-theme">
        <App />
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);
