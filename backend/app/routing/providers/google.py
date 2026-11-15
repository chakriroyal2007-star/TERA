import httpx
from app.config import settings
from ..schemas import RouteResult
from .base import BaseRoutingProvider, RoutingProviderError


def decode_polyline(polyline_str: str) -> list[list[float]]:
    """Decodes Google encoded polyline string into list of [lat, lng] coordinates."""
    coordinates = []
    index = 0
    lat = 0
    lng = 0
    length = len(polyline_str)

    while index < length:
        # Decode latitude
        shift = 0
        result = 0
        while True:
            byte = ord(polyline_str[index]) - 63
            index += 1
            result |= (byte & 0x1F) << shift
            shift += 5
            if byte < 0x20:
                break
        dlat = ~(result >> 1) if (result & 1) else (result >> 1)
        lat += dlat

        # Decode longitude
        shift = 0
        result = 0
        while True:
            byte = ord(polyline_str[index]) - 63
            index += 1
            result |= (byte & 0x1F) << shift
            shift += 5
            if byte < 0x20:
                break
        dlng = ~(result >> 1) if (result & 1) else (result >> 1)
        lng += dlng

        coordinates.append([lat / 1e5, lng / 1e5])

    return coordinates


class GoogleDirectionsProvider(BaseRoutingProvider):
    """Google Directions API routing provider (credential-gated)."""

    def __init__(self, api_key: str | None = None, timeout: float | None = None):
        self.api_key = api_key or settings().google_directions_api_key
        self.timeout = timeout or settings().routing_timeout_seconds

    async def get_route(
        self,
        origin: tuple[float, float],
        destination: tuple[float, float],
    ) -> RouteResult:
        if not self.api_key:
            raise RoutingProviderError("Google Directions API key is not configured.")

        lat1, lon1 = origin
        lat2, lon2 = destination

        url = "https://maps.googleapis.com/maps/api/directions/json"
        params = {
            "origin": f"{lat1},{lon1}",
            "destination": f"{lat2},{lon2}",
            "mode": "driving",
            "key": self.api_key,
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.get(url, params=params)

            if resp.status_code != 200:
                raise RoutingProviderError(
                    f"Google Directions returned status {resp.status_code}: {resp.text[:200]}"
                )

            data = resp.json()
            if data.get("status") != "OK" or not data.get("routes"):
                raise RoutingProviderError(
                    f"Google Directions failed with status: {data.get('status')}"
                )

            primary_route = data["routes"][0]
            leg = primary_route["legs"][0]
            duration_secs = round(float(leg.get("duration", {}).get("value", 0)), 1)
            distance_meters = round(float(leg.get("distance", {}).get("value", 0)), 1)
            distance_km = round(distance_meters / 1000.0, 1)

            overview_poly = primary_route.get("overview_polyline", {}).get("points", "")
            polyline = decode_polyline(overview_poly) if overview_poly else [[lat1, lon1], [lat2, lon2]]

            mins = round(duration_secs / 60.0)
            summary = f"{mins} mins ({distance_km} km)" if mins >= 1 else f"< 1 min ({distance_km} km)"

            return RouteResult(
                origin=[lat1, lon1],
                destination=[lat2, lon2],
                duration_seconds=duration_secs,
                distance_meters=distance_meters,
                polyline=polyline,
                provider="google",
                status="available",
                straight_line=False,
                summary=summary,
                cached=False,
                error=None,
            )

        except (httpx.TimeoutException, httpx.RequestError) as net_err:
            raise RoutingProviderError(f"Google Directions connection failed: {net_err}") from net_err
        except Exception as err:
            if isinstance(err, RoutingProviderError):
                raise
            raise RoutingProviderError(f"Google Directions unexpected error: {err}") from err
