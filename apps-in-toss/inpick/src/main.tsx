import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { installProductionApiBridge } from "./api-bridge";
import { installMiniAppAnchorBridge } from "./adapters/navigation";
import "../inpick-source/src/app/globals.css";
import "./toss-shell.css";

installProductionApiBridge();
installMiniAppAnchorBridge();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
