import "./styles/native-controls.css";
import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App.jsx";
import { getSettings } from "./services/settings";
import "./styles.css";
import "./styles/appearance.css";

function applyTheme(settings) {
  document.documentElement.dataset.theme =
    settings?.appearanceTheme === "light" ? "light" : "dark";
}

applyTheme(getSettings());
window.addEventListener("game-manager-settings-changed", (event) => {
  applyTheme(event.detail);
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
