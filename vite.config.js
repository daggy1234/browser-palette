import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        palette: resolve(__dirname, "palette.html"),
        settings: resolve(__dirname, "settings.html"),
        background: resolve(__dirname, "background.js"),
        content: resolve(__dirname, "content.js"),
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "[name].js",
        assetFileNames: "[name].[ext]",
      },
    },
  },
  css: {
    postcss: "./postcss.config.cjs",
  },
});
