/* Syllabus catalogue — chapter names and order are kept exactly as in the original tracker.
   Existing progress is stored by (subject, position), so NEVER reorder or insert chapters in
   the middle of a subject: append only. */
export const SUBJECTS={"History": ["Bricks, Beads and Bones", "Kings, Farmers and Towns", "Kinship, Caste and Class", "Thinkers, Beliefs and Buildings", "Through the Eyes of Travellers", "Bhakti-Sufi Traditions", "An Imperial Capital: Vijayanagara", "Peasants, Zamindars and the State", "Colonialism and the Countryside", "Rebels and the Raj", "Mahatma Gandhi and the Nationalist Movement", "Framing the Constitution"], "Geography": ["Human Geography: Nature and Scope", "The World Population", "Human Development", "Primary Activities", "Secondary Activities", "Tertiary and Quaternary Activities", "Transport, Communication and Trade", "International Trade", "Population: Distribution, Density, Growth and Composition", "Human Settlements", "Land Resources and Agriculture", "Water Resources", "Mineral and Energy Resources", "Planning and Sustainable Development in Indian Context", "Transport and Communication", "International Trade (India)", "Geographical Perspective on Selected Issues and Problems"], "Political Science": ["The End of Bipolarity", "Contemporary Centres of Power", "Contemporary South Asia", "International Organizations", "Security in the Contemporary World", "Environment and Natural Resources", "Globalisation", "Challenges of Nation Building", "Era of One-Party Dominance", "Politics of Planned Development", "India's External Relations", "Challenges to and Restoration of the Congress System", "The Crisis of Democratic Order", "Regional Aspirations", "Recent Developments in Indian Politics"], "English": ["The Last Lesson", "Lost Spring", "Deep Water", "The Rattrap", "Indigo", "Poets and Pancakes", "The Interview", "Going Places", "My Mother at Sixty-six", "Keeping Quiet", "A Thing of Beauty", "A Roadside Stand", "Aunt Jennifer's Tigers", "The Third Level", "The Tiger King", "Journey to the End of the Earth", "The Enemy", "On the Face of It", "Memories of Childhood", "Notice / Invitation", "Replies", "Letter Writing", "Article / Report"], "Hindi": ["भक्तिन", "बाजार दर्शन", "काले मेघा पानी दे", "पहलवान की ढोलक", "शिरीष के फूल", "श्रम विभाजन और जाति-प्रथा", "आत्म-परिचय / एक गीत", "पतंग", "कविता के बहाने / बात सीधी थी पर", "कैमरे में बंद अपाहिज", "सहर्ष स्वीकारा है", "उषा", "बादल राग", "रुबाइयाँ / ग़ज़ल", "छोटे मेरे खेत / बगुलों के पंख", "सिल्वर वैडिंग", "जूझ", "अतीत में दबे पाँव", "डायरी के पन्ने", "लेखन के विभिन्न प्रारूप", "व्याकरण / भाषा अभ्यास"]};
export const TASKS=["NCERT Read","Notes","Questions / PYQs","Revision","Completed"];
export const TASK_SHORT=["NCERT","NOTES","Q / PYQ","REV","DONE"];
export const SUBJ_KEYS=Object.keys(SUBJECTS);

/* Stable ids used by the new data layer (questions, sessions, notes, ...). */
export const SUBJECT_SLUG={"History":"history","Geography":"geography","Political Science":"polsci","English":"english","Hindi":"hindi"};

export function chapterId(subject,index){
  const slug=SUBJECT_SLUG[subject];
  if(!slug||!Number.isInteger(index)||index<0||index>=SUBJECTS[subject].length)return null;
  return slug+"-"+String(index+1).padStart(2,"0");
}

const BY_ID=new Map();
for(const s of SUBJ_KEYS)SUBJECTS[s].forEach((name,i)=>BY_ID.set(chapterId(s,i),{id:chapterId(s,i),subject:s,index:i,name}));

export const chapterById=id=>BY_ID.get(id)||null;
export const allChapters=()=>[...BY_ID.values()];
