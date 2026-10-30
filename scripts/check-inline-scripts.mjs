import { readFile } from "node:fs/promises";
import { Script } from "node:vm";

for (const file of ["index.html", "add.html"]) {
  const html = await readFile(new URL("../" + file, import.meta.url), "utf8");
  const blocks = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
  let count = 0;
  for (const [, attributes, source] of blocks) {
    if (/\bsrc\s*=/.test(attributes) || /application\/ld\+json/i.test(attributes)) continue;
    new Script(source, { filename: file + "#inline-script-" + (++count) });
  }
  if (count === 0) throw new Error("No executable inline scripts found in " + file);
  console.log(file + ": " + count + " inline script(s) parsed successfully.");
}
