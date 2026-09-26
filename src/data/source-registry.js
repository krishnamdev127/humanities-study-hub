/* Verified-source registry for curriculum-aware question generation.
   Source priority:
   1) CBSE Academic / CBSE official
   2) NCERT
   3) Trusted supplementary sources only when explicitly enabled.
   This registry stores discovery endpoints, not question content. */

export const SOURCE_PRIORITIES={
  official_cbse:1,
  official_ncert:1,
  trusted_secondary:2
};

export const VERIFIED_SOURCES=[
  {
    id:"cbse-academic",
    tier:"official_cbse",
    publisher:"CBSE Academic",
    title:"CBSE Academic main portal",
    url:"https://cbseacademic.nic.in/",
    capabilities:["curriculum","sqps","marking_schemes","notifications"]
  },
  {
    id:"cbse-class12-sqp-2026-27",
    tier:"official_cbse",
    publisher:"CBSE Academic",
    title:"Class XII Sample Question Papers & Marking Schemes 2026-27",
    url:"https://cbseacademic.nic.in/SQP_CLASSXII_2026-27.html",
    capabilities:["sqps","marking_schemes","paper_design"],
    session:"2026-27"
  },
  {
    id:"cbse-circulars",
    tier:"official_cbse",
    publisher:"CBSE Academic",
    title:"CBSE Academic circulars and notifications",
    url:"https://cbseacademic.nic.in/circulars.html",
    capabilities:["notifications","updates"]
  },
  {
    id:"cbse-question-papers",
    tier:"official_cbse",
    publisher:"CBSE",
    title:"CBSE official previous-year question papers",
    url:"https://www.cbse.gov.in/cbsenew/question-paper.html",
    capabilities:["previous_year_papers"]
  },
  {
    id:"cbse-exam-circulars",
    tier:"official_cbse",
    publisher:"CBSE",
    title:"CBSE examination circulars",
    url:"https://www.cbse.gov.in/cbsenew/examination_Circular.html",
    capabilities:["notifications","exam_updates"]
  },
  {
    id:"ncert-textbooks",
    tier:"official_ncert",
    publisher:"NCERT",
    title:"NCERT official textbook portal",
    url:"https://ncert.nic.in/textbook.php",
    capabilities:["textbooks","chapters"]
  }
];

export const CURRENT_ACADEMIC_SESSION="2026-27";

export const CURRENT_CURRICULUM_SOURCES={
  History:"https://cbseacademic.nic.in/web_material/CurriculumMain27/SecPart2/History_SecP2_2026-27.pdf",
  Geography:"https://cbseacademic.nic.in/web_material/CurriculumMain27/SecPart2/Geography_SecP2_2026-27.pdf",
  "Political Science":"https://cbseacademic.nic.in/web_material/CurriculumMain27/SecPart2/PoliticalScience_SecP2_2026-27.pdf",
  English:"https://cbseacademic.nic.in/web_material/CurriculumMain27/SecPart2/English_core_SecP2_2026-27.pdf"
};

export const RESEARCH_POLICY={
  officialOnlyForCurriculum:true,
  officialOnlyForPyq:true,
  trustedSourcesMaySupplement:true,
  generatedQuestionsMustBeLabeled:true,
  liveResearchRequiredForCurrentClaims:true
};

export function sourcesFor(capability){
  return VERIFIED_SOURCES.filter(s=>s.capabilities.includes(capability))
    .sort((a,b)=>(SOURCE_PRIORITIES[a.tier]||99)-(SOURCE_PRIORITIES[b.tier]||99));
}

export function officialSources(){
  return VERIFIED_SOURCES.filter(s=>s.tier==="official_cbse"||s.tier==="official_ncert");
}
