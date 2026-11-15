import math
from ..schemas import RouteResult
from .base import BaseRoutingProvider


def haversine_distance(origin: tuple[float, float], destination: tuple[float, float]) -> float:
    """Calculates great-circle distance between two points on Earth in meters."""
    lat1, lon1 = origin
    lat2, lon2 = destination

    r = 6371000.0  # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return r * c


class StraightLineFallbackProvider(BaseRoutingProvider):
    """Calculates straight-line geometric distance.
    
    NON-NEGOTIABLE SAFETY RULE:
    Never invents or fabricates an ETA.
    Sets duration_seconds=None, status='unavailable', straight_line=True,
    and explicitly labels the route summary as 'distance only, no ETA'.
    """

    async def get_route(
        self,
        origin: tuple[float, float],
        destination: tuple[float, float],
    ) -> RouteResult:
        distance_meters = round(haversine_distance(origin, destination), 1)
        distance_km = distance_meters / 1000.0

        return RouteResult(
            origin=[origin[0], origin[1]],
            destination=[destination[0], destination[1]],
            duration_seconds=None,
            distance_meters=distance_meters,
            polyline=[[origin[0], origin[1]], [destination[0], destination[1]]],
            provider="straight_line",
            status="unavailable",
            straight_line=True,
            summary=f"Distance only, no ETA ({distance_km:.1f} km)",
            cached=False,
            error="Road routing unavailable. Displaying straight-line distance without ETA.",
        )
