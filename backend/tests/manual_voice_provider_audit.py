"""Run explicitly in the local normal-mode backend: real paid-provider smoke tests.
Uses only synthetic fixture speech. Never reads/prints secrets from responses.
"""
import base64
import json
from pathlib import Path
import httpx
from app.config import settings

FIXTURES = {
 'en': 'A car and a bus collided near Tirupati railway station. Seven people are involved. Two people are safe and need no medical assistance. Five need help.',
 'te': 'తిరుపతి రైల్వే స్టేషన్ దగ్గర కారు బస్సు ఢీకొన్నాయి. మొత్తం ఏడుగురు ఉన్నారు. ఇద్దరు సురక్షితంగా ఉన్నారు. వారికి వైద్య సహాయం అవసరం లేదు. మిగిలిన ఐదుగురికి సహాయం అవసరం.',
 'hi': 'तिरुपति रेलवे स्टेशन के पास कार और बस की टक्कर हुई है। कुल सात लोग हैं। दो लोग सुरक्षित हैं और उन्हें चिकित्सा सहायता नहीं चाहिए। पांच लोगों को मदद चाहिए।',
 'ta': 'திருப்பதி ரயில் நிலையம் அருகில் காரும் பேருந்தும் மோதின. மொத்தம் ஏழு பேர் உள்ளனர். இரண்டு பேர் பாதுகாப்பாக உள்ளனர். அவர்களுக்கு மருத்துவ உதவி தேவையில்லை. ஐந்து பேருக்கு உதவி தேவை.',
 'kn': 'ತಿರುಪತಿ ರೈಲು ನಿಲ್ದಾಣದ ಬಳಿ ಕಾರು ಮತ್ತು ಬಸ್ ಡಿಕ್ಕಿ ಹೊಡೆದಿವೆ. ಒಟ್ಟು ಏಳು ಜನರಿದ್ದಾರೆ. ಇಬ್ಬರು ಸುರಕ್ಷಿತವಾಗಿದ್ದಾರೆ. ಅವರಿಗೆ ವೈದ್ಯಕೀಯ ಸಹಾಯ ಬೇಡ. ಐದು ಜನರಿಗೆ ಸಹಾಯ ಬೇಕು.',
 'ml': 'തിരുപ്പതി റെയിൽവേ സ്റ്റേഷനു സമീപം കാറും ബസും കൂട്ടിയിടിച്ചു. ആകെ ഏഴ് പേരുണ്ട്. രണ്ടു പേർ സുരക്ഷിതരാണ്. അവർക്ക് വൈദ്യസഹായം വേണ്ട. അഞ്ച് പേർക്ക് സഹായം വേണം.',
}
results=[]
with httpx.Client(timeout=120) as client:
 for language, text in FIXTURES.items():
  tts=client.post('https://api.sarvam.ai/text-to-speech',headers={'api-subscription-key':settings().sarvam_api_key},json={'text':text,'target_language_code':language+'-IN','model':'bulbul:v3','speaker':'shubh'})
  if tts.status_code != 200:
   results.append({'language':language,'tts_status':tts.status_code});continue
  audio=base64.b64decode(tts.json()['audios'][0])
  result=client.post('http://localhost:8000/api/v1/voice/transcribe',files={'file':('fixture.wav',audio,'audio/wav')},data={'language':language})
  row={'language':language,'status':result.status_code}
  if result.status_code==200:
   j=result.json(); ext=j['extraction']
   row.update({k:ext.get(k) for k in ('total_people','safe_people','assistance_needed','vehicles','severity','extraction_provider')})
   row['passed']=ext.get('total_people')==7 and ext.get('safe_people')==2 and ext.get('assistance_needed')==5
   row['transcript']=j['transcript']
  results.append(row);print(json.dumps({k:v for k,v in row.items() if k!='transcript'},ensure_ascii=False),flush=True)
Path('/app/.local/multilingual-audit.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
assert len(results)==6 and all(r.get('passed') for r in results), 'Some multilingual cases need inspection'
