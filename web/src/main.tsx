import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./styles/global.css";
import WorldPage from "./pages/WorldPage";
import Connect from "./pages/Connect";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Connect />} />
        <Route path="/world" element={<WorldPage />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
