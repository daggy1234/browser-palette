import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        palette: resolve(__dirname, "palette.html"),
        content: resolve(__dirname, "content.js"),
        background: resolve(__dirname, "background.js"),
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
