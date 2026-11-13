import { useEffect, useState } from 'react';

import { Activity, ArrowDownRight, ArrowRight, BookOpen, BriefcaseBusiness, Check, ChevronDown, CircleHelp, Compass, FileSearch, FileText, Flame, LayoutDashboard, LockKeyhole, LogOut, Menu, Mic2, MoreHorizontal, Plus, Send, Settings2, Sparkles, Target, TrendingUp, Trash2, UserRound, X } from 'lucide-react';
import MoreModules from './MoreModules';

function TutorText({text}:{text:string}) {
  const inline = (value:string) => value.replace(/\\([*`_])/g,'$1').split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part,i) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2,-2)}</strong>;
    if (part.startsWith('`') && part.endsWith('`')) return <code key={i}>{part.slice(1,-1)}</code>;
    if (part.startsWith('*') && part.endsWith('*')) return <em key={i}>{part.slice(1,-1)}</em>;
    return part;
  });
  const lines = text.split(/\r?\n/);
  const blocks:React.ReactNode[]=[];
  let paragraph:string[]=[]; let bullets:string[]=[]; let numbers:string[]=[];
  const flush=()=>{if(paragraph.length){blocks.push(<p key={`p${blocks.length}`}>{inline(paragraph.join(' '))}</p>);paragraph=[];}if(bullets.length){blocks.push(<ul key={`u${blocks.length}`}>{bullets.map((x,i)=><li key={i}>{inline(x)}</li>)}</ul>);bullets=[];}if(numbers.length){blocks.push(<ol key={`o${blocks.length}`}>{numbers.map((x,i)=><li key={i}>{inline(x)}</li>)}</ol>);numbers=[];}};
  for(const raw of lines){const line=raw.trim().replace(/\\([*+.-])/g,'$1');if(!line){flush();continue;}const bullet=line.match(/^(?:[-+*])\s+(.+)/);const number=line.match(/^\d+[.)]\s+(.+)/);if(bullet){if(paragraph.length||numbers.length)flush();bullets.push(bullet[1]);continue;}if(number){if(paragraph.length||bullets.length)flush();numbers.push(number[1]);continue;}if(bullets.length||numbers.length)flush();paragraph.push(line);}
  flush(); return <div className="tutor-markdown">{blocks}</div>;
}



const API = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

type User = { id: number; email: string; full_name: string; target_role: string; experience_level: string };

type Goal = { id: number; title: string; status: string };

type Overview = { profile: { full_name: string; target_role: string }; goal_count: number; goals: Goal[]; readiness: number | null; readiness_note: string; integrations: { ai_provider: string } };



function App() {

  const [token, setToken] = useState(localStorage.getItem('cp_token') || '');

  const [user, setUser] = useState<User | null>(null);

  const [overview, setOverview] = useState<Overview | null>(null);

  const [view, setView] = useState('Dashboard');

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState('');

  const [notice, setNotice] = useState('');

  const [goal, setGoal] = useState('');

  const [authMode, setAuthMode] = useState<'login'|'register'>('login');

  const [menuOpen, setMenuOpen] = useState(false);

  const [resumes, setResumes] = useState<{id:number;filename:string;uploaded_at:string}[]>([]);

  const [analysis, setAnalysis] = useState<any>(null);

  const [roadmap, setRoadmap] = useState<any>(null);

  const [featureBusy, setFeatureBusy] = useState(false);

  const [tutorSession, setTutorSession] = useState('');

  const [tutorMessages, setTutorMessages] = useState<any[]>([]);

  const [tutorTopic, setTutorTopic] = useState('');

  const [tutorSessions, setTutorSessions] = useState<any[]>([]);

  const [tutorQuiz, setTutorQuiz] = useState<any>(null);

  const [quizAnswers, setQuizAnswers] = useState<number[]>([]);

  const [quizResult, setQuizResult] = useState<any>(null);
  const [knowledgeDocs, setKnowledgeDocs] = useState<any[]>([]);
  const [ragQuestion, setRagQuestion] = useState('');
  const [ragResult, setRagResult] = useState<any>(null);



  async function api(path: string, options: RequestInit = {}) {

    const response = await fetch(`${API}${path}`, { ...options, headers: { ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers } });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) throw new Error(data.detail || `Request failed (${response.status})`);

    return data;

  }

  async function refresh() {

    if (!token) return;

    try { const [me, data] = await Promise.all([api('/auth/me'), api('/dashboard/overview')]); setUser(me); setOverview(data); }

    catch (e) { setToken(''); localStorage.removeItem('cp_token'); setUser(null); setError(e instanceof Error ? e.message : 'Could not load your account'); }

  }

  useEffect(() => { refresh(); }, [token]);


  // Keep action feedback on the page where it was triggered.
  useEffect(() => { setError(''); setNotice(''); }, [view]);

  useEffect(() => { if (!token) return; api('/resume').then(setResumes).catch(()=>{}); api('/learning/roadmap').then(setRoadmap).catch(()=>{}); }, [token]);

  useEffect(() => { if (token && view==='AI tutor') loadTutorSessions(); }, [token,view]);
  useEffect(() => { if (token && view==='Knowledge library') api('/documents').then(setKnowledgeDocs).catch(e=>setError(e instanceof Error?e.message:'Could not load documents')); }, [token,view]);

  async function authenticate(event: React.FormEvent<HTMLFormElement>) {

    event.preventDefault(); setLoading(true); setError('');

    const form = new FormData(event.currentTarget); const body: Record<string,string> = { email: String(form.get('email')), password: String(form.get('password')) };

    if (authMode === 'register') body.full_name = String(form.get('full_name'));

    try { const result = await fetch(`${API}/auth/${authMode === 'register' ? 'register' : 'login'}`, { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(body) }); const data = await result.json(); if (!result.ok) throw new Error(data.detail || 'Could not sign in'); localStorage.setItem('cp_token', data.access_token); setToken(data.access_token); }

    catch(e) { setError(e instanceof Error ? e.message : 'Could not connect to CareerPilot API'); }

    finally { setLoading(false); }

  }

  async function addGoal(event: React.FormEvent) { event.preventDefault(); if (!goal.trim()) return; try { await api('/career/goals', { method:'POST', body:JSON.stringify({title:goal}) }); setGoal(''); setNotice('Career goal saved'); refresh(); } catch(e) { setError(e instanceof Error ? e.message : 'Could not save goal'); } }

  async function uploadResume(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); const formElement = event.currentTarget; const form = new FormData(formElement); setFeatureBusy(true); setError(''); try { const result = await api('/resume/upload', { method:'POST', body:form }); setResumes((items)=>[result,...items]); setNotice('Resume securely uploaded and text extracted'); formElement.reset(); } catch(e) { setError(e instanceof Error ? e.message : 'Resume upload failed'); } finally { setFeatureBusy(false); } }

  async function analyzeResume(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); const formElement = event.currentTarget; const form = new FormData(formElement); setFeatureBusy(true); setError(''); try { const result = await api('/resume/analyze', { method:'POST', body:JSON.stringify({resume_id:Number(form.get('resume_id')),target_role:String(form.get('target_role'))}) }); setAnalysis(result); setUser((old)=>old?{...old,target_role:result.target_role}:old); setNotice('Resume skill coverage analyzed'); refresh(); } catch(e) { setError(e instanceof Error ? e.message : 'Analysis failed'); } finally { setFeatureBusy(false); } }

  async function createRoadmap(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); const formElement = event.currentTarget; const form = new FormData(formElement); setFeatureBusy(true); setError(''); try { const result = await api('/career/roadmap', { method:'POST', body:JSON.stringify({target_role:String(form.get('target_role')),analysis_id:analysis?.id ?? null}) }); setRoadmap(result); setNotice('Your learning roadmap is saved'); } catch(e) { setError(e instanceof Error ? e.message : 'Roadmap generation failed'); } finally { setFeatureBusy(false); } }

  async function updateTask(taskId:number,status:string) { try { await api(`/learning/progress?task_id=${taskId}`,{method:'POST',body:JSON.stringify({status})}); const updated=await api('/learning/roadmap'); setRoadmap(updated); } catch(e) { setError(e instanceof Error ? e.message : 'Could not save progress'); } }

  async function askTutor(event:React.FormEvent<HTMLFormElement>){event.preventDefault();const formElement=event.currentTarget;const form=new FormData(formElement);const message=String(form.get('message')||'');setFeatureBusy(true);try{const out=await api('/tutor/chat',{method:'POST',body:JSON.stringify({message,topic:tutorTopic,session_id:tutorSession||null})});setTutorSession(out.session_id);setTutorMessages(v=>[...v,{role:'user',content:message},{role:'assistant',content:out.answer,mode:out.mode}]);formElement.reset()}catch(e){setError(e instanceof Error?e.message:'Tutor request failed')}finally{setFeatureBusy(false)}}

  async function loadTutorSessions(){try{setTutorSessions(await api('/tutor/sessions'))}catch{}}

  async function openTutorSession(id:string){try{setTutorSession(id);setTutorMessages(await api(`/tutor/sessions/${id}`))}catch(e){setError(e instanceof Error?e.message:'Could not load session')}}

  async function makeTutorQuiz(){setFeatureBusy(true);setQuizResult(null);try{const result=await api('/tutor/quiz',{method:'POST',body:JSON.stringify({topic:tutorTopic||'Programming fundamentals'})});setTutorQuiz(result);setQuizAnswers(Array(result.questions.length).fill(-1))}catch(e){setError(e instanceof Error?e.message:'Quiz generation failed')}finally{setFeatureBusy(false)}}

  async function submitTutorQuiz(){try{const result=await api('/tutor/quiz',{method:'POST',body:JSON.stringify({topic:tutorQuiz.topic,questions:tutorQuiz.questions,answers:quizAnswers})});setQuizResult(result)}catch(e){setError(e instanceof Error?e.message:'Quiz submission failed')}}
  async function uploadKnowledge(event:React.FormEvent<HTMLFormElement>){event.preventDefault();const formElement=event.currentTarget;const form=new FormData(formElement);setFeatureBusy(true);setError('');setNotice('');try{const item=await api('/documents/upload',{method:'POST',body:form});setKnowledgeDocs(v=>[item,...v]);formElement.reset();setError('');setNotice(`Indexed ${item.chunks} document passages`)}catch(e){setNotice('');setError(e instanceof Error?e.message:'Document indexing failed')}finally{setFeatureBusy(false)}}
  async function removeKnowledge(id:number){try{await api(`/documents/${id}`,{method:'DELETE'});setKnowledgeDocs(v=>v.filter(d=>d.id!==id));setNotice('Document and its indexed vectors were deleted')}catch(e){setError(e instanceof Error?e.message:'Could not delete document')}}
  async function retryKnowledgeIndex(id:number){setFeatureBusy(true);setError('');setNotice('');try{const updated=await api(`/documents/${id}/index`,{method:'POST'});setKnowledgeDocs(v=>v.map(d=>d.id===id?updated:d));setError('');setNotice(`Indexed ${updated.chunks} document passages`)}catch(e){setNotice('');setError(e instanceof Error?e.message:'Document indexing failed')}finally{setFeatureBusy(false)}}
  async function queryKnowledge(event:React.FormEvent){event.preventDefault();setFeatureBusy(true);setError('');setNotice('');setRagResult(null);try{setRagResult(await api('/rag/query',{method:'POST',body:JSON.stringify({query:ragQuestion,limit:5})}));setError('')}catch(e){setNotice('');setError(e instanceof Error?e.message:'Document search failed')}finally{setFeatureBusy(false)}}

  function logout() { localStorage.removeItem('cp_token'); setToken(''); setUser(null); setOverview(null); }



  if (!token || !user) return <div className="auth-shell"><div className="auth-art"><div className="brand"><span className="brand-icon"><Compass size={21}/></span> careerpilot<span className="brand-ai">AI</span></div><div className="art-copy"><div className="eyebrow"><span className="live-dot"/> YOUR NEXT CHAPTER STARTS HERE</div><h1>Build a career<br/>that moves <em>you.</em></h1><p>Your personal command center for learning, interview prep, and finding work that fits your future.</p><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="art-chip"><Sparkles size={15}/> A little progress, every day</div></div><div className="auth-foot">Made for the next version of you <Sparkles size={13}/></div></div><main className="auth-main"><div className="auth-card"><div className="mobile-brand brand"><span className="brand-icon"><Compass size={21}/></span> careerpilot<span className="brand-ai">AI</span></div><div className="eyebrow">{authMode === 'login' ? 'WELCOME BACK' : "LET'S GET STARTED"}</div><h2>{authMode === 'login' ? 'Sign in to your space' : 'Create your account'}</h2><p className="subcopy">{authMode === 'login' ? 'Your next step is waiting.' : 'A clearer path starts with one small step.'}</p><form onSubmit={authenticate} className="auth-form">{authMode === 'register' && <label>Your name<input required name="full_name" placeholder="Alex Morgan"/></label>}<label>Email address<input required name="email" type="email" placeholder="you@example.com" autoComplete="email"/></label><label>Password<input required name="password" type="password" minLength={authMode === 'register'?10:1} placeholder={authMode==='register'?'At least 10 characters':'Enter your password'} autoComplete={authMode==='register'?'new-password':'current-password'}/></label>{error && <div className="error">{error}</div>}<button className="primary-btn" disabled={loading}>{loading ? 'Please wait...' : authMode==='login'?'Sign in':'Create account'} <ArrowRight size={17}/></button></form><div className="auth-switch">{authMode==='login'?"New to CareerPilot?":"Already have an account?"} <button onClick={()=>{setAuthMode(authMode==='login'?'register':'login');setError('')}}>{authMode==='login'?'Create an account':'Sign in'}</button></div><div className="privacy-note"><LockKeyhole size={13}/> Your career data stays private to your account.</div></div></main></div>;



  const nav = [{ label:'Workspace', items:[['Dashboard',LayoutDashboard],['My roadmap',Compass],['AI tutor',BookOpen],['Knowledge library',FileSearch],['Mock interviews',Mic2]] }, { label:'CAREER', items:[['Resume insights',FileText],['Explore jobs',BriefcaseBusiness],['Applications',Target]] }, { label:'YOU', items:[['Progress',TrendingUp],['My profile',UserRound]] }] as const;

  const firstName = user.full_name?.split(' ')[0] || 'there';

  const date = new Intl.DateTimeFormat('en', { weekday:'long', month:'long', day:'numeric' }).format(new Date());

  return <div className="app-shell"><aside className={`sidebar ${menuOpen?'open':''}`}><div className="brand"><span className="brand-icon"><Compass size={20}/></span> careerpilot<span className="brand-ai">AI</span><button className="close-menu" onClick={()=>setMenuOpen(false)}><X size={18}/></button></div><button className="workspace-select"><div className="workspace-avatar">{firstName[0]?.toUpperCase()}</div><span><b>My workspace</b><small>Personal account</small></span><ChevronDown size={15}/></button><div className="nav-wrap">{nav.map(group=><div className="nav-group" key={group.label}><div className="nav-label">{group.label}</div>{group.items.map(([label,Icon])=><button key={label} className={`nav-link ${view===label?'active':''}`} onClick={()=>{setView(label);setMenuOpen(false)}}><Icon size={17}/><span>{label}</span>{label==='Mock interviews'&&<span className="new-pill">NEW</span>}</button>)}</div>)}</div><div className="sidebar-bottom"><div className="streak-card"><div className="streak-icon"><Flame size={17}/></div><div><b>Start a streak</b><small>One small step today</small></div><ArrowDownRight size={16}/></div><button className="nav-link"><CircleHelp size={17}/><span>Help & support</span></button><button className="nav-link logout-nav" onClick={logout} title="Log out of CareerPilot"><LogOut size={17}/><span>Log out</span></button><div className="user-mini"><div className="user-avatar">{firstName[0]?.toUpperCase()}</div><span><b>{user.full_name}</b><small>{user.email}</small></span><Settings2 size={16}/></div></div></aside>

    {menuOpen&&<button className="scrim" onClick={()=>setMenuOpen(false)} aria-label="Close menu"/>}<main className="main"><header className="topbar"><button className="hamburger" onClick={()=>setMenuOpen(true)}><Menu/></button><div className="crumb">My workspace <span>/</span> <b>{view}</b></div><div className="top-actions"><button type="button" className="icon-btn logout-top" onClick={logout} title="Log out" aria-label="Log out"><LogOut size={18}/></button><button className="icon-btn"><CircleHelp size={18}/></button><div className="top-avatar">{firstName[0]?.toUpperCase()}</div></div></header><div className="page-content"><div className="welcome-row"><div><div className="eyebrow date-label">{date.toUpperCase()} <span className="date-spark"><Sparkles size={12}/></span></div><h1>{view==='Dashboard'?<>A good day to grow, <em>{firstName}.</em></>:view}</h1><p className="welcome-sub">{view==='Dashboard'?'Your career journey, all in one place. Here\'s where things stand.':'Keep moving toward work that feels like you.'}</p></div><button className="outline-btn" onClick={()=>setNotice('Your dashboard is up to date')}><Activity size={16}/> <span>All systems go</span><i/></button></div>

      {error&&<div className="error-banner">{error}<button onClick={()=>setError('')}><X size={15}/></button></div>}{notice&&<div className="success-banner"><Check size={15}/>{notice}<button onClick={()=>setNotice('')}><X size={15}/></button></div>}

      {view==='Resume insights'&&<section className="feature-page"><div className="feature-card"><div className="eyebrow">RESUME INTELLIGENCE</div><h2>Turn your experience into a clear next step.</h2><p>Upload a text-based PDF or DOCX resume (up to 8 MB). The extracted text stays tied to your account.</p><form className="feature-form upload-form" onSubmit={uploadResume}><input name="file" type="file" required accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"/><button className="primary-btn" disabled={featureBusy}><FileText size={16}/>{featureBusy?'Working...':'Upload resume'}</button></form>{resumes.length>0&&<form className="feature-form analyze-form" onSubmit={analyzeResume}><label>Resume<select name="resume_id" required defaultValue={resumes[0].id}>{resumes.map(r=><option value={r.id} key={r.id}>{r.filename}</option>)}</select></label><label>Target role<input name="target_role" required minLength={2} maxLength={160} defaultValue={user.target_role||''} placeholder="e.g. Frontend Developer"/></label><button className="primary-btn" disabled={featureBusy}><Sparkles size={16}/>{featureBusy?'Analyzing...':'Analyze skill coverage'}</button></form>}{analysis&&<div className="analysis-result"><div className="analysis-score"><strong>{analysis.readiness_score}%</strong><span>role skill coverage</span></div><div className="analysis-copy"><div className="eyebrow">{analysis.analysis_mode==='model_assisted'?'AI ASSISTED':'KEYWORD ANALYSIS'} | ESTIMATE</div><p>{analysis.summary}</p><div className="chips">{analysis.skills.map((skill:string)=><span className="skill-chip present" key={skill}>{skill}</span>)}{analysis.missing_skills.map((skill:string)=><span className="skill-chip missing" key={skill}>{skill} (gap)</span>)}</div>{analysis.suggestions.map((item:string,i:number)=><p className="recommendation" key={i}><ArrowRight size={14}/>{item}</p>)}<form className="inline-roadmap" onSubmit={createRoadmap}><input type="hidden" name="target_role" value={analysis.target_role}/><button className="primary-btn" disabled={featureBusy}>Build my personalized roadmap <ArrowRight size={16}/></button></form></div></div>}</div><div className="feature-side"><div className="eyebrow">YOUR DOCUMENTS</div><h3>Private to your account</h3>{resumes.length===0?<p>No resumes uploaded yet.</p>:resumes.map(r=><div className="resume-file" key={r.id}><FileText size={17}/><span><b>{r.filename}</b><small>{new Date(r.uploaded_at).toLocaleDateString()}</small></span></div>)}<p>Coverage is based on skill keywords and does not measure proficiency or predict hiring outcomes. Scanned PDFs need OCR, which is not enabled yet.</p></div></section>}

      {view==='My roadmap'&&<section className="roadmap-page">{roadmap?<div className="feature-card"><div className="eyebrow">PERSONALIZED LEARNING PATH</div><h2>Your path to {roadmap.target_role}</h2><p>Work through the tasks at your pace. Progress saves to your account.</p><div className="roadmap-list">{roadmap.tasks.map((task:any,index:number)=><article className={`roadmap-task ${task.status==='done'?'completed':''}`} key={task.id}><span className="step-number">{String(index+1).padStart(2,'0')}</span><div className="task-copy"><b>{task.title}</b><span>{task.description}</span><small>{task.estimated_hours} hours | {task.priority} priority {task.resource_url&&<>| <a href={task.resource_url} target="_blank" rel="noreferrer">Learning resource</a></>}</small></div><select aria-label={`Progress for ${task.title}`} value={task.status} onChange={e=>updateTask(task.id,e.target.value)}><option value="todo">To do</option><option value="in_progress">In progress</option><option value="done">Done</option></select></article>)}</div></div>:<div className="feature-card"><div className="eyebrow">LEARNING ROADMAP</div><h2>Make your next goal actionable.</h2><p>Analyze a resume for a target role first, or generate a starter roadmap from your target role.</p><form className="feature-form analyze-form" onSubmit={createRoadmap}><label>Target role<input name="target_role" required minLength={2} maxLength={160} defaultValue={user.target_role||''} placeholder="e.g. Data Analyst"/></label><button className="primary-btn" disabled={featureBusy}>Create roadmap <ArrowRight size={16}/></button></form><button className="text-btn" onClick={()=>setView('Resume insights')}>Analyze a resume first <ArrowRight size={14}/></button></div>}</section>}

      {view==='AI tutor'&&<section className="tutor-layout"><div className="feature-card tutor-chat"><div className="eyebrow">AI LEARNING TUTOR</div><h2>Ask, explore, understand.</h2><label className="topic-label">Topic<input value={tutorTopic} onChange={e=>setTutorTopic(e.target.value)} placeholder="e.g. React state or SQL joins"/></label><div className="chat-messages">{tutorMessages.length===0?<p className="empty-state">Ask a question to start a private learning session. Model answers require an AI provider configured on the backend.</p>:tutorMessages.map((m,i)=><article className={`chat-message ${m.role}`} key={i}><b>{m.role==='user'?'You':'Tutor'}</b><TutorText text={m.content}/>{m.mode==='provider_unavailable'&&<small>Provider not configured</small>}</article>)}</div><form className="tutor-form" onSubmit={askTutor}><textarea name="message" required maxLength={6000} placeholder="What would you like to learn?"/><button className="primary-btn" disabled={featureBusy}>{featureBusy?'Thinking...':'Send'} <Send size={15}/></button></form></div><div className="feature-card quiz-card"><div className="eyebrow">PRACTICE</div><h3>Quick topic check</h3>{!tutorQuiz?<><p>Generate a short quiz for the topic above. Scores save to your learning history.</p><button className="primary-btn" onClick={makeTutorQuiz} disabled={featureBusy}>Create quiz <ArrowRight size={15}/></button></>:<><p>{tutorQuiz.topic} | {tutorQuiz.mode==='model_assisted'?'AI generated': 'Fallback practice'}</p>{tutorQuiz.questions.map((q:any,i:number)=><fieldset className="quiz-question" key={i}><legend>{q.question}</legend>{q.choices.map((c:string,j:number)=><label key={j}><input type="radio" name={`quiz-${i}`} checked={quizAnswers[i]===j} onChange={()=>setQuizAnswers(a=>a.map((x,k)=>k===i?j:x))}/>{c}</label>)}{quizResult&&<small>{quizResult.results[i].correct?'Correct.':'Review:'} {q.explanation}</small>}</fieldset>)}{quizResult?<b>{quizResult.score}/{quizResult.total} | {quizResult.percentage}%</b>:<button className="primary-btn" disabled={quizAnswers.some(a=>a<0)} onClick={submitTutorQuiz}>Submit answers</button>}<button type="button" className="text-btn" onClick={makeTutorQuiz} disabled={featureBusy}>Generate another quiz <ArrowRight size={14}/></button></>}</div></section>}

      {view==='Knowledge library'&&<section className="knowledge-layout"><div className="feature-card"><div className="eyebrow">PRIVATE KNOWLEDGE BASE</div><h2>Ask questions about your own documents.</h2><p>Upload PDF, DOCX, TXT, or Markdown files. CareerPilot extracts text, indexes it for search, and limits retrieval to your account.</p><form className="feature-form upload-form" onSubmit={uploadKnowledge}><input name="file" type="file" required accept=".pdf,.docx,.txt,.md,application/pdf,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document"/><button className="primary-btn" disabled={featureBusy}><FileSearch size={16}/>{featureBusy?'Indexing…':'Upload and index'}</button></form><form className="knowledge-query" onSubmit={queryKnowledge}><label htmlFor="knowledge-question">Ask a question</label><textarea id="knowledge-question" required maxLength={3000} value={ragQuestion} onChange={e=>setRagQuestion(e.target.value)} placeholder="What does my resume say about project leadership?"/><button className="primary-btn" disabled={featureBusy}>{featureBusy?'Searching…':'Search my documents'} <ArrowRight size={15}/></button></form>{ragResult&&<article className="knowledge-answer"><div className="eyebrow">{ragResult.mode==='model_assisted'?'AI ANSWER WITH SOURCES':'MATCHING EXCERPTS'}</div><p>{ragResult.answer}</p>{ragResult.sources?.length>0&&<div className="knowledge-sources"><b>Sources</b>{ragResult.sources.map((source:any,i:number)=><details key={`${source.document_id}-${i}`}><summary>[S{i+1}] {source.filename} · relevance {Math.round((source.score||0)*100)}%</summary><p>{source.text}</p></details>)}</div>}</article>}</div><aside className="feature-card knowledge-docs"><div className="eyebrow">YOUR DOCUMENTS</div><h3>{knowledgeDocs.length} documents</h3>{knowledgeDocs.length===0?<p>No documents uploaded yet.</p>:knowledgeDocs.map((doc:any)=><article className="knowledge-doc" key={doc.id}><FileText size={18}/><span><b>{doc.filename}</b><small>{doc.status} · {doc.chunks||0} passages</small>{doc.status==='failed'&&<button className="text-btn" disabled={featureBusy} onClick={()=>retryKnowledgeIndex(doc.id)}>Retry indexing</button>}</span><button aria-label={`Delete ${doc.filename}`} title="Delete document" onClick={()=>removeKnowledge(doc.id)}><Trash2 size={15}/></button></article>)}<p className="knowledge-privacy">Documents and search results are scoped to your signed-in account. Upload only files you’re allowed to store.</p></aside></section>}
      {['Mock interviews','Explore jobs','Applications','Progress','My profile'].includes(view)&&<MoreModules view={view} token={token} user={user} onUser={setUser} onDeleted={logout}/> }
      {!['Dashboard','Resume insights','My roadmap','AI tutor','Knowledge library','Mock interviews','Explore jobs','Applications','Progress','My profile'].includes(view)&&<section className="feature-card coming-soon"><div className="metric-icon purple"><Sparkles size={18}/></div><div className="eyebrow">IN THE CAREERPILOT PLAN</div><h2>{view} is on the roadmap.</h2><p>This module is not connected yet. Your dashboard, resume analysis, and learning roadmap are working now; other areas will be added in follow-on increments.</p><button className="outline-btn" onClick={()=>setView('Dashboard')}>Back to dashboard <ArrowRight size={15}/></button></section>}

      <div style={{display:view==='Dashboard'?'contents':'none'}}>

      <section className="hero-card"><div className="hero-text"><div className="hero-kicker"><Sparkles size={14}/> YOUR CAREER, IN FOCUS</div><h2>Big goals start with<br/>a <em>clear next step.</em></h2><p>Set a direction. We'll help you figure out how to get there.</p><button className="hero-btn" onClick={()=>setView('My roadmap')}>Explore your roadmap <ArrowRight size={16}/></button></div><div className="hero-visual"><div className="hero-ring ring-a"/><div className="hero-ring ring-b"/><div className="hero-ring ring-c"/><div className="hero-star star-a"><Sparkles size={14}/></div><div className="hero-star star-b"><Sparkles size={19}/></div><div className="hero-star star-c"><Sparkles size={17}/></div><div className="hero-path"><span/><span/><span/><span/></div><div className="hero-orbit-label"><Compass size={14}/> YOUR DIRECTION</div></div><div className="hero-index">01 <span>/ 04</span></div></section>

      <div className="section-heading"><div><div className="eyebrow">YOUR SNAPSHOT</div><h2>A little about your journey</h2></div><button className="text-btn" onClick={()=>setView('My profile')}>Edit profile <ArrowRight size={15}/></button></div>

      <section className="metrics-grid"><article className="metric-card readiness"><div className="metric-top"><span className="metric-icon purple"><Sparkles size={16}/></span><span className="metric-caption">CAREER READINESS</span><button className="more" aria-label="More career readiness options"><MoreHorizontal size={17}/></button></div><div className="score-line"><div className="score">{overview?.readiness ?? '—'}<small>{overview?.readiness!==null?'%':''}</small></div><div className="score-tag">{overview?.readiness===null?'Not assessed':'On your way'}</div></div><div className="score-track"><span style={{width:overview?.readiness?`${overview.readiness}%`:'0%'}}/></div><p>{overview?.readiness_note || 'Add your resume to get a personalized starting point.'}</p><button className="card-link" onClick={()=>setView('Resume insights')}>Get started <ArrowRight size={14}/></button></article>

      <article className="metric-card"><div className="metric-top"><span className="metric-icon green"><Target size={16}/></span><span className="metric-caption">CAREER GOALS</span><button className="more" aria-label="More career goal options"><MoreHorizontal size={17}/></button></div><div className="score-line"><div className="score">{overview?.goal_count ?? 0}<small className="unit"> goals</small></div><span className="metric-note">Your direction</span></div><div className="metric-description">A clear goal makes every next step count.</div><form className="goal-form" onSubmit={addGoal}><input value={goal} onChange={e=>setGoal(e.target.value)} placeholder="Add a goal, e.g. Become a data analyst" maxLength={200}/><button aria-label="Add goal"><Plus size={17}/></button></form>{overview?.goals?.slice(0,2).map(g=><div className="goal-row" key={g.id}><span className="goal-dot"/>{g.title}<Check size={14}/></div>)}</article>

      <article className="metric-card role-card"><div className="metric-top"><span className="metric-icon orange"><BriefcaseBusiness size={16}/></span><span className="metric-caption">YOUR NEXT CHAPTER</span><button className="more" aria-label="More role options"><MoreHorizontal size={17}/></button></div><div className="role-name">{user.target_role || 'Still exploring'}</div><div className="role-meta"><span className="role-dot"/>{user.target_role?'Your target role':'Choose a direction that excites you'}</div><div className="role-divider"/><div className="role-footer"><span>{user.experience_level}</span><button onClick={()=>setView('My profile')}>Set your direction <ArrowRight size={14}/></button></div></article></section>

      <div className="lower-grid"><section className="journey-card"><div className="section-heading compact"><div><div className="eyebrow">ONE STEP AT A TIME</div><h2>Your path starts here</h2></div><button className="round-link" onClick={()=>setView('My roadmap')}><ArrowRight size={16}/></button></div><div className="journey-content"><div className="journey-step"><div className="step-number">01</div><div className="step-copy"><b>Get to know your strengths</b><span>Start with your experience and what you enjoy.</span></div><span className="step-state">UP NEXT</span></div><div className="journey-line"/><div className="journey-step muted"><div className="step-number">02</div><div className="step-copy"><b>Find your skill gaps</b><span>See what could help you reach your goal.</span></div><LockKeyhole size={14}/></div><div className="journey-line"/><div className="journey-step muted"><div className="step-number">03</div><div className="step-copy"><b>Build your learning plan</b><span>A path shaped around your goals.</span></div><LockKeyhole size={14}/></div></div></section><section className="activity-card"><div className="section-heading compact"><div><div className="eyebrow">MADE FOR YOUR MOMENTUM</div><h2>Your career toolkit</h2></div><button className="text-btn subtle" onClick={()=>setView('Progress')}>Explore all <ArrowRight size={14}/></button></div><button className="tool-row" onClick={()=>setView('Resume insights')}><span className="tool-icon purple"><FileText size={17}/></span><span><b>Get resume feedback</b><small>Make your experience shine</small></span><ArrowRight size={15}/></button><button className="tool-row" onClick={()=>setView('AI tutor')}><span className="tool-icon green"><BookOpen size={17}/></span><span><b>Learn something new</b><small>Build skills at your own pace</small></span><ArrowRight size={15}/></button><button className="tool-row" onClick={()=>setView('Mock interviews')}><span className="tool-icon orange"><Mic2 size={17}/></span><span><b>Practice an interview</b><small>Get comfortable, one question at a time</small></span><ArrowRight size={15}/></button><div className="provider-note"><span className={overview?.integrations.ai_provider==='configured'?'provider-on':'provider-off'}/>{overview?.integrations.ai_provider==='configured'?'AI provider connected':'Connect an AI provider in backend settings to enable personalized AI features'}</div></section></div>

      <footer className="footer"><span>CareerPilot AI <span className="footer-star"><Sparkles size={11}/></span></span><span>Your career, at your pace.</span><span><TrendingUp size={14}/> A little progress adds up.</span></footer></div></div></main></div>;

}



export default App;

