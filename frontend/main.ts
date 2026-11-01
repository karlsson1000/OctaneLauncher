import { mount } from "svelte"
import App from "./app.svelte"
import './App.css'
import { applyCustomTheme } from "./lib/custom-theme"

try {
  if (localStorage.getItem("octane_theme") === "custom") void applyCustomTheme()
} catch {}

const app = mount(App, {
  target: document.getElementById("root")!,
})

export default app
