import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const configuredBase = new URL(process.env.NEXTROUND_BASE_URL || "http://localhost:4173/");
if (!["http:", "https:"].includes(configuredBase.protocol)) throw new Error("NEXTROUND_BASE_URL must be an HTTP(S) application directory URL");
configuredBase.search = "";
configuredBase.hash = "";
if (!configuredBase.pathname.endsWith("/")) configuredBase.pathname += "/";
export const baseUrl = configuredBase.href;

const override = process.env.NEXTROUND_PLAYWRIGHT;
const specifier = override && path.isAbsolute(override) ? pathToFileURL(override).href : override || "playwright";
export const { chromium } = await import(specifier);

export async function testOutput(moduleUrl) {
  const suite = path.basename(fileURLToPath(moduleUrl), ".mjs").replace(/-browser$/, "");
  const output = new URL(`../test-results/${suite}/`, moduleUrl);
  await mkdir(output, { recursive: true });
  return output;
}

// Playwright screenshot paths must be native filesystem strings on every OS.
export const artifactPath = (nameOrUrl, output) => fileURLToPath(output ? new URL(nameOrUrl, output) : nameOrUrl);
