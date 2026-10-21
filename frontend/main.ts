import { mount } from "svelte"
import App from "./app.svelte"
import './App.css'

const app = mount(App, {
  target: document.getElementById("root")!,
})

export default app
