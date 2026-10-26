import { seoArtifacts } from "./seo.mjs";
import path from "node:path";
import { root, runtimeFiles, writeSnapshot } from "./release-files.mjs";
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const target = path.resolve(process.argv[2] || path.join(root, "dist", `nextround-public-${stamp}`));
console.log(JSON.stringify(await writeSnapshot(target, await runtimeFiles(), "NextRound-public", await seoArtifacts(root))));
