import { useQuery } from '@tanstack/react-query';
import { useState, useRef, useEffect } from 'react';
import { api } from './api';
import { ErrorBox } from './components';

export function Guidance({topic='general', patientGroup='unknown'}:{topic?:string;patientGroup?:string}) {
  const q = useQuery({queryKey:['guidance',topic,patientGroup],queryFn:()=>api<any>(`/companion/guidance/${topic}?patient_group=${patientGroup}`)});
  return <section className="panel" aria-label="Immediate safety guidance">
    <h3>{q.data?.title || 'Immediate safety guidance'}</h3>
    <p><a href="tel:112">Call 112</a> in India. Follow the dispatcher; do not delay action to watch a video.</p>
    <ErrorBox error={q.error}/>
    {q.data && <><ol style={{listStyle:"decimal",paddingLeft:"1.5rem",margin:"1rem 0"}}>{q.data.steps.slice(1).map((s:string,i:number)=><li key={i} style={{marginBottom:"0.5rem"}}>{s}</li>)}</ol>
      <button type="button" className="secondary" onClick={()=>{speechSynthesis.cancel(); const speech=new SpeechSynthesisUtterance(q.data.steps.join('. '));speech.lang='en-IN';speechSynthesis.speak(speech);}}>Read guidance aloud (English)</button>
      <p><a href={q.data.source_url} target="_blank" rel="noreferrer">Read the medical or emergency-service source</a></p>
      <p>Source-based guidance; local clinical review pending. English guidance is shown to avoid unreviewed medical translations.</p>
      {q.data.video_url && <><p>Optional demonstration — do not wait for playback.</p><iframe referrerPolicy="strict-origin-when-cross-origin" title={q.data.title+' demonstration'} src={q.data.video_url} style={{width:'100%',aspectRatio:'16 / 9',border:0}} allow="encrypted-media; picture-in-picture" allowFullScreen/><a href={q.data.video_url.replace('www.youtube-nocookie.com/embed/','www.youtube.com/watch?v=')} target="_blank" rel="noreferrer">Open video if embedded playback is unavailable</a></>}
    </>}
  </section>;
}

export function VoiceMessageInput({onText,language='en'}:{onText:(text:string)=>void;language?:string}) {
  const recorder=useRef<MediaRecorder|null>(null);
  const stream=useRef<MediaStream|null>(null);
  const [recording,setRecording]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<any>(null);
  useEffect(()=>()=>{stream.current?.getTracks().forEach(t=>t.stop());},[]);
  async function toggle() {
    if(recording) {recorder.current?.stop();setRecording(false);return;}
    setError(null);
    try {
      stream.current=await navigator.mediaDevices.getUserMedia({audio:true});
      const r=new MediaRecorder(stream.current);recorder.current=r;const chunks:Blob[]=[];
      r.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
      r.onstop=async()=>{
        stream.current?.getTracks().forEach(t=>t.stop());setBusy(true);
        try {const fd=new FormData();fd.append('file',new Blob(chunks,{type:r.mimeType}),'question.webm');fd.append('language',language);
          const result=await api<any>('/voice/transcribe','POST',fd);onText(result.transcript);
        } catch(e) {setError(e);} finally {setBusy(false);}
      };r.start();setRecording(true);
    } catch(e) {setError(e);}
  }
  return <div><button type="button" className="secondary" disabled={busy} onClick={toggle}>{busy?'Transcribing…':recording?'Stop recording':'Record a question or clarification'}</button><ErrorBox error={error}/></div>;
}
