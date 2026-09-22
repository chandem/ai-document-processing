import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Proxy /api → backend so the browser never hits cross-origin in local dev.
// This eliminates most "Failed to fetch" / CORS issues when refreshing.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
