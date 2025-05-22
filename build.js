import { copyFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { readFile, writeFile } from "fs/promises";
import pkg from "./package.json" assert { type: "json" };

async function copyFiles() {
  const filesToCopy = [
    "manifest.json",
    "background.js",
    "icons/icon16.png",
    "icons/icon48.png",
    "icons/icon128.png",
    "settings.html",
    "palette.html",
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

async function updateManifestVersion(manifestPath, outPath) {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  manifest.version = pkg.version;
  await writeFile(outPath, JSON.stringify(manifest, null, 2));
}

async function buildManifests() {
  await updateManifestVersion("manifest.json", "dist/manifest.json");
  await updateManifestVersion(
    "manifest.firefox.json",
    "dist/manifest.firefox.json"
  );
}

copyFiles().catch(console.error);
await buildManifests();
