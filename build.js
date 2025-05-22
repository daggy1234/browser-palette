import { copyFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";

async function copyFiles() {
  const filesToCopy = [
    "manifest.json",
    "background.js",
    "icons/icon16.png",
    "icons/icon48.png",
    "icons/icon128.png",
    "settings.html",
    "settings.js",
  ];

  if (!existsSync("dist")) {
    await mkdir("dist");
  }

  if (!existsSync("dist/icons")) {
    await mkdir("dist/icons");
  }

  // Copy each file
  for (const file of filesToCopy) {
    try {
      await copyFile(file, join("dist", file));
      console.log(`Copied ${file} to dist/`);
    } catch (error) {
      console.error(`Error copying ${file}:`, error);
    }
  }
}

copyFiles().catch(console.error);
