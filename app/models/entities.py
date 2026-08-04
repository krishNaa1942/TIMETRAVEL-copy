"""
ORM Entity Models
==================
SQLAlchemy models representing persistent data for the Time Travel app.
"""

import uuid
from datetime import datetime, timezone

import bcrypt
from flask_login import UserMixin
from sqlalchemy import event

from app.models.database import db

# ── User ────────────────────────────────────────────────────────────────────


class User(UserMixin, db.Model):
    """Registered user with hashed password."""

    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String(128), nullable=False)
    email = db.Column(db.String(256), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(256), nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    trips = db.relationship("TripQuery", backref="user", lazy="dynamic")
    messages = db.relationship("ChatMessage", backref="user", lazy="dynamic")
    favorites = db.relationship("Favorite", backref="user", lazy="dynamic")

    def set_password(self, password: str):
        """Hash and store the password."""
        self.password_hash = bcrypt.hashpw(
            password.encode("utf-8"), bcrypt.gensalt()
        ).decode("utf-8")

    def check_password(self, password: str) -> bool:
        """Verify a plaintext password against the stored hash."""
        return bcrypt.checkpw(
            password.encode("utf-8"),
            self.password_hash.encode("utf-8"),
        )

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

    def __repr__(self):
        return f"<User {self.email}>"


class TripQuery(db.Model):
    """Stores every trip planning query for analytics & ML improvement."""

    __tablename__ = "trip_queries"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(
        db.Integer, db.ForeignKey("users.id"), nullable=True, index=True
    )
    user_session = db.Column(db.String(64), nullable=True, index=True)
    destination = db.Column(db.String(128), nullable=False)
    num_days = db.Column(db.Integer, nullable=False, default=1)
    family_size = db.Column(db.Integer, nullable=False, default=1)
    travel_class = db.Column(db.String(16), nullable=True, default="economy")
    estimated_budget = db.Column(db.Float, nullable=True)
    accommodation = db.Column(db.Float, nullable=True)
    food = db.Column(db.Float, nullable=True)
    transport = db.Column(db.Float, nullable=True)
    activities = db.Column(db.Float, nullable=True)
    miscellaneous = db.Column(db.Float, nullable=True)
    trip_id = db.Column(
        db.Integer, db.ForeignKey("trips.id"), nullable=True, index=True
    )
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    linked_trip = db.relationship("Trip")

    def to_dict(self):
        return {
            "id": self.id,
            "destination": self.destination,
            "num_days": self.num_days,
            "family_size": self.family_size,
            "travel_class": self.travel_class,
            "estimated_budget": self.estimated_budget,
            "accommodation": self.accommodation,
            "food": self.food,
            "transport": self.transport,
            "activities": self.activities,
            "miscellaneous": self.miscellaneous,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

    def __repr__(self):
        return f"<TripQuery {self.destination} | {self.num_days}d | ₹{self.estimated_budget}>"


class ChatMessage(db.Model):
    """Logs chatbot conversations for future training data."""

    __tablename__ = "chat_messages"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(
        db.Integer, db.ForeignKey("users.id"), nullable=True, index=True
    )
    user_session = db.Column(db.String(64), nullable=True, index=True)
    role = db.Column(db.String(16), nullable=False)  # "user" or "bot"
    message = db.Column(db.Text, nullable=False)
    detected_intent = db.Column(db.String(64), nullable=True)
    destination = db.Column(db.String(64), nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def __repr__(self):
        return f"<ChatMessage [{self.role}] {self.message[:40]}>"


class Destination(db.Model):
    """Master list of supported destinations with metadata."""

    __tablename__ = "destinations"
    __table_args__ = (
        db.Index("ix_destinations_country", "country"),
        db.CheckConstraint(
            "safety_score IS NULL OR (safety_score >= 0 AND safety_score <= 10)",
            name="ck_dest_safety_score",
        ),
    )

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String(128), unique=True, nullable=False, index=True)
    country = db.Column(db.String(64), nullable=False, default="India")
    latitude = db.Column(db.Float, nullable=True)
    longitude = db.Column(db.Float, nullable=True)
    safety_score = db.Column(db.Float, nullable=True)  # 0.0 – 10.0
    avg_daily_cost = db.Column(db.Float, nullable=True)  # in INR
    best_season = db.Column(db.String(64), nullable=True)
    region = db.Column(db.String(64), nullable=True)
    categories = db.Column(db.JSON, nullable=True)  # ["heritage", "nature", ...]
    highlights = db.Column(db.JSON, nullable=True)  # top sights/attractions
    description = db.Column(db.Text, nullable=True)
    best_months = db.Column(db.JSON, nullable=True)  # [1..12]
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def __repr__(self):
        return f"<Destination {self.name}, {self.country}>"


class Favorite(db.Model):
    """User's bookmarked / wishlisted destinations and places."""

    __tablename__ = "favorites"
    __table_args__ = (
        db.UniqueConstraint("user_id", "item_type", "item_name", name="uq_user_fav"),
        db.Index("ix_favorites_item_type", "item_type"),
        db.CheckConstraint(
            "item_type IN ('destination', 'place', 'attraction', 'restaurant')",
            name="ck_fav_item_type",
        ),
    )

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(
        db.Integer, db.ForeignKey("users.id"), nullable=False, index=True
    )
    item_type = db.Column(
        db.String(32), nullable=False, default="destination"
    )  # destination | place
    item_name = db.Column(db.String(256), nullable=False)
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "id": self.id,
            "item_type": self.item_type,
            "item_name": self.item_name,
            "notes": self.notes,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

    def __repr__(self):
        return f"<Favorite {self.item_type}:{self.item_name}>"


# ── Travel Notes / Journal ──────────────────────────────────────────────


class TravelNote(db.Model):
    """User's travel journal entries – notes, impressions, memories."""

    __tablename__ = "travel_notes"
    __table_args__ = (
        db.Index("ix_travel_notes_user_public", "user_id", "is_public"),
        db.Index("ix_travel_notes_dest", "destination"),
    )

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(
        db.Integer, db.ForeignKey("users.id"), nullable=False, index=True
    )
    destination = db.Column(db.String(128), nullable=False)
    title = db.Column(db.String(256), nullable=False)
    content = db.Column(db.Text, nullable=False)
    mood = db.Column(db.String(32), nullable=True)  # happy, excited, relaxed, etc.
    rating = db.Column(db.Integer, nullable=True)  # 1-5 stars
    is_public = db.Column(db.Boolean, default=False)  # community visibility
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    user = db.relationship(
        "User", lazy="joined", backref=db.backref("notes", lazy="dynamic")
    )

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "user_name": self.user.name if self.user else None,
            "destination": self.destination,
            "title": self.title,
            "content": self.content,
            "mood": self.mood,
            "rating": self.rating,
            "is_public": self.is_public,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    def __repr__(self):
        return f"<TravelNote {self.title[:30]} @ {self.destination}>"


# ── Shared Trip (collaborative sharing) ─────────────────────────────────


class SharedTrip(db.Model):
    """Shareable trip link allowing others to view a user's trip plan."""

    __tablename__ = "shared_trips"
    __table_args__ = (db.Index("ix_shared_trips_trip", "trip_id"),)

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    share_token = db.Column(
        db.String(36),
        unique=True,
        nullable=False,
        index=True,
        default=lambda: str(uuid.uuid4()),
    )
    user_id = db.Column(
        db.Integer, db.ForeignKey("users.id"), nullable=False, index=True
    )
    trip_id = db.Column(
        db.Integer,
        db.ForeignKey("trips.id", ondelete="CASCADE"),
        nullable=True,
    )
    title = db.Column(db.String(256), nullable=False, default="My Trip")
    itinerary_json = db.Column(db.Text, nullable=True)  # stored JSON of itinerary
    notes = db.Column(db.Text, nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    view_count = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    user = db.relationship("User", backref=db.backref("shared_trips", lazy="dynamic"))
    trip = db.relationship("Trip", backref=db.backref("shares", lazy="dynamic"))

    def to_dict(self):
        return {
            "id": self.id,
            "share_token": self.share_token,
            "title": self.title,
            "itinerary_json": self.itinerary_json,
            "notes": self.notes,
            "is_active": self.is_active,
            "view_count": self.view_count,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "user_name": self.user.name if self.user else None,
        }

    def __repr__(self):
        return f"<SharedTrip {self.share_token[:8]}>"


# ── Expense Tracker ─────────────────────────────────────────────────────


class Expense(db.Model):
    """Individual expense entries for real-time trip spending tracking."""

    __tablename__ = "expenses"
    __table_args__ = (
        db.Index("ix_expenses_trip_cat", "trip_id", "category"),
        db.Index("ix_expenses_user_dest", "user_id", "destination"),
        db.Index("ix_expenses_date", "date"),
    )

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(
        db.Integer, db.ForeignKey("users.id"), nullable=False, index=True
    )
    trip_id = db.Column(
        db.Integer,
        db.ForeignKey("trips.id", ondelete="CASCADE"),
        nullable=True,
    )
    destination = db.Column(db.String(128), nullable=False)
    category = db.Column(
        db.String(64), nullable=False
    )  # food, transport, accommodation, activity, misc
    description = db.Column(db.String(256), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    currency = db.Column(db.String(8), default="INR")
    date = db.Column(db.Date, nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    user = db.relationship("User", backref=db.backref("expenses", lazy="dynamic"))
    trip = db.relationship("Trip", backref=db.backref("expenses", lazy="dynamic"))

    def to_dict(self):
        return {
            "id": self.id,
            "destination": self.destination,
            "category": self.category,
            "description": self.description,
            "amount": self.amount,
            "currency": self.currency,
            "date": self.date.isoformat() if self.date else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

    def __repr__(self):
        return f"<Expense ₹{self.amount} – {self.category}>"


# ── Packing Checklist ───────────────────────────────────────────────────


class PackingItem(db.Model):
    """Interactive packing checklist with user-added items and check states."""

    __tablename__ = "packing_items"
    __table_args__ = (
        db.Index("ix_packing_items_user_dest", "user_id", "destination"),
        db.Index("ix_packing_items_custom", "is_custom"),
    )

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(
        db.Integer, db.ForeignKey("users.id"), nullable=False, index=True
    )
    destination = db.Column(db.String(128), nullable=False)
    item_text = db.Column(db.String(256), nullable=False)
    is_checked = db.Column(db.Boolean, default=False)
    is_custom = db.Column(db.Boolean, default=False)  # user-added vs auto-generated
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    user = db.relationship("User", backref=db.backref("packing_items", lazy="dynamic"))

    def to_dict(self):
        return {
            "id": self.id,
            "destination": self.destination,
            "item_text": self.item_text,
            "is_checked": self.is_checked,
            "is_custom": self.is_custom,
        }

    def __repr__(self):
        return f"<PackingItem {'✓' if self.is_checked else '○'} {self.item_text[:30]}>"


# ── Trip (full planning entity) ─────────────────────────────────────────


class Trip(db.Model):
    """Full trip planning entity — central workspace for a travel plan."""

    __tablename__ = "trips"
    __table_args__ = (
        db.Index("ix_trips_user_status", "user_id", "status"),
        db.Index("ix_trips_user_dest", "user_id", "destination"),
        db.Index("ix_trips_is_public", "is_public"),
        db.CheckConstraint(
            "status IN ('planning', 'active', 'completed', 'cancelled')",
            name="ck_trip_status",
        ),
        db.CheckConstraint(
            "travel_class IN ('economy', 'budget', 'standard', 'premium', 'luxury')",
            name="ck_trip_travel_class",
        ),
    )

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(
        db.Integer, db.ForeignKey("users.id"), nullable=False, index=True
    )
    title = db.Column(db.String(256), nullable=False)
    destination = db.Column(db.String(128), nullable=False)
    start_date = db.Column(db.Date, nullable=True)
    end_date = db.Column(db.Date, nullable=True)
    num_days = db.Column(db.Integer, default=1)
    family_size = db.Column(db.Integer, default=1)
    travel_class = db.Column(db.String(16), default="economy")
    cover_image_url = db.Column(db.String(512), nullable=True)
    status = db.Column(db.String(20), default="planning")  # planning, active, completed
    budget_total = db.Column(db.Float, nullable=True)
    notes = db.Column(db.Text, nullable=True)
    itinerary_json = db.Column(db.Text, nullable=True)  # AI-generated itinerary
    is_public = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    user = db.relationship("User", backref=db.backref("planned_trips", lazy="dynamic"))
    days = db.relationship(
        "TripDay",
        backref="trip",
        lazy="selectin",
        cascade="all, delete-orphan",
        order_by="TripDay.day_number",
    )
    places = db.relationship(
        "TripPlace", backref="trip", lazy="selectin", cascade="all, delete-orphan"
    )
    reservations = db.relationship(
        "Reservation", backref="trip", lazy="selectin", cascade="all, delete-orphan"
    )
    photos = db.relationship(
        "TripPhoto", backref="trip", lazy="selectin", cascade="all, delete-orphan"
    )
    companions = db.relationship(
        "Companion", backref="trip", lazy="selectin", cascade="all, delete-orphan"
    )

    def to_dict(self, include_days=False, include_places=False):
        d = {
            "id": self.id,
            "title": self.title,
            "destination": self.destination,
            "start_date": self.start_date.isoformat() if self.start_date else None,
            "end_date": self.end_date.isoformat() if self.end_date else None,
            "num_days": self.num_days,
            "family_size": self.family_size,
            "travel_class": self.travel_class,
            "cover_image_url": self.cover_image_url,
            "status": self.status,
            "budget_total": self.budget_total,
            "notes": self.notes,
            "itinerary_json": self.itinerary_json,
            "is_public": self.is_public,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "companions_count": len(self.companions) if self.companions else 0,
            "places_count": len(self.places) if self.places else 0,
            "photos_count": len(self.photos) if self.photos else 0,
        }
        if include_days:
            d["days"] = [day.to_dict(include_places=True) for day in self.days]
        if include_places:
            d["places"] = [p.to_dict() for p in self.places]
        return d

    def __repr__(self):
        return f"<Trip {self.title} – {self.destination}>"


class TripDay(db.Model):
    """Day-by-day structure within a trip."""

    __tablename__ = "trip_days"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    trip_id = db.Column(
        db.Integer, db.ForeignKey("trips.id", ondelete="CASCADE"), nullable=False, index=True
    )
    day_number = db.Column(db.Integer, nullable=False)
    date = db.Column(db.Date, nullable=True)
    title = db.Column(db.String(256), nullable=True)
    notes = db.Column(db.Text, nullable=True)

    places = db.relationship(
        "TripPlace",
        backref="day",
        lazy="selectin",
        cascade="all, delete-orphan",
        order_by="TripPlace.position_order",
    )

    def to_dict(self, include_places=True):
        d = {
            "id": self.id,
            "trip_id": self.trip_id,
            "day_number": self.day_number,
            "date": self.date.isoformat() if self.date else None,
            "title": self.title,
            "notes": self.notes,
        }
        if include_places:
            d["places"] = [p.to_dict() for p in self.places]
        return d


class TripPlace(db.Model):
    """A place/activity pinned to a trip (optionally assigned to a day)."""

    __tablename__ = "trip_places"
    __table_args__ = (
        db.Index("ix_trip_places_day_pos", "day_id", "position_order"),
        db.Index("ix_trip_places_category", "category"),
    )

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    trip_id = db.Column(
        db.Integer, db.ForeignKey("trips.id", ondelete="CASCADE"), nullable=False, index=True
    )
    day_id = db.Column(
        db.Integer, db.ForeignKey("trip_days.id", ondelete="CASCADE"), nullable=True, index=True
    )
    name = db.Column(db.String(256), nullable=False)
    address = db.Column(db.String(512), nullable=True)
    lat = db.Column(db.Float, nullable=True)
    lon = db.Column(db.Float, nullable=True)
    category = db.Column(
        db.String(64), nullable=True
    )  # restaurant, hotel, attraction, etc.
    notes = db.Column(db.Text, nullable=True)
    start_time = db.Column(db.String(16), nullable=True)  # "09:00"
    end_time = db.Column(db.String(16), nullable=True)  # "11:00"
    duration_minutes = db.Column(db.Integer, nullable=True)
    estimated_cost = db.Column(db.Float, nullable=True)
    position_order = db.Column(db.Integer, default=0)
    is_booked = db.Column(db.Boolean, default=False)
    rating = db.Column(db.Float, nullable=True)
    image_url = db.Column(db.String(512), nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "id": self.id,
            "trip_id": self.trip_id,
            "day_id": self.day_id,
            "name": self.name,
            "address": self.address,
            "lat": self.lat,
            "lon": self.lon,
            "category": self.category,
            "notes": self.notes,
            "start_time": self.start_time,
            "end_time": self.end_time,
            "duration_minutes": self.duration_minutes,
            "estimated_cost": self.estimated_cost,
            "position_order": self.position_order,
            "is_booked": self.is_booked,
            "rating": self.rating,
            "image_url": self.image_url,
        }


class Reservation(db.Model):
    """Booking / reservation tracker — flights, hotels, restaurants, etc."""

    __tablename__ = "reservations"
    __table_args__ = (
        db.Index("ix_reservations_type", "res_type"),
        db.Index("ix_reservations_status", "status"),
    )

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    trip_id = db.Column(
        db.Integer, db.ForeignKey("trips.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id = db.Column(
        db.Integer, db.ForeignKey("users.id"), nullable=False, index=True
    )
    res_type = db.Column(
        db.String(32), nullable=False
    )  # flight, hotel, restaurant, transport, activity
    title = db.Column(db.String(256), nullable=False)
    confirmation_code = db.Column(db.String(128), nullable=True)
    provider = db.Column(db.String(128), nullable=True)  # airline/hotel/platform name
    start_datetime = db.Column(db.DateTime, nullable=True)
    end_datetime = db.Column(db.DateTime, nullable=True)
    location = db.Column(db.String(256), nullable=True)
    notes = db.Column(db.Text, nullable=True)
    amount = db.Column(db.Float, nullable=True)
    currency = db.Column(db.String(8), default="INR")
    status = db.Column(
        db.String(20), default="confirmed"
    )  # confirmed, pending, cancelled
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    user = db.relationship("User", backref=db.backref("reservations", lazy="dynamic"))

    def to_dict(self):
        return {
            "id": self.id,
            "trip_id": self.trip_id,
            "res_type": self.res_type,
            "title": self.title,
            "confirmation_code": self.confirmation_code,
            "provider": self.provider,
            "start_datetime": (
                self.start_datetime.isoformat() if self.start_datetime else None
            ),
            "end_datetime": (
                self.end_datetime.isoformat() if self.end_datetime else None
            ),
            "location": self.location,
            "notes": self.notes,
            "amount": self.amount,
            "currency": self.currency,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class TripPhoto(db.Model):
    """Photos uploaded and attached to trips."""

    __tablename__ = "trip_photos"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    trip_id = db.Column(
        db.Integer, db.ForeignKey("trips.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id = db.Column(
        db.Integer, db.ForeignKey("users.id"), nullable=False, index=True
    )
    filename = db.Column(db.String(256), nullable=False)  # stored filename (UUID-based)
    original_name = db.Column(db.String(256), nullable=True)
    caption = db.Column(db.String(512), nullable=True)
    place_name = db.Column(db.String(256), nullable=True)
    taken_at = db.Column(db.DateTime, nullable=True)
    file_size = db.Column(db.Integer, nullable=True)  # bytes
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    user = db.relationship("User", backref=db.backref("photos", lazy="dynamic"))

    def _photo_url(self):
        """Return Supabase public URL or local serve path."""
        try:
            from flask import current_app

            url = current_app.config.get("SUPABASE_URL", "")
            if url:
                bucket = current_app.config.get(
                    "SUPABASE_STORAGE_BUCKET_PHOTOS", "photos"
                )
                return f"{url}/storage/v1/object/public/{bucket}/{self.user_id}/{self.filename}"
        except RuntimeError:
            pass  # outside app context
        return f"/api/uploads/serve/photos/{self.filename}"

    def to_dict(self):
        return {
            "id": self.id,
            "trip_id": self.trip_id,
            "filename": self.filename,
            "original_name": self.original_name,
            "caption": self.caption,
            "place_name": self.place_name,
            "url": self._photo_url(),
            "taken_at": self.taken_at.isoformat() if self.taken_at else None,
            "file_size": self.file_size,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class TripDocument(db.Model):
    """Travel documents — passports, visas, insurance, tickets, etc."""

    __tablename__ = "trip_documents"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(
        db.Integer, db.ForeignKey("users.id"), nullable=False, index=True
    )
    trip_id = db.Column(
        db.Integer, db.ForeignKey("trips.id", ondelete="CASCADE"), nullable=True, index=True
    )
    doc_type = db.Column(
        db.String(32), nullable=False
    )  # passport, visa, insurance, ticket, other
    title = db.Column(db.String(256), nullable=False)
    filename = db.Column(db.String(256), nullable=False)
    original_name = db.Column(db.String(256), nullable=True)
    expiry_date = db.Column(db.Date, nullable=True)
    notes = db.Column(db.Text, nullable=True)
    file_size = db.Column(db.Integer, nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    user = db.relationship("User", backref=db.backref("documents", lazy="dynamic"))
    trip = db.relationship("Trip", backref=db.backref("documents", lazy="dynamic"))

    def _doc_url(self):
        """Return Supabase public URL or local serve path."""
        try:
            from flask import current_app

            url = current_app.config.get("SUPABASE_URL", "")
            if url:
                bucket = current_app.config.get(
                    "SUPABASE_STORAGE_BUCKET_DOCS", "documents"
                )
                return f"{url}/storage/v1/object/public/{bucket}/{self.user_id}/{self.filename}"
        except RuntimeError:
            pass  # outside app context
        return f"/api/uploads/serve/documents/{self.filename}"

    def to_dict(self):
        return {
            "id": self.id,
            "trip_id": self.trip_id,
            "doc_type": self.doc_type,
            "title": self.title,
            "filename": self.filename,
            "original_name": self.original_name,
            "url": self._doc_url(),
            "expiry_date": self.expiry_date.isoformat() if self.expiry_date else None,
            "notes": self.notes,
            "file_size": self.file_size,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class Companion(db.Model):
    """Travel companions linked to a trip."""

    __tablename__ = "companions"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    trip_id = db.Column(
        db.Integer, db.ForeignKey("trips.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id = db.Column(
        db.Integer, db.ForeignKey("users.id"), nullable=False, index=True
    )
    name = db.Column(db.String(128), nullable=False)
    email = db.Column(db.String(256), nullable=True)
    phone = db.Column(db.String(32), nullable=True)
    role = db.Column(db.String(20), default="traveler")  # organizer, traveler
    avatar_color = db.Column(db.String(16), nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    user = db.relationship("User", backref=db.backref("companionships", lazy="dynamic"))

    def to_dict(self):
        return {
            "id": self.id,
            "trip_id": self.trip_id,
            "name": self.name,
            "email": self.email,
            "phone": self.phone,
            "role": self.role,
            "avatar_color": self.avatar_color,
        }


class TripTemplate(db.Model):
    """Pre-built itinerary templates users can clone."""

    __tablename__ = "trip_templates"
    __table_args__ = (
        db.Index("ix_trip_templates_category", "category"),
        db.Index("ix_trip_templates_dest", "destination"),
    )

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    title = db.Column(db.String(256), nullable=False)
    destination = db.Column(db.String(128), nullable=False)
    num_days = db.Column(db.Integer, nullable=False)
    description = db.Column(db.Text, nullable=True)
    template_json = db.Column(db.Text, nullable=False)  # JSON itinerary
    category = db.Column(
        db.String(64), nullable=True
    )  # honeymoon, family, adventure, budget, luxury
    cover_image_url = db.Column(db.String(512), nullable=True)
    popularity = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "destination": self.destination,
            "num_days": self.num_days,
            "description": self.description,
            "template_json": self.template_json,
            "category": self.category,
            "cover_image_url": self.cover_image_url,
            "popularity": self.popularity,
        }


# ── Auto-update `updated_at` on any model that has the column ──

_updated_at_models = [
    cls for cls in db.Model.__subclasses__() if hasattr(cls, "updated_at")
]


@event.listens_for(db.session, "before_flush")
def _auto_update_timestamps(session, flush_context, instances):
    now = datetime.now(timezone.utc)
    for obj in session.dirty:
        if hasattr(obj, "updated_at"):
            obj.updated_at = now


class NewsletterSubscriber(db.Model):
    """Email subscribers for travel tips & deals."""

    __tablename__ = "newsletter_subscribers"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    email = db.Column(db.String(256), unique=True, nullable=False)
    subscribed_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
