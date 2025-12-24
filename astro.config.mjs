import { defineConfig } from "astro/config";

export default defineConfig({
  // Custom domain: GitHub Pages serve dalla ROOT del dominio
  site: "https://ketogo.it",
  base: "/",

  // (opzionale ma consigliato) output statico esplicito
  output: "static",
});
