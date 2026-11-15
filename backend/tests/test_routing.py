import pytest
import time
from unittest.mock import AsyncMock, patch
import httpx
from app.routing.schemas import RouteResult
from app.routing.providers.base import RoutingProviderError
from app.routing.providers.fallback import StraightLineFallbackProvider, haversine_distance
from app.routing.providers.osrm import OSRMRoutingProvider
from app.routing.providers.google import GoogleDirectionsProvider, decode_polyline
from app.routing.providers.mapbox import MapboxDirectionsProvider
from app.routing.service import RoutingService, CircuitBreaker


def test_haversine_distance():
    # Tirupati Railway Station (13.6288, 79.4192) to SVIMS Hospital (13.6373, 79.4042)
    dist = haversine_distance((13.6288, 79.4192), (13.6373, 79.4042))
    assert 1500 < dist < 2200  # Approx 1.8 km straight line


@pytest.mark.anyio
async def test_straight_line_fallback_never_fabricates_eta():
    provider = StraightLineFallbackProvider()
    res = await provider.get_route((13.6288, 79.4192), (13.6373, 79.4042))

    assert isinstance(res, RouteResult)
    # Non-negotiable rule: duration_seconds must be None when no real road route exists
    assert res.duration_seconds is None
    assert res.status == "unavailable"
    assert res.straight_line is True
    assert "Distance only, no ETA" in res.summary
    assert res.distance_meters > 0
    assert len(res.polyline) == 2


@pytest.mark.anyio
async def test_osrm_provider_success():
    provider = OSRMRoutingProvider(base_url="http://mock-osrm:5000", timeout=2.0)

    mock_osrm_response = {
        "code": "Ok",
        "routes": [
            {
                "duration": 540.2,
                "distance": 3120.5,
                "geometry": {
                    "coordinates": [
                        [79.4192, 13.6288],
                        [79.4120, 13.6320],
                        [79.4042, 13.6373],
                    ],
                    "type": "LineString",
                },
            }
        ],
    }

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        from unittest.mock import MagicMock
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = mock_osrm_response
        mock_get.return_value = mock_resp

        res = await provider.get_route((13.6288, 79.4192), (13.6373, 79.4042))

        assert res.status == "available"
        assert res.straight_line is False
        assert res.duration_seconds == 540.2
        assert res.distance_meters == 3120.5
        assert res.summary == "9 mins (3.1 km)"
        # Verify coordinates converted from [lon, lat] to [lat, lon]
        assert res.polyline[0] == [13.6288, 79.4192]
        assert res.polyline[-1] == [13.6373, 79.4042]


@pytest.mark.anyio
async def test_osrm_provider_failure_and_timeout():
    provider = OSRMRoutingProvider(base_url="http://mock-osrm:5000", timeout=1.0)

    with patch("httpx.AsyncClient.get", side_effect=httpx.TimeoutException("Connection timed out")):
        with pytest.raises(RoutingProviderError) as exc_info:
            await provider.get_route((13.6288, 79.4192), (13.6373, 79.4042))
        assert "connection failed" in str(exc_info.value).lower()


def test_circuit_breaker_transitions():
    cb = CircuitBreaker(failure_threshold=2, reset_timeout_seconds=0.2)
    assert cb.state == "CLOSED"
    assert cb.allow_request() is True

    # First failure
    cb.record_failure()
    assert cb.state == "CLOSED"
    assert cb.allow_request() is True

    # Second failure triggers OPEN
    cb.record_failure()
    assert cb.state == "OPEN"
    assert cb.allow_request() is False

    # After reset timeout, transitions to HALF-OPEN
    time.sleep(0.25)
    assert cb.allow_request() is True
    assert cb.state == "HALF-OPEN"

    # Successful request closes circuit
    cb.record_success()
    assert cb.state == "CLOSED"
    assert cb.failure_count == 0


@pytest.mark.anyio
async def test_routing_service_falls_back_when_provider_fails():
    from app.routing.service import get_circuit_breaker
    get_circuit_breaker("osrm").record_success()
    service = RoutingService(provider_name="osrm")

    with patch.object(OSRMRoutingProvider, "get_route", side_effect=RoutingProviderError("OSRM container down")):
        res = await service.get_directions((13.6288, 79.4192), (13.6373, 79.4042))

        assert res.status == "unavailable"
        assert res.duration_seconds is None
        assert res.straight_line is True
        assert "Distance only, no ETA" in res.summary
        assert "OSRM container down" in str(res.error)


@pytest.mark.anyio
async def test_google_directions_provider():
    # When no API key is provided, gracefully raises error
    provider = GoogleDirectionsProvider(api_key="")
    with pytest.raises(RoutingProviderError) as exc:
        await provider.get_route((13.6288, 79.4192), (13.6373, 79.4042))
    assert "not configured" in str(exc.value)

    # Test polyline decoder
    # Encoded polyline for roughly Tirupati coordinates
    decoded = decode_polyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@")
    assert len(decoded) > 0
    assert all(len(pt) == 2 for pt in decoded)


@pytest.mark.anyio
async def test_mapbox_directions_provider():
    provider = MapboxDirectionsProvider(access_token="")
    with pytest.raises(RoutingProviderError) as exc:
        await provider.get_route((13.6288, 79.4192), (13.6373, 79.4042))
    assert "not configured" in str(exc.value)


def test_routing_directions_api_endpoint(client, authenticated):
    op_client = authenticated("operator")

    # Valid route request
    resp = op_client.get(
        "/api/v1/routing/directions",
        params={
            "origin_lat": 13.6288,
            "origin_lng": 79.4192,
            "dest_lat": 13.6373,
            "dest_lng": 79.4042,
            "provider": "straight_line",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "unavailable"
    assert data["straight_line"] is True
    assert data["duration_seconds"] is None
    assert "Distance only, no ETA" in data["summary"]

    # Invalid latitude parameter triggers validation error
    bad_resp = op_client.get(
        "/api/v1/routing/directions",
        params={
            "origin_lat": 999.0,  # Invalid latitude > 90
            "origin_lng": 79.4192,
            "dest_lat": 13.6373,
            "dest_lng": 79.4042,
        },
    )
    assert bad_resp.status_code == 422
