import fs from "node:fs";
import path from "node:path";
import { Features, transform } from "lightningcss";
import { compile } from "@tailwindcss/node";
import { Scanner } from "@tailwindcss/oxide";

/**
 * A vite plugin for using tailwindcss within single files.
 *
 * @param {Object} options - Configuration options for the plugin.
 * @param {string} options.entryFilePath - The path to the entry file for each file it is used in.
 *
 * @example ```
 * scopedTailwindcss({
 *   entryFilePath: path.resolve("./src/theme/shadow.css"),
 * })
 * ```
 */
export default function scopedTailwindcss(
  { entryFilePath } = {
    entryFilePath: "./src/shadow.css",
  },
) {
  // What happens here:
  // 1. Each file where the virtual module is imported is scanned for tailwind classes.
  // 2. Then the file gets compiled tailwind styles injected into a "shadow-tailwind:css" module.

  // Why this works:
  // - Tailwindcss uses css-vars for theming.
  // - Css-vars defined in the :root, penetrate shadow dom boundaries.
  // - So we can strip all theming for the "scoped" compiled tailwind styles to save bytes.
  // - So, defining all variables in the :root once, is enough to theme the entire ui, including inside shadow dom.

  const absoluteEntryFilePath = path.resolve(entryFilePath);
  const entryFile = fs.readFileSync(absoluteEntryFilePath).toString();

  const importMap = new Map();

  return {
    name: "scoped-tailwind",

    async resolveId(source, importer) {
      if (source.startsWith("shadow-tailwind:css")) {
        return `shadow-tailwind:css:{${importer}}`;
      }
    },

    async load(id) {
      if (id.startsWith("shadow-tailwind:css")) {
        this.addWatchFile(absoluteEntryFilePath);

        const sourceId = id.split(":")[2]?.replace("{", "").replace("}", "");
        return `export default \`${importMap.get(sourceId)}\`;`;
      }
    },

    async handleHotUpdate({ server, modules, file, timestamp }) {
      server.hot.send({ type: "full-reload" });

      const module = server.moduleGraph.getModuleById(
        `shadow-tailwind:css:{${file}}`,
      );
      if (module) {
        server.moduleGraph.invalidateModule(module);
        return [module];
      }
    },

    async transform(code, id) {
      if (
        !path.extname(id).match(/tsx?|jsx?/g) ||
        !code.includes("shadow-tailwind:css")
      )
        return;

      const dependencies = new Set();
      const base = path.dirname(absoluteEntryFilePath);

      const input = `
        @source "${id}";
        @import "tailwindcss/utilities.css";
        ${entryFile}
      `;

      const compiler = await compile(input, {
        base,
        shouldRewriteUrls: true,
        onDependency: (path) => {
          dependencies.add(path);
        },
      });

      const scanner = new Scanner({
        sources: compiler.sources,
      });

      /** @type {Set<string>} */
      const candidates = new Set();
      for (const candidate of scanner.scan()) {
        candidates.add(candidate);
      }

      const output = compiler.build([...candidates]);
      if (output) {
        // the replace fixes escaping beeing unescaped when turned into a script
        const cssOutput = optimizeCss(output).replaceAll("\\", "\\\\");
        importMap.set(id, cssOutput);

        return { code: code };
      }

      return { code: code };
    },
  };
}

function optimizeCss(input) {
  return transform({
    filename: "virtual.css",
    code: Buffer.from(input),
    minify: true,
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
