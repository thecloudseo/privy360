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
      ".claude/**",
      "apps/api/src/middleware/**",
      "apps/api/src/routes/health.ts",
      "apps/api/src/routes/consents.ts",
      "apps/api/src/services/consent.ts",
      "apps/api/src/types/fastify.d.ts",
      "packages/database/run-migrations.mjs",
      "tests/unit/**",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
);
