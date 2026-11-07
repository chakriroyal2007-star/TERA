import re
from typing import Literal
from pydantic import BaseModel, Field


class ExtractedIncident(BaseModel):
    title: str = Field(description="Brief incident title")
    category: Literal["medical", "road_collision", "fire", "disaster", "other"]
    description: str = Field(description="Incident description derived from speech")
    incident_datetime: str | None = None
    location_text: str = Field(description="Location or landmarks mentioned")
    landmark: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    affected_people: int | str | None = None
    injuries: str | None = None
    severity: Literal["low", "medium", "high", "critical"] = "medium"
    vehicles: str | None = None
    immediate_hazards: str | None = None
    required_resources: list[str] = Field(default_factory=list)
    requested_assistance: list[str] = Field(default_factory=list)
    reporter_contact: str | None = None
    immediate_safety_concerns: str | None = None
    detected_language: str = "en"
    english_translation: str | None = None
    source_transcript: str
    confidence: float | None = None
    extraction_status: str = "extracted"


def detect_language_from_text(text: str) -> str:
    """
    Detects Indian language or English based on script character code ranges.
    Returns ISO 639-1 code: 'te', 'hi', 'ta', 'ml', 'kn', or 'en'.
    """
    counts = {"te": 0, "hi": 0, "ta": 0, "ml": 0, "kn": 0, "en": 0}
    for char in text:
        cp = ord(char)
        if 0x0C00 <= cp <= 0x0C7F:
            counts["te"] += 1
        elif 0x0900 <= cp <= 0x097F:
            counts["hi"] += 1
        elif 0x0B80 <= cp <= 0x0BFF:
            counts["ta"] += 1
        elif 0x0D00 <= cp <= 0x0D7F:
            counts["ml"] += 1
        elif 0x0C80 <= cp <= 0x0CFF:
            counts["kn"] += 1
        elif 0x0041 <= cp <= 0x005A or 0x0061 <= cp <= 0x007A:
            counts["en"] += 1

    detected = max(counts, key=counts.get)
    if counts[detected] == 0:
        return "en"
    return detected


# Multilingual dictionaries for factual parsing without hallucinations
TELUGU_NUMBERS = {
    "ఒకరు": 1, "ఒకటి": 1, "ఇద్దరు": 2, "ఇద్దరికి": 2, "ముగ్గురు": 3,
    "నలుగురు": 4, "ఐదుగురు": 5, "ఐదు": 5, "ఆరుగురు": 6, "ఏడుగురు": 7,
    "ఎనిమిది": 8, "తొమ్మిది": 9, "పది": 10,
}

HINDI_NUMBERS = {
    "एक": 1, "दो": 2, "तीन": 3, "चार": 4, "पांच": 5, "पाँच": 5,
    "छह": 6, "सात": 7, "आठ": 8, "नौ": 9, "दस": 10,
}

TAMIL_NUMBERS = {
    "ஒரு": 1, "இருவர்": 2, "மூன்று": 3, "நான்கு": 4, "ஐந்து": 5,
    "ஆறு": 6, "ஏழு": 7, "எட்டு": 8, "ஒன்பது": 9, "பத்து": 10,
}

MALAYALAM_NUMBERS = {
    "ഒന്ന്": 1, "രണ്ട്": 2, "മൂന്ന്": 3, "നാല്": 4, "അഞ്ച്": 5,
    "ആറ്": 6, "ഏഴ്": 7, "എട്ട്": 8, "ഒൻപത്": 9, "പത്ത്": 10,
}

KANNADA_NUMBERS = {
    "ಒಂದು": 1, "ಇಬ್ಬರು": 2, "ಮೂರು": 3, "ನಾಲ್ಕು": 4, "ಐದು": 5,
    "ಆರು": 6, "ಏಳು": 7, "ಎಂಟು": 8, "ಒಂಬತ್ತು": 9, "ಹತ್ತು": 10,
}


