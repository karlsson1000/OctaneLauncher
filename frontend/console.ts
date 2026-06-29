import { mount } from "svelte"
import ConsoleWindow from "./features/console/ConsoleWindow.svelte"
import './App.css'

const app = mount(ConsoleWindow, {
  target: document.getElementById("root")!,
})

export default app
