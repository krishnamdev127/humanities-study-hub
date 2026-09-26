/* DuckDuckGo web-search adapter.
   This stays server-side and is isolated so the provider can later be
   replaced by SearXNG or another SERP provider without changing the app.
*/

import {WebSearch} from "duckduckgo-websearch";

const OFFICIAL_DOMAINS=[
  "cbseacademic.nic.in",
  "cbse.gov.in",
  "ncert.nic.in"
];

const normalize=(item)=>({
  title:item?.title||"",
  url:item?.link||item?.url||"",
  snippet:item?.snippet||item?.description||""
});

const isOfficial=(url="")=>{
  try{
    const host=new URL(url).hostname.toLowerCase().replace(/^www\./,"");
    return OFFICIAL_DOMAINS.some(domain=>host===domain||host.endsWith("." + domain));
  }catch{return false}
};

export async function searchWeb(query,{maxResults=8,officialOnly=false}={}){
  const clean=String(query||"").trim();
  if(!clean)return [];

  const q=officialOnly
    ? `${clean} ${OFFICIAL_DOMAINS.map(d=>`site:${d}`).join(" OR ")}`
    : clean;

  const searcher=new WebSearch();
  const response=await searcher.search(q,{maxResults:Math.min(25,Math.max(1,maxResults))});
  const results=Array.isArray(response)
    ? response
    : Array.isArray(response?.results) ? response.results : [];

  return results
    .map(normalize)
    .filter(r=>r.url)
    .filter(r=>!officialOnly||isOfficial(r.url))
    .slice(0,Math.min(20,Math.max(1,maxResults)));
}

export {OFFICIAL_DOMAINS,isOfficial};
