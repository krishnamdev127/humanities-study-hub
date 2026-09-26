/* DuckDuckGo search adapter.
   Search is best-effort because DuckDuckGo web search is not an official SERP API.
   Keep this module server-side only; never expose it to the browser.
*/

import { search } from "duck-duck-scrape";

const OFFICIAL_DOMAINS=[
  "cbseacademic.nic.in",
  "cbse.gov.in",
  "ncert.nic.in"
];

const normalize=(item)=>({
  title:item?.title||"",
  url:item?.url||"",
  snippet:item?.description||item?.body||""
});

const isOfficial=(url="")=>{
  try{
    const host=new URL(url).hostname.toLowerCase().replace(/^www\./,"");
    return OFFICIAL_DOMAINS.some(domain=>host===domain||host.endsWith("." + domain));
  }catch{return false}
};

export async function searchWeb(query,{maxResults=8,officialOnly=false}={}){
  const clean=String(query||"").trim();
  if(!clean) return [];

  const q=officialOnly
    ? `${clean} (${OFFICIAL_DOMAINS.map(d=>`site:${d}`).join(" OR ")})`
    : clean;

  const response=await search(q);
  const results=Array.isArray(response?.results)?response.results.map(normalize):[];

  return results
    .filter(r=>r.url)
    .filter(r=>!officialOnly||isOfficial(r.url))
    .slice(0,Math.min(20,Math.max(1,maxResults)));
}

export {OFFICIAL_DOMAINS,isOfficial};
