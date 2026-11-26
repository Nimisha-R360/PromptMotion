import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";

// The UI talks to the Next.js API in ../backend. In dev, Vite proxies /api (and the
// pre-rendered remocn thumbnails) to it so everything stays same-origin.
const BACKEND = process.env.BACKEND_URL ?? "http://127.0.0.1:3001";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@backend": path.resolve(__dirname, "../backend"),
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    port: 3000,
    strictPort: true, // never drift onto the backend's port (3001)
    fs: { allow: [path.resolve(__dirname, "..")] },
    proxy: {
      "/api": { target: BACKEND, changeOrigin: true },
      "/remocn-thumbs": { target: BACKEND, changeOrigin: true },
    },
  },
  preview: {
    port: 3000,
    strictPort: true,
    proxy: {
      "/api": { target: BACKEND, changeOrigin: true },
      "/remocn-thumbs": { target: BACKEND, changeOrigin: true },
    },
  },
  build: { outDir: "dist", chunkSizeWarningLimit: 2000 },
});
