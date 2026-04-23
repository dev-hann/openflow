import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? "0.0.0"),
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:9800",
        changeOrigin: true,
      },
      "/ws": {
        target: "ws://localhost:9800",
        ws: true,
      },
    },
  },
});
