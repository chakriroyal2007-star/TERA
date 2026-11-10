import { useState, useEffect } from 'react';
import { api } from './api';
import { ErrorBox } from './components';
import { Guidance, VoiceMessageInput } from './Guidance';
export interface CompanionProps {incidentId?:string;trackingCode?:string;initialCategory?:string;initialLanguage?:string;onClose?:()=>void;}
export type SupportedLanguage='en'|'te'|'hi'|'ta'|'kn'|'ml';
export function EmergencyCompanion({incidentId,trackingCode,initialLanguage='en',onClose}:CompanionProps) {
  const [language,setLanguage]=useState(initialLanguage);
  const [data,setData]=useState<any>(null);
  const [text,setText]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<any>(null);
  async function load(message?:string) {
    setBusy(true);setError(null);
    try {setData(await api('/companion/assist','POST',{incident_id:incidentId,tracking_code:trackingCode,language,message}));setError(null);setText('');}
    catch(e){setError(e);} finally {setBusy(false);}
  }
  useEffect(()=>{load();},[incidentId,trackingCode]);
  return <section className="panel emergency-companion" style={{background:'var(--surface, #fff)',padding:'1.5rem',borderRadius:16,maxHeight:'85vh',overflowY:'auto'}}>
    <div style={{display:'flex',justifyContent:'space-between'}}><h2>Emergency first-aid companion</h2>{onClose&&<button className="secondary" onClick={onClose}>Close</button>}</div>
    <p><a href="tel:112">Call 112 now</a> for emergency help in India. This assistant does not replace a dispatcher or clinician.</p>
    <ErrorBox error={error}/>{!data&&busy&&<p role="status">Loading the saved conversation…</p>}
    {data&&<><p>Case {data.case_id} · {data.status}. Messages are saved with this case.</p>
      <Guidance topic={data.guidance?.topic} patientGroup={data.extraction?.patient_group}/>
      <div aria-live="polite">{data.messages.map((m:any)=><p key={m.id} style={{whiteSpace:'pre-wrap'}}><strong>{m.speaker==='citizen'?'You':m.speaker==='system'?'Recorded guidance':'Assistant'}:</strong> {m.content}</p>)}</div>
      {data.extraction?.assistance_needed!=null&&<p>Latest reported assistance count: {data.extraction.assistance_needed}. Operator review is required for changes.</p>}
    </>}
    <label>Conversation language<select value={language} onChange={e=>setLanguage(e.target.value)}>{[['en','English'],['te','తెలుగు'],['hi','हिन्दी'],['ta','தமிழ்'],['kn','ಕನ್ನಡ'],['ml','മലയാളം']].map(([v,n])=><option key={v} value={v}>{n}</option>)}</select></label>
    <VoiceMessageInput language={language} onText={setText}/>
    <label>Question or condition update<textarea value={text} onChange={e=>setText(e.target.value)} placeholder="Tell us what has changed or ask about immediate safety."/></label>
    <button disabled={busy||!text.trim()} onClick={()=>load(text)}>{busy?'Saving…':'Send and save update'}</button>
    {error&&<button className="secondary" disabled={busy} onClick={()=>load()}>Reload saved conversation</button>}
  </section>;
}
