from __future__ import annotations
from typing import Literal
from pydantic import BaseModel, Field


class RoutePoint(BaseModel):
    lat: float = Field(ge=-90.0, le=90.0)
    lng: float = Field(ge=-180.0, le=180.0)


class RouteResult(BaseModel):
    origin: list[float]
    destination: list[float]
    duration_seconds: float | None = Field(
        default=None,
        description="Duration in seconds. null/None when routing provider is unavailable (distance only)",
    )
    distance_meters: float = Field(ge=0.0, description="Distance in meters")
    polyline: list[list[float]] = Field(
        default_factory=list,
        description="List of [latitude, longitude] coordinates representing the route geometry",
    )
    provider: str = Field(description="Routing provider used: osrm, google, mapbox, straight_line")
    status: Literal["available", "unavailable"] = Field(
        default="available",
        description="'available' when road network routing succeeded; 'unavailable' when fallback straight-line was used",
    )
    straight_line: bool = Field(
        default=False,
        description="True if route is straight-line distance only without road navigation or ETA",
    )
    summary: str = Field(description="Human readable route summary, e.g. '14 mins (6.2 km)' or 'distance only, no ETA'")
    cached: bool = Field(default=False, description="Whether this result was served from Redis cache")
    error: str | None = Field(default=None, description="Error explanation if routing provider failed")
