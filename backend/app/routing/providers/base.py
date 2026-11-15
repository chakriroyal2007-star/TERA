from abc import ABC, abstractmethod
from ..schemas import RouteResult


class RoutingProviderError(Exception):
    """Raised when a routing provider encounters a network, API, or parsing failure."""
    pass


class BaseRoutingProvider(ABC):
    """Abstract interface for emergency routing providers."""

    @abstractmethod
    async def get_route(
        self,
        origin: tuple[float, float],
        destination: tuple[float, float],
    ) -> RouteResult:
        """Calculates route between origin (lat, lng) and destination (lat, lng).
        
        Must return RouteResult or raise RoutingProviderError.
        """
        pass

