import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";

const [root, needle] = process.argv.slice(2);

if (!root || !needle) {
  console.error("Usage: node scripts/assert-export-placeholder.mjs <directory> <text>");
  process.exit(2);
}

async function containsNeedle(path) {
  const metadata = await stat(path);
  if (metadata.isDirectory()) {
    const entries = await readdir(path);
    for (const entry of entries) {
      if (await containsNeedle(join(path, entry))) return true;
    }
    return false;
  }

  return (await readFile(path, "utf8")).includes(needle);
}

if (!(await containsNeedle(root))) {
  console.error(`Expected exported bundle to contain: ${needle}`);
  process.exit(1);
}

console.log("Confirmed the exported bundle uses compile-only CI placeholders.");
