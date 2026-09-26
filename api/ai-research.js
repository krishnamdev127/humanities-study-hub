/* Vercel serverless boundary for AI-assisted curriculum research and question generation.
   Required environment variable: OPENAI_API_KEY
   The key is NEVER sent to the browser.

   This endpoint is deliberately conservative:
   - current curriculum / PYQ claims must be verified against official sources
   - generated questions are never labelled as official PYQs
   - callers receive structured JSON only
*/

const OFFICIAL_DOMAINS=[
  "cbseacademic.nic.in",
  "cbse.gov.in",
  "ncert.nic.in"
];

const json=(res,status,body)=>{
  res.status(status).setHeader("Content-Type","application/json; charset=utf-8");
  return res.end(JSON.stringify(body));
};

export default async function handler(req,res){
  if(req.method!=="POST")return json(res,405,{error:"POST required"});
  if(!process.env.OPENAI_API_KEY)return json(res,503,{error:"AI service is not configured yet. Add OPENAI_API_KEY to the server environment."});

  const body=req.body||{};
  const {task}=body;
  if(task!=="curriculum_research"&&task!=="generate_questions")
    return json(res,400,{error:"Unsupported AI task"});

  const system=task==="curriculum_research"
    ? `You are the research layer for a CBSE Class XII Humanities study app.
Use web search to verify current curriculum, syllabus, sample papers, marking schemes and official previous-year papers.
For curriculum and PYQ claims, prefer ONLY official CBSE/NCERT sources from these domains: ${OFFICIAL_DOMAINS.join(", ")}.
Return concise structured JSON with: session, subject, chapter, sources[{title,url,publisher,claim}], verified_claims[], uncertainties[].
Never invent a source or claim. If official evidence is unavailable, say so.`
    : `You are the question-generation layer for a CBSE Class XII Humanities study app.
Use the supplied research context and, when needed, web search to verify current syllabus/paper-pattern facts.
Curriculum and PYQ facts must be grounded in official CBSE/NCERT sources.
Generate NEW practice questions only; never claim generated questions are official PYQs.
Return JSON: {questions:[{text,options,correct_index,explanation,difficulty,qtype,marks,topic,source:"ai_generated"}]}.
Keep every question strictly inside the requested subject/chapter/topic and avoid metadata questions about the paper itself.`;

  const input=task==="curriculum_research"
    ? JSON.stringify({subject:body.subject||"",chapter:body.chapter||"",session:body.session||"current"})
    : JSON.stringify({subject:body.subject||"",chapter:body.chapter||"",topic:body.topic||"",count:Math.min(30,Math.max(1,Number(body.count)||10)),difficulty:body.difficulty||"mixed",questionType:body.questionType||"mcq",researchContext:body.researchContext||[]});

  const payload={
    model:"gpt-5.6-mini",
    tools:[{type:"web_search_preview"}],
    input:[{role:"system",content:system},{role:"user",content:input}]
  };

  try{
    const upstream=await fetch("https://api.openai.com/v1/responses",{
      method:"POST",
      headers:{
        "Authorization":`Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type":"application/json"
      },
      body:JSON.stringify(payload)
    });
    const data=await upstream.json();
    if(!upstream.ok)return json(res,502,{error:"AI provider request failed",details:data?.error?.message||"Unknown provider error"});

    const text=data.output_text||"";
    let parsed;
    try{parsed=JSON.parse(text)}catch{
      const match=text.match(/\{[\s\S]*\}/);
      if(match)try{parsed=JSON.parse(match[0])}catch{}
    }
    if(!parsed)return json(res,502,{error:"AI returned an invalid structured response"});
    return json(res,200,{...parsed,research_used:true});
  }catch(error){
    return json(res,500,{error:"AI research request failed",details:String(error?.message||error)});
  }
}
