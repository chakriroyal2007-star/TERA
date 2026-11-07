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
    severity: Literal["low", "medium", "high", "critical"] = "medium"
    required_resources: list[str] = Field(default_factory=list)
    reporter_contact: str | None = None
    immediate_safety_concerns: str | None = None
    source_transcript: str
    extraction_status: str = "extracted"


def extract_incident_from_transcript(transcript: str) -> ExtractedIncident:
    """
    Extracts structured emergency incident information from the spoken transcript.
    Never invents unmentioned details.
    """
    text = transcript.strip()
    lower = text.lower()

    # 1. Category Classification
    category: Literal["medical", "road_collision", "fire", "disaster", "other"] = "other"
    if any(k in lower for k in ["crash", "collision", "car accident", "truck", "bike accident", "hit and run", "vehicle", "overturned"]):
        category = "road_collision"
    elif any(k in lower for k in ["fire", "blaze", "smoke", "burning", "flames", "explosion"]):
        category = "fire"
    elif any(k in lower for k in ["heart attack", "cardiac", "stroke", "unconscious", "bleeding", "asthma", "fainted", "choking", "seizure", "chest pain", "injured", "fracture", "patient"]):
        category = "medical"
    elif any(k in lower for k in ["flood", "earthquake", "building collapse", "cyclone", "hurricane", "landslide", "tsunami"]):
        category = "disaster"

    # 2. Severity / Priority Determination
    severity: Literal["low", "medium", "high", "critical"] = "medium"
    if any(k in lower for k in ["critical", "unconscious", "not breathing", "severe", "fatal", "dying", "massive", "heavy bleeding", "trapped inside", "explosion risk", "life-threatening"]):
        severity = "critical"
    elif any(k in lower for k in ["urgent", "badly hurt", "spreading fast", "fracture", "multiple injured", "head injury", "deep cut", "high fire"]):
        severity = "high"
    elif any(k in lower for k in ["minor", "stable", "small scratch", "conscious", "controlled", "small fire"]):
        severity = "low"

    # 3. Location Extraction
    location = ""
    # Look for patterns like "at X", "near X", "in X", "on X road/street"
    loc_matches = re.findall(
        r"(?:at|near|on|in|around|opposite|behind|beside)\s+([A-Za-z0-9\s,\.-]+?)(?:\.|\band\b|\bwith\b|\bplease\b|\bneed\b|\bthere\b|$)",
        text,
        re.IGNORECASE,
    )
    if loc_matches:
        # Pick the most specific location candidate
        candidate = loc_matches[0].strip()
        if len(candidate) > 3 and not candidate.lower().startswith(("a ", "the ", "this ")):
            location = candidate[:200]

    # If no regex match found, check for street/road/junction/metro keywords
    if not location:
        kw_match = re.search(r"([A-Z][a-zA-Z0-9\s]+(?:Road|Street|Avenue|Highway|Junction|Cross|Lane|Hospital|Station|Metro|Park|Bridge|Colony|Nagar))", text)
        if kw_match:
            location = kw_match.group(1).strip()

    if not location:
        location = "Location described in voice report"

    # 4. Affected People
    affected: int | str | None = None
    num_match = re.search(
        r"(\b\d+\b|one|two|three|four|five|six|seven|eight|nine|ten|several|multiple)\s+(?:people|persons|passengers|victims|injured|patients|pedestrians|workers|individuals|civilians|adults|children)",
        lower,
    )
    if num_match:
        word = num_match.group(1)
        word_to_num = {
            "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
            "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
        }
        if word.isdigit():
            affected = int(word)
        elif word in word_to_num:
            affected = word_to_num[word]
        else:
            affected = word

    # 5. Required Resources
    resources = []
    if category in ("medical", "road_collision") or any(k in lower for k in ["ambulance", "paramedic", "doctor", "medic", "hospital"]):
        resources.append("Ambulance")
    if category == "fire" or any(k in lower for k in ["fire engine", "fire brigade", "fire truck", "extinguisher"]):
        resources.append("Fire Engine")
    if any(k in lower for k in ["police", "patrol", "traffic police", "cops"]):
        resources.append("Police")
    if any(k in lower for k in ["rescue", "disaster team", "boat", "crane", "search and rescue", "cutter"]):
        resources.append("Rescue Squad")

    if not resources:
        resources.append("Emergency Response Team")

    # 6. Safety Concerns
    concerns = []
    if "smoke" in lower or "gas" in lower:
        concerns.append("Smoke / gas hazard")
    if "trapped" in lower:
        concerns.append("Trapped individuals")
    if "flame" in lower or "fire spreading" in lower:
        concerns.append("Spreading fire")
    if "traffic" in lower or "highway" in lower or "road" in lower:
        concerns.append("Road traffic obstruction")
    safety_concerns = ", ".join(concerns) if concerns else None

    # 7. Reporter Contact
    phone_match = re.search(r"(\+?\d[\d\s-]{8,14}\d)", text)
    reporter_contact = phone_match.group(1).strip() if phone_match else None

    # 8. Title
    cat_titles = {
        "medical": "Medical Emergency",
        "road_collision": "Road Traffic Collision",
        "fire": "Fire Incident",
        "disaster": "Disaster Report",
        "other": "Emergency Incident",
    }
    title = f"{cat_titles.get(category, 'Emergency Report')}"
    if location and location != "Location described in voice report":
        title += f" at {location}"

    return ExtractedIncident(
        title=title[:160],
        category=category,
        description=text[:5000],
        location_text=location[:500],
        landmark=location if location != "Location described in voice report" else None,
        affected_people=affected,
        severity=severity,
        required_resources=resources,
        reporter_contact=reporter_contact,
        immediate_safety_concerns=safety_concerns,
        source_transcript=text,
        extraction_status="extracted",
    )
