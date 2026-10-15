import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      ".cache/**",
      ".venv-*/**",
      "test-results/**",
      "playwright-report/**",
      "apps/web/.next/**",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
);
