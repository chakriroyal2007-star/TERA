import httpx
from app.config import settings
from ..schemas import RouteResult
from .base import BaseRoutingProvider, RoutingProviderError


class MapboxDirectionsProvider(BaseRoutingProvider):
    """Mapbox Directions API routing provider (credential-gated)."""

    def __init__(self, access_token: str | None = None, timeout: float | None = None):
        self.access_token = access_token or settings().mapbox_access_token
        self.timeout = timeout or settings().routing_timeout_seconds

    async def get_route(
        self,
        origin: tuple[float, float],
        destination: tuple[float, float],
    ) -> RouteResult:
        if not self.access_token:
            raise RoutingProviderError("Mapbox access token is not configured.")

        lat1, lon1 = origin
        lat2, lon2 = destination

        # Mapbox expects longitude,latitude
        url = f"https://api.mapbox.com/directions/v5/mapbox/driving/{lon1},{lat1};{lon2},{lat2}"
        params = {
            "geometries": "geojson",
            "overview": "full",
            "access_token": self.access_token,
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.get(url, params=params)

            if resp.status_code != 200:
                raise RoutingProviderError(
                    f"Mapbox Directions returned status {resp.status_code}: {resp.text[:200]}"
                )

            data = resp.json()
            if data.get("code") != "Ok" or not data.get("routes"):
                raise RoutingProviderError(
                    f"Mapbox Directions failed with code: {data.get('code')}"
                )

            primary_route = data["routes"][0]
            duration_secs = round(float(primary_route.get("duration", 0)), 1)
            distance_meters = round(float(primary_route.get("distance", 0)), 1)
            distance_km = round(distance_meters / 1000.0, 1)

            # Mapbox GeoJSON coordinates are [lon, lat] -> convert to [lat, lon]
            raw_coords = primary_route.get("geometry", {}).get("coordinates", [])
            polyline = [[c[1], c[0]] for c in raw_coords]

            mins = round(duration_secs / 60.0)
            summary = f"{mins} mins ({distance_km} km)" if mins >= 1 else f"< 1 min ({distance_km} km)"

            return RouteResult(
                origin=[lat1, lon1],
                destination=[lat2, lon2],
                duration_seconds=duration_secs,
                distance_meters=distance_meters,
                polyline=polyline,
                provider="mapbox",
                status="available",
                straight_line=False,
                summary=summary,
                cached=False,
                error=None,
            )

        except (httpx.TimeoutException, httpx.RequestError) as net_err:
            raise RoutingProviderError(f"Mapbox Directions connection failed: {net_err}") from net_err
        except Exception as err:
            if isinstance(err, RoutingProviderError):
                raise
            raise RoutingProviderError(f"Mapbox Directions unexpected error: {err}") from err

