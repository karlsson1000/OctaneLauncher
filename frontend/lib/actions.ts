export function clickOutside(node: HTMLElement, callback: () => void) {
  function handleClick(e: MouseEvent) {
    if (node && !node.contains(e.target as Node)) {
      callback()
    }
  }
  document.addEventListener("mousedown", handleClick)
  return {
    destroy() {
      document.removeEventListener("mousedown", handleClick)
    }
  }
}
