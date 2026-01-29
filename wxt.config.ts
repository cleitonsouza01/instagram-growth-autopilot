import { defineConfig } from "wxt";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "Platform Growth Autopilot",
    description:
      "Grow your audience organically with smart, safe engagement automation.",
    permissions: ["storage", "alarms", "tabs", "declarativeNetRequest"],
    host_permissions: [
      "https://www.instagram.com/*",
      "https://i.instagram.com/*",
    ],
    content_security_policy: {
      extension_pages:
        "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'",
    },
  },
  vite: () => ({
    plugins: [tailwindcss()],
    build: {
      // Ensure ASCII-only output to avoid Chrome "not UTF-8 encoded" errors
      target: "esnext",
    },
    esbuild: {
      charset: "ascii",
    },
  }),
});
