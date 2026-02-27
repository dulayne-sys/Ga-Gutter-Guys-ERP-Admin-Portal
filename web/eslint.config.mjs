import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // React 19 compiler rules — these flag standard async-fetch patterns
      // that are safe. Disable until codebase migrates to Suspense.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/preserve-manual-memoization": "off",
      // External avatar URLs from Google auth cannot use next/image
      "@next/next/no-img-element": "warn",
    },
  },
]);

export default eslintConfig;
