export interface ClientExtractedIncident {
  category: "medical" | "road_collision" | "fire" | "disaster" | "other";
  description: string;
  location_text: string;
  affected_people: number | null;
  injuries: string | null;
  severity: "low" | "medium" | "high" | "critical";
  vehicles: string | null;
  immediate_hazards: string | null;
  required_resources: string[];
  english_translation?: string;
  reporter_name?: string | null;
  reporter_phone?: string | null;
}

export function detectScriptLanguage(text: string): string {
  let te = 0, hi = 0, ta = 0, ml = 0, kn = 0, en = 0;
  for (let i = 0; i < text.length; i++) {
    const cp = text.charCodeAt(i);
    if (cp >= 0x0C00 && cp <= 0x0C7F) te++;
    else if (cp >= 0x0900 && cp <= 0x097F) hi++;
    else if (cp >= 0x0B80 && cp <= 0x0BFF) ta++;
    else if (cp >= 0x0D00 && cp <= 0x0D7F) ml++;
    else if (cp >= 0x0C80 && cp <= 0x0CFF) kn++;
    else if ((cp >= 65 && cp <= 90) || (cp >= 97 && cp <= 122)) en++;
  }
  const max = Math.max(te, hi, ta, ml, kn, en);
  if (max === 0) return "en";
  if (max === te) return "te";
  if (max === hi) return "hi";
  if (max === ta) return "ta";
  if (max === ml) return "ml";
  if (max === kn) return "kn";
  return "en";
}

const TELUGU_NUMBERS: Record<string, number> = {
  "ఒకరు": 1, "ఒకటి": 1, "ఇద్దరు": 2, "ముగ్గురు": 3, "నలుగురు": 4, "ఐదుగురు": 5,
  "ఆరుగురు": 6, "ఏడుగురు": 7, "ఎనిమిది": 8, "తొమ్మిది": 9, "పది": 10,
};

const HINDI_NUMBERS: Record<string, number> = {
  "एक": 1, "दो": 2, "तीन": 3, "चार": 4, "पांच": 5, "पाँच": 5,
  "छह": 6, "सात": 7, "आठ": 8, "नौ": 9, "दस": 10,
};

const ENGLISH_NUMBERS: Record<string, number> = {
  "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
  "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
};

