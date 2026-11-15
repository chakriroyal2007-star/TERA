import httpx
from app.config import settings
from ..schemas import RouteResult
from .base import BaseRoutingProvider, RoutingProviderError


class OSRMRoutingProvider(BaseRoutingProvider):
    """Open Source Routing Machine (OSRM) provider for self-hosted road network routing."""

    def __init__(self, base_url: str | None = None, timeout: float | None = None):
        self.base_url = (base_url or settings().osrm_url).rstrip("/")
        self.timeout = timeout or settings().routing_timeout_seconds

    async def get_route(
        self,
        origin: tuple[float, float],
        destination: tuple[float, float],
    ) -> RouteResult:
        lat1, lon1 = origin
        lat2, lon2 = destination

        # OSRM coordinate order is longitude,latitude
        url = f"{self.base_url}/route/v1/driving/{lon1},{lat1};{lon2},{lat2}"
        params = {
            "overview": "full",
            "geometries": "geojson",
            "steps": "false",
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.get(url, params=params)

            if resp.status_code != 200:
                raise RoutingProviderError(
                    f"OSRM returned status {resp.status_code}: {resp.text[:200]}"
                )

            data = resp.json()
            if data.get("code") != "Ok" or not data.get("routes"):
                raise RoutingProviderError(
                    f"OSRM route calculation failed with code: {data.get('code')}"
                )

            primary_route = data["routes"][0]
            duration_secs = round(float(primary_route.get("duration", 0)), 1)
            distance_meters = round(float(primary_route.get("distance", 0)), 1)
            distance_km = round(distance_meters / 1000.0, 1)

            # Convert GeoJSON [lon, lat] coordinates to [lat, lon] for Leaflet mapping
            raw_coords = primary_route.get("geometry", {}).get("coordinates", [])
            polyline = [[coord[1], coord[0]] for coord in raw_coords]

            mins = round(duration_secs / 60.0)
            summary = f"{mins} mins ({distance_km} km)" if mins >= 1 else f"< 1 min ({distance_km} km)"

            return RouteResult(
                origin=[lat1, lon1],
                destination=[lat2, lon2],
                duration_seconds=duration_secs,
                distance_meters=distance_meters,
                polyline=polyline,
                provider="osrm",
                status="available",
                straight_line=False,
                summary=summary,
                cached=False,
                error=None,
            )

        except (httpx.TimeoutException, httpx.RequestError) as net_err:
            raise RoutingProviderError(f"OSRM connection failed: {net_err}") from net_err
        except Exception as err:
            if isinstance(err, RoutingProviderError):
                raise
            raise RoutingProviderError(f"OSRM unexpected error: {err}") from err
