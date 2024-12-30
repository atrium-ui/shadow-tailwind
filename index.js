import fs from "node:fs";
import path from "node:path";
import autoprefixer from "autoprefixer";
import dependencyTree from "dependency-tree";
import { Features, transform } from "lightningcss";
import postcss from "postcss";
import postcssNested from "postcss-nested";
import inlineImport from "postcss-import";
import tailwindcss from "tailwindcss";

export function dependencies(file) {
  const root = path.resolve(file, "../");

  return dependencyTree.toList({
    filename: file,
    directory: root,
  });
}

export const scopedTailwindcss = function scopedTailwindcss(
  { tailwindConfigPath, entryFilePath } = {
    tailwindConfigPath: "./tailwind.config.js",
    entryFilePath: "./src/shadow.css",
  },
) {
  // What happens here:
  // 1. Each file .ts(x) is scanned for tailwind classes.
  // 2. Then the file gets compiled tailwind styles injected into a "TAILWIND_CSS" const at the top of the file.

  // Why this works:
  // - Tailwindcss uses css-vars for theming
  // - Css-vars defined in the :root, penetrate shadow dom boundaries
  // - So we can strip all theming for the "scoped" compiled tailwind styles to save bytes.
  // - Defining all variables in the :root once, is enough to theme the entire ui, including inside shadow dom

  const absoluteEntryFilePath = path.resolve(entryFilePath);
  const entryFile = fs.readFileSync(absoluteEntryFilePath).toString();

  const projectConfigPath = path.resolve(tailwindConfigPath);
  const projectConfig = import(projectConfigPath);

  const projectConfigDeps = dependencies(projectConfigPath);

  const importMap = new Map();

  return {
    name: "tailwindcss-scoped",

    async resolveId(source, importer) {
      if (source.startsWith("shadow-tailwind:css")) {
        return `shadow-tailwind:css:{${importer}}`;
      }
    },

    async load(id) {
      if (id.startsWith("shadow-tailwind:css")) {
        const sourceId = id.split(":")[2].replace("{", "").replace("}", "");
        return `export default \`${importMap.get(sourceId)}\`;`;
      }
    },

    async transform(code, id) {
      const ext = path.extname(id);
      if (ext !== ".ts" && ext !== ".tsx") return;

      for (const dep of projectConfigDeps) {
        this.addWatchFile(dep);
      }

      const peers = [...parsePeers(id)];

      // prepend peers
      // for (const peer of peers) {
      //   css = `
      //     ${fs.readFileSync(peer, "utf8")}
      //     ${css}
      //   `;
      // }

      const tailwindConfig = {
        ...(await projectConfig).default,
        content: [id, ...peers],
        safelist: [],
      };

      let output;
      try {
        output = await postcss([
          inlineImport,
          autoprefixer,
          postcssNested,
          tailwindcss({
            config: tailwindConfig,
          }),
        ]).process(entryFile, {
          from: absoluteEntryFilePath,
        });
      } catch (e) {
        console.error(e);
        return;
      }

      if (output) {
        // the replace fixes escaping beeing unescaped when turned into a script
        importMap.set(id, optimizeCss(output.css).replaceAll("\\", "\\\\"));

        return { code: code };
      }

      return { code: code };
    },
  };
};

function parsePeers(file) {
  const content = fs.readFileSync(file, "utf8");
  const list = [];

  for (const line of content.split("\n")) {
    if (line?.startsWith("import")) {
      const match = line.match(/from\s+['"](.*?)(\?[a-zA-Z]+)?['"]/);
      if (match?.[1]?.match(/.css/g)) {
        list.push(path.resolve(file, "../", match[1]));
      }
    }
  }

  return list;
}

function optimizeCss(input) {
  return transform({
    filename: "index.css",
    code: Buffer.from(input),
    minify: process.env.NODE_ENV === "production",
    sourceMap: false,
    drafts: {
      customMedia: true,
    },
    nonStandard: {
      deepSelectorCombinator: true,
    },
    include: Features.Nesting,
    exclude: Features.LogicalProperties,
    targets: {
      safari: (16 << 16) | (4 << 8),
    },
    errorRecovery: true,
  }).code.toString();
}
