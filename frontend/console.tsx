import React from "react"
import ReactDOM from "react-dom/client"
import { ConsoleWindow } from "./features/console/ConsoleWindow"
import './App.css'

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ConsoleWindow />
  </React.StrictMode>,
)