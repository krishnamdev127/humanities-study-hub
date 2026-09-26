/* AI research client.
   The browser never receives an AI provider secret. The server endpoint owns credentials.
   This client is optional: the Study Hub continues to work from its local question bank offline. */

export async function researchCurriculum({subject,chapter,session="current"}={}){
  const res=await fetch("/api/ai-research",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({task:"curriculum_research",subject,chapter,session})
  });
  if(!res.ok){
    let message="AI research unavailable";
    try{const data=await res.json();if(data?.error)message=data.error}catch{}
    throw new Error(message);
  }
  return res.json();
}

export async function generateQuestions({subject,chapter,topic="",count=10,difficulty="mixed",questionType="mcq",researchContext=[]}={}){
  const res=await fetch("/api/ai-research",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({task:"generate_questions",subject,chapter,topic,count,difficulty,questionType,researchContext})
  });
  if(!res.ok){
    let message="AI question generation unavailable";
    try{const data=await res.json();if(data?.error)message=data.error}catch{}
    throw new Error(message);
  }
  return res.json();
}
