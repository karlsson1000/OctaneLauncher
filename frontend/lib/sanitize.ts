import DOMPurify from "dompurify"

export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    FORBID_TAGS: ["style", "form", "button"],
    FORBID_ATTR: ["srcset"],
  })
}
