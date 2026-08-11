import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./app/App.js";
import { Providers } from "./app/providers.js";
import "./index.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("The #root element is missing");
}

createRoot(root).render(
  <StrictMode>
    <Providers>
      <App />
    </Providers>
  </StrictMode>,
);
