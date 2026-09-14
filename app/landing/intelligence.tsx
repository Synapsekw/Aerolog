'use client';
import { memo, useEffect, useRef, useState, type CSSProperties } from 'react';
import { ArrowRight, ArrowUpRight, Check, FileText, Fingerprint, FolderOpen, Pause, Play, RotateCcw, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { agents, scenarios } from './intelligence-data';
import './intelligence.css';

type Sample = typeof scenarios[number];
const titles = [<>Ready for<br/>what’s <em>next.</em></>, <>Every flight.<br/>A <em>paper trail.</em></>, <>The whole story.<br/><em>Connected.</em></>];
const captions = ['Aircraft readiness', 'Flight authorization', 'Mission intelligence'];

const EvidenceScene = memo(function EvidenceScene({ active, sample }: { active: number; sample: Sample }) {
  const service = sample.id === 'service', gap = sample.id === 'permit';
  const finding = sample.findings[active];
  return <div className={`ai-visual ai-visual-${active}`}>
    <div className="ai-visual-grain" aria-hidden="true"/>
    <div className="ai-visual-coordinate ai-coordinate-top">AEROLOG / EVIDENCE SYSTEM</div>
    <div className="ai-visual-coordinate ai-coordinate-bottom">ILLUSTRATIVE MISSION DATA <span>0{active + 1}—03</span></div>
    {active === 0 && <div className="ai-service-scene">
      <svg className="ai-service-dial" viewBox="0 0 600 540" aria-hidden="true">
        <defs><linearGradient id="ai-service-gradient"><stop stopColor="#e8b57c" stopOpacity=".08"/><stop offset="1" stopColor="#e8b57c"/></linearGradient></defs>
        <circle cx="300" cy="270" r="207" className="ai-outer-ring"/>
        <circle cx="300" cy="270" r="192" className="ai-ticks"/>
        <circle cx="300" cy="270" r="167" fill="none" stroke="#e8b57c" strokeOpacity=".12" strokeWidth="2"/>
        <circle cx="300" cy="270" r="167" className="ai-service-arc" pathLength="100" strokeDasharray={service ? '99 100' : '82.67 100'} transform="rotate(-90 300 270)"/>
        <circle cx="300" cy="270" r="138" className="ai-inner-ring"/>
        <path d="M300 44V65M300 475V496M74 270H95M505 270H526" stroke="#e8b57c" strokeOpacity=".6"/>
        <path d="M390 142H490L518 115M211 397H111L83 424" fill="none" stroke="#e8b57c" strokeOpacity=".4"/>
      </svg>
      <div className="ai-dial-reading"><span>AIRCRAFT SERVICE CLOCK</span><strong>{service ? '150' : '124'}<small>h</small></strong><p>of 150 flight hours</p><div className={service ? 'ai-dial-status ai-alert' : 'ai-dial-status'}><span/>{service ? 'Service review due' : 'Next service in 26 h'}</div></div>
      <div className="ai-orbit-note ai-orbit-upper"><span>01 / FLIGHT LOG</span><b>+ {sample.time}</b><small>Added to aircraft history</small></div>
      <div className="ai-orbit-note ai-orbit-lower"><span>02 / SERVICE MANUAL</span><b>150 h interval</b><small>{service ? 'Engineer review proposed' : 'Maintenance schedule linked'}</small></div>
      <div className="ai-telemetry"><span>RECENT FLIGHT HOURS</span><div aria-hidden="true">{[16,24,19,35,25,40,31,45,38,56,43,63,49,70,54,76,69,88,76,97,86,100].map((h,i)=><i key={i} style={{height:`${h}%`, '--bar-delay':`${i*25}ms`} as CSSProperties}/>)}</div><span>LOG → SERVICE HISTORY</span></div>
    </div>}
    {active === 1 && <div className={`ai-permit-scene ${gap ? 'ai-permit-gap' : ''}`}>
      <div className="ai-map-aperture"><img src="/landing/coastline.webp" alt="" loading="lazy" width="1942" height="809"/><div/></div>
      <svg className="ai-permit-map" viewBox="0 0 600 540" role="img" aria-label={gap ? 'Illustrative executed flight route with no matching permit found.' : 'Illustrative executed flight route inside a linked permit boundary.'}>
        <circle cx="300" cy="270" r="207" className="ai-outer-ring"/><circle cx="300" cy="270" r="192" className="ai-ticks"/>
        <path d="M115 170L276 93L490 226L422 410L216 434L113 292Z" className="ai-permit-boundary"/>
        <path d="M192 353L181 274L303 337L325 287L200 223L226 182L347 244L370 199L277 151" className="ai-route-shadow"/>
        <path d="M192 353L181 274L303 337L325 287L200 223L226 182L347 244L370 199L277 151" className="ai-flight-path" pathLength="100"/>
        <circle cx="192" cy="353" r="6" fill="#dbe8f5"/><circle cx="192" cy="353" r="14" fill="none" stroke="#dbe8f5" strokeOpacity=".5"/>
        <circle cx="277" cy="151" r="5" fill="#dbe8f5"/>
        <path d="M113 292H65M422 410H500L520 430M347 244H489" stroke="#93badf" fill="none" strokeOpacity=".5"/>
        <text x="366" y="237" className="ai-map-label">EXECUTED ROUTE</text>
      </svg>
      <div className="ai-permit-document"><span><FileText size={17}/> GOVERNMENT PERMIT</span><b>{gap ? 'No matching document' : 'Mission evidence linked'}</b><p>{gap ? 'Repository search → review needed' : 'Date · operating area · aircraft'}</p><div>{gap ? 'GAP IDENTIFIED' : <><Check size={13}/> MATCH FOUND</>}</div></div>
      <div className="ai-map-legend"><i/>{gap ? 'Permit boundary unverified' : 'Linked permit boundary'}<span/>Recorded flight</div>
      <div className="ai-route-tag"><span>FLIGHT RECORD</span><b>{sample.flight}</b><small>{sample.time} / Completed</small></div>
    </div>}
    {active === 2 && <div className="ai-report-scene">
      <div className="ai-report-orbit" aria-hidden="true"/><div className="ai-report-back ai-report-back-one" aria-hidden="true"/><div className="ai-report-back ai-report-back-two" aria-hidden="true"/>
      <div className="ai-report-paper">
        <div className="ai-paper-header"><span>AEROLOG</span><Fingerprint size={23}/></div>
        <span className="ai-paper-kicker">POST-MISSION / DRAFT</span><h4>One flight.<br/>Every detail.</h4><p>{sample.flight} <span>↗</span></p>
        <div className="ai-paper-summary"><span>FLIGHT TIME<b>{sample.time}</b></span><span>REVIEW STATUS<b>{gap || service ? 'Follow-up' : 'Prepared'}</b></span></div>
        {sample.findings.slice(0,2).map((f,i)=><div className="ai-paper-finding" key={i}><span>0{i+1}</span><div><b>{agents[i].name}</b><small>{f.status}</small></div>{f.status==='Review needed'?<span className="ai-paper-attention">!</span>:<Check size={15}/>}</div>)}
        <div className="ai-paper-footer"><ShieldCheck size={17}/><span>Prepared for human review</span></div>
      </div>
      <div className="ai-linked-source ai-source-one"><FolderOpen size={17}/><span>Source documents<small>Linked to each finding</small></span><Check size={13}/></div>
      <div className="ai-linked-source ai-source-two"><ArrowUpRight size={17}/><span>{gap ? 'Permit follow-up' : service ? 'Service task' : 'Operations handoff'}<small>{gap || service ? 'Proposed for approval' : 'Ready for team review'}</small></span></div>
    </div>}
    <span className="ai-visual-sr">{finding.title} Supporting evidence: {finding.sources.join('; ')}.</span>
  </div>;
});

function Intelligence({ reduced }: { reduced: boolean }) {
  const [scenario, setScenario] = useState('routine'), [active, setActive] = useState(0);
  const [running, setRunning] = useState(false), [elapsed, setElapsed] = useState(0), [finished, setFinished] = useState(false), [visible, setVisible] = useState(false);
  const root = useRef<HTMLElement>(null);
  const sample = scenarios.find(s => s.id === scenario)!, agent = agents[active], finding = sample.findings[active];
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: .2 });
    if (root.current) observer.observe(root.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => { if (reduced) setRunning(false); }, [reduced]);
  useEffect(() => {
    if (!running || !visible || reduced) return;
    const timer = setInterval(() => { if (!document.hidden) setElapsed(t => Math.min(8000, t + 100)); }, 100);
    return () => clearInterval(timer);
  }, [running, visible, reduced]);
  useEffect(() => {
    if (elapsed < 8000) return;
    if (active === 2) { setRunning(false); setFinished(true); }
    else { setActive(a => a + 1); setElapsed(0); }
  }, [elapsed, active]);
  function chooseAgent(value: string | number | null) {setActive(Number(value));setElapsed(0);setRunning(false);setFinished(false);}
  function play() {
    if (reduced) {setActive(a => (a + 1) % 3);setElapsed(0);setFinished(false);return;}
    if (finished || (!running && elapsed === 0)) {setActive(0);setElapsed(0);setFinished(false);}
    setRunning(r => !r);
  }
  return <section ref={root} id="intelligence" className={`ai-section ${running && visible && !reduced ? 'ai-running' : ''}`} style={{ '--agent-color': agent.color, '--ai-progress':`${elapsed / 80}%` } as CSSProperties} aria-labelledby="ai-title">
    <div className="ai-heading" data-reveal><div><p className="al-eyebrow">03 / BEYOND THE FLIGHT</p><h2 id="ai-title">The flight ends.<br/><span>The thinking doesn’t.</span></h2></div><div className="ai-heading-copy"><span className="ai-roadmap"><span/> AEROLOG INTELLIGENCE / COMING NEXT</span><p>Imagine a second set of eyes on every mission. Connecting the records. Finding the gaps. Preparing what comes next.</p></div></div>
    <Tabs value={String(active)} onValueChange={chooseAgent} className="ai-story" id="ai-sequence">
      <div className="ai-story-top"><span className="ai-story-title"><span/> THE POST-FLIGHT SEQUENCE</span><Button variant="ghost" onClick={play} className="ai-play">{reduced ? <ArrowRight size={15}/> : running ? <Pause size={15}/> : finished ? <RotateCcw size={15}/> : <Play size={15}/>} {reduced ? 'Next agent' : running ? 'Pause story' : finished ? 'Replay story' : 'Play the story'}<span>{reduced ? '0'+(active+1)+'/03' : '24 SEC'}</span></Button></div>
      <TabsList className="ai-chapters" aria-label="Explore the planned AI agents">{agents.map((a,i)=><TabsTrigger key={a.name} value={String(i)}><span className="ai-chapter-number">0{i+1}</span><div><span>{captions[i]}</span><b>{a.name}</b></div><ArrowUpRight size={19}/><span className="ai-chapter-progress" aria-hidden="true"><i/></span></TabsTrigger>)}</TabsList>
      {agents.map((a,i)=><TabsContent key={a.name} value={String(i)} className="ai-act"><div className="ai-narrative" key={`${scenario}-${i}`}><div className="ai-agent-kicker"><a.Icon size={18}/><span>{a.name.toUpperCase()} AGENT</span><span>0{i+1}</span></div><h3>{titles[i]}</h3><p className="ai-description">{a.description}</p><div className={`ai-finding ${finding.status === 'Review needed' ? 'ai-finding-alert' : ''}`}><span className="ai-finding-dot"/><div><span>{finding.status}</span><h4>{finding.title}</h4></div></div><p className="ai-detail-copy">{finding.detail}</p><div className="ai-human-handoff"><ArrowUpRight size={17}/><p><span>THE HUMAN HANDOFF</span>{finding.action}</p></div></div><EvidenceScene active={i} sample={sample}/></TabsContent>)}

    </Tabs>
    <div className="ai-scenario-strip"><div><span className="ai-micro-label">CHANGE THE ENDING</span><p>One flight. Different possibilities.</p></div><Tabs value={scenario} onValueChange={v=>{setScenario(String(v));setElapsed(0);setFinished(false);setRunning(false);if(v==='permit')setActive(1);else if(v==='service')setActive(0);root.current?.querySelector('.ai-story')?.scrollIntoView({behavior:reduced?'instant':'smooth',block:'start'});}}><TabsList aria-label="Choose an AI review scenario">{scenarios.map(s=><TabsTrigger key={s.id} value={s.id}>{s.label}<ArrowUpRight size={14}/></TabsTrigger>)}</TabsList></Tabs></div>
    <div className="ai-closing"><div className="ai-closing-line"><ShieldCheck size={20}/><p>Evidence connected.<br/><span>People in command.</span></p></div><div><p>Every finding should lead back to a source. Every decision stays with your team.</p><span>A preview of planned capabilities, using illustrative scenarios. These AI agents are not yet available in AEROLOG.</span></div></div>
    <p className="ai-visual-sr" role="status">{agent.name} agent. {finding.status}. {finished ? 'Story complete. Ready for human review.' : ''}</p>
  </section>;
}
export default memo(Intelligence);
