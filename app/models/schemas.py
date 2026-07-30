"""
Request / Response Schemas
===========================
Plain dataclasses used to validate and serialise API payloads.
Keeps the API layer thin and the business logic testable.
"""

from dataclasses import dataclass, asdict, field
from typing import Optional, List

# ── Chat ────────────────────────────────────────────────────────────────────


@dataclass
class ChatRequest:
    message: str
    session_id: Optional[str] = None


@dataclass
class ChatResponse:
    reply: str
    intent: str
    confidence: float
    session_id: Optional[str] = None

    def to_dict(self):
        return asdict(self)


# ── Budget ──────────────────────────────────────────────────────────────────


@dataclass
class BudgetRequest:
    destination: str
    num_days: int
    family_size: int
    travel_class: str = "economy"  # economy | comfort | premium

    def validate(self) -> List[str]:
        """Return a list of validation errors (empty = valid)."""
        errors = []
        if not self.destination:
            errors.append("destination is required")
        if self.num_days < 1:
            errors.append("num_days must be >= 1")
        if self.family_size < 1:
            errors.append("family_size must be >= 1")
        if self.travel_class not in ("economy", "comfort", "premium"):
            errors.append("travel_class must be economy, comfort, or premium")
        return errors


@dataclass
class BudgetEstimate:
    destination: str
    num_days: int
    family_size: int
    travel_class: str
    accommodation: float
    food: float
    transport: float
    activities: float
    miscellaneous: float
    total: float
    currency: str = "INR"

    def to_dict(self):
        return asdict(self)


# ── Safety ──────────────────────────────────────────────────────────────────


@dataclass
class SafetyResponse:
    destination: str
    overall_score: float  # 0 – 10  (10 = safest)
    crime_score: float
    health_score: float
    infrastructure_score: float
    tourist_friendliness: float
    advisory: str  # human-readable advisory text
    is_estimated: bool = False  # True when scores are defaults, not real data

    def to_dict(self):
        return asdict(self)


# ── Weather & Packing ──────────────────────────────────────────────────────


@dataclass
class WeatherResponse:
    destination: str
    temperature_c: float
    feels_like_c: float
    humidity: int
    description: str
    wind_speed_kmh: float
    packing_suggestions: List[str] = field(default_factory=list)

    def to_dict(self):
        return asdict(self)
