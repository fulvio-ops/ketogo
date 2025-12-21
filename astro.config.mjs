import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";

export default defineConfig({
  integrations: [tailwind()],
  output: "static",
  site: process.env.SITE_URL || "https://example.com",
  base: process.env.BASE_PATH || "/"
});
