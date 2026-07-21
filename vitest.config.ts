import { defineConfig } from "vitest/config";
import path from "path";
import fs from "fs";
import pkg from "@next/env";

const { loadEnvConfig } = pkg;

// Load Next.js environment variables (this populates process.env with DATABASE_URL, etc.)
loadEnvConfig(process.cwd());

function resolveFile(basePath: string) {
  const extensions = [".ts", ".tsx", ".js", ".jsx", ".json"];
  try {
    if (fs.existsSync(basePath) && fs.statSync(basePath).isFile()) {
      return basePath;
    }
  } catch (e) { }

  for (const ext of extensions) {
    if (fs.existsSync(basePath + ext)) {
      return basePath + ext;
    }
  }

  for (const ext of extensions) {
    const indexPath = path.join(basePath, "index" + ext);
    if (fs.existsSync(indexPath)) {
      return indexPath;
    }
  }
  return null;
}

const tsconfigPathsPlugin = () => {
  return {
    name: "tsconfig-paths-local",
    enforce: "pre" as const,
    resolveId(source: string) {
      // Fix ESM import resolution of next/server for next-auth
      if (source === "next/server") {
        return path.resolve(__dirname, "node_modules/next/server.js");
      }

      if (source.startsWith("@/")) {
        const relativePath = source.substring(2); // remove '@/'

        // Check src/
        const srcPath = path.resolve(__dirname, "src", relativePath);
        const resolvedSrc = resolveFile(srcPath);
        if (resolvedSrc) {
          return resolvedSrc;
        }

        // Check src/app/
        const appPath = path.resolve(__dirname, "src/app", relativePath);
        const resolvedApp = resolveFile(appPath);
        if (resolvedApp) {
          return resolvedApp;
        }
      }
      return null;
    }
  };
};

export default defineConfig({
  plugins: [tsconfigPathsPlugin()],
  test: {
    globals: true,
    environment: "node",
  },
});
