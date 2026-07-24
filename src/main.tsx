import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import ServiceWorkerUpdate from "./ServiceWorkerUpdate";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
    <ServiceWorkerUpdate />
  </StrictMode>,
);
