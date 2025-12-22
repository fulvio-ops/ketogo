import fs from "node:fs/promises";
import path from "node:path";

const SOURCE = "src/data/posts.json";
const OUT = "src/data/featured.json";
const PICK = 4;

const SHOP_SUBS = new Set(["ShutUpAndTakeMyMoney", "gadgets", "BuyItForLife"]);

function mulberry32(a){return function(){let t=(a+=0x6D2B79F5);t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;}}
function isoWeekSeed(d=new Date()){const date=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));const dayNum=date.getUTCDay()||7;date.setUTCDate(date.getUTCDate()+4-dayNum);const yearStart=new Date(Date.UTC(date.getUTCFullYear(),0,1));const weekNo=Math.ceil((((date-yearStart)/86400000)+1)/7);return parseInt(`${date.getUTCFullYear()}${String(weekNo).padStart(2,"0")}`,10);}
function shuffle(arr,rng){const a=[...arr];for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}

async function main(){
 const raw=await fs.readFile(path.join(process.cwd(),SOURCE),"utf8");
 const data=JSON.parse(raw);
 const posts=Array.isArray(data?.posts)?data.posts:[];
 const rng=mulberry32(isoWeekSeed());

 const articlesPool=posts.filter(p=>p?.subreddit&&!SHOP_SUBS.has(p.subreddit));
 const odditiesPool=posts.filter(p=>p?.subreddit&&SHOP_SUBS.has(p.subreddit));

 const articles=shuffle(articlesPool,rng).slice(0,PICK);
 const pickedOdd=shuffle(odditiesPool,rng).slice(0,PICK);
 const need=PICK-pickedOdd.length;

 const odditiesFill=need>0?shuffle(posts.filter(p=>!articles.find(a=>a.id===p.id)&&!pickedOdd.find(o=>o.id===p.id)),rng).slice(0,need):[];

 const featured={generatedAt:new Date().toISOString(),seed:isoWeekSeed(),articles,oddities:[...pickedOdd,...odditiesFill]};
 await fs.mkdir(path.join(process.cwd(),"src","data"),{recursive:true});
 await fs.writeFile(path.join(process.cwd(),OUT),JSON.stringify(featured,null,2),"utf8");
 console.log("featured.json generated");
}

main().catch(e=>{console.error(e);process.exit(1);});
