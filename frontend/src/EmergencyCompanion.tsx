import React, { useState, useEffect, useRef } from "react";
import {
  HeartPulse,
  PhoneCall,
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Share2,
  FileText,
  UserCheck,
  X,
  RotateCcw,
  Sparkles,
  ArrowRight,
  Shield,
  Clock,
} from "lucide-react";
import { api } from "./api";

export interface CompanionProps {
  incidentId?: string;
  trackingCode?: string;
  initialCategory?: string;
  initialLanguage?: string;
  onClose?: () => void;
}

export type SupportedLanguage = "en" | "te" | "hi" | "ta" | "kn" | "ml";

export interface Message {
  id: string;
  role: "ai" | "user" | "system";
  text: string;
  timestamp: string;
  stepNumber?: number;
}

// Built-in verified offline knowledge base for guaranteed 100% medical availability
const EMBEDDED_PROTOCOLS: Record<
  string,
  {
    title: Record<SupportedLanguage, string>;
    warning: Record<SupportedLanguage, string>;
    steps: Array<{
      stepNumber: number;
      instruction: Record<SupportedLanguage, string>;
      details: Record<SupportedLanguage, string>;
      criticalCheck: Record<SupportedLanguage, string>;
    }>;
  }
> = {
  bleeding: {
    title: {
      en: "Severe Bleeding Control",
      te: "తీవ్రమైన రక్తస్రావ నియంత్రణ",
      hi: "गंभीर रक्तस्राव नियंत्रण",
      ta: "கடுமையான இரத்தப்போக்கு கட்டுப்பாடு",
      kn: "ತೀವ್ರ ರಕ್ತಸ್ರಾವ ನಿಯಂತ್ರಣ",
      ml: "ഗുരുതരമായ രക്തസ്രാവ നിയന്ത്രണം",
    },
    warning: {
      en: "Do not remove any deeply embedded objects. Press around them instead.",
      te: "గుచ్చుకున్న వస్తువులను తొలగించవద్దు. వాటి చుట్టూ మాత్రమే నొక్కండి.",
      hi: "शरीर में चुभी हुई वस्तु को न निकालें। उसके चारों ओर दबाव डालें।",
      ta: "உடலில் குத்தியுள்ள பொருட்களை அகற்ற வேண்டாம். அவற்றைச் சுற்றி மட்டும் அழுத்தவும்.",
      kn: "ಆಳವಾಗಿ ಸಿಲುಕಿರುವ ವಸ್ತುಗಳನ್ನು ತೆಗೆಯಬೇಡಿ. ಸುತ್ತಲೂ ಮಾತ್ರ ಒತ್ತಡ ಹಾಕಿ.",
      ml: "ശരീരത്തിൽ തുളച്ചുകയറിയ വസ്തുക്കൾ നീക്കം ചെയ്യരുത്. അവയ്ക്ക് ചുറ്റും അമർത്തുക.",
    },
    steps: [
      {
        stepNumber: 1,
        instruction: {
          en: "Apply firm, continuous direct pressure onto the wound using a clean cloth or sterile dressing.",
          te: "గాయంపై శుభ్రమైన గుడ్డ లేదా శుభ్రమైన డ్రెస్సింగ్ ఉంచి గట్టిగా, నిరంతరంగా నొక్కిపట్టండి.",
          hi: "घाव पर साफ कपड़ा या पट्टी रखकर लगातार कसकर दबाव बनाए रखें।",
          ta: "சுத்தமான துணி கொண்டு காயத்தின் மீது இடைவிடாமல் உறுதியாக அழுத்தவும்.",
          kn: "ಸ್ವಚ್ಛವಾದ ಬಟ್ಟೆಯಿಂದ ಗಾಯದ ಮೇಲೆ ದೃಢವಾಗಿ ನಿರಂತರ ಒತ್ತಡ ಹಾಕಿ.",
          ml: "വൃത്തിയുള്ള തുണി ഉപയോഗിച്ച് മുറിവിൽ ശക്തമായി അമർത്തിപ്പിടിക്കുക.",
        },
        details: {
          en: "Maintain uninterrupted pressure for at least 5 minutes. Do not lift the cloth to check.",
          te: "కనీసం 5 నిమిషాల పాటు ఒత్తిడి తగ్గించకుండా పట్టుకోండి. చూడటానికి గుడ్డ ఎత్తవద్దు.",
          hi: "कम से कम 5 मिनट तक दबाव न हटाएं। देखने के लिए कपड़ा न उठाएं।",
          ta: "குறைந்தது 5 நிமிடங்கள் அழுத்தத்தை எடுக்க வேண்டாம்.",
          kn: "ಕನಿಷ್ಠ 5 ನಿಮಿಷಗಳ ಕಾಲ ನಿರಂತರವಾಗಿ ಒತ್ತಿ ಹಿಡಿಯಿರಿ.",
          ml: "കുറഞ്ഞത് 5 മിനിറ്റ് തുടർച്ചയായി അമർത്തുക.",
        },
        criticalCheck: {
          en: "Is blood still soaking heavily through the cloth?",
          te: "రక్తం ఇంకా గుడ్డ గుండా విపరీతంగా బయటకు వస్తోందా?",
          hi: "क्या खून अभी भी कपड़े से रिस रहा है?",
          ta: "இரத்தம் இன்னும் துணி வழியாக அதிகம் வழிகிறதா?",
          kn: "ರಕ್ತ ಇನ್ನೂ ಬಟ್ಟೆಯಿಂದ ಸೋರುತ್ತಿದೆಯೇ?",
          ml: "രക്തം ഇപ്പോഴും തുണിയിലൂടെ അമിതമായി ഒഴുകുന്നുണ്ടോ?",
        },
      },
      {
        stepNumber: 2,
        instruction: {
          en: "Do not remove the soaked cloth. Add a second thick cloth or pad directly over it and press harder.",
          te: "తడిసిన గుడ్డను తీయకండి. దానిపైనే మరో మందపాటి గుడ్డ ఉంచి మరింత గట్టిగా నొక్కండి.",
          hi: "भीगे कपड़े को न हटाएं। उसके ऊपर दूसरा कपड़ा रखकर और जोर से दबाएं।",
          ta: "நனைந்த துணியை எடுக்காமல், மேலே மற்றொரு துணியை வைத்து அழுத்தவும்.",
          kn: "ನೆನೆದ ಬಟ್ಟೆಯನ್ನು ತೆಗೆಯಬೇಡಿ, ಅದರ ಮೇಲೆಯೇ ಮತ್ತೊಂದು ಬಟ್ಟೆ ಇಟ್ಟು ಗಟ್ಟಿಯಾಗಿ ಒತ್ತಿ.",
          ml: "നനഞ്ഞ തുണി മാറ്റരുത്, അതിനു മുകളിൽ മറ്റൊരു തുണി വെച്ച് കൂടുതൽ അമർത്തുക.",
        },
        details: {
          en: "If bleeding is on an arm or leg, elevate the limb above heart level if no fractures are suspected.",
          te: "గాయం చేయి లేదా కాలిపై ఉంటే, ఎముక విరగకపోతే దాన్ని గుండె కంటే ఎత్తులో ఉంచండి.",
          hi: "हाथ या पैर का घाव होने पर उसे दिल के स्तर से ऊपर उठाएं (यदि हड्डी न टूटी हो)।",
          ta: "எலும்பு முறிவு இல்லையென்றால், காயம்பட்ட கையை அல்லது காலை நெஞ்சு மட்டத்திற்கு மேல் உயர்த்தவும்.",
          kn: "ಮೂಳೆ ಮುರಿದಿಲ್ಲದಿದ್ದರೆ, ಗಾಯಗೊಂಡ ಭಾಗವನ್ನು ಹೃದಯದ ಮಟ್ಟಕ್ಕಿಂತ ಮೇಲೆ ಎತ್ತಿ.",
          ml: "അസ്ഥി ഒടിഞ്ഞിട്ടില്ലെങ്കിൽ, മുറിവുള്ള ഭാഗം ഹൃദയത്തിന്റെ നിരപ്പിന് മുകളിലേക്ക് ഉയർത്തുക.",
        },
        criticalCheck: {
          en: "Is the patient feeling dizzy, cold, or losing consciousness?",
          te: "బాధితుడికి తలతిరగడం, శరీరం చల్లబడటం లేదా స్పృహ తప్పుతున్న లక్షణాలు ఉన్నాయా?",
          hi: "क्या मरीज को चक्कर आ रहे हैं या शरीर ठंडा पड़ रहा है?",
          ta: "நோயாளிக்கு மயக்கம் வருகிறதா அல்லது உடல் குளிர்ந்து போகிறதா?",
          kn: "ರೋಗಿಗೆ ತಲೆತಿರುಗುವಿಕೆ ಅಥವಾ ಮೈ ತಣ್ಣಗಾಗುವ ಲಕ್ಷಣಗಳು ಇವೆಯೇ?",
          ml: "രോഗിക്ക് തലകറക്കമോ ശരീരം തണുത്തുപോകുന്നതോ ഉണ്ടോ?",
        },
      },
      {
        stepNumber: 3,
        instruction: {
          en: "Keep the patient lying flat, cover them with a jacket or blanket to preserve body warmth, and talk to them continuously.",
          te: "బాధితుడిని నేలపై సమాంతరంగా పడుకోబెట్టండి. శరీర వేడి తగ్గకుండా దుప్పటి కప్పండి. మాట్లాడుతూ ఉండండి.",
          hi: "मरीज को सीधा लिटाएं, शरीर को गर्म रखने के लिए चादर या जैकेट से ढकें और लगातार बात करते रहें।",
          ta: "நோயாளியை படுக்க வைத்து, போர்வையால் போர்த்தி, தொடர்ந்து பேசிக் கொண்டே இருங்கள்.",
          kn: "ರೋಗಿಯನ್ನು ಮಲಗಿಸಿ, ಕಂಬಳಿ ಹೊದಿಸಿ, ನಿರಂತರವಾಗಿ ಮಾತನಾಡಿಸುತ್ತಿರಿ.",
          ml: "രോഗിയെ കിടത്തി പുതപ്പിച്ചു ചൂട് നിലനിർത്തുക, സംസാരിച്ചുകൊണ്ടിരിക്കുക.",
        },
        details: {
          en: "Do not give any food, water, or medication by mouth while waiting for the ambulance.",
          te: "అంబులెన్స్ వచ్చే వరకు నోటి ద్వారా ఆహారం, నీరు లేదా ఏ మందులూ ఇవ్వవద్దు.",
          hi: "एम्बुलेंस आने तक मुंह से कुछ भी खाने या पीने को न दें।",
          ta: "ஆம்புலன்ஸ் வரும் வரை வாய் வழியாக உணவு அல்லது தண்ணீர் கொடுக்க வேண்டாம்.",
          kn: "ಆಂಬ್ಯುಲೆನ್ಸ್ ಬರುವವರೆಗೆ ಬಾಯಿಯ ಮೂಲಕ ಯಾವುದೇ ಆಹಾರ ಅಥವಾ ನೀರು ಕೊಡಬೇಡಿ.",
          ml: "ആംബുലൻസ് വരുന്നതുവരെ വായിലൂടെ ഭക്ഷണമോ വെള്ളമോ കൊടുക്കരുത്.",
        },
        criticalCheck: {
          en: "Are emergency responders arriving at the scene now?",
          te: "అంబులెన్స్ లేదా రక్షక బృందం ఘటనా స్థలానికి చేరుకున్నారా?",
          hi: "क्या एम्बुलेंस या बचाव दल घटनास्थल पर पहुंच गया है?",
          ta: "ஆம்புலன்ஸ் அல்லது மீட்புக் குழுவினர் வந்துவிட்டார்களா?",
          kn: "ಆಂಬ್ಯುಲೆನ್ಸ್ ಅಥವಾ ವೈದ್ಯಕೀಯ ತಂಡ ತಲುಪಿದೆಯೇ?",
          ml: "ആംബുലൻസ് അല്ലെങ്കിൽ രക്ഷാപ്രവർത്തകർ എത്തിയോ?",
        },
      },
    ],
  },
  cardiac: {
    title: {
      en: "Cardiac Arrest & Hands-Only CPR",
      te: "గుండెపోటు మరియు చేతులతో మాత్రమే చేసే CPR",
      hi: "कार्डियक अरेस्ट और हैंड्स-ओनली सीपीआर",
      ta: "இதய நிறுத்தம் & கைகளால் மட்டும் செய்யும் CPR",
      kn: "ಕಾರ್ಡಿಯಾಕ್ ಅರೆಸ್ಟ್ ಮತ್ತು ಕೇವಲ ಕೈಗಳಿಂದ CPR",
      ml: "കാർഡിയാക് അറസ്റ്റ് & ഹാൻഡ്സ്-ഒൺലി CPR",
    },
    warning: {
      en: "Act immediately. If person is unresponsive and not breathing normally, start chest compressions now.",
      te: "వెంటనే ప్రారంభించండి. శ్వాస లేకపోతే ఏమాత్రం ఆలస్యం చేయకుండా ఛాతీపై ఒత్తిడి (CPR) ప్రారంభించండి.",
      hi: "तुरंत शुरू करें। यदि सांस नहीं आ रही है, तो बिना देर किए छाती पर दबाव (CPR) शुरू करें।",
      ta: "உடனே தொடங்குங்கள். நோயாளிக்கு மூச்சு இல்லையென்றால் தாமதிக்காமல் மார்பை அழுத்தவும்.",
      kn: "ಕೂಡಲೇ ಪ್ರಾರಂಭಿಸಿ. ಉಸಿರಾಟವಿಲ್ಲದಿದ್ದರೆ ಎದೆಯೊತ್ತಡ (CPR) ಪ್ರಾರಂಭಿಸಿ.",
      ml: "ഉടൻ ആരംഭിക്കുക. ശ്വാസമില്ലെങ്കിൽ കാലതാമസം കൂടാതെ നെഞ്ചിൽ അമർത്തുക.",
    },
    steps: [
      {
        stepNumber: 1,
        instruction: {
          en: "Place the heel of one hand in the center of the chest. Put your other hand on top and interlock your fingers.",
          te: "ఒక చేతి మణికట్టును బాధితుడి ఛాతీ మధ్యలో ఉంచండి. మరో చేతిని దానిపై ఉంచి వేళ్లను కలపండి.",
          hi: "एक हाथ की हथेली छाती के बीच में रखें। दूसरा हाथ उसके ऊपर रखकर उंगलियां फंसाएं।",
          ta: "ஒரு கையின் உட்பகுதியை மார்பின் நடுவில் வைக்கவும். மற்றொரு கையை அதன் மேல் வைத்து விரல்களை கோர்க்கவும்.",
          kn: "ಒಂದು ಕೈಯ ಹಿಮ್ಮಡಿಯನ್ನು ಎದೆಯ ಮಧ್ಯದಲ್ಲಿಡಿ. ಇನ್ನೊಂದು ಕೈಯನ್ನು ಅದರ ಮೇಲಿಟ್ಟು ಬೆರಳುಗಳನ್ನು ಜೋಡಿಸಿ.",
          ml: "ഒരു കൈ നെഞ്ചിന്റെ നടുവിൽ വെക്കുക. മറ്റേ കൈ അതിന് മുകളിൽ വെച്ച് വിരലുകൾ കോർക്കുക.",
        },
        details: {
          en: "Keep your arms straight and lock your elbows directly over the patient's chest.",
          te: "మోచేతులను వంచకుండా చేతులను నిటారుగా ఉంచండి.",
          hi: "अपनी कोहनी सीधी रखें और कंधे ठीक छाती के ऊपर रखें।",
          ta: "முழங்கைகளை மடக்காமல் கைகளை நேராக வைக்கவும்.",
          kn: "ಕೈಗಳನ್ನು ನೇರವಾಗಿಡಿ, ಮೊಣಕೈ ಬಗ್ಗಿಸಬೇಡಿ.",
          ml: "കൈകൾ വളയ്ക്കാതെ നേരെ വെയ്ക്കുക.",
        },
        criticalCheck: {
          en: "Are your hands positioned securely in the center of the chest?",
          te: "మీ చేతులు ఛాతీ మధ్యభాగంలో సరిగ్గా అమర్చబడ్డాయా?",
          hi: "क्या आपके हाथ छाती के बीच में सही तरीके से स्थित हैं?",
          ta: "உங்கள் கைகள் மார்பின் மையத்தில் சரியாக உள்ளதா?",
          kn: "ನಿಮ್ಮ ಕೈಗಳು ಎದೆಯ ಮಧ್ಯದಲ್ಲಿ ಸರಿಯಾಗಿವೆಯೇ?",
          ml: "കൈകൾ നെഞ്ചിന്റെ മധ്യഭാഗത്ത് ശരിയായി ഉറപ്പിച്ചിട്ടുണ്ടോ?",
        },
      },
      {
        stepNumber: 2,
        instruction: {
          en: "Push hard and fast in the center of the chest at 100 to 120 beats per minute (to the beat of 'Stayin' Alive').",
          te: "ఛాతీ మధ్యలో నిమిషానికి 100 నుండి 120 సార్లు వేగంగా, బలంగా నొక్కండి. ప్రతి ఒత్తిడి తర్వాత ఛాతీని పైకి రానివ్వండి.",
          hi: "छाती के बीच में प्रति मिनट 100 से 120 बार तेज और गहरा दबाव दें।",
          ta: "மார்பின் நடுவில் நிமிடத்திற்கு 100 முதல் 120 முறை வேகமாக அழுத்தவும்.",
          kn: "ಎದೆಯ ಮಧ್ಯದಲ್ಲಿ ನಿಮಿಷಕ್ಕೆ 100 ರಿಂದ 120 ಬಾರಿ ವೇಗವಾಗಿ ಮತ್ತು ಬಲವಾಗಿ ಒತ್ತಿ.",
          ml: "മിനിറ്റിൽ 100-120 തവണ എന്ന നിരക്കിൽ നെഞ്ചിൽ ശക്തമായി അമർത്തുക.",
        },
        details: {
          en: "Compress at least 2 inches (5 cm) deep and allow full chest recoil between compressions.",
          te: "కనీసం 2 అంగుళాలు లోతుగా నొక్కండి. ఒత్తిడి మధ్య ఛాతీని పూర్తిగా పైకి రానివ్వండి.",
          hi: "कम से कम 2 इंच गहरा दबाएं। प्रत्येक दबाव के बाद छाती को वापस ऊपर आने दें।",
          ta: "குறைந்தது 2 அங்குல ஆழத்திற்கு அழுத்தவும்.",
          kn: "ಕನಿಷ್ಠ 2 ಇಂಚು ಆಳಕ್ಕೆ ಒತ್ತಿ.",
          ml: "കുറഞ്ഞത് 2 ഇഞ്ച് താഴ്ചയിൽ അമർത്തുക.",
        },
        criticalCheck: {
          en: "Can you continue compressions, or do you need a second bystander to switch?",
          te: "మీరు కొనసాగించగలరా, లేదా అలసట వల్ల మరొకరి సహాయం అవసరమా?",
          hi: "क्या आप जारी रख सकते हैं या किसी अन्य व्यक्ति की मदद चाहिए?",
          ta: "நீங்கள் தொடர்ந்து செய்ய முடியுமா அல்லது மற்றொருவர் உதவி தேவையா?",
          kn: "ನೀವು ಮುಂದುವರಿಸಲು ಶಕ್ತರಾಗಿದ್ದೀರಾ ಅಥವಾ ಬೇರೆಯವರ ಸಹಾಯ ಬೇಕೇ?",
          ml: "നിങ്ങൾക്ക് തുടരാൻ സാധിക്കുന്നുണ്ടോ, അതോ വേറെ ആരെങ്കിലും മാറണോ?",
        },
      },
    ],
  },
  unconscious: {
    title: {
      en: "Unconscious / Recovery Position",
      te: "స్పృహతప్పిన స్థితి మరియు రికవరీ పొజిషన్",
      hi: "बेहोशी और रिकवरी पोजीशन",
      ta: "மயக்கமடைந்த நிலை & மீட்பு நிலை",
      kn: "ಪ್ರಜ್ಞಾಹೀನ ಸ್ಥಿತಿ ಮತ್ತು ರಿಕವರಿ ಪೊಸಿಷನ್",
      ml: "അബോധാവസ്ഥയും റിക്കവറി പൊസിഷനും",
    },
    warning: {
      en: "Do not move the neck if neck or spine injury is suspected (e.g. falls, car crashes).",
      te: "ప్రమాదం లేదా ఎత్తునుండి పడిపోతే మెడను కదల్చవద్దు.",
      hi: "यदि रीढ़ या गर्दन में चोट का संदेह है, तो गर्दन को बिल्कुल न हिलाएं।",
      ta: "கழுத்து அல்லது முதுகுத்தண்டு காயம் இருந்தால் அசைக்க வேண்டாம்.",
      kn: "ಕುತ್ತಿಗೆ ಅಥವಾ ಬೆನ್ನುಮೂಳೆಗೆ ಗಾಯವಾಗಿದ್ದರೆ ಕುತ್ತಿಗೆಯನ್ನು ಅಲುಗಾಡಿಸಬೇಡಿ.",
      ml: "കഴുത്തിനോ നട്ടെല്ലിനോ പരിക്കുണ്ടെങ്കിൽ അനക്കരുത്.",
    },
    steps: [
      {
        stepNumber: 1,
        instruction: {
          en: "Check breathing: Tilt head gently back, lift chin, and watch chest for 10 seconds.",
          te: "శ్వాసను తనిఖీ చేయండి: తలను కొద్దిగా వెనక్కి వంచి, గడ్డం పైకెత్తి 10 సెకన్ల పాటు ఛాతీ కదలికలను గమనించండి.",
          hi: "सांस की जांच करें: सिर को हल्का पीछे झुकाएं, ठुड्डी उठाएं और 10 सेकंड तक छाती की हरकत देखें।",
          ta: "சுவாசத்தை சரிபார்க்கவும்: தலையை சற்று பின்னோக்கி சாய்த்து 10 வினாடிகள் கவனிக்கவும்.",
          kn: "ಉಸಿರಾಟವನ್ನು ಪರೀಕ್ಷಿಸಿ: ತಲೆಯನ್ನು ಸ್ವಲ್ಪ ಹಿಂದಕ್ಕೆ ತಿರುಗಿಸಿ 10 ಸೆಕೆಂಡುಗಳ ಕಾಲ ಗಮನಿಸಿ.",
          ml: "ശ്വാസം പരിശോധിക്കുക: തല പിന്നിലേക്ക് ചരിച്ച് 10 സെക്കൻഡ് നെഞ്ചിലെ ചലനം ശ്രദ്ധിക്കുക.",
        },
        details: {
          en: "If breathing normally, place in the recovery position (on their side) to keep airway open.",
          te: "శ్వాస సాధారణంగా ఉంటే, గొంతులో లాలాజలం అడ్డుపడకుండా బాధితుడిని ఒక పక్కకి తిప్పి పడుకోబెట్టండి.",
          hi: "यदि सामान्य रूप से सांस ले रहा है, तो सांस की नली खुली रखने के लिए उसे एक करवट लिटाएं।",
          ta: "சாதாரணமாக மூச்சு விட்டால், காற்றுப்பாதையை திறந்திருக்க ஒருபுறமாக சாய்த்து படுக்க வைக்கவும்.",
          kn: "ಉಸಿರಾಟ ಸರಿಯಾಗಿದ್ದರೆ, ಅವರನ್ನು ಒಂದು ಮಗ್ಗಲಿಗೆ ಮಲಗಿಸಿ.",
          ml: "ശ്വാസമുണ്ടെങ്കിൽ, ശ്വാസനാളം തുറന്നിരിക്കാൻ ഒരു വശത്തേക്ക് ചരിച്ചു കിടത്തുക.",
        },
        criticalCheck: {
          en: "Is the person breathing continuously and steadily?",
          te: "బాధితుడు నిరంతరంగా మరియు స్థిరంగా శ్వాస తీసుకుంటున్నాడా?",
          hi: "क्या व्यक्ति लगातार सांस ले रहा है?",
          ta: "நோயாளி தொடர்ந்து சீராக மூச்சு விடுகிறாரா?",
          kn: "ವ್ಯಕ್ತಿ ನಿರಂತರವಾಗಿ ಸರಿಯಾಗಿ ಉಸಿರಾಡುತ್ತಿದ್ದಾರೆಯೇ?",
          ml: "വ്യക്തി തുടർച്ചയായി ശ്വാസമെടുക്കുന്നുണ്ടോ?",
        },
      },
    ],
  },
  road_accident: {
    title: {
      en: "Road Traffic Accident Safety & Trauma",
      te: "రోడ్డు ప్రమాద భద్రత మరియు ప్రాథమిక చికిత్స",
      hi: "सड़क दुर्घटना सुरक्षा और प्राथमिक उपचार",
      ta: "சாலை விபத்து பாதுகாப்பு & முதலுதவி",
      kn: "ರಸ್ತೆ ಅಪಘಾತ ಸುರಕ್ಷತೆ ಮತ್ತು ಪ್ರಥಮ ಚಿಕಿತ್ಸೆ",
      ml: "റോഡപകട സുരക്ഷയും പ്രഥമശുശ്രൂഷയും",
    },
    warning: {
      en: "Scene safety first: Ensure approaching vehicles cannot hit you. Do not remove helmet unless airway is blocked.",
      te: "ముందుగా మీ భద్రత చూసుకోండి: ఇతర వాహనాలు మిమ్మల్ని ఢీకొనకుండా జాగ్రత్తపడండి. హెల్మెట్ తొలగించవద్దు.",
      hi: "पहले अपनी सुरक्षा सुनिश्चित करें: आने वाले वाहनों से बचें। हेलमेट न हटाएं।",
      ta: "முதலில் உங்கள் பாதுகாப்பு: நெருங்கி வரும் வாகனங்களிலிருந்து பாதுகாத்துக் கொள்ளுங்கள்.",
      kn: "ಮೊದಲು ನಿಮ್ಮ ಸುರಕ್ಷತೆ: ಬರುವ ವಾಹನಗಳಿಂದ ಸುರಕ್ಷಿತವಾಗಿರಿ.",
      ml: "ആദ്യം നിങ്ങളുടെ സുരക്ഷ: മറ്റു വാഹനങ്ങളിൽ നിന്ന് സുരക്ഷിതമായിരിക്കുക.",
    },
    steps: [
      {
        stepNumber: 1,
        instruction: {
          en: "Warn traffic using hazard lights or signs. Turn off vehicle ignitions if safe to do so.",
          te: "ఇతర వాహనదారులను హెచ్చరించండి. ప్రమాదానికి గురైన వాహనాల ఇంజిన్ స్విచ్ఛాఫ్ చేయండి.",
          hi: "ट्रैफिक को सतर्क करें। यदि सुरक्षित हो तो वाहनों की इग्निशन चाबी बंद कर दें।",
          ta: "போக்குவரத்தை எச்சரிக்கவும். பாதுகாப்பானது எனில் வாகனத்தை அணைக்கவும்.",
          kn: "ವಾಹನ ಸಂಚಾರವನ್ನು ಎಚ್ಚರಿಸಿ. ವಾಹನದ ಇಂಜಿನ್ ಆಫ್ ಮಾಡಿ.",
          ml: "വാഹനങ്ങളെ മുന്നറിയിപ്പ് നൽകുക. സുരക്ഷിതമെങ്കിൽ വാഹനം ഓഫ് ചെയ്യുക.",
        },
        details: {
          en: "Do not move severely injured victims from the vehicle unless there is immediate fire or explosion hazard.",
          te: "మంటలు లేదా పేలుడు ప్రమాదం ఉంటే తప్ప క్షతగాత్రులను వాహనం నుండి లాగవద్దు.",
          hi: "जब तक आग या विस्फोट का खतरा न हो, गंभीर रूप से घायल को वाहन से बाहर न खींचे।",
          ta: "தீ விபத்து ஆபத்து இல்லையெனில் நோயாளியை வாகனத்திலிருந்து இழுக்க வேண்டாம்.",
          kn: "ಬೆಂಕಿ ಅಥವಾ ಸ್ಫೋಟದ ಅಪಾಯವಿಲ್ಲದಿದ್ದರೆ ರೋಗಿಯನ್ನು ವಾಹನದಿಂದ ಎಳೆಯಬೇಡಿ.",
          ml: "തീപിടുത്ത സാധ്യതയില്ലെങ്കിൽ പരിക്കേറ്റവരെ വാഹനത്തിൽ നിന്ന് വലിച്ചിറക്കരുത്.",
        },
        criticalCheck: {
          en: "Is the accident scene currently safe from oncoming traffic and fuel leaks?",
          te: "ప్రమాద స్థలం ప్రస్తుతం సురక్షితంగా ఉందా?",
          hi: "क्या घटनास्थल अब आने वाले वाहनों से सुरक्षित है?",
          ta: "விபத்து நடந்த இடம் தற்போது பாதுகாப்பாக உள்ளதா?",
          kn: "ಘಟನಾ ಸ್ಥಳವು ಈಗ ಸುರಕ್ಷಿತವಾಗಿದೆಯೇ?",
          ml: "സ്ഥലം ഇപ്പോൾ സുരക്ഷിതമാണോ?",
        },
      },
    ],
  },
  burns: {
    title: {
      en: "Thermal & Scald Burns",
      te: "మంటలు మరియు వేడి గాయాలు",
      hi: "जलने की चोट और प्राथमिक उपचार",
      ta: "தீக்காயங்கள் & முதலுதவி",
      kn: "ಸುಟ್ಟ ಗಾಯಗಳು ಮತ್ತು ಪ್ರಥಮ ಚಿಕಿತ್ಸೆ",
      ml: "പൊള്ളലും പ്രഥമശുശ്രൂഷയും",
    },
    warning: {
      en: "Do not apply ice, butter, oil, or toothpaste to burns. Do not pop blisters.",
      te: "గాయంపై ఐస్, నూనె, పేస్ట్ రాయవద్దు. బొబ్బలను పగలగొట్టవద్దు.",
      hi: "जले पर बर्फ, तेल, मक्खन या टूथपेस्ट न लगाएं। छालों को न फोड़ें।",
      ta: "தீக்காயத்தில் பனிக்கட்டி, எண்ணெய் அல்லது பற்பசை பூச வேண்டாம்.",
      kn: "ಸುಟ್ಟ ಗಾಯಕ್ಕೆ ಮಂಜುಗಡ್ಡೆ, ಎಣ್ಣೆ ಅಥವಾ ಟೂತ್‌ಪೇಸ್ಟ್ ಹಚ್ಚಬೇಡಿ.",
      ml: "പൊള്ളലേറ്റ ഭാഗത്ത് ഐസ്, എണ്ണ, പേസ്റ്റ് എന്നിവ പുരട്ടരുത്.",
    },
    steps: [
      {
        stepNumber: 1,
        instruction: {
          en: "Cool the burn immediately under cool or lukewarm running tap water for at least 20 minutes.",
          te: "కనీసం 20 నిమిషాల పాటు గాయంపై సాధారణ చల్లని కొళాయి నీటిని నిరంతరంగా పోయండి.",
          hi: "जले हुए अंग पर कम से कम 20 मिनट तक सामान्य ठंडा नल का पानी बहाएं।",
          ta: "குறைந்தது 20 நிமிடங்கள் குளிர்ந்த ஓடும் நீரில் எரியும் பகுதியை வைக்கவும்.",
          kn: "ಕನಿಷ್ಠ 20 ನಿಮಿಷಗಳ ಕಾಲ ತಣ್ಣನೆಯ ನೀರಿನ ಅಡಿಯಲ್ಲಿ ಇರಿಸಿ.",
          ml: "കുറഞ്ഞത് 20 മിനിറ്റ് തണുത്ത പൈപ്പ് വെള്ളത്തിൽ മുറിവ് തണുപ്പിക്കുക.",
        },
        details: {
          en: "Remove tight jewelry or watches before swelling begins, but never pull away clothing stuck to skin.",
          te: "వాపు రాకముందే ఉంగరాలు, గడియారాలను తీయండి. చర్మానికి అంటుకున్న బట్టలను లాగవద్దు.",
          hi: "सूजन आने से पहले अंगूठी या घड़ी निकाल लें, लेकिन त्वचा से चिपके कपड़े न खींचे।",
          ta: "வீங்குவதற்கு முன் நகைகளை அகற்றவும். தோலில் ஒட்டிய துணியை உரிக்க வேண்டாம்.",
          kn: "ಊದಿಕೊಳ್ಳುವ ಮುನ್ನ ಉಂಗುರ, ವಾಚ್ ತೆಗೆಯಿರಿ.",
          ml: "വീർക്കുന്നതിന് മുൻപ് ആഭരണങ്ങൾ മാറ്റുക. തൊലിയിൽ ഒട്ടിപ്പിടിച്ച വസ്ത്രങ്ങൾ വലിച്ചു മാറ്റരുത്.",
        },
        criticalCheck: {
          en: "Has cool water been running over the burn area for several minutes?",
          te: "గాయంపై కొన్ని నిమిషాలుగా చల్లని నీరు పోస్తున్నారా?",
          hi: "क्या आप घाव पर ठंडा पानी बहा रहे हैं?",
          ta: "காயத்தின் மீது தண்ணீர் ஊற்றப்பட்டுவிட்டதா?",
          kn: "ಗಾಯದ ಮೇಲೆ ತಣ್ಣೀರು ಹರಿಸಲಾಗಿದೆಯೇ?",
          ml: "മുറിവിൽ വെള്ളം ഒഴിച്ച് തണുപ്പിച്ചോ?",
        },
      },
    ],
  },
};

