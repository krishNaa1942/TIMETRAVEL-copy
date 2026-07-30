"""
User Preferences Service
Manages user travel preferences for AI recommendations
"""

from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)


@dataclass
class TravelPreferences:
    """User travel preferences model"""

    user_id: str
    travel_style: str = "adventure"  # adventure, relaxation, cultural, business, mixed
    budget_preference: str = "moderate"  # budget, moderate, luxury
    climate_preference: str = "moderate"  # tropical, cold, moderate, varied
    accommodation_type: str = "hotel"  # hotel, hostel, resort, apartment, camping
    activity_preferences: List[str] = field(default_factory=list)
    cuisine_preferences: List[str] = field(default_factory=list)
    accessibility_needs: List[str] = field(default_factory=list)
    dietary_restrictions: List[str] = field(default_factory=list)
    language_preference: str = "en"
    currency_preference: str = "USD"
    notification_preferences: Dict[str, bool] = field(
        default_factory=lambda: {
            "price_alerts": True,
            "trip_reminders": True,
            "recommendations": True,
            "newsletter": False,
        }
    )
    created_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    updated_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "TravelPreferences":
        """Create from dictionary"""
        return cls(**data)


@dataclass
class SavedDestination:
    """Saved/favorited destination"""

    destination_id: str
    name: str
    country: str
    saved_at: str
    notes: str = ""
    tags: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class UserPreferencesService:
    """
    Service for managing user travel preferences.

    Features:
    - Travel style and budget preferences
    - Activity and cuisine preferences
    - Saved destinations (favorites)
    - Search history tracking
    - Preference-based recommendations
    """

    # Valid preference values
    VALID_TRAVEL_STYLES = ["adventure", "relaxation", "cultural", "business", "mixed"]
    VALID_BUDGET_LEVELS = ["budget", "moderate", "luxury"]
    VALID_CLIMATE_PREFS = ["tropical", "cold", "moderate", "varied"]
    VALID_ACCOMMODATION_TYPES = [
        "hotel",
        "hostel",
        "resort",
        "apartment",
        "camping",
        "any",
    ]

    # Activity categories
    ACTIVITY_CATEGORIES = {
        "adventure": [
            "hiking",
            "diving",
            "skiing",
            "surfing",
            "climbing",
            "rafting",
            "safari",
        ],
        "cultural": [
            "museums",
            "historical_sites",
            "art_galleries",
            "local_culture",
            "festivals",
        ],
        "relaxation": ["beaches", "spas", "wellness", "yoga", "meditation"],
        "nightlife": ["bars", "clubs", "concerts", "theater", "casinos"],
        "nature": [
            "wildlife",
            "national_parks",
            "scenic_views",
            "gardens",
            "eco_tours",
        ],
        "food": [
            "food_tours",
            "cooking_classes",
            "wine_tasting",
            "local_cuisine",
            "street_food",
        ],
    }

    def __init__(self, db_service=None):
        self.db = db_service
        self._preferences_cache: Dict[str, TravelPreferences] = {}
        self._favorites_cache: Dict[str, List[SavedDestination]] = {}
        self._search_history_cache: Dict[str, List[Dict]] = {}

    async def get_preferences(self, user_id: str) -> TravelPreferences:
        """
        Get user travel preferences.

        Args:
            user_id: User's unique identifier

        Returns:
            TravelPreferences object
        """
        # Check cache first
        if user_id in self._preferences_cache:
            return self._preferences_cache[user_id]

        # Fetch from database (or return defaults)
        if self.db:
            try:
                prefs_data = await self.db.get_user_preferences(user_id)
                if prefs_data:
                    prefs = TravelPreferences.from_dict(prefs_data)
                    self._preferences_cache[user_id] = prefs
                    return prefs
            except Exception as e:
                logger.error(f"Error fetching preferences for {user_id}: {e}")

        # Return default preferences
        return TravelPreferences(user_id=user_id)

    async def update_preferences(
        self, user_id: str, updates: Dict[str, Any]
    ) -> TravelPreferences:
        """
        Update user preferences.

        Args:
            user_id: User's unique identifier
            updates: Dictionary of preferences to update

        Returns:
            Updated TravelPreferences
        """
        current = await self.get_preferences(user_id)

        # Validate and apply updates
        for key, value in updates.items():
            if hasattr(current, key):
                if key == "travel_style" and value not in self.VALID_TRAVEL_STYLES:
                    continue
                elif (
                    key == "budget_preference" and value not in self.VALID_BUDGET_LEVELS
                ):
                    continue
                elif (
                    key == "climate_preference"
                    and value not in self.VALID_CLIMATE_PREFS
                ):
                    continue
                elif (
                    key == "accommodation_type"
                    and value not in self.VALID_ACCOMMODATION_TYPES
                ):
                    continue

                setattr(current, key, value)

        current.updated_at = datetime.now(timezone.utc).isoformat()

        # Save to database
        if self.db:
            try:
                await self.db.save_user_preferences(user_id, current.to_dict())
            except Exception as e:
                logger.error(f"Error saving preferences for {user_id}: {e}")

        # Update cache
        self._preferences_cache[user_id] = current

        return current

    async def add_activity_preference(
        self, user_id: str, activity: str
    ) -> TravelPreferences:
        """Add an activity preference"""
        prefs = await self.get_preferences(user_id)

        if activity not in prefs.activity_preferences:
            prefs.activity_preferences.append(activity)
            prefs.updated_at = datetime.now(timezone.utc).isoformat()

            if self.db:
                await self.db.save_user_preferences(user_id, prefs.to_dict())

            self._preferences_cache[user_id] = prefs

        return prefs

    async def remove_activity_preference(
        self, user_id: str, activity: str
    ) -> TravelPreferences:
        """Remove an activity preference"""
        prefs = await self.get_preferences(user_id)

        if activity in prefs.activity_preferences:
            prefs.activity_preferences.remove(activity)
            prefs.updated_at = datetime.now(timezone.utc).isoformat()

            if self.db:
                await self.db.save_user_preferences(user_id, prefs.to_dict())

            self._preferences_cache[user_id] = prefs

        return prefs

    async def save_destination(
        self, user_id: str, destination: SavedDestination
    ) -> bool:
        """
        Save a destination to user's favorites.

        Args:
            user_id: User's unique identifier
            destination: Destination to save

        Returns:
            True if saved successfully
        """
        if user_id not in self._favorites_cache:
            self._favorites_cache[user_id] = []

        # Check if already saved
        existing = [
            f
            for f in self._favorites_cache[user_id]
            if f.destination_id == destination.destination_id
        ]

        if existing:
            # Update existing
            existing[0] = destination
        else:
            self._favorites_cache[user_id].append(destination)

        if self.db:
            try:
                await self.db.save_favorite(user_id, destination.to_dict())
            except Exception as e:
                logger.error(f"Error saving favorite for {user_id}: {e}")
                return False

        return True

    async def remove_saved_destination(self, user_id: str, destination_id: str) -> bool:
        """Remove a saved destination"""
        if user_id in self._favorites_cache:
            self._favorites_cache[user_id] = [
                f
                for f in self._favorites_cache[user_id]
                if f.destination_id != destination_id
            ]

        if self.db:
            try:
                await self.db.remove_favorite(user_id, destination_id)
            except Exception as e:
                logger.error(f"Error removing favorite: {e}")
                return False

        return True

    async def get_saved_destinations(self, user_id: str) -> List[SavedDestination]:
        """Get all saved destinations for a user"""
        if user_id in self._favorites_cache:
            return self._favorites_cache[user_id]

        if self.db:
            try:
                favorites = await self.db.get_favorites(user_id)
                destinations = [SavedDestination(**f) for f in favorites]
                self._favorites_cache[user_id] = destinations
                return destinations
            except Exception as e:
                logger.error(f"Error fetching favorites: {e}")

        return []

    async def add_search_history(
        self,
        user_id: str,
        query: str,
        search_type: str,
        filters: Optional[Dict] = None,
        results_count: int = 0,
    ) -> None:
        """
        Add a search to user's search history.

        Args:
            user_id: User's unique identifier
            query: Search query
            search_type: Type of search (destination, activity, etc.)
            filters: Applied filters
            results_count: Number of results returned
        """
        if user_id not in self._search_history_cache:
            self._search_history_cache[user_id] = []

        search_entry = {
            "query": query,
            "search_type": search_type,
            "filters": filters or {},
            "results_count": results_count,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        self._search_history_cache[user_id].append(search_entry)

        # Keep only last 100 searches
        if len(self._search_history_cache[user_id]) > 100:
            self._search_history_cache[user_id] = self._search_history_cache[user_id][
                -100:
            ]

        if self.db:
            try:
                await self.db.add_search_history(user_id, search_entry)
            except Exception as e:
                logger.error(f"Error adding search history: {e}")

    async def get_search_history(self, user_id: str, limit: int = 50) -> List[Dict]:
        """Get user's search history"""
        if user_id in self._search_history_cache:
            return self._search_history_cache[user_id][-limit:]

        if self.db:
            try:
                history = await self.db.get_search_history(user_id, limit)
                self._search_history_cache[user_id] = history
                return history
            except Exception as e:
                logger.error(f"Error fetching search history: {e}")

        return []

    async def get_recommendation_context(self, user_id: str) -> Dict[str, Any]:
        """
        Get user context for AI recommendations.

        Returns:
            Dictionary with preferences, recent searches, and favorites
        """
        prefs = await self.get_preferences(user_id)
        history = await self.get_search_history(user_id, 10)
        favorites = await self.get_saved_destinations(user_id)

        return {
            "preferences": prefs.to_dict(),
            "recent_searches": [h["query"] for h in history[-10:]],
            "favorite_destinations": [
                {"id": f.destination_id, "name": f.name, "country": f.country}
                for f in favorites
            ],
            "activity_signals": self._extract_activity_signals(history),
            "destination_affinity": self._calculate_destination_affinity(favorites),
        }

    def _extract_activity_signals(self, search_history: List[Dict]) -> List[str]:
        """Extract activity preferences from search history"""
        activities = []
        activity_keywords = {
            "beach": "beaches",
            "hike": "hiking",
            "museum": "museums",
            "food": "food_tours",
            "adventure": "adventure",
            "spa": "spas",
            "safari": "safari",
            "dive": "diving",
            "ski": "skiing",
        }

        for search in search_history:
            query = search.get("query", "").lower()
            for keyword, activity in activity_keywords.items():
                if keyword in query and activity not in activities:
                    activities.append(activity)

        return activities

    def _calculate_destination_affinity(
        self, favorites: List[SavedDestination]
    ) -> Dict[str, float]:
        """Calculate destination affinity scores"""
        affinity = {"beach": 0.0, "city": 0.0, "nature": 0.0, "cultural": 0.0}

        # Simple scoring based on tags
        for fav in favorites:
            for tag in fav.tags:
                if tag in affinity:
                    affinity[tag] += 0.2

        # Normalize
        max_score = max(affinity.values()) if affinity.values() else 1
        if max_score > 0:
            affinity = {k: min(v / max_score, 1.0) for k, v in affinity.items()}

        return affinity

    def get_preference_embedding(self, prefs: TravelPreferences) -> List[float]:
        """
        Generate a preference embedding vector for ML matching.

        Args:
            prefs: User preferences

        Returns:
            Embedding vector
        """
        # One-hot encoding for categorical preferences
        travel_style_encoding = [
            1.0 if prefs.travel_style == s else 0.0 for s in self.VALID_TRAVEL_STYLES
        ]

        budget_encoding = [
            1.0 if prefs.budget_preference == b else 0.0
            for b in self.VALID_BUDGET_LEVELS
        ]

        climate_encoding = [
            1.0 if prefs.climate_preference == c else 0.0
            for c in self.VALID_CLIMATE_PREFS
        ]

        # Activity preference encoding (multi-hot)
        all_activities = []
        for activities in self.ACTIVITY_CATEGORIES.values():
            all_activities.extend(activities)

        activity_encoding = [
            1.0 if activity in prefs.activity_preferences else 0.0
            for activity in all_activities[:20]  # Limit to top 20
        ]

        return (
            travel_style_encoding
            + budget_encoding
            + climate_encoding
            + activity_encoding
        )


# Singleton instance
user_preferences_service = UserPreferencesService()
