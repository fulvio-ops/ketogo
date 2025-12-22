import fs from "node:fs/promises";
import path from "node:path";

function mulberry32(a){return function(){let t=(a+=0x6D2B79F5);t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;}}
function isoWeekSeed(d=new Date()){
  const date=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));
  const dayNum=date.getUTCDay()||7;
  date.setUTCDate(date.getUTCDate()+4-dayNum);
  const yearStart=new Date(Date.UTC(date.getUTCFullYear(),0,1));
  const weekNo=Math.ceil((((date-yearStart)/86400000)+1)/7);
  return parseInt(`${date.getUTCFullYear()}${String(weekNo).padStart(2,"0")}`,10);
}

const NOTES = [
  { en: "Things got weird. We stayed.", it: "Le cose si sono fatte strane. Noi siamo rimasti." },
  { en: "Small companionship. Zero explanations.", it: "Compagnia piccola. Zero spiegazioni." },
  { en: "The world did its thing. We noticed.", it: "Il mondo ha fatto il suo. Noi l’abbiamo visto." },
  { en: "Nothing urgent. Just… this.", it: "Niente di urgente. Solo… questo." },
  { en: "A quiet selection for loud days.", it: "Una selezione quieta per giorni rumorosi." }
];

async function main(){
  const seed = isoWeekSeed();
  const rng = mulberry32(seed);
  const pick = NOTES[Math.floor(rng()*NOTES.length)];

  const out = { generatedAt: new Date().toISOString(), seed, note: pick };
  const outDir = path.join(process.cwd(), "src", "data");
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(path.join(outDir, "editorial.json"), JSON.stringify(out, null, 2), "utf8");
  console.log("✅ editorial.json generated");
}
main().catch(e=>{console.error(e);process.exit(1);});
