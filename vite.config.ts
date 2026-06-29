import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from '@tailwindcss/vite'
import { resolve } from "path"

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [svelte(),
    tailwindcss(),
  ],

  clearScreen: false,
  optimizeDeps: {
    exclude: ["lucide-svelte"],
  },
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },

  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        console: resolve(__dirname, "console.html"),
      },
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/lucide-svelte")) return "icons"
          if (id.includes("node_modules/skinview3d")) return "skinview"
          if (id.includes("node_modules/three")) return "three"
          if (id.includes("node_modules/@tauri-apps")) return "tauri"
        },
      },
    },
  },
}));