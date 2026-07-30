"""
Pydantic Validation Models
Production-grade input validation schemas
"""

from pydantic import BaseModel, Field, validator, root_validator
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, date
from enum import Enum
import re


# Enums
class TripStatus(str, Enum):
    PLANNING = "planning"
    BOOKED = "booked"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class DestinationType(str, Enum):
    CITY = "city"
    BEACH = "beach"
    MOUNTAIN = "mountain"
    COUNTRYSIDE = "countryside"
    HISTORICAL = "historical"
    ADVENTURE = "adventure"
    RELAXATION = "relaxation"


class AccommodationType(str, Enum):
    HOTEL = "hotel"
    HOSTEL = "hostel"
    RESORT = "resort"
    APARTMENT = "apartment"
    CAMPING = "camping"
    HOMESTAY = "homestay"


class Currency(str, Enum):
    USD = "USD"
    EUR = "EUR"
    GBP = "GBP"
    INR = "INR"
    JPY = "JPY"
    AUD = "AUD"
    CAD = "CAD"


# Base Models
class TimestampMixin(BaseModel):
    """Mixin for timestamp fields"""

    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


# Auth Validation
class LoginRequest(BaseModel):
    """Login request validation"""

    email: str = Field(..., min_length=5, max_length=255)
    password: str = Field(..., min_length=8, max_length=128)

    @validator("email")
    def validate_email(cls, v):
        if "@" not in v or "." not in v.split("@")[-1]:
            raise ValueError("Invalid email format")
        return v.lower().strip()


class RegisterRequest(BaseModel):
    """Registration request validation"""

    email: str = Field(..., min_length=5, max_length=255)
    password: str = Field(..., min_length=8, max_length=128)
    name: str = Field(..., min_length=2, max_length=100)

    @validator("email")
    def validate_email(cls, v):
        if "@" not in v or "." not in v.split("@")[-1]:
            raise ValueError("Invalid email format")
        return v.lower().strip()

    @validator("password")
    def validate_password(cls, v):
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain at least one digit")
        return v

    @validator("name")
    def validate_name(cls, v):
        return v.strip()


class PasswordResetRequest(BaseModel):
    """Password reset request"""

    email: str = Field(..., min_length=5, max_length=255)

    @validator("email")
    def validate_email(cls, v):
        if "@" not in v or "." not in v.split("@")[-1]:
            raise ValueError("Invalid email format")
        return v.lower().strip()


class UpdatePasswordRequest(BaseModel):
    """Update password request"""

    current_password: str = Field(..., min_length=8)
    new_password: str = Field(..., min_length=8, max_length=128)

    @validator("new_password")
    def validate_new_password(cls, v):
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain at least one digit")
        return v


# Trip Validation
class DestinationInput(BaseModel):
    """Destination input validation"""

    name: str = Field(..., min_length=2, max_length=200)
    country: str = Field(..., min_length=2, max_length=100)
    city: Optional[str] = Field(None, max_length=100)
    type: Optional[DestinationType] = None
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    description: Optional[str] = Field(None, max_length=2000)

    @validator("name", "country")
    def strip_whitespace(cls, v):
        return v.strip() if v else v


