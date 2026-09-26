/* LangSearch Web Search adapter.
   Server-side only.
   Required environment variable: LANGSEARCH_API_KEY
*/

const LANGSEARCH_URL="https://api.langsearch.com/v1/web-search";

export const OFFICIAL_DOMAINS=[
  "cbseacademic.nic.in",
  "cbse.gov.in",
  "ncert.nic.in"
];

const normalize=(item)=>({
  title:item?.name||item?.title||"",
  url:item?.url||item?.link||"",
  snippet:item?.snippet||item?.summary||item?.text||""
});

const isOfficial=(url="")=>{
  try{
    const host=new URL(url).hostname.toLowerCase().replace(/^www\./,"");
    return OFFICIAL_DOMAINS.some(domain=>host===domain||host.endsWith("." + domain));
  }catch{return false}
};

function extractResults(data){
  const candidates=[
    data?.data?.webPages?.value,
    data?.data?.webpages?.value,
    data?.webPages?.value,
    data?.webpages?.value,
    data?.data?.results,
    data?.results
  ];
  return candidates.find(Array.isArray)||[];
}

export async function searchWeb(query,{maxResults=8,officialOnly=false}={}) {
  const clean=String(query||"").trim();
  if(!clean)return [];

  if(!process.env.LANGSEARCH_API_KEY)
    throw new Error("LANGSEARCH_API_KEY is not configured");

  const payload={
    query:clean,
    freshness:"noLimit",
    summary:true,
    count:Math.min(50,Math.max(1,maxResults))
  };

  if(officialOnly)payload.includeDomains=OFFICIAL_DOMAINS;

  const upstream=await fetch(LANGSEARCH_URL,{
    method:"POST",
    headers:{
      "Authorization":`Bearer ${process.env.LANGSEARCH_API_KEY}`,
      "Content-Type":"application/json"
    },
    body:JSON.stringify(payload)
  });

  const data=await upstream.json().catch(()=>({}));
  if(!upstream.ok)
    throw new Error(data?.msg||data?.message||`LangSearch request failed (${upstream.status})`);

  return extractResults(data)
    .map(normalize)
    .filter(r=>r.url)
    .filter(r=>!officialOnly||isOfficial(r.url))
    .slice(0,Math.min(50,Math.max(1,maxResults)));
}

export {isOfficial};
