import json
import logging
import time
from typing import Optional
from app.config import settings
from app.security import redis
from .schemas import RouteResult
from .providers.base import BaseRoutingProvider, RoutingProviderError
from .providers.osrm import OSRMRoutingProvider
from .providers.google import GoogleDirectionsProvider
from .providers.mapbox import MapboxDirectionsProvider
from .providers.fallback import StraightLineFallbackProvider

logger = logging.getLogger("tera.routing")


class CircuitBreaker:
    """In-memory circuit breaker to prevent cascading timeouts when routing providers are down."""

    def __init__(self, failure_threshold: int = 3, reset_timeout_seconds: float = 60.0):
        self.failure_threshold = failure_threshold
        self.reset_timeout_seconds = reset_timeout_seconds
        self.failure_count = 0
        self.last_failure_time = 0.0
        self.state = "CLOSED"  # CLOSED, OPEN, HALF-OPEN

    def record_success(self):
        self.failure_count = 0
        self.state = "CLOSED"

    def record_failure(self):
        self.failure_count += 1
        self.last_failure_time = time.monotonic()
        if self.failure_count >= self.failure_threshold:
            self.state = "OPEN"
            logger.warning(
                "Routing circuit breaker OPENED after %d consecutive failures",
                self.failure_count,
            )

    def allow_request(self) -> bool:
        if self.state == "CLOSED":
            return True
        if self.state == "OPEN":
            if (time.monotonic() - self.last_failure_time) > self.reset_timeout_seconds:
                self.state = "HALF-OPEN"
                logger.info("Routing circuit breaker entered HALF-OPEN state, attempting trial request")
                return True
            return False
        if self.state == "HALF-OPEN":
            # Allow trial request
            return True
        return True


# Global circuit breakers per provider
_circuit_breakers: dict[str, CircuitBreaker] = {}


def get_circuit_breaker(provider_name: str) -> CircuitBreaker:
    if provider_name not in _circuit_breakers:
        _circuit_breakers[provider_name] = CircuitBreaker(
            failure_threshold=settings().routing_circuit_breaker_threshold,
            reset_timeout_seconds=float(settings().routing_circuit_breaker_reset_seconds),
        )
    return _circuit_breakers[provider_name]


class RoutingService:
    """Emergency routing service orchestrator.
    
    Provides:
    - Transparent provider selection (OSRM, Google, Mapbox)
    - Redis short-TTL caching
    - Circuit breaker to protect from provider failures
    - Straight-line distance fallback with explicit 'unavailable' ETA status
    """

    def __init__(self, provider_name: Optional[str] = None):
        self.provider_name = (provider_name or settings().routing_provider or "osrm").lower()
        self.fallback_provider = StraightLineFallbackProvider()

    def _get_provider(self, name: str) -> BaseRoutingProvider:
        if name == "google":
            return GoogleDirectionsProvider()
        if name == "mapbox":
            return MapboxDirectionsProvider()
        if name == "straight_line":
            return self.fallback_provider
        return OSRMRoutingProvider()

    def _build_cache_key(
        self,
        origin: tuple[float, float],
        destination: tuple[float, float],
        provider: str,
    ) -> str:
        # Round coordinates to 4 decimal places (~11 meters) for spatial caching
        lat1, lon1 = round(origin[0], 4), round(origin[1], 4)
        lat2, lon2 = round(destination[0], 4), round(destination[1], 4)
        return f"route:{lat1}:{lon1}:{lat2}:{lon2}:{provider}"

    async def get_directions(
        self,
        origin: tuple[float, float],
        destination: tuple[float, float],
        provider_override: Optional[str] = None,
    ) -> RouteResult:
        """Calculates driving directions and ETA.
        
        If routing is unavailable, returns straight-line distance with duration_seconds=None.
        """
        provider_name = (provider_override or self.provider_name).lower()

        # 1. Check Redis cache
        cache_key = self._build_cache_key(origin, destination, provider_name)
        try:
            cached_data = redis.get(cache_key)
            if cached_data:
                parsed = json.loads(cached_data)
                result = RouteResult(**parsed)
                result.cached = True
                return result
        except Exception as cache_err:
            logger.debug("Redis cache read skipped: %s", cache_err)

        # 2. Check circuit breaker
        cb = get_circuit_breaker(provider_name)
        if not cb.allow_request():
            logger.warning("Routing circuit breaker is OPEN for %s. Skipping provider call.", provider_name)
            fallback = await self.fallback_provider.get_route(origin, destination)
            fallback.error = f"Routing provider '{provider_name}' circuit is open due to recent failures."
            return fallback

        # 3. Call active provider
        provider = self._get_provider(provider_name)
        try:
            route_res = await provider.get_route(origin, destination)
            cb.record_success()

            # Cache successful route in Redis with short TTL
            try:
                redis.setex(cache_key, settings().routing_cache_ttl, route_res.model_dump_json())
            except Exception as cache_err:
                logger.debug("Redis cache write skipped: %s", cache_err)

            return route_res

        except RoutingProviderError as prov_err:
            logger.warning("Routing provider '%s' failed: %s. Falling back to straight-line.", provider_name, prov_err)
            cb.record_failure()
            fallback = await self.fallback_provider.get_route(origin, destination)
            fallback.error = str(prov_err)
            return fallback
        except Exception as unk_err:
            logger.error("Unexpected error in routing provider '%s': %s", provider_name, unk_err)
            cb.record_failure()
            fallback = await self.fallback_provider.get_route(origin, destination)
            fallback.error = f"Routing error: {unk_err}"
            return fallback
