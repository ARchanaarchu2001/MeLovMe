import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Unit and component tests (`npm test`). Test files sit next to the code: src/**/*.test.ts(x)
export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true }, // "@/lib/..." imports, as in tsconfig.json
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
