import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.jsx";
import { AboutWindow } from "./components/AboutWindow.jsx";
import "./styles.css";

const view = new URLSearchParams(window.location.search).get("view");

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {view === "about" ? <AboutWindow /> : <App />}
  </React.StrictMode>,
);
