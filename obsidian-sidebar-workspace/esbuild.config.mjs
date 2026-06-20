import esbuild from "esbuild";
import process from "process";

const prod = process.argv[2] === "production";

await esbuild.build({
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: ["obsidian"],
  format: "cjs",
  target: "es2020",
  platform: "node",
  outfile: "main.js",
  minify: prod,
  sourcemap: prod ? false : "inline",
  treeShaking: true,
});

if (!prod) {
  console.log("Build complete. Watching for changes...");
}
