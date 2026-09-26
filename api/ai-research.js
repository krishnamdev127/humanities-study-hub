/* Vercel serverless boundary for AI-assisted curriculum research and question generation.
   LLM: NVIDIA NIM (GLM-5.3)
   Search: DuckDuckGo web search adapter
   Required server environment variable: NVIDIA_API_KEY
   The key is NEVER sent to the browser.

   Search is deliberately separated from the LLM so the provider can later be
   replaced by SearXNG or another SERP provider without changing the frontend.
*/

import {searchWeb,OFFICIAL_DOMAINS} from "./lib/duckduckgo.js";

const NVIDIA_BASE_URL="https://integrate.api.nvidia.com/v1";
const NVIDIA_MODEL="z-ai/glm-5.3";

const json=(res,status,body)=>{
  res.status(status).setHeader("Content-Type","application/json; charset=utf-8");
  return res.end(JSON.stringify(body));
};

const parseJson=(text)=>{
  try{return JSON.parse(text)}catch{
    const match=String(text||"").match(/\{[\s\S]*\}/);
    if(match)try{return JSON.parse(match[0])}catch{}
  }
  return null;
};

async function askModel(system,user){
  const upstream=await fetch(`${NVIDIA_BASE_URL}/chat/completions`,{
    method:"POST",
    headers:{
      "Authorization":`Bearer ${process.env.NVIDIA_API_KEY}`,
      "Content-Type":"application/json"
    },
    body:JSON.stringify({
      model:NVIDIA_MODEL,
      messages:[
        {role:"system",content:system},
        {role:"user",content:user}
      ],
      temperature:0.2,
      top_p:1,
      max_tokens:4096,
      stream:false
    })
  });

  const data=await upstream.json();
  if(!upstream.ok)throw new Error(data?.error?.message||"NVIDIA provider request failed");

  const content=data?.choices?.[0]?.message?.content||"";
  const parsed=parseJson(content);
  if(!parsed)throw new Error("GLM returned an invalid structured response");
  return parsed;
}

const buildResearchQuery=({subject,chapter,session})=>
  `CBSE Class XII ${subject} ${chapter} ${session} syllabus sample paper marking scheme official`;

export default async function handler(req,res){
  if(req.method!=="POST")return json(res,405,{error:"POST required"});
  if(!process.env.NVIDIA_API_KEY)
    return json(res,503,{error:"AI service is not configured yet. Add NVIDIA_API_KEY to the server environment."});

  const body=req.body||{};
  const {task}=body;
  if(task!=="curriculum_research"&&task!=="generate_questions")
    return json(res,400,{error:"Unsupported AI task"});

  try{
    const subject=String(body.subject||"");
    const chapter=String(body.chapter||"");
    const session=String(body.session||"current");

    const query=task==="curriculum_research"
      ? buildResearchQuery({subject,chapter,session})
      : `CBSE Class XII ${subject} ${chapter} ${body.topic||""} syllabus NCERT practice questions`;

    const searchResults=await searchWeb(query,{maxResults:10,officialOnly:true});

    const researchContext=searchResults.map(r=>({
      title:r.title,
      url:r.url,
      snippet:r.snippet
    }));

    const system=task==="curriculum_research"
      ? `You are the research layer for a CBSE Class XII Humanities study app.
Use ONLY the supplied search results as evidence. The results were restricted to official CBSE/NCERT domains: ${OFFICIAL_DOMAINS.join(", ")}.
Do not invent sources or claims. If the supplied results do not establish something, put it in uncertainties.
Return ONLY valid JSON with:
{"session":"","subject":"","chapter":"","sources":[{"title":"","url":"","publisher":"","claim":""}],"verified_claims":[],"uncertainties":[]}
Treat current-session claims as current only when supported by the supplied official results.`
      : `You are the question-generation layer for a CBSE Class XII Humanities study app.
Use the supplied official CBSE/NCERT search context to stay inside the current syllabus.
Generate NEW practice questions only. Never claim generated questions are official PYQs.
Do not generate questions about sample-paper counts, marks, metadata, or the research process.
Return ONLY valid JSON:
{"questions":[{"text":"","options":["","","",""],"correct_index":0,"explanation":"","difficulty":"easy|medium|hard","qtype":"mcq","marks":1,"topic":"","source":"ai_generated"}]}
Keep every question strictly inside the requested subject/chapter/topic.`;

    const input=JSON.stringify({
      subject,
      chapter,
      topic:body.topic||"",
      session,
      count:Math.min(30,Math.max(1,Number(body.count)||10)),
      difficulty:body.difficulty||"mixed",
      questionType:body.questionType||"mcq",
      official_sources:researchContext
    });

    const parsed=await askModel(system,input);
    return json(res,200,{
      ...parsed,
      research_used:true,
      search_provider:"duckduckgo",
      llm_provider:"nvidia",
      model:NVIDIA_MODEL,
      source_results:researchContext
    });
  }catch(error){
    return json(res,502,{
      error:"AI research request failed",
      details:String(error?.message||error)
    });
  }
}
