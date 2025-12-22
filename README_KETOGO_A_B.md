KETOGO — A + B (automatico)

Copia TUTTO nella root della repo (sovrascrivi):
- package.json
- scripts/* (3 file + editorial gate)
- src/soul/* (manifesto + vocabulary immutabili)
- src/i18n/strings.json
- src/components/* (I18n + LanguageToggle + EditorialCard + PostCard)
- src/layouts/Layout.astro
- src/pages/index.astro
- src/styles/global.css

Build pipeline:
npm run build
=> build-posts.mjs genera src/data/posts.json
=> pick-featured.mjs genera src/data/featured.json (hero + 4 + 4)
=> editorial-note.mjs genera src/data/editorial.json (card editoriale settimanale)

Nota:
Se Reddit JSON risponde 403, passa automaticamente a RSS.
