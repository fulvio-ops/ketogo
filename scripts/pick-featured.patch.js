/*
INSTRUCTIONS:
1. Open scripts/pick-featured.mjs
2. Add at top:
   import { filterGadgets } from "./gadget-gate.mjs";
3. Replace oddities selection with:

const gatedOddities = filterGadgets(odditiesPool);
const pickedOdd = pickN(gatedOddities, PICK, rng);

*/