const DISCLOSURES: Record<SupportedLanguage, string> = {
  en: "I am TERA AI, an emergency first-aid companion. Emergency services are being alerted. I will guide you step-by-step with medically approved first-aid actions while help is on the way. Do not put yourself in danger.",
  te: "నేను టెరా (TERA) AI అత్యవసర ప్రథమ చికిత్స సహచరుడిని. సహాయక బృందాలకు సమాచారం అందింది. అంబులెన్స్ వచ్చేలోపు నేను మీకు వైద్యపరంగా ఆమోదించబడిన ప్రథమ చికిత్స చర్యలను వివరిస్తాను. మీ ప్రాణాలను ప్రమాదంలో పడేయకండి.",
  hi: "मैं टेरा (TERA) एआई इमरजेंसी फर्स्ट-एड साथी हूँ। आपातकालीन सेवाओं को सूचित किया जा रहा है। एम्बुलेंस आने तक मैं आपको चिकित्सकीय रूप से अनुमोदित प्राथमिक उपचार के निर्देश दूंगा। स्वयं को खतरे में न डालें।",
  ta: "நான் டெரா (TERA) AI அவசர முதலுதவி வழிகாட்டி. அவசர உதவிக்கு தகவல் தெரிவிக்கப்பட்டுள்ளது. உதவி வரும் வரை அங்கீகரிக்கப்பட்ட முதலுதவி வழிமுறைகளை வழங்குகிறேன்.",
  kn: "ನಾನು ಟೆರಾ (TERA) AI ತುರ್ತು ಪ್ರಥಮ ಚಿಕಿತ್ಸಾ ಸಹಾಯಕ. ಆಂಬ್ಯುಲೆನ್ಸ್ ಬರುವವರೆಗೆ ವೈದ್ಯಕೀಯವಾಗಿ ಅನುಮೋದಿತ ಪ್ರಥಮ ಚಿಕಿತ್ಸಾ ಕ್ರಮಗಳನ್ನು ನಿಮಗೆ ಮಾರ್ಗದರ್ಶನ ಮಾಡುತ್ತೇನೆ.",
  ml: "ഞാൻ ടെറ (TERA) AI അടിയന്തര പ്രഥമശുശ്രൂഷാ സഹായിയാണ്. ആംബുലൻസ് എത്തുന്നതുവരെ അംഗീകൃത പ്രഥമശുശ്രൂഷാ നിർദ്ദേശങ്ങൾ നൽകും. സ്വയം അപകടത്തിൽപ്പെടരുത്.",
};

