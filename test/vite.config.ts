import { defineConfig } from "vite";
import shadowTailwind from "../index.js";

export default defineConfig({
	clearScreen: false,
	build: {
		minify: false,
		sourcemap: false,
	},
	plugins: [
		shadowTailwind({
			entryFilePath: "shadow.css",
		}),
	],
});
