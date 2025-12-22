KETOGO – Gadget Price Gate (APPROVATO)

Cosa fa:
- Accetta SOLO gadget 5–15 €
- Consente eccezioni fino a 25 € (max 25% del totale)
- Scarta tutto ciò che sembra prodotto o shop
- Richiede condivisibilità >= 7/10

File nuovi:
- src/soul/gadget-rules.json
- scripts/gadget-gate.mjs

Integrazione:
- Importare filterGadgets in scripts/pick-featured.mjs
- Applicare filterGadgets prima del pickN sugli oggetti

Dopo il commit:
- GitHub Actions deve tornare verde
- La sezione oggetti diventa più leggera, virale e coerente
