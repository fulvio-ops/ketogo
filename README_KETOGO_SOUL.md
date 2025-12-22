KETOGO — Soul + Editorial Gate + IT/EN language selector

Copia i file nelle stesse cartelle del progetto (sovrascrivi se richiesto):
- package.json
- scripts/build-posts.mjs
- scripts/editorial.mjs
- scripts/pick-featured.mjs
- src/editorial/soul.json
- src/i18n/strings.json
- src/components/I18nScript.astro
- src/components/LanguageToggle.astro
- src/components/PostCard.astro
- src/layouts/Layout.astro
- src/styles/global.css
- src/pages/index.astro

Poi:
npm install
npm run build
