Fix: posts.json vuoto

Se src/data/posts.json è vuoto, il sito non può mostrare né articoli né oggetti.
Questo pacchetto:
- aggiunge src/soul/sources.json con i 3 subreddit
- sostituisce scripts/build-posts.mjs con una versione che usa RSS (pubblico, stabile)
- NON sovrascrive posts.json se il fetch fallisce (tiene l’ultimo buono)

Cosa fare:
1) Copia:
   - src/soul/sources.json
   - scripts/build-posts.mjs
2) Verifica che il workflow chiami:
   node scripts/build-posts.mjs
   node scripts/pick-featured.mjs

Dopo il commit:
- controlla src/data/posts.json: deve avere posts[].length > 0
