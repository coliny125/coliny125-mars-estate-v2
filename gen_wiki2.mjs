import { readFileSync } from 'fs';
for (const line of readFileSync('.env.local','utf8').split('\n')){const m=line.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'');}
const { kv } = await import('@vercel/kv');
async function claude(p,mt){const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'x-api-key':process.env.ANTHROPIC_API_KEY,'anthropic-version':'2023-06-01','content-type':'application/json'},body:JSON.stringify({model:'claude-sonnet-4-6',max_tokens:mt,messages:[{role:'user',content:p}]})});const d=await r.json();return d.content?.[0]?.text??'';}
function extractObjs(text){const c=text.replace(/[^\x09\x0A\x0D\x20-\x7E]/g,'');const b=c.indexOf('[');if(b<0)return[];const o=[];let d=0,cur='',ino=false;for(let i=b+1;i<c.length;i++){const ch=c[i];if(ch==='{'){if(d===0){ino=true;cur='';}d++;cur+=ch;}else if(ch==='}'){d--;cur+=ch;if(d===0&&ino){try{o.push(JSON.parse(cur));}catch{}ino=false;}}else if(ino)cur+=ch;else if(ch===']'&&d===0)break;}return o;}

const RELP={works_at:{out:'works at',in:'employs / includes'},involved_in:{out:'involved in',in:'involves'},depends_on:{out:'depends on',in:'is depended on by'},owns:{out:'owns',in:'owned by'},related_to:{out:'related to',in:'related to'},competes_with:{out:'competes with',in:'competes with'},mentions:{out:'mentions',in:'mentioned by'}};

const NUANCE = `MARS ESTATE — OPERATIONAL NUANCE (from meeting notes + Notion):
- Owner Mars Yuan: Chinese entrepreneur, co-founded Haidilao hot pot (1,300+ global locations); avid wine collector; "Mars" is an English name given by his son Colin — the volcanic/red-soil association makes it fitting.
- Colin Yuan: project lead, finishing undergrad at University of Chicago; runs brand, strategy, operations; hospitality DNA from family restaurant background ("moments of delight").
- Property: former Lamborn Family Vineyard (Mike Lamborn, owned since 1970s); Heidi Barrett has made wine from this vineyard since 2003; ~30 acres, 7 planted; 2,200 ft, above the fog line (extra sun, gradual maturation). Howell Mountain AVA = first Napa AVA (1983), defined by elevation (1,400ft+), considered distinct/greater than valley floor.
- Winemaking: made off-site at the Joseph Phelps facility in Calistoga (no on-site winery use permit). Heidi presses off early (~1 week) to avoid seed-tannin extraction — gentler than neighbor Randy Dunn's extended macerations. ~600-700 cases/yr. Eagle Rock = fulfillment/storage.
- Vintages: 2022 inaugural (Zin + Cab, ~700 cases, the Founding Circle release); 2023 Cab only (Zin block ripped out, replanted Cab Sauv/Petit Verdot/Cab Franc, Clone 30); 2024 Cab (certified organic fruit); 2025 Chardonnay crop lost to the Pickett Fire (bought fruit instead).
- Pickett Fire (2025): the Hundred Acre winery fire caused smoke taint on Mars's Chardonnay; ETS Labs tests guaiacol (>0.9 = taint); litigation/insurance handled with DPF Law (David Balter, John Trinidad, Melissa Granillo); risk Hundred Acre files Chapter 11.
- Soil/terroir (a core differentiator): Aiken Loam (weathered volcanics, more clay/fertile) and Sobrante Loam (weathered sandstone/rhyolite, shallower/rockier). Rock units TSR (rhyolite flows), TST (pumiceous ash-flow tuff), TSA (andesite-basalt). Napa = young volcanic rock without active volcanoes → powerful, lower-acid, broad wines. Mafic (iron-rich basalt) vs felsic (silica-rich rhyolite). Flavor signature: "wild berry jam" — huckleberry, olallieberry, bramble — consistent 25 yrs. Soil pit field work Apr 15-17 2026 (excavator + Silverado GPS, Brenna Quigley analysis, Sarah MacDonald/EnvisionGeo regional data). Goal: map terroir "personalities" Burgundy-style.
- Blocks: Block 2 = flagship (deep, ripe, best exposure); Block 1 = old Zin (ripeness issues); Blocks 3 & 4 = new vines, picked together; east-side shade area = weakest.
- Architecture: Michael McCabe, Walker Warner Architects (also Quintessa, Flowers). Philosophy "buildings submissive to landscape." Plan: tear down hilltop house → VIP tasting facility (20-30 ppl, few hotel rooms); avoid Promontory's "cold/cult" formality. CA build cost $2,500-3,000/sqft. No winery use permit possible (Summit Lake Drive easement needs all neighbors' sign-off). Current path: B720 Vineyard Estate Tasting Permit (new 2026 permit, up to 36 events/yr, no infrastructure, ~few hundred dollars).
- Branding: regular caps "Mars Estate" (not all-caps). Label by Chuck House (black/white hand-drawn; also Frog's Leap, Bryant Family, Masseto). Target peers: Bryant Family, Colgin, Grace Family (cult but authentic); NOT Opus One (too commercial). Land is the hero; people (Steve, Heidi, family) are shepherds. Agencies: Offset (Lindsay Regan, Jessica, Joanie, Julia — primary web/brand; site = Land/Wines/Notes); FINE (Kenn Fine — considered); Eddie/Liquid Matter Advisors (copy, tasting notes $300 ea). Photographers: Nicola Parisi (documentary), Matt Morris (landscape), Brandon La (film). Commerce: Offset Commerce ($3k onboarding + 2%, integrates Ship Compliant → Eagle Rock, allocation groups for tiers). Maps: Sarah MacDonald/EnvisionGeo + artist Teresa Whitehill.
- Membership "Founding Circle": inaugural allocation = 2022 vintage (3 bottles); target 40-60 members; application in Notion screens for commitment/advocacy (un-Googleable questions); preferred pricing for members on later purchases. Verve partnership (tasting events + retail shelf, ~80% of affluent target market). NY Vintners (Will): retail/events/private-club models. Thesis: collectors buy wine to buy INTO a social class/identity, not just to drink — the bottle is a status signal; Mars leverages this with curated groups (junior networking / mid-career / elite collectors). Strategy refs: "mimetic desire" (target tastemakers first for pull-through), "Veblen good" (demand rises with price), "indefinite optimism" (status games in a zero-sum elite).
- Distribution: DTC priority + restaurant placements NYC/Chicago (targets: Cote, 1 White Street, Family Meal at Blue Hill). Clearing houses: MHW (Perla Fernandez, $2,800/mo min) vs Canopy (Jack, $4.50/case, $1k deposit, Edison NJ warehouse — chosen). WithWine (Dustin) = festival commerce for Taste of Howell Mountain. Distributors referenced: Polaner (Dunn uses), Banville (Cain uses).
- Critics: James Suckling (98 pts), Robert Parker/Wine Advocate (results ~late June 2026), Wine Spectator (submitted), Jancis Robinson (high-value, Liv-ex pulls her scores), Decanter/Vinous (no response).
- Entity: Sept 2025 sale/transfer — Mars Estate Inc. → Mars Synergy / Mars Capital Management PTE LTD. FGMK (Cory Chiovari, Michael Pearson) valuation; Cushman & Wakefield real estate appraisal; FIRPTA 15% foreign-seller withholding.
JARGON: Founding Circle; clearing house (logistics intermediary, per-case fee not margin); price posting (NY monthly retail price filing); Ship Compliant (excise/compliance software); allocation groups (tiered customer segments); guaiacol (smoke-taint marker); B720 (Vineyard Estate Tasting Permit); AW Zone (Agricultural Watershed zoning); HMVGA (Howell Mountain Vintners & Growers Assoc, Sam Peters); mimetic desire; Veblen good; Roadside Wine (Brenna's wine documentary series).`;

