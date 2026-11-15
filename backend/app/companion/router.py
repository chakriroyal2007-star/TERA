"""TERA AI Emergency First-Aid Companion API Router.

Modularly decomposed into domain-specific sub-routers:
- routers/media.py: Health check, audio transcription/TTS synthesis, instructional videos
- routers/chat.py: Multilingual AI guidance, conversation turns, checklist toggles, source guidance
- routers/sessions.py: Assistance session lifecycle, messages, condition updates, handover & callbacks
- routers/protocols.py: Protocol management, versioning, and clinical reviews
- routers/tools.py: Secure telephony webhook callbacks and mid-call clinical tools
"""

from fastapi import APIRouter
from .routers import media, chat, sessions, protocols, tools

router = APIRouter(tags=["AI Emergency First-Aid Companion"])

# Include modular sub-routers
router.include_router(media.router)
router.include_router(chat.router)
router.include_router(sessions.router)
router.include_router(protocols.router)
router.include_router(tools.router)
