import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from '@tailwindcss/vite'
import { resolve } from "path"

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
      ignored: ["**/backend/**"],
    },
  },

  build: {
    rolldownOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        console: resolve(import.meta.dirname, "console.html"),
      },
      output: {
        codeSplitting: {
          includeDependenciesRecursively: false,
          groups: [
            { name: "icons", test: /node_modules[\\/]lucide-svelte/ },
            { name: "skinview", test: /node_modules[\\/]skinview3d/ },
            { name: "three", test: /node_modules[\\/]three/ },
            { name: "tauri", test: /node_modules[\\/]@tauri-apps/ },
          ],
        },
      },
    },
  },
}));