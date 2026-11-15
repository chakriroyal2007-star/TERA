from typing import Optional
from fastapi import APIRouter, Depends, Query, Request
from app.security import current, limited
from .schemas import RouteResult
from .service import RoutingService

router = APIRouter(prefix="/routing", tags=["Emergency Routing & ETA"])


@router.get("/directions", response_model=RouteResult)
async def get_directions(
    request: Request,
    origin_lat: float = Query(..., ge=-90.0, le=90.0, description="Origin latitude"),
    origin_lng: float = Query(..., ge=-180.0, le=180.0, description="Origin longitude"),
    dest_lat: float = Query(..., ge=-90.0, le=90.0, description="Destination latitude"),
    dest_lng: float = Query(..., ge=-180.0, le=180.0, description="Destination longitude"),
    provider: Optional[str] = Query(None, description="Optional routing provider: osrm, google, mapbox, straight_line"),
    user=Depends(current),
):
    """Calculates road network route, distance, polyline, and predicted ETA.
    
    Falls back gracefully to straight-line distance with explicit 'unavailable' status
    and no invented ETA if road routing providers fail.
    """
    client_ip = request.client.host if request.client else "unknown"
    limited(f"routing:{client_ip}", 120, 60)

    service = RoutingService()
    return await service.get_directions(
        origin=(origin_lat, origin_lng),
        destination=(dest_lat, dest_lng),
        provider_override=provider,
    )