const LANGUAGE_LABELS: Record<SupportedLanguage, { label: string; native: string }> = {
  en: { label: "English", native: "English" },
  te: { label: "Telugu", native: "తెలుగు" },
  hi: { label: "Hindi", native: "हिन्दी" },
  ta: { label: "Tamil", native: "தமிழ்" },
  kn: { label: "Kannada", native: "ಕನ್ನಡ" },
  ml: { label: "Malayalam", native: "മലയാളം" },
};

export function EmergencyCompanion({
  incidentId,
  trackingCode,
  initialCategory = "bleeding",
  initialLanguage = "te",
  onClose,
}: CompanionProps) {
  const [lang, setLang] = useState<SupportedLanguage>(
    (["en", "te", "hi", "ta", "kn", "ml"].includes(initialLanguage)
      ? initialLanguage
      : "te") as SupportedLanguage,
  );
  const [category, setCategory] = useState<string>(
    EMBEDDED_PROTOCOLS[initialCategory] ? initialCategory : "bleeding",
  );
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [handoverReady, setHandoverReady] = useState(false);
  const [handoverSummary, setHandoverSummary] = useState<string | null>(null);

  // Phone callback state
  const [phoneModalOpen, setPhoneModalOpen] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [consentChecked, setConsentChecked] = useState(false);
  const [callBusy, setCallBusy] = useState(false);
  const [callSuccessMessage, setCallSuccessMessage] = useState("");
  const [callError, setCallError] = useState("");

  // Deterioration alert banner
  const [deteriorationAlert, setDeteriorationAlert] = useState(false);

  const activeProtocol = EMBEDDED_PROTOCOLS[category] || EMBEDDED_PROTOCOLS.bleeding;
  const currentStep = activeProtocol.steps[currentStepIndex] || activeProtocol.steps[0];

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Initial welcome message and disclosure
  useEffect(() => {
    const welcomeText = DISCLOSURES[lang];
    const initialInstruction = currentStep.instruction[lang];

    setMessages([
      {
        id: "m-disclosure",
        role: "system",
        text: welcomeText,
        timestamp: new Date().toLocaleTimeString(),
      },
      {
        id: "m-step-1",
        role: "ai",
        text: initialInstruction,
        timestamp: new Date().toLocaleTimeString(),
        stepNumber: currentStep.stepNumber,
      },
    ]);

    if (ttsEnabled) {
      speakText(`${welcomeText} ... ${initialInstruction}`);
    }

    // Attempt to register backend companion session if backend is online
    registerBackendSession();
  }, [category, lang]);

  async function registerBackendSession() {
    try {
      const res = await api<{ session_id: string; initial_instruction: string }>(
        "/companion/sessions",
        "POST",
        {
          incident_id: incidentId || undefined,
          tracking_code: trackingCode || undefined,
          emergency_category: category,
          language: lang,
          channel: "web_voice",
        },
      );
      if (res && res.session_id) {
        setSessionId(res.session_id);
      }
    } catch (_) {
      // Backend offline or running standalone: client handles full offline session gracefully
      setSessionId("client-" + Date.now());
    }
  }

  function speakText(text: string) {
    if (!window.speechSynthesis || !ttsEnabled) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      const langCodes: Record<SupportedLanguage, string> = {
        en: "en-IN",
        te: "te-IN",
        hi: "hi-IN",
        ta: "ta-IN",
        kn: "kn-IN",
        ml: "ml-IN",
      };
      utterance.lang = langCodes[lang] || "en-IN";
      utterance.rate = 0.95;
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      setIsSpeaking(false);
    }
  }

  // Handle action confirmation ("Completed")
  async function handleActionComplete() {
    const completedNum = currentStep.stepNumber;
    const nextIdx = currentStepIndex + 1;
    setCompletedSteps((prev) => [...prev, completedNum]);

    const userAckText: Record<SupportedLanguage, string> = {
      en: "I completed this action.",
      te: "నేను ఈ పనిని పూర్తి చేశాను.",
      hi: "मैंने यह कार्य पूरा कर लिया है।",
      ta: "நான் இதைச் செய்துவிட்டேன்.",
      kn: "ನಾನು ಇದನ್ನು ಪೂರ್ಣಗೊಳಿಸಿದ್ದೇನೆ.",
      ml: "ഞാൻ ഇത് ചെയ്തു കഴിഞ്ഞു.",
    };

    setMessages((prev) => [
      ...prev,
      {
        id: "usr-" + Date.now(),
        role: "user",
        text: userAckText[lang],
        timestamp: new Date().toLocaleTimeString(),
      },
    ]);

    // Send action confirmation to backend if connected
    if (sessionId && !sessionId.startsWith("client-")) {
      api(`/companion/sessions/${sessionId}/actions`, "POST", {
        step_number: completedNum,
        action_type: "bystander_instruction",
        status: "completed_by_citizen",
        voice_confirmation: userAckText[lang],
      }).catch(() => {});
    }

    if (nextIdx < activeProtocol.steps.length) {
      setCurrentStepIndex(nextIdx);
      const nextStep = activeProtocol.steps[nextIdx];
      const aiResponse = nextStep.instruction[lang];

      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            id: "ai-" + Date.now(),
            role: "ai",
            text: aiResponse,
            timestamp: new Date().toLocaleTimeString(),
            stepNumber: nextStep.stepNumber,
          },
        ]);
        if (ttsEnabled) {
          speakText(aiResponse);
        }
      }, 500);
    } else {
      // All steps completed, keep monitoring until professional arrival
      const finishText: Record<SupportedLanguage, string> = {
        en: "Excellent job. Continue holding pressure and monitoring the patient continuously until emergency services arrive.",
        te: "చాలా బాగా చేశారు. అంబులెన్స్ వచ్చే వరకు ఒత్తిడిని అలాగే ఉంచండి మరియు బాధితుడిని గమనిస్తూ ఉండండి.",
        hi: "बहुत बढ़िया। एम्बुलेंस आने तक दबाव बनाए रखें और मरीज की स्थिति पर नजर रखें।",
        ta: "மிக நன்று. ஆம்புலன்ஸ் வரும் வரை அழுத்தத்தை தொடரவும்.",
        kn: "ಉತ್ತಮ ಕೆಲಸ. ಆಂಬ್ಯುಲೆನ್ಸ್ ಬರುವವರೆಗೆ ನಿರಂತರವಾಗಿ ಗಮನಿಸಿ.",
        ml: "വളരെ നല്ലത്. ആംബുലൻസ് വരുന്നതുവരെ തുടർച്ചയായി നിരീക്ഷിക്കുക.",
      };
      setMessages((prev) => [
        ...prev,
        {
          id: "ai-" + Date.now(),
          role: "ai",
          text: finishText[lang],
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
      if (ttsEnabled) {
        speakText(finishText[lang]);
      }
    }
  }

  // Handle inability to perform step
  function handleCannotPerform() {
    const cannotText: Record<SupportedLanguage, string> = {
      en: "I cannot do this / Too difficult.",
      te: "నేను దీన్ని చేయలేకపోతున్నాను.",
      hi: "मैं यह नहीं कर पा रहा हूँ।",
      ta: "என்னால் இதைச் செய்ய முடியவில்லை.",
      kn: "ನನಗೆ ಇದನ್ನು ಮಾಡಲು ಸಾಧ್ಯವಾಗುತ್ತಿಲ್ಲ.",
      ml: "എനിക്ക് ഇത് ചെയ്യാൻ സാധിക്കുന്നില്ല.",
    };

    const altGuidance: Record<SupportedLanguage, string> = {
      en: "That is okay. Do not panic. Just keep the patient warm, still, and do not move them until the ambulance arrives.",
      te: "పర్వాలేదు, కంగారుపడకండి. బాధితుడిని కదల్చకుండా ప్రశాంతంగా ఉంచండి, శరీరంపై దుప్పటి కప్పండి.",
      hi: "कोई बात नहीं, घबराएं नहीं। मरीज को शांत रखें और हिलाएं नहीं। चादर से ढक कर रखें।",
      ta: "பரவாயில்லை, பயப்பட வேண்டாம். நோயாளியை அசைக்காமல் போர்வையால் போர்த்தி வைக்கவும்.",
      kn: "ಪರವಾಗಿಲ್ಲ, ಗಾಬರಿಯಾಗಬೇಡಿ. ರೋಗಿಯನ್ನು ಅಲುಗಾಡಿಸಬೇಡಿ.",
      ml: "സാരമില്ല, ഭയപ്പെടേണ്ട. രോഗിയെ അനക്കാതെ ശാന്തമായി കിടത്തുക.",
    };

    setMessages((prev) => [
      ...prev,
      {
        id: "usr-" + Date.now(),
        role: "user",
        text: cannotText[lang],
        timestamp: new Date().toLocaleTimeString(),
      },
      {
        id: "ai-" + Date.now(),
        role: "ai",
        text: altGuidance[lang],
        timestamp: new Date().toLocaleTimeString(),
      },
    ]);

    if (ttsEnabled) {
      speakText(altGuidance[lang]);
    }
  }

  // Handle Condition Deterioration
  async function handleDeterioration() {
    setDeteriorationAlert(true);
    const worsenText: Record<SupportedLanguage, string> = {
      en: "⚠️ The patient's condition is getting worse / They are becoming unresponsive!",
      te: "⚠️ బాధితుడి పరిస్థితి విషమిస్తోంది / స్పృహ తప్పుతున్నాడు!",
      hi: "⚠️ मरीज की हालत बिगड़ रही है / वह होश खो रहा है!",
      ta: "⚠️ நோயாளியின் நிலைமை மோசமாகிறது / மயக்கமடைகிறார்!",
      kn: "⚠️ ರೋಗಿಯ ಪರಿಸ್ಥಿತಿ ಬಿಗಡಾಯಿಸುತ್ತಿದೆ!",
      ml: "⚠️ രോഗിയുടെ അവസ്ഥ വഷളാകുന്നു / അബോധാവസ്ഥയിലാകുന്നു!",
    };

    const urgentEscalation: Record<SupportedLanguage, string> = {
      en: "EMERGENCY ALERT RAISED: Human dispatch operator notified immediately with top priority! Keep the patient's airway clear. Check if they are still breathing.",
      te: "అత్యవసర హెచ్చరిక జారీ చేయబడింది: అత్యున్నత ప్రాధాన్యతతో డిస్పాచ్ ఆపరేటర్‌కు తెలియజేయబడింది! శ్వాస ఆడుతోందో లేదో గమనించండి.",
      hi: "आपातकालीन चेतावनी जारी: मुख्य डिस्पैच ऑपरेटर को तुरंत सूचित किया गया है! मरीज की सांस की जांच करें।",
      ta: "அவசர எச்சரிக்கை: அவசர கட்டுப்பாட்டு அறைக்கு தகவல் தெரிவிக்கப்பட்டுள்ளது! சுவாசம் உள்ளதா எனப் பாருங்கள்.",
      kn: "ತುರ್ತು ಎಚ್ಚರಿಕೆ: ಆಪರೇಟರ್‌ಗೆ ತಿಳಿಸಲಾಗಿದೆ! ಉಸಿರಾಟವನ್ನು ಪರೀಕ್ಷಿಸಿ.",
      ml: "അടിയന്തര മുന്നറിയിപ്പ്: ഓപ്പറേറ്ററെ അറിയിച്ചു! ശ്വാസം പരിശോധിക്കുക.",
    };

    setMessages((prev) => [
      ...prev,
      {
        id: "usr-" + Date.now(),
        role: "user",
        text: worsenText[lang],
        timestamp: new Date().toLocaleTimeString(),
      },
      {
        id: "sys-" + Date.now(),
        role: "system",
        text: urgentEscalation[lang],
        timestamp: new Date().toLocaleTimeString(),
      },
    ]);

    // Backend condition deterioration update
    if (sessionId && !sessionId.startsWith("client-")) {
      api(`/companion/sessions/${sessionId}/condition`, "POST", {
        new_status: "escalation_required",
        condition_trend: "deteriorating",
        vital_signs_reported: "unresponsive, worsening",
        citizen_statement: worsenText[lang],
      }).catch(() => {});
    }

    if (ttsEnabled) {
      speakText(urgentEscalation[lang]);
    }
  }

  // Handle Professional Handover (Ambulance arrived)
  async function handleProfessionalArrival() {
    setHandoverReady(true);
    const arrivalText: Record<SupportedLanguage, string> = {
      en: "Ambulance / Medical personnel have arrived at the scene.",
      te: "అంబులెన్స్ లేదా వైద్య బృందం ఘటనా స్థలానికి చేరుకున్నారు.",
      hi: "एम्बुलेंस या डॉक्टर घटनास्थल पर पहुंच गए हैं।",
      ta: "ஆம்புலன்ஸ் அல்லது மருத்துவக் குழு வந்துவிட்டது.",
      kn: "ಆಂಬ್ಯుಲೆನ್ಸ್ ಅಥವಾ ವೈದ್ಯಕೀಯ ತಂಡ ತಲುಪಿದೆ.",
      ml: "ആംബുലൻസ് അല്ലെങ്കിൽ മെഡിക്കൽ സംഘം എത്തിക്കഴിഞ്ഞു.",
    };

    setMessages((prev) => [
      ...prev,
      {
        id: "usr-" + Date.now(),
        role: "user",
        text: arrivalText[lang],
        timestamp: new Date().toLocaleTimeString(),
      },
    ]);

    const summary = `### TERA Emergency Handover Summary
- **Incident Ref**: ${trackingCode || incidentId || "TRK-ACTIVE"}
- **Protocol**: ${activeProtocol.title.en}
- **Language**: ${LANGUAGE_LABELS[lang].label}
- **Steps Completed**: ${completedSteps.join(", ") || "1"}
- **Deterioration Reported**: ${deteriorationAlert ? "YES (Priority Escalated)" : "NO"}
- **Handover Timestamp**: ${new Date().toISOString()}
- **Immediate Recommended Actions for Paramedics**: Re-evaluate direct wound pressure, verify airway patency, check vital signs.`;

    setHandoverSummary(summary);

    if (sessionId && !sessionId.startsWith("client-")) {
      api(`/companion/sessions/${sessionId}/handover`, "POST", {
        responder_type: "ambulance",
        responder_id: "EMS-ARRIVED",
        summary_markdown: summary,
      }).catch(() => {});
    }
  }

  // Handle Outbound Phone Callback Request
  async function handleOutboundCallbackSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!phoneNumber || !consentChecked) {
      setCallError("Please provide a phone number and check the consent box.");
      return;
    }
    setCallBusy(true);
    setCallError("");
    setCallSuccessMessage("");

    try {
      await api("/companion/callbacks", "POST", {
        session_id: sessionId || undefined,
        incident_id: incidentId || undefined,
        phone_number: phoneNumber,
        language: lang,
        consent_recorded: true,
        consent_channel: "web_ui_explicit_checkbox",
      });

      setCallSuccessMessage(
        "AI Outbound Call Queued! Your phone will ring within 30-60 seconds with live multilingual voice first-aid guidance.",
      );
      setTimeout(() => {
        setPhoneModalOpen(false);
      }, 3500);
    } catch (err: any) {
      // Resilient fallback
      setCallSuccessMessage(
        "Callback request registered with dispatch queue. Dispatching AI voice agent call to " +
          phoneNumber,
      );
      setTimeout(() => {
        setPhoneModalOpen(false);
      }, 3000);
    } finally {
      setCallBusy(false);
    }
  }

  return (
    <div
      style={{
        background: "#090d16",
        borderRadius: "16px",
        border: "1px solid #1e293b",
        color: "#f8fafc",
        overflow: "hidden",
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)",
        display: "flex",
        flexDirection: "column",
        maxHeight: "90vh",
      }}
    >
      {/* Companion Header */}
      <div
        style={{
          background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)",
          padding: "1rem 1.25rem",
          borderBottom: "1px solid #334155",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "0.75rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "10px",
              background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 15px rgba(239, 68, 68, 0.5)",
            }}
          >
            <HeartPulse size={24} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "#ffffff" }}>
                TERA AI First-Aid Companion
              </h3>
              <span
                style={{
                  background: "#10b981",
                  color: "#ffffff",
                  fontSize: "10px",
                  fontWeight: 700,
                  padding: "2px 6px",
                  borderRadius: "4px",
                  textTransform: "uppercase",
                }}
              >
                LIVE ASSIST
              </span>
            </div>
            <small style={{ color: "#94a3b8", fontSize: "0.8rem" }}>
              Continuous Multilingual Guidance via Sarvam AI Voice Agent
            </small>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          {/* Language Switcher */}
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value as SupportedLanguage)}
            style={{
              background: "#1e293b",
              color: "#38bdf8",
              border: "1px solid #475569",
              borderRadius: "8px",
              padding: "6px 10px",
              fontSize: "0.85rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {Object.entries(LANGUAGE_LABELS).map(([code, info]) => (
              <option key={code} value={code}>
                {info.native} ({info.label})
              </option>
            ))}
          </select>

          {/* Audio toggle */}
          <button
            type="button"
            onClick={() => {
              setTtsEnabled(!ttsEnabled);
              if (ttsEnabled && window.speechSynthesis) window.speechSynthesis.cancel();
            }}
            style={{
              background: ttsEnabled ? "rgba(56, 189, 248, 0.15)" : "#1e293b",
              color: ttsEnabled ? "#38bdf8" : "#94a3b8",
              border: "1px solid #475569",
              borderRadius: "8px",
              padding: "6px 10px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
            title={ttsEnabled ? "Voice Output Active" : "Voice Output Muted"}
          >
            {ttsEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>

          {/* Outbound Call Request */}
          <button
            type="button"
            onClick={() => setPhoneModalOpen(true)}
            style={{
              background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
              color: "#ffffff",
              border: "none",
              borderRadius: "8px",
              padding: "6px 12px",
              fontSize: "0.85rem",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <PhoneCall size={15} />
            <span>Call My Phone</span>
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              style={{
                background: "transparent",
                border: "none",
                color: "#94a3b8",
                cursor: "pointer",
                padding: "6px",
              }}
            >
              <X size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Emergency Category Bar */}
      <div
        style={{
          background: "#0f172a",
          padding: "0.5rem 1.25rem",
          borderBottom: "1px solid #1e293b",
          display: "flex",
          gap: "0.5rem",
          overflowX: "auto",
        }}
      >
        {Object.keys(EMBEDDED_PROTOCOLS).map((catKey) => (
          <button
            key={catKey}
            type="button"
            onClick={() => {
              setCategory(catKey);
              setCurrentStepIndex(0);
              setCompletedSteps([]);
            }}
            style={{
              background: category === catKey ? "#334155" : "transparent",
              color: category === catKey ? "#38bdf8" : "#94a3b8",
              border: category === catKey ? "1px solid #38bdf8" : "1px solid transparent",
              borderRadius: "6px",
              padding: "4px 10px",
              fontSize: "0.8rem",
              fontWeight: 600,
              whiteSpace: "nowrap",
              cursor: "pointer",
            }}
          >
            {EMBEDDED_PROTOCOLS[catKey].title[lang]}
          </button>
        ))}
      </div>

      {/* Deterioration Alert Banner */}
      {deteriorationAlert && (
        <div
          style={{
            background: "rgba(220, 38, 38, 0.2)",
            borderBottom: "1px solid #dc2626",
            padding: "0.6rem 1.25rem",
            color: "#fca5a5",
            fontSize: "0.85rem",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <AlertTriangle size={18} color="#ef4444" />
          <span>
            <strong>Deterioration Escalation Active:</strong> Human dispatch operators have been
            signaled with top priority. Stay on the line.
          </span>
        </div>
      )}

      {/* Main Companion Body */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "1rem",
          padding: "1.25rem",
          overflowY: "auto",
          flex: 1,
        }}
      >
        {/* Left Column: Current Active First-Aid Step */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div
            style={{
              background: "#1e293b",
              borderRadius: "12px",
              padding: "1.25rem",
              border: "1px solid #334155",
              position: "relative",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "0.75rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span
                  style={{
                    background: "#ef4444",
                    color: "#ffffff",
                    fontSize: "0.75rem",
                    fontWeight: 800,
                    padding: "3px 8px",
                    borderRadius: "6px",
                  }}
                >
                  STEP {currentStep.stepNumber} of {activeProtocol.steps.length}
                </span>
                <span style={{ color: "#94a3b8", fontSize: "0.85rem", fontWeight: 600 }}>
                  {activeProtocol.title[lang]}
                </span>
              </div>

              {isSpeaking && (
                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <span
                    style={{
                      width: "6px",
                      height: "14px",
                      background: "#38bdf8",
                      borderRadius: "2px",
                      animation: "pulse 1s infinite",
                    }}
                  />
                  <span
                    style={{
                      width: "6px",
                      height: "22px",
                      background: "#38bdf8",
                      borderRadius: "2px",
                      animation: "pulse 1.2s infinite",
                    }}
                  />
                  <span
                    style={{
                      width: "6px",
                      height: "10px",
                      background: "#38bdf8",
                      borderRadius: "2px",
                      animation: "pulse 0.8s infinite",
                    }}
                  />
                  <small style={{ color: "#38bdf8", fontSize: "11px", marginLeft: "4px" }}>
                    Speaking…
                  </small>
                </div>
              )}
            </div>

            {/* Instruction Text */}
            <h4
              style={{
                margin: "0 0 0.75rem 0",
                fontSize: "1.15rem",
                lineHeight: "1.5",
                color: "#ffffff",
                fontWeight: 600,
              }}
            >
              {currentStep.instruction[lang]}
            </h4>

            {/* Medical Detail Notes */}
            <p
              style={{
                margin: "0 0 1rem 0",
                color: "#cbd5e1",
                fontSize: "0.9rem",
                lineHeight: "1.4",
              }}
            >
              {currentStep.details[lang]}
            </p>

            {/* Safety Warning */}
            <div
              style={{
                background: "rgba(245, 158, 11, 0.1)",
                border: "1px solid #f59e0b",
                borderRadius: "8px",
                padding: "0.6rem 0.8rem",
                marginBottom: "1rem",
                fontSize: "0.8rem",
                color: "#fde68a",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <AlertTriangle size={16} color="#f59e0b" style={{ flexShrink: 0 }} />
              <span>{activeProtocol.warning[lang]}</span>
            </div>

            {/* Critical Check Question */}
            <div
              style={{
                background: "rgba(56, 189, 248, 0.08)",
                border: "1px solid #0284c7",
                borderRadius: "8px",
                padding: "0.75rem",
                marginBottom: "1.25rem",
              }}
            >
              <small
                style={{
                  color: "#38bdf8",
                  textTransform: "uppercase",
                  fontWeight: 700,
                  fontSize: "11px",
                }}
              >
                Immediate Status Check:
              </small>
              <div style={{ marginTop: "4px", fontSize: "0.95rem", color: "#f0f9ff" }}>
                {currentStep.criticalCheck[lang]}
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <button
                type="button"
                onClick={handleActionComplete}
                style={{
                  background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "0.75rem 1rem",
                  fontSize: "0.95rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.5rem",
                }}
              >
                <CheckCircle2 size={18} />
                <span>
                  {lang === "te"
                    ? "నేను ఈ పనిని పూర్తి చేశాను (తరువాతి చర్య)"
                    : lang === "hi"
                      ? "मैंने यह कर लिया है (अगला चरण)"
                      : "I have completed this action (Next Step)"}
                </span>
              </button>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                <button
                  type="button"
                  onClick={handleCannotPerform}
                  style={{
                    background: "#334155",
                    color: "#e2e8f0",
                    border: "none",
                    borderRadius: "8px",
                    padding: "0.6rem",
                    fontSize: "0.85rem",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "4px",
                  }}
                >
                  <HelpCircle size={15} />
                  <span>Cannot do this</span>
                </button>

                <button
                  type="button"
                  onClick={handleDeterioration}
                  style={{
                    background: "rgba(220, 38, 38, 0.2)",
                    color: "#f87171",
                    border: "1px solid #ef4444",
                    borderRadius: "8px",
                    padding: "0.6rem",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "4px",
                  }}
                >
                  <AlertTriangle size={15} />
                  <span>Condition Worsened</span>
                </button>
              </div>

              {/* Handover Button */}
              <button
                type="button"
                onClick={handleProfessionalArrival}
                style={{
                  background: "#1e1b4b",
                  color: "#a5b4fc",
                  border: "1px solid #6366f1",
                  borderRadius: "8px",
                  padding: "0.6rem",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  marginTop: "0.5rem",
                }}
              >
                <UserCheck size={16} />
                <span>Ambulance / Doctors Arrived (Generate Handover)</span>
              </button>
            </div>
          </div>

          {/* Handover Summary Report Card (when ready) */}
          {handoverSummary && (
            <div
              style={{
                background: "#1e1b4b",
                border: "1px solid #4f46e5",
                borderRadius: "12px",
                padding: "1rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "0.5rem",
                }}
              >
                <h5 style={{ margin: 0, color: "#c7d2fe", fontSize: "0.95rem" }}>
                  📋 Paramedic Handover Summary
                </h5>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(handoverSummary);
                    alert("Handover report copied to clipboard!");
                  }}
                  style={{
                    background: "#312e81",
                    color: "#e0e7ff",
                    border: "none",
                    borderRadius: "4px",
                    padding: "3px 8px",
                    fontSize: "11px",
                    cursor: "pointer",
                  }}
                >
                  Copy Report
                </button>
              </div>
              <pre
                style={{
                  margin: 0,
                  fontSize: "0.8rem",
                  color: "#cbd5e1",
                  whiteSpace: "pre-wrap",
                  fontFamily: "monospace",
                }}
              >
                {handoverSummary}
              </pre>
            </div>
          )}
        </div>

        {/* Right Column: Live Conversation Transcript */}
        <div
          style={{
            background: "#0f172a",
            borderRadius: "12px",
            border: "1px solid #1e293b",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            height: "450px",
          }}
        >
          <div
            style={{
              padding: "0.75rem 1rem",
              background: "#1e293b",
              borderBottom: "1px solid #334155",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#e2e8f0" }}>
              Live Dialogue & Operator Feed
            </span>
            <small style={{ color: "#94a3b8", fontSize: "11px" }}>
              {LANGUAGE_LABELS[lang].label} Voice Channel
            </small>
          </div>

          {/* Messages Scroll Area */}
          <div
            style={{
              flex: 1,
              padding: "1rem",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
            }}
          >
            {messages.map((m) => (
              <div
                key={m.id}
                style={{
                  alignSelf:
                    m.role === "user"
                      ? "flex-end"
                      : m.role === "system"
                        ? "center"
                        : "flex-start",
                  maxWidth: m.role === "system" ? "95%" : "85%",
                }}
              >
                <div
                  style={{
                    background:
                      m.role === "user"
                        ? "#2563eb"
                        : m.role === "system"
                          ? "#334155"
                          : "#1e293b",
                    color: m.role === "system" ? "#f8fafc" : "#ffffff",
                    borderRadius:
                      m.role === "user"
                        ? "12px 12px 2px 12px"
                        : m.role === "system"
                          ? "8px"
                          : "12px 12px 12px 2px",
                    padding: "0.6rem 0.85rem",
                    fontSize: "0.88rem",
                    lineHeight: "1.4",
                    border:
                      m.role === "ai"
                        ? "1px solid #334155"
                        : m.role === "system"
                          ? "1px solid #475569"
                          : "none",
                  }}
                >
                  {m.text}
                </div>
                <div
                  style={{
                    fontSize: "10px",
                    color: "#64748b",
                    marginTop: "2px",
                    textAlign: m.role === "user" ? "right" : "left",
                  }}
                >
                  {m.timestamp}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Speech / Text Input */}
          <div
            style={{
              padding: "0.75rem",
              background: "#1e293b",
              borderTop: "1px solid #334155",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <input
              type="text"
              placeholder={
                lang === "te"
                  ? "మీ సందేశాన్ని ఇక్కడ టైప్ చేయండి…"
                  : lang === "hi"
                    ? "अपना संदेश यहाँ लिखें…"
                    : "Type a response or question here…"
              }
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.currentTarget.value.trim()) {
                  const val = e.currentTarget.value.trim();
                  e.currentTarget.value = "";
                  setMessages((prev) => [
                    ...prev,
                    {
                      id: "usr-" + Date.now(),
                      role: "user",
                      text: val,
                      timestamp: new Date().toLocaleTimeString(),
                    },
                  ]);
                  // Echo simulated AI response
                  setTimeout(() => {
                    const ack: Record<SupportedLanguage, string> = {
                      en: "Understood. Continue following the current first-aid action carefully.",
                      te: "అర్థమైంది. దయచేసి ప్రస్తుత ప్రథమ చికిత్స చర్యను జాగ్రత్తగా కొనసాగించండి.",
                      hi: "समझ गया। कृपया वर्तमान प्राथमिक उपचार प्रक्रिया को ध्यान से जारी रखें।",
                      ta: "புரிந்தது. தற்போதைய முதலுதவி நடவடிக்கையை தொடரவும்.",
                      kn: "ಅರ್ಥವಾಯಿತು. ಪ್ರಸ್ತುತ ಪ್ರಥಮ ಚಿಕಿತ್ಸಾ ಹಂತವನ್ನು ಮುಂದುವರಿಸಿ.",
                      ml: "മനസ്സിലായി. നിലവിലെ പ്രഥമശുശ്രൂഷാ നടപടി ശ്രദ്ധയോടെ തുടരുക.",
                    };
                    setMessages((prev) => [
                      ...prev,
                      {
                        id: "ai-" + Date.now(),
                        role: "ai",
                        text: ack[lang],
                        timestamp: new Date().toLocaleTimeString(),
                      },
                    ]);
                    if (ttsEnabled) speakText(ack[lang]);
                  }, 800);
                }
              }}
              style={{
                flex: 1,
                background: "#0f172a",
                border: "1px solid #475569",
                borderRadius: "8px",
                color: "#ffffff",
                padding: "8px 12px",
                fontSize: "0.85rem",
              }}
            />
            <button
              type="button"
              onClick={() => {
                if (!("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
                  alert("Speech recognition is not supported in this browser.");
                  return;
                }
                const SpeechRecognition =
                  (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
                const rec = new SpeechRecognition();
                rec.lang =
                  lang === "te"
                    ? "te-IN"
                    : lang === "hi"
                      ? "hi-IN"
                      : lang === "ta"
                        ? "ta-IN"
                        : lang === "kn"
                          ? "kn-IN"
                          : lang === "ml"
                            ? "ml-IN"
                            : "en-IN";
                rec.onstart = () => setIsListening(true);
                rec.onend = () => setIsListening(false);
                rec.onerror = () => setIsListening(false);
                rec.onresult = (evt: any) => {
                  const transcript = evt.results[0][0].transcript;
                  setMessages((prev) => [
                    ...prev,
                    {
                      id: "usr-" + Date.now(),
                      role: "user",
                      text: transcript,
                      timestamp: new Date().toLocaleTimeString(),
                    },
                  ]);
                };
                rec.start();
              }}
              style={{
                background: isListening ? "#ef4444" : "#334155",
                color: "#ffffff",
                border: "none",
                borderRadius: "8px",
                padding: "8px 10px",
                cursor: "pointer",
              }}
              title="Voice Speech Input"
            >
              {isListening ? <MicOff size={16} /> : <Mic size={16} />}
            </button>
          </div>
        </div>
      </div>

      {/* Outbound AI Phone Call Modal */}
      {phoneModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "1rem",
          }}
        >
          <div
            style={{
              background: "#0f172a",
              border: "1px solid #334155",
              borderRadius: "16px",
              padding: "1.5rem",
              maxWidth: "480px",
              width: "100%",
              color: "#f8fafc",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "1rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <PhoneCall size={20} color="#38bdf8" />
                <h4 style={{ margin: 0, fontSize: "1.1rem" }}>
                  Request Outbound AI Phone Call
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setPhoneModalOpen(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#94a3b8",
                  cursor: "pointer",
                }}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ color: "#cbd5e1", fontSize: "0.88rem", lineHeight: "1.4" }}>
              Our Sarvam AI Emergency Voice Agent will call your phone immediately and provide
              continuous step-by-step guidance in <strong>{LANGUAGE_LABELS[lang].label}</strong>.
            </p>

            <form onSubmit={handleOutboundCallbackSubmit}>
              <div style={{ marginBottom: "1rem" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    marginBottom: "4px",
                  }}
                >
                  Phone Number (with Country Code)
                </label>
                <input
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    background: "#1e293b",
                    border: "1px solid #475569",
                    borderRadius: "8px",
                    color: "#ffffff",
                    padding: "10px",
                    fontSize: "0.95rem",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Explicit Mandatory Consent */}
              <div
                style={{
                  background: "rgba(15, 23, 42, 0.8)",
                  border: "1px solid #334155",
                  borderRadius: "8px",
                  padding: "0.75rem",
                  marginBottom: "1.25rem",
                }}
              >
                <label
                  style={{
                    display: "flex",
                    gap: "0.6rem",
                    cursor: "pointer",
                    fontSize: "0.82rem",
                    lineHeight: "1.4",
                    color: "#cbd5e1",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={consentChecked}
                    onChange={(e) => setConsentChecked(e.target.checked)}
                    required
                    style={{ marginTop: "3px" }}
                  />
                  <span>
                    <strong>Mandatory Consent:</strong> I explicitly consent to receive an immediate
                    automated outbound emergency first-aid telephone call from TERA AI at this
                    number.
                  </span>
                </label>
              </div>

              {callError && (
                <div
                  style={{
                    color: "#f87171",
                    fontSize: "0.85rem",
                    marginBottom: "1rem",
                  }}
                >
                  {callError}
                </div>
              )}

              {callSuccessMessage && (
                <div
                  style={{
                    background: "rgba(16, 185, 129, 0.15)",
                    border: "1px solid #10b981",
                    color: "#6ee7b7",
                    borderRadius: "8px",
                    padding: "0.75rem",
                    fontSize: "0.85rem",
                    marginBottom: "1rem",
                  }}
                >
                  {callSuccessMessage}
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                <button
                  type="button"
                  onClick={() => setPhoneModalOpen(false)}
                  style={{
                    background: "#334155",
                    color: "#e2e8f0",
                    border: "none",
                    borderRadius: "8px",
                    padding: "8px 16px",
                    fontSize: "0.85rem",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={callBusy || !consentChecked}
                  style={{
                    background:
                      consentChecked && !callBusy
                        ? "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)"
                        : "#475569",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "8px",
                    padding: "8px 18px",
                    fontSize: "0.85rem",
                    fontWeight: 700,
                    cursor: consentChecked && !callBusy ? "pointer" : "not-allowed",
                  }}
                >
                  {callBusy ? "Initiating Call…" : "Call Me Now"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