let raw = await kv.get('graph:data');
let g = typeof raw==='string'?JSON.parse(raw):raw; if(typeof g==='string')g=JSON.parse(g);
console.log(`graph: ${g.nodes.length} nodes, ${g.edges.length} edges`);

const byId=new Map(g.nodes.map(n=>[n.id,n]));
const relMap=new Map();
const push=(nid,oid,phr)=>{const o=byId.get(oid);if(!o)return;const l=relMap.get(nid)||[];if(l.some(r=>r.id===oid&&r.phrasing===phr))return;l.push({id:o.id,label:o.label,type:o.type,phrasing:phr});relMap.set(nid,l);};
for(const e of g.edges){const ph=RELP[e.relation]||{out:e.relation,in:e.relation};push(e.source,e.target,ph.out);push(e.target,e.source,ph.in);}

const articles={}; // id -> {summary, sections}
const BATCH=14;
for(let i=0;i<g.nodes.length;i+=BATCH){
  const batch=g.nodes.slice(i,i+BATCH);
  const block=batch.map(n=>{const rel=(relMap.get(n.id)||[]).slice(0,8).map(r=>`${r.phrasing} ${r.label}`).join('; ');return `id:${n.id} | ${n.label} (${n.type}) | current note: ${n.description||'—'} | connected: ${rel||'none'}`;}).join('\n');
  const p=`You are writing wiki articles for Mars Estate, a boutique Napa Valley winery on Howell Mountain. Use the operational nuance below to write a richer, more knowledgeable article for each entity than its one-line note. Be specific and accurate; weave in the nuance where relevant; reference connected entities by name so readers can follow links.

${NUANCE}

For each entity below, write:
- "summary": one crisp sentence defining it.
- "sections": 2-3 sections, each {"heading","body"}. Choose headings that fit the entity, e.g. "Overview", "Role at Mars Estate", "Background", "Context & Notes", "Significance". Each body = 2-4 sentences. Reference related people/projects/concepts by their exact names where natural.

ENTITIES:
${block}

Return ONLY a JSON array (no prose): [{"id":"exact-id","summary":"...","sections":[{"heading":"...","body":"..."}]}]`;
  const txt=await claude(p,8000);
  for(const o of extractObjs(txt)){if(o.id&&o.summary&&Array.isArray(o.sections))articles[o.id]={summary:o.summary,sections:o.sections};}
  console.log(`  batch ${Math.floor(i/BATCH)+1}/${Math.ceil(g.nodes.length/BATCH)}: ${Object.keys(articles).length} articles so far`);
}

const entries=g.nodes.map(n=>{const a=articles[n.id];const summary=(a?.summary||n.description||`${n.label} — ${n.type}.`).trim();const sections=a?.sections?.length?a.sections:[{heading:'Overview',body:summary}];return {id:n.id,label:n.label,type:n.type,summary,sections,email:n.email,related:(relMap.get(n.id)||[]).sort((x,y)=>x.label.localeCompare(y.label)),mention_count:n.mention_count||0};}).sort((a,b)=>a.label.localeCompare(b.label));
const wiki={entries,generated_at:new Date().toISOString()};
await kv.set('wiki:data',JSON.stringify(wiki));
console.log(`SAVED wiki: ${entries.length} entries, ${Object.keys(articles).length} with rich sectioned articles`);