class TripCreate(BaseModel):
    """Trip creation validation"""

    name: str = Field(..., min_length=3, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    destinations: List[DestinationInput] = Field(..., min_items=1)
    start_date: date
    end_date: date
    budget: Optional[float] = Field(None, ge=0)
    currency: Currency = Currency.USD
    travelers: int = Field(1, ge=1, le=50)
    status: TripStatus = TripStatus.PLANNING
    tags: Optional[List[str]] = None

    @root_validator
    def validate_dates(cls, values):
        start = values.get("start_date")
        end = values.get("end_date")
        if start and end and start > end:
            raise ValueError("End date must be after start date")
        return values

    @validator("tags")
    def validate_tags(cls, v):
        if v:
            return [tag.strip().lower() for tag in v if tag.strip()]
        return v


class TripUpdate(BaseModel):
    """Trip update validation"""

    name: Optional[str] = Field(None, min_length=3, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    destinations: Optional[List[DestinationInput]] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    budget: Optional[float] = Field(None, ge=0)
    currency: Optional[Currency] = None
    travelers: Optional[int] = Field(None, ge=1, le=50)
    status: Optional[TripStatus] = None
    tags: Optional[List[str]] = None

    @root_validator
    def validate_dates(cls, values):
        start = values.get("start_date")
        end = values.get("end_date")
        if start and end and start > end:
            raise ValueError("End date must be after start date")
        return values


class TripQuery(BaseModel):
    """Trip query/filter validation"""

    status: Optional[TripStatus] = None
    destination: Optional[str] = None
    start_date_from: Optional[date] = None
    start_date_to: Optional[date] = None
    budget_min: Optional[float] = Field(None, ge=0)
    budget_max: Optional[float] = Field(None, ge=0)
    travelers: Optional[int] = Field(None, ge=1)
    sort_by: Optional[str] = Field(
        "created_at", regex="^(created_at|start_date|name|budget)$"
    )
    sort_order: Optional[str] = Field("desc", regex="^(asc|desc)$")
    page: int = Field(1, ge=1)
    limit: int = Field(20, ge=1, le=100)

    @root_validator
    def validate_budget_range(cls, values):
        min_b = values.get("budget_min")
        max_b = values.get("budget_max")
        if min_b is not None and max_b is not None and min_b > max_b:
            raise ValueError("budget_max must be greater than budget_min")
        return values


# Itinerary Validation
class ItineraryActivity(BaseModel):
    """Itinerary activity validation"""

    title: str = Field(..., min_length=2, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    location: Optional[str] = Field(None, max_length=200)
    start_time: Optional[str] = Field(None, regex=r"^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$")
    end_time: Optional[str] = Field(None, regex=r"^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$")
    cost: Optional[float] = Field(None, ge=0)
    currency: Optional[Currency] = Currency.USD
    booking_url: Optional[str] = Field(None, max_length=500)
    notes: Optional[str] = Field(None, max_length=500)

    @validator("booking_url")
    def validate_url(cls, v):
        if v and not v.startswith(("http://", "https://")):
            raise ValueError("Invalid URL format")
        return v


class ItineraryDay(BaseModel):
    """Single day itinerary validation"""

    date: date
    activities: List[ItineraryActivity] = Field(default_factory=list)
    accommodation: Optional[str] = Field(None, max_length=200)
    accommodation_type: Optional[AccommodationType] = None
    transport: Optional[str] = Field(None, max_length=500)
    notes: Optional[str] = Field(None, max_length=1000)


class ItineraryCreate(BaseModel):
    """Itinerary creation validation"""

    trip_id: str = Field(..., min_length=1)
    days: List[ItineraryDay] = Field(..., min_items=1)
    total_budget: Optional[float] = Field(None, ge=0)
    notes: Optional[str] = Field(None, max_length=2000)


# Budget Validation
class BudgetItem(BaseModel):
    """Budget item validation"""

    category: str = Field(..., min_length=2, max_length=50)
    name: str = Field(..., min_length=2, max_length=200)
    amount: float = Field(..., ge=0)
    currency: Currency = Currency.USD
    date: Optional[date] = None
    notes: Optional[str] = Field(None, max_length=500)
    receipt_url: Optional[str] = None

    @validator("category")
    def validate_category(cls, v):
        valid_categories = [
            "accommodation",
            "transport",
            "food",
            "activities",
            "shopping",
            "insurance",
            "visa",
            "other",
        ]
        v = v.lower().strip()
        if v not in valid_categories:
            raise ValueError(
                f'Invalid category. Must be one of: {", ".join(valid_categories)}'
            )
        return v


class BudgetCreate(BaseModel):
    """Budget creation validation"""

    trip_id: str = Field(..., min_length=1)
    total_budget: float = Field(..., ge=0)
    currency: Currency = Currency.USD
    items: List[BudgetItem] = Field(default_factory=list)


# Recommendation Validation
class RecommendationRequest(BaseModel):
    """Recommendation request validation"""

    user_id: str = Field(..., min_length=1)
    context: Optional[Dict[str, Any]] = None
    destination_type: Optional[DestinationType] = None
    budget_min: Optional[float] = Field(None, ge=0)
    budget_max: Optional[float] = Field(None, ge=0)
    travel_dates: Optional[List[date]] = None
    interests: Optional[List[str]] = None
    limit: int = Field(10, ge=1, le=50)

    @root_validator
    def validate_dates(cls, values):
        dates = values.get("travel_dates")
        if dates and len(dates) == 2:
            if dates[0] > dates[1]:
                raise ValueError("End date must be after start date")
        return values


class SearchRequest(BaseModel):
    """Search request validation"""

    query: str = Field(..., min_length=2, max_length=200)
    type: Optional[str] = Field("all", regex="^(all|destination|trip|activity|hotel)$")
    filters: Optional[Dict[str, Any]] = None
    page: int = Field(1, ge=1)
    limit: int = Field(20, ge=1, le=100)

    @validator("query")
    def sanitize_query(cls, v):
        # Remove potentially dangerous characters
        return re.sub(r'[<>"\'\\]', "", v).strip()


# Response Models
class ErrorResponse(BaseModel):
    """Error response model"""

    error: str
    message: str
    details: Optional[Dict[str, Any]] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class SuccessResponse(BaseModel):
    """Success response model"""

    success: bool = True
    message: str
    data: Optional[Dict[str, Any]] = None


class PaginatedResponse(BaseModel):
    """Paginated response model"""

    items: List[Any]
    total: int
    page: int
    limit: int
    has_more: bool

    @root_validator
    def calculate_has_more(cls, values):
        total = values.get("total", 0)
        page = values.get("page", 1)
        limit = values.get("limit", 20)
        values["has_more"] = (page * limit) < total
        return values


# Validation decorators
def validate_request(schema: BaseModel):
    """Decorator to validate request body"""

    def decorator(f):
        def wrapper(*args, **kwargs):
            from flask import request

            try:
                data = request.get_json() or {}
                validated = schema(**data)
                kwargs["validated_data"] = validated
                return f(*args, **kwargs)
            except Exception as e:
                from flask import jsonify

                return (
                    jsonify(
                        {
                            "error": "Validation error",
                            "message": str(e),
                            "details": e.errors() if hasattr(e, "errors") else None,
                        }
                    ),
                    400,
                )

        return wrapper

    return decorator


def validate_query_params(schema: BaseModel):
    """Decorator to validate query parameters"""

    def decorator(f):
        def wrapper(*args, **kwargs):
            from flask import request

            try:
                params = dict(request.args)
                validated = schema(**params)
                kwargs["validated_params"] = validated
                return f(*args, **kwargs)
            except Exception as e:
                from flask import jsonify

                return jsonify({"error": "Validation error", "message": str(e)}), 400

        return wrapper

    return decorator


# Export
__all__ = [
    # Enums
    "TripStatus",
    "DestinationType",
    "AccommodationType",
    "Currency",
    # Auth
    "LoginRequest",
    "RegisterRequest",
    "PasswordResetRequest",
    "UpdatePasswordRequest",
    # Trip
    "DestinationInput",
    "TripCreate",
    "TripUpdate",
    "TripQuery",
    # Itinerary
    "ItineraryActivity",
    "ItineraryDay",
    "ItineraryCreate",
    # Budget
    "BudgetItem",
    "BudgetCreate",
    # Recommendation
    "RecommendationRequest",
    "SearchRequest",
    # Response
    "ErrorResponse",
    "SuccessResponse",
    "PaginatedResponse",
    # Decorators
    "validate_request",
    "validate_query_params",
]