export function extractIncidentFromText(text: string): ClientExtractedIncident {
  const lower = text.toLowerCase();

  // 1. Category extraction
  let category: "medical" | "road_collision" | "fire" | "disaster" | "other" = "other";
  if (
    /accident|collision|crash|car|bike|motorcycle|truck|bus|lorry|auto|vehicle|road|hit|ప్రమాదం|వాహనం|కారు|బైక్|లారీ|బస్సు|ట్రాఫిక్|टक्कर|दुर्घटना|गाड़ी|मोटर|हादसा/.test(
      lower
    )
  ) {
    category = "road_collision";
  } else if (
    /fire|flame|smoke|burn|blast|explosion|gas leak|cylinder|మంటలు|పొగ|అగ్ని|పేలుడు|సిలిండర్|ఆగ్|धुआं|विस्फोट|आग/.test(
      lower
    )
  ) {
    category = "fire";
  } else if (
    /flood|collapse|building fall|earthquake|drowned|landslide|వరద|భవనం కూలింది|భూకంపం|కూలిపోయింది|बाढ़|इमारत गिर|भूकंप/.test(
      lower
    )
  ) {
    category = "disaster";
  } else if (
    /patient|unconscious|bleeding|blood|heart attack|cardiac|pain|faint|breathing|breath|pregnant|hospital|ambulance|injury|injured|స్పృహ|రక్తం|గుండెపోటు|నొప్పి|శ్వాస|ఆస్పత్రి|గాయం|గాయపడ్డారు|बेहोश|खून|दर्द|सांस|अस्पताल|चोट/.test(
      lower
    )
  ) {
    category = "medical";
  } else {
    category = "medical";
  }

  // 2. Casualties extraction
  let affectedPeople: number | null = null;
  const numMatch = text.match(/(\d+)\s*(people|persons|members|injured|casualties|మంది|వ్యక్తులు|లోగ్|लोग)/i);
  if (numMatch) {
    affectedPeople = parseInt(numMatch[1], 10);
  } else {
    for (const [w, n] of Object.entries(TELUGU_NUMBERS)) {
      if (text.includes(w)) {
        affectedPeople = n;
        break;
      }
    }
    if (!affectedPeople) {
      for (const [w, n] of Object.entries(HINDI_NUMBERS)) {
        if (text.includes(w)) {
          affectedPeople = n;
          break;
        }
      }
    }
    if (!affectedPeople) {
      for (const [w, n] of Object.entries(ENGLISH_NUMBERS)) {
        if (new RegExp(`\\b${w}\\b`, "i").test(lower)) {
          affectedPeople = n;
          break;
        }
      }
    }
  }

  // 3. Severity extraction
  let severity: "low" | "medium" | "high" | "critical" = "medium";
  if (
    /unconscious|severe bleeding|heavy bleeding|head injury|cardiac arrest|died|critical|trapped|massive|స్పృహ లేదు|ఎక్కువ రక్తం|తీవ్రమైన|చనిపోయారు|చిక్కుకున్నారు|बेहोश|भारी खून|गंभीर|फंसे/.test(
      lower
    ) || (affectedPeople && affectedPeople >= 4)
  ) {
    severity = "critical";
  } else if (
    /blood|bleeding|fracture|broken|urgent|immediate|hospital|accident|రక్తం|గాయాలు|ప్రమాదం|తొందరగా|ఆస్పత్రి|खून|चोट|तुरंत|अस्पताल/.test(
      lower
    ) || (affectedPeople && affectedPeople >= 2)
  ) {
    severity = "high";
  }

  // 4. Vehicles extraction
  const vehiclesFound: string[] = [];
  if (/car|కారు|गाड़ी/i.test(lower)) vehiclesFound.push("Car");
  if (/bike|motorcycle|scooter|బైక్|మోటార్ సైకిల్|बाइक/i.test(lower)) vehiclesFound.push("Motorcycle");
  if (/truck|lorry|ట్రక్|లారీ|ट्रक/i.test(lower)) vehiclesFound.push("Heavy Truck");
  if (/bus|బస్సు|बस/i.test(lower)) vehiclesFound.push("Bus");
  if (/auto|rickshaw|ఆటో|ऑटो/i.test(lower)) vehiclesFound.push("Auto Rickshaw");

  // 5. Injuries extraction
  let injuries: string | null = null;
  if (/unconscious|స్పృహ లేదు|స్పృహ తప్పి|बेहोश/i.test(lower)) {
    injuries = "Unconscious casualty reported";
  }
  if (/blood|bleeding|రక్తం|రక్తస్రావం|खून/i.test(lower)) {
    injuries = injuries ? `${injuries}, bleeding observed` : "Bleeding observed";
  }
  if (/fracture|broken bone|ఎముక విరిగింది|हड्डी टूटी/i.test(lower)) {
    injuries = injuries ? `${injuries}, suspected fracture` : "Suspected bone fracture";
  }
  if (!injuries && (affectedPeople || category === "road_collision" || category === "medical")) {
    injuries = affectedPeople ? `${affectedPeople} individuals injured` : "Injuries reported on scene";
  }

  // 6. Hazards extraction
  let immediate_hazards: string | null = null;
  if (/fire|smoke|మంటలు|పొగ|आग|धुआं/i.test(lower)) immediate_hazards = "Active fire and heavy smoke";
  if (/fuel|petrol|diesel|gas leak|సిలిండర్|గ్యాస్ లీక్|गैस रिसाव/i.test(lower)) {
    immediate_hazards = immediate_hazards ? `${immediate_hazards}, fuel/gas leakage risk` : "Fuel/gas leakage hazard";
  }
  if (/highway|traffic|road block|హైవే|ట్రాఫిక్/i.test(lower)) {
    immediate_hazards = immediate_hazards ? `${immediate_hazards}, live roadway traffic` : "Live traffic collision zone";
  }

  // 7. Location extraction
  let location_text = "Reported in voice description";
  const locMatch = text.match(/(?:at|near|in|opp|opposite to|near to|దగ్గర|వద్ద|లో|కే పాస్|के पास|में)\s+([A-Za-z0-9\u0C00-\u0C7F\u0900-\u097F\s]{3,40}?)(?:[.,;]|\s+and|\s+with|\s+near|$)/i);
  if (locMatch && locMatch[1].trim().length >= 3) {
    location_text = locMatch[1].trim();
  }

  // 8. Required resources
  const required_resources: string[] = [];
  if (category === "medical" || category === "road_collision" || injuries || affectedPeople) {
    required_resources.push("Ambulance (EMS)");
  }
  if (category === "fire" || /fire|burn|మంటలు/i.test(lower)) {
    required_resources.push("Fire Engine");
  }
  if (category === "road_collision" || /police|traffic|పోలీస్/i.test(lower)) {
    required_resources.push("Traffic Police / Patrol");
  }
  if (category === "disaster" || /rescue|trapped/i.test(lower)) {
    required_resources.push("Disaster Rescue Team");
  }

  // 9. Reporter contact extraction (Phone number & Name if mentioned)
  let reporter_phone: string | null = null;
  const phoneMatch = text.match(/(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}/);
  if (phoneMatch) {
    reporter_phone = phoneMatch[0].replace(/[\s-]/g, "");
  }

  let reporter_name: string | null = null;
  const nameMatch = text.match(/(?:my name is|i am|this is|name is|పేరు|నా పేరు|मेरा नाम)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
  if (nameMatch && nameMatch[1]) {
    reporter_name = nameMatch[1].trim();
  }

  return {
    category,
    description: text,
    location_text,
    affected_people: affectedPeople,
    injuries,
    severity,
    vehicles: vehiclesFound.length > 0 ? vehiclesFound.join(", ") : null,
    immediate_hazards,
    required_resources,
    reporter_name,
    reporter_phone,
  };
}
