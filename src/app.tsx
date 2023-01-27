import React from "react";
import ReactDOM from "react-dom/client";
import { Reader } from "./components/Reader";

import { createHashRouter, RouterProvider } from "react-router-dom";

import "./tailwind.css";
import { Paste } from "./components/Paste";

const router = createHashRouter([
  {
    path: "/reader",
    element: <Reader />,
  },
  {
    path: "/paste",
    element: <Paste />,
  },
]);

const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);
root.render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
