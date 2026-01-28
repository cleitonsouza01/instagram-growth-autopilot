import { defineConfig } from "wxt";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "Instagram Growth Autopilot",
    description:
      "Grow your Instagram audience organically with smart, safe engagement automation.",
    permissions: ["storage", "alarms"],
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
  }),
});