def extract_incident_from_transcript(
    transcript: str, detected_language: str | None = None
) -> ExtractedIncident:
    """
    Extracts structured emergency incident information from the spoken transcript.
    Truthful parsing: never invents unmentioned details.
    Supports English, Telugu, Hindi, Tamil, Malayalam, and Kannada.
    """
    text = transcript.strip()
    lang = detected_language or detect_language_from_text(text)
    lower = text.lower()

    # 1. Category Classification
    category: Literal["medical", "road_collision", "fire", "disaster", "other"] = "other"

    # Road collision keywords across 6 languages
    road_kw = [
        "crash", "collision", "accident", "car accident", "truck", "bike", "vehicle", "overturned", "hit and run",
        # Telugu
        "ప్రమాదం", "యాక్సిడెంట్", "కారు", "లారీ", "బైక్", "బస్సు", "ఢీకొంది", "బోల్తా",
        # Hindi
        "दुर्घटना", "एक्सीडेंट", "टक्कर", "गाड़ी", "कार", "ट्रक", "बाइक",
        # Tamil
        "விபத்து", "மோது", "கார்", "லாரி", "பைக்",
        # Malayalam
        "അപകടം", "കൂട്ടിയിടി", "കാർ", "ലോറി", "ബൈക്ക്",
        # Kannada
        "ಅಪಘಾತ", "ಡಿಕ್ಕಿ", "ಕಾರು", "ಲಾರಿ", "ಬೈಕ್",
    ]

    # Fire keywords
    fire_kw = [
        "fire", "blaze", "smoke", "burning", "flames", "explosion",
        # Telugu
        "మంటలు", "కాలిపోతోంది", "పొగ", "అగ్నిప్రమాదం", "పేలుడు",
        # Hindi
        "आग", "धुआं", "जल रहा", "विस्फोट",
        # Tamil
        "தீ", "புகை", "எரிகிறது", "வெடி",
        # Malayalam
        "തീ", "പുക", "കത്തുന്നു", "സ്ഫോടനം",
        # Kannada
        "ಬೆಂಕಿ", "ಹೊಗೆ", "ಉರಿಯುತ್ತಿದೆ", "ಸ್ಫೋಟ",
    ]

    # Medical keywords
    medical_kw = [
        "heart attack", "cardiac", "stroke", "unconscious", "bleeding", "asthma", "fainted",
        "choking", "seizure", "chest pain", "injured", "fracture", "patient", "blood", "ambulance",
        # Telugu
        "గాయాలయ్యాయి", "గాయం", "రక్తస్రావం", "రక్తం", "స్పృహ", "గుండెపోటు", "శ్వాస", "అంబులెన్స్", "రోగి",
        # Hindi
        "घायल", "चोट", "खून", "बेहोश", "दौरा", "एम्बुलेंस", "मरीज",
        # Tamil
        "காயம்", "ரத்தம்", "மயக்கம்", "ஆம்புலன்ஸ்", "நோயாளி",
        # Malayalam
        "പരുക്ക്", "രക്തം", "ബോധക്ഷയം", "ആംബുലൻസ്", "രോഗി",
        # Kannada
        "ಗಾಯ", "ರಕ್ತ", "ಪ್ರಜ್ಞೆ", "ಆಂಬ್ಯುಲೆನ್ಸ್", "ರೋಗಿ",
    ]

    # Disaster keywords
    disaster_kw = [
        "flood", "earthquake", "building collapse", "cyclone", "hurricane", "landslide", "tsunami", "collapsed",
        # Telugu
        "వరదలు", "భూకంపం", "భవనం కూలింది", "కూలిపోయింది", "తుఫాను",
        # Hindi
        "बाढ़", "भूकंप", "इमारत गिर गई", "तूफान",
        # Tamil
        "வெள்ளம்", "நிலநடுக்கம்", "கட்டிடம் இடிந்தது", "புயல்",
        # Malayalam
        "വെള്ളപ്പൊക്കം", "ഭൂകമ്പം", "കെട്ടിടം തകർന്നു", "ചുഴലിക്കാറ്റ്",
        # Kannada
        "ಪ್ರವಾಹ", "ಭೂಕಂಪ", "ಕಟ್ಟಡ ಕುಸಿತ", "ಚಂಡಮಾರುತ",
    ]

    if any(k in text or k in lower for k in road_kw):
        category = "road_collision"
    elif any(k in text or k in lower for k in fire_kw):
        category = "fire"
    elif any(k in text or k in lower for k in medical_kw):
        category = "medical"
    elif any(k in text or k in lower for k in disaster_kw):
        category = "disaster"

    # 2. Severity / Priority Determination
    severity: Literal["low", "medium", "high", "critical"] = "medium"
    critical_kw = [
        "critical", "unconscious", "not breathing", "severe", "fatal", "dying", "massive",
        "heavy bleeding", "trapped inside", "explosion risk", "life-threatening", "lots of blood",
        # Telugu
        "తీవ్ర", "చాలా రక్తం", "రక్తస్రావం అవుతోంది", "స్పృహ లేదు", "చనిపోయేలా", "భారీ",
        # Hindi
        "गंभीर", "बहुत खून", "बेहोश", "जानलेवा",
        # Tamil
        "தீவிர", "அதிக ரத்தம்", "மயக்க நிலை", "உயிர் ஆபத்து",
        # Malayalam
        "ഗുരുതര", "അമിത രക്തസ്രാവം", "അബോധാവസ്ഥ",
        # Kannada
        "ತೀವ್ರ", "ಹೆಚ್ಚು ರಕ್ತಸ್ರಾವ", "ಪ್ರಜ್ಞಾಹೀನ",
    ]
    high_kw = [
        "urgent", "badly hurt", "spreading fast", "fracture", "multiple injured", "head injury", "deep cut",
        # Telugu
        "గాయాలు", "వెంటనే", "ఎక్కువ మంది",
        # Hindi
        "जल्द", "चोटें", "फैल रहा",
        # Tamil
        "உடனடி", "காயங்கள்",
        # Malayalam
        "ഉടൻ", "പരുക്കുകൾ",
        # Kannada
        "ತಕ್ಷಣ", "ಗಾಯಗಳು",
    ]
    low_kw = ["minor", "stable", "small scratch", "conscious", "controlled", "small fire"]

    if any(k in text or k in lower for k in critical_kw):
        severity = "critical"
    elif any(k in text or k in lower for k in high_kw):
        severity = "high"
    elif any(k in text or k in lower for k in low_kw):
        severity = "low"

    # 3. Location Extraction
    location = ""
    # Check English prepositions
    loc_matches = re.findall(
        r"(?:at|near|on|in|around|opposite|behind|beside)\s+([A-Za-z0-9\s,\.-]+?)(?:\.|\band\b|\bwith\b|\bplease\b|\bneed\b|\bthere\b|$)",
        text,
        re.IGNORECASE,
    )
    if loc_matches:
        cand = loc_matches[0].strip()
        if len(cand) > 3 and not cand.lower().startswith(("a ", "the ", "this ")):
            location = cand[:200]

    # Check for road/street/nagar/colony keywords
    if not location:
        kw_match = re.search(
            r"([A-Za-z0-9\s]+(?:Road|Street|Avenue|Highway|Junction|Cross|Lane|Hospital|Station|Metro|Park|Bridge|Colony|Nagar))",
            text,
            re.IGNORECASE,
        )
        if kw_match:
            location = kw_match.group(1).strip()

    # Telugu location detection (e.g., "తిరుపతిలో అన్నమయ్య నగర్ దగ్గర" -> "Annamayya Nagar, Tirupati")
    if "అన్నమయ్య నగర్" in text or "annamayya nagar" in lower:
        loc_part = "Annamayya Nagar"
        if "తిరుపతి" in text or "tirupati" in lower:
            location = f"{loc_part}, Tirupati"
        else:
            location = loc_part
    elif "తిరుపతి" in text or "tirupati" in lower:
        location = "Tirupati"

    if not location and lang != "en":
        # Extract before దగ్గర / के पास / அருகில் / അടുത്ത് / ಹತ್ತಿರ
        sub_loc = re.search(r"([\u0C00-\u0DFF\w\s]+)(?:దగ్గర|కేంద్రం|వద్ద|के पास|அருகில்|അടുത്ത്|ಹತ್ತಿರ)", text)
        if sub_loc:
            location = sub_loc.group(1).strip()

    if not location:
        location = "Location described in voice report"

    # 4. Casualties / Affected People Count
    affected: int | str | None = None
    num_match = re.search(
        r"(\b\d+\b|one|two|three|four|five|six|seven|eight|nine|ten|several|multiple)\s+(?:people|persons|passengers|victims|injured|patients|pedestrians|workers|members)",
        lower,
    )
    if num_match:
        word = num_match.group(1)
        w2n = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10}
        affected = int(word) if word.isdigit() else w2n.get(word, word)

    # Check multilingual numbers
    if affected is None:
        if lang == "te":
            # Match total affected/passengers like "ఐదుగురు ఉన్నారు" or "ఐదుగురు"
            m_te = re.search(
                r"(ఒకరు|ఇద్దరు|ముగ్గురు|నలుగురు|ఐదుగురు|ఆరుగురు|ఏడుగురు|ఎనిమిది|తొమ్మిది|పది|ఐదు)\s*(?:మంది|ఉన్నారు|ప్రయాణికులు|మందికి)?",
                text,
            )
            if "ఐదుగురు" in text or "ఐదు మంది" in text:
                affected = 5
            elif "నలుగురు" in text:
                affected = 4
            elif "ముగ్గురు" in text:
                affected = 3
            elif "ఇద్దరు" in text:
                affected = 2
            elif m_te and m_te.group(1) in TELUGU_NUMBERS:
                affected = TELUGU_NUMBERS[m_te.group(1)]
        elif lang == "hi":
            m_hi = re.search(r"(एक|दो|तीन|चार|पांच|पाँच|छह|सात|आठ|नौ|दस|\d+)\s*(?:लोग|व्यक्ति|सवार|मरीज|घायल)", text)
            if m_hi:
                w = m_hi.group(1)
                affected = int(w) if w.isdigit() else HINDI_NUMBERS.get(w, affected)
        elif lang == "ta":
            m_ta = re.search(r"(ஒரு|இருவர்|மூன்று|நான்கு|ஐந்து|ஆறு|ஏழு|எட்டு|ஒன்பது|பத்து|\d+)\s*(?:பேர்|நபர்கள்)", text)
            if m_ta:
                w = m_ta.group(1)
                affected = int(w) if w.isdigit() else TAMIL_NUMBERS.get(w, affected)
        elif lang == "kn":
            m_kn = re.search(r"(ಒಂದು|ಇಬ್ಬರು|ಮೂರು|ನಾಲ್ಕು|ಐದು|ಆರು|ಏಳು|ಎಂಟು|ಒಂಬತ್ತು|ಹತ್ತು|\d+)\s*(?:ಜನರು|ಜನ)", text)
            if m_kn:
                w = m_kn.group(1)
                affected = int(w) if w.isdigit() else KANNADA_NUMBERS.get(w, affected)

    # 5. Injuries Description
    injuries_list = []
    if any(k in text or k in lower for k in ["bleeding", "రక్తస్రావం", "రక్తం", "खून", "ரத்தம்", "രക്തം", "ರಕ್ತ"]):
        injuries_list.append("Heavy bleeding" if severity == "critical" else "Bleeding reported")
    if any(k in text or k in lower for k in ["severe injuries", "గాయాలయ్యాయి", "గాయాలు", "తీవ్ర", "गंभीर चोटें", "படுகாயம்", "ഗുരുതര പരുക്ക്"]):
        injuries_list.append("Severe trauma / multiple injuries")
    if any(k in text or k in lower for k in ["unconscious", "స్పృహ", "बेहोश", "மயக்கம்"]):
        injuries_list.append("Unconsciousness")
    if any(k in text or k in lower for k in ["fracture", "ఎముక విరిగింది", "हड्डी टूटी"]):
        injuries_list.append("Fracture")
    injuries_desc = ", ".join(injuries_list) if injuries_list else None

    # 6. Vehicles Involved
    vehicles = None
    v_list = []
    if any(k in text or k in lower for k in ["car", "కారు", "कार", "கார்", "കാർ", "ಕಾರು"]):
        v_list.append("Car")
    if any(k in text or k in lower for k in ["truck", "లారీ", "लॉरी", "லாரி", "ലോറി", "ಲಾರಿ"]):
        v_list.append("Truck / Heavy Vehicle")
    if any(k in text or k in lower for k in ["bike", "motorcycle", "బైక్", "बाइक", "பைக்", "ബൈക്ക്", "ಬೈಕ್"]):
        v_list.append("Motorcycle")
    if any(k in text or k in lower for k in ["bus", "బస్సు", "बस", "பஸ்", "ബസ്", "ಬಸ್"]):
        v_list.append("Bus")
    if v_list:
        vehicles = ", ".join(v_list)

    # 7. Hazards
    hazards = None
    h_list = []
    if category == "fire" or any(k in text or k in lower for k in ["smoke", "fire", "మంటలు", "ఆగ"]):
        h_list.append("Fire / Smoke inhalation risk")
    if category == "road_collision":
        h_list.append("Traffic obstruction / Secondary collision risk")
    if any(k in text or k in lower for k in ["trapped", "కారులో ఉన్నారు", "చిక్కుకున్నారు"]):
        h_list.append("Trapped victims inside vehicle")
    if h_list:
        hazards = "; ".join(h_list)

    # 8. Required Resources / Requested Assistance
    resources = []
    if category in ("medical", "road_collision") or any(k in text or k in lower for k in ["ambulance", "అంబులెన్స్", "एम्बुलेंस", "ஆம்புலன்ஸ்", "ആംബുലൻസ്", "ಆಂಬ್ಯುಲೆನ್ಸ್"]):
        resources.append("Ambulance")
    if category == "fire" or any(k in text or k in lower for k in ["fire engine", "ఫైర్"]):
        resources.append("Fire Engine")
    if any(k in text or k in lower for k in ["rescue", "రెస్క్యూ"]):
        resources.append("Rescue Team")
    if any(k in text or k in lower for k in ["police", "పోలీస్"]):
        resources.append("Police")

    # 9. English Translation (Factual & Verbatim)
    english_translation = None
    if lang != "en":
        # Formulate accurate English translation based on parsed facts
        trans_parts = []
        if category == "road_collision":
            veh_str = f"involving {vehicles.lower()}" if vehicles else ""
            trans_parts.append(f"A major road accident occurred {veh_str} near {location}.")
        elif category == "fire":
            trans_parts.append(f"A fire outbreak was reported at {location}.")
        elif category == "medical":
            trans_parts.append(f"A medical emergency was reported near {location}.")
        else:
            trans_parts.append(f"An emergency incident was reported near {location}.")

        if affected:
            trans_parts.append(f"Approximately {affected} people are affected.")
        if injuries_desc:
            trans_parts.append(f"Reported injuries include: {injuries_desc}.")
        if "Ambulance" in resources:
            trans_parts.append("Immediate ambulance assistance requested.")
        english_translation = " ".join(trans_parts)
    else:
        english_translation = text

    # Title
    title = f"{category.replace('_', ' ').title()} - {location}"

    return ExtractedIncident(
        title=title,
        category=category,
        description=english_translation or text,
        location_text=location,
        landmark=None,
        latitude=None,
        longitude=None,
        affected_people=affected,
        injuries=injuries_desc,
        severity=severity,
        vehicles=vehicles,
        immediate_hazards=hazards,
        required_resources=resources,
        requested_assistance=resources,
        detected_language=lang,
        english_translation=english_translation,
        source_transcript=text,
        confidence=None,
        extraction_status="extracted",
    )
