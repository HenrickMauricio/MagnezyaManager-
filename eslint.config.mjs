import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Permite descartar campos com { campo: _ignorado, ...resto }.
      "@typescript-eslint/no-unused-vars": ["warn", { ignoreRestSiblings: true, varsIgnorePattern: "^_" }],
    },
  },
  globalIgnores([".next/**", "node_modules/**", "src/generated/**", "next-env.d.ts"]),
]);
