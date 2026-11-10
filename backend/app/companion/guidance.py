"""Fixed source-based guidance. Models may select topics, never write procedures/URLs.
Not a claim of local clinical approval; professional dispatcher instructions take precedence.
"""
RCUK = 'https://www.resus.org.uk/professional-library/2025-resuscitation-guidelines/first-aid-guidelines'
BRC = 'https://www.redcross.org.uk/first-aid/learn-first-aid/'
CALL = 'Call 112 for emergency help in India now. Follow the dispatcher’s instructions; do not wait for a video or this report.'
GUIDANCE = {
 'general': ('Immediate safety', ['Check scene safety before approaching.', 'Tell the dispatcher the location and whether anyone is unresponsive or breathing abnormally.'], RCUK, None),
 'cpr': ('Unresponsive and not breathing normally', ['Call on speakerphone and start CPR as directed by the dispatcher.', 'Ask someone to bring an AED and follow its prompts.'], RCUK, 'gDmy0of0XAk'),
 'choking': ('Choking', ['If the person can cough effectively, encourage coughing.', 'If they cannot cough, speak or breathe, get immediate dispatcher guidance. State their age. Do not perform blind finger sweeps.'], RCUK, None),
 'bleeding': ('Severe bleeding', ['Apply firm, continuous direct pressure using a clean cloth.', 'Keep pressure on the wound while professional help is arranged.'], RCUK, None),
 'burns': ('Thermal burns', ['Cool the burned area under cool running water for 20 minutes.', 'Keep the rest of the person warm. Seek urgent medical help for serious burns.'], BRC+'burns', None),
 'fracture': ('Suspected fracture', ['Support the injured area in the position found.', 'Do not try to straighten it; arrange professional help.'], BRC+'broken-bone', None),
 'unconscious': ('Unresponsive person', ['Check whether breathing is normal and tell the dispatcher.', 'Abnormal breathing needs immediate CPR guidance. Avoid unnecessary movement after trauma.'], RCUK, None),
 'road_collision': ('Road collision scene safety', ['Stay clear of moving traffic and fuel hazards.', 'Avoid moving injured people unless there is immediate danger; follow dispatcher guidance.'], 'https://www.gov.uk/guidance/the-highway-code/annex-7-first-aid-on-the-road', None),
 'drowning': ('Water rescue safety', ['Do not enter dangerous water. Offer flotation from a safe position.', 'Tell the dispatcher whether the person is responsive and breathing after safe rescue.'], RCUK, None),
 'electrical': ('Electrical danger', ['Do not touch the person while electricity may still be live.', 'Switch off the supply only if safe. Keep away from high-voltage sources and await trained responders.'], 'https://www.electricalsafetyfirst.org.uk/safety-advice/home-and-people/house-maintenance/first-aid/', None),
 'fire': ('Fire and smoke', ['Move away from fire and smoke if there is a safe escape route.', 'Do not return into danger. Tell emergency services if anyone is trapped.'], 'https://www.ready.marines.mil/Stay-Informed/Technological-Hazards/Home-Fires/', None),
 'flood': ('Flood safety', ['Avoid walking or driving through floodwater.', 'Follow evacuation instructions and move to a safer location when possible.'], 'https://www.cdc.gov/floods/safety/', None),
}


def guidance_for(topic='general', patient_group='unknown'):
    title, steps, source, video = GUIDANCE.get(topic, GUIDANCE['general'])
    if topic == 'choking' and patient_group == 'infant':
        title = 'Infant choking — tell the dispatcher the baby’s age'
        steps = ['If the baby cannot breathe or cry, follow dispatcher instructions for back blows and chest thrusts.', 'Do not use abdominal thrusts on an infant.']
        source = 'https://www.redcross.org.uk/first-aid/learn-first-aid-for-babies-and-children/choking-baby'
        video = 'NcZ2UrbSMns'
    # The verified CPR video is adult-specific. Do not present it for a child or unknown age.
    if topic == 'cpr' and patient_group != 'adult':
        video = None
    return {'topic': topic, 'title': title, 'steps': [CALL, *steps], 'source_url': source,
            'video_url': 'https://www.youtube-nocookie.com/embed/'+video if video else None,
            'source_checked': '2026-11-10', 'language': 'en', 'clinical_approval': 'Source-based; local clinical review pending'}
