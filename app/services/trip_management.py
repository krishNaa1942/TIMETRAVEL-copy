"""
Enhanced Trip Management Service
Production-grade trip management with AI integration
"""

from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, field, asdict
from datetime import datetime, date, timedelta, timezone
import json
import logging
import uuid

from app.models.validation import TripStatus, DestinationType, AccommodationType
from app.services.ai_recommendations import recommendation_service

logger = logging.getLogger(__name__)


@dataclass
class TripDestination:
    """Trip destination model"""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    name: str = ""
    country: str = ""
    city: Optional[str] = None
    type: str = "city"
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    description: Optional[str] = None
    order: int = 0
    duration_days: int = 1
    accommodation: Optional[str] = None
    accommodation_type: str = "hotel"
    highlights: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'TripDestination':
        return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})


@dataclass
class TripCollaborator:
    """Trip collaborator model"""
    user_id: str
    name: str
    email: str
    avatar: Optional[str] = None
    role: str = "viewer"  # owner, editor, viewer
    added_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


@dataclass
class Trip:
    """Enhanced trip model"""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str = ""
    name: str = ""
    description: Optional[str] = None
    destinations: List[TripDestination] = field(default_factory=list)
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    budget: float = 0.0
    currency: str = "USD"
    status: str = "planning"
    travelers: int = 1
    tags: List[str] = field(default_factory=list)
    collaborators: List[TripCollaborator] = field(default_factory=list)
    cover_image: Optional[str] = None
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    is_public: bool = False
    ai_generated: bool = False
    
    def to_dict(self) -> Dict[str, Any]:
        data = {
            "id": self.id,
            "user_id": self.user_id,
            "name": self.name,
            "description": self.description,
            "destinations": [d.to_dict() for d in self.destinations],
            "start_date": self.start_date.isoformat() if self.start_date else None,
            "end_date": self.end_date.isoformat() if self.end_date else None,
            "budget": self.budget,
            "currency": self.currency,
            "status": self.status,
            "travelers": self.travelers,
            "tags": self.tags,
            "collaborators": [asdict(c) for c in self.collaborators],
            "cover_image": self.cover_image,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "is_public": self.is_public,
            "ai_generated": self.ai_generated
        }
        return data
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Trip':
        destinations = [
            TripDestination.from_dict(d) for d in data.get('destinations', [])
        ]
        collaborators = [
            TripCollaborator(**c) for c in data.get('collaborators', [])
        ]
        return cls(
            id=data.get('id', str(uuid.uuid4())),
            user_id=data.get('user_id', ''),
            name=data.get('name', ''),
            description=data.get('description'),
            destinations=destinations,
            start_date=data.get('start_date'),
            end_date=data.get('end_date'),
            budget=data.get('budget', 0.0),
            currency=data.get('currency', 'USD'),
            status=data.get('status', 'planning'),
            travelers=data.get('travelers', 1),
            tags=data.get('tags', []),
            collaborators=collaborators,
            cover_image=data.get('cover_image'),
            created_at=data.get('created_at', datetime.now(timezone.utc).isoformat()),
            updated_at=data.get('updated_at', datetime.now(timezone.utc).isoformat()),
            is_public=data.get('is_public', False),
            ai_generated=data.get('ai_generated', False)
        )


class TripManagementService:
    """
    Enhanced Trip Management Service.
    
    Features:
    - Full CRUD operations
    - Trip sharing and collaboration
    - AI-powered recommendations
    - Budget tracking
    - Status management
    - Trip templates
    """
    
    def __init__(self, db_service=None):
        self.db = db_service
        self._trips_cache: Dict[str, Trip] = {}
        self._user_trips_cache: Dict[str, List[str]] = {}
    
    async def create_trip(
        self,
        user_id: str,
        name: str,
        destinations: List[Dict[str, Any]],
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        budget: float = 0.0,
        currency: str = "USD",
        travelers: int = 1,
        description: Optional[str] = None,
        tags: Optional[List[str]] = None
    ) -> Trip:
        """
        Create a new trip.
        
        Args:
            user_id: Trip owner's user ID
            name: Trip name
            destinations: List of destination data
            start_date: Trip start date
            end_date: Trip end date
            budget: Trip budget
            currency: Currency code
            travelers: Number of travelers
            description: Trip description
            tags: Trip tags
            
        Returns:
            Created Trip object
        """
        trip = Trip(
            user_id=user_id,
            name=name,
            description=description,
            start_date=start_date,
            end_date=end_date,
            budget=budget,
            currency=currency,
            travelers=travelers,
            tags=tags or [],
            status=TripStatus.PLANNING.value
        )
        
        # Add destinations
        for i, dest_data in enumerate(destinations):
            dest = TripDestination(
                name=dest_data.get('name', ''),
                country=dest_data.get('country', ''),
                city=dest_data.get('city'),
                type=dest_data.get('type', 'city'),
                latitude=dest_data.get('latitude'),
                longitude=dest_data.get('longitude'),
                description=dest_data.get('description'),
                order=i,
                duration_days=dest_data.get('duration_days', 1),
                accommodation=dest_data.get('accommodation'),
                accommodation_type=dest_data.get('accommodation_type', 'hotel'),
                highlights=dest_data.get('highlights', [])
            )
            trip.destinations.append(dest)
        
        # Add owner as collaborator
        owner = TripCollaborator(
            user_id=user_id,
            name="",  # Would fetch from user service
            email="",
            role="owner"
        )
        trip.collaborators.append(owner)
        
        # Save to database
        if self.db:
            try:
                await self.db.create_trip(trip.to_dict())
            except Exception as e:
                logger.error(f"Error creating trip: {e}")
                raise
        
        # Update cache
        self._trips_cache[trip.id] = trip
        if user_id in self._user_trips_cache:
            self._user_trips_cache[user_id].append(trip.id)
        else:
            self._user_trips_cache[user_id] = [trip.id]
        
        logger.info(f"Created trip {trip.id} for user {user_id}")
        return trip
    
    async def get_trip(self, trip_id: str, user_id: str) -> Optional[Trip]:
        """
        Get a trip by ID.
        
        Args:
            trip_id: Trip ID
            user_id: Requesting user ID (for access control)
            
        Returns:
            Trip object if found and accessible
        """
        # Check cache
        if trip_id in self._trips_cache:
            trip = self._trips_cache[trip_id]
            if self._can_access(trip, user_id):
                return trip
            return None
        
        # Fetch from database
        if self.db:
            try:
                trip_data = await self.db.get_trip(trip_id)
                if trip_data:
                    trip = Trip.from_dict(trip_data)
                    if self._can_access(trip, user_id):
                        self._trips_cache[trip_id] = trip
                        return trip
            except Exception as e:
                logger.error(f"Error fetching trip {trip_id}: {e}")
        
        return None
    
    async def update_trip(
        self,
        trip_id: str,
        user_id: str,
        updates: Dict[str, Any]
    ) -> Optional[Trip]:
        """
        Update a trip.
        
        Args:
            trip_id: Trip ID
            user_id: Requesting user ID
            updates: Dictionary of fields to update
            
        Returns:
            Updated Trip object
        """
        trip = await self.get_trip(trip_id, user_id)
        if not trip:
            return None
        
        if not self._can_edit(trip, user_id):
            raise PermissionError("User does not have edit permission")
        
        # Apply updates
        updatable_fields = [
            'name', 'description', 'start_date', 'end_date',
            'budget', 'currency', 'travelers', 'tags', 'status',
            'cover_image', 'is_public'
        ]
        
        for field in updatable_fields:
            if field in updates:
                setattr(trip, field, updates[field])
        
        trip.updated_at = datetime.now(timezone.utc).isoformat()
        
        # Save to database
        if self.db:
            try:
                await self.db.update_trip(trip_id, trip.to_dict())
            except Exception as e:
                logger.error(f"Error updating trip {trip_id}: {e}")
                raise
        
        # Update cache
        self._trips_cache[trip_id] = trip
        
        return trip
    
    async def delete_trip(self, trip_id: str, user_id: str) -> bool:
        """
        Delete a trip.
        
        Args:
            trip_id: Trip ID
            user_id: Requesting user ID
            
        Returns:
            True if deleted successfully
        """
        trip = await self.get_trip(trip_id, user_id)
        if not trip:
            return False
        
        if not self._is_owner(trip, user_id):
            raise PermissionError("Only owner can delete trip")
        
        # Delete from database
        if self.db:
            try:
                await self.db.delete_trip(trip_id)
            except Exception as e:
                logger.error(f"Error deleting trip {trip_id}: {e}")
                return False
        
        # Remove from cache
        if trip_id in self._trips_cache:
            del self._trips_cache[trip_id]
        if user_id in self._user_trips_cache and trip_id in self._user_trips_cache[user_id]:
            self._user_trips_cache[user_id].remove(trip_id)
        
        return True
    
    async def get_user_trips(
        self,
        user_id: str,
        status: Optional[str] = None,
        limit: int = 20,
        offset: int = 0
    ) -> List[Trip]:
        """
        Get all trips for a user.
        
        Args:
            user_id: User ID
            status: Filter by status
            limit: Maximum number of trips
            offset: Pagination offset
            
        Returns:
            List of Trip objects
        """
        if self.db:
            try:
                trips_data = await self.db.get_user_trips(
                    user_id, status=status, limit=limit, offset=offset
                )
                trips = [Trip.from_dict(t) for t in trips_data]
                
                # Update cache
                for trip in trips:
                    self._trips_cache[trip.id] = trip
                
                return trips
            except Exception as e:
                logger.error(f"Error fetching user trips: {e}")
        
        return []
    
    async def add_destination(
        self,
        trip_id: str,
        user_id: str,
        destination: Dict[str, Any]
    ) -> Optional[TripDestination]:
        """
        Add a destination to a trip.
        
        Args:
            trip_id: Trip ID
            user_id: Requesting user ID
            destination: Destination data
            
        Returns:
            Created TripDestination
        """
        trip = await self.get_trip(trip_id, user_id)
        if not trip or not self._can_edit(trip, user_id):
            return None
        
        new_dest = TripDestination(
            name=destination.get('name', ''),
            country=destination.get('country', ''),
            city=destination.get('city'),
            type=destination.get('type', 'city'),
            latitude=destination.get('latitude'),
            longitude=destination.get('longitude'),
            description=destination.get('description'),
            order=len(trip.destinations),
            duration_days=destination.get('duration_days', 1)
        )
        
        trip.destinations.append(new_dest)
        trip.updated_at = datetime.now(timezone.utc).isoformat()
        
        if self.db:
            await self.db.update_trip(trip_id, trip.to_dict())
        
        self._trips_cache[trip_id] = trip
        return new_dest
    
    async def remove_destination(
        self,
        trip_id: str,
        user_id: str,
        destination_id: str
    ) -> bool:
        """
        Remove a destination from a trip.
        """
        trip = await self.get_trip(trip_id, user_id)
        if not trip or not self._can_edit(trip, user_id):
            return False
        
        trip.destinations = [
            d for d in trip.destinations if d.id != destination_id
        ]
        
        # Reorder remaining destinations
        for i, dest in enumerate(trip.destinations):
            dest.order = i
        
        trip.updated_at = datetime.now(timezone.utc).isoformat()
        
        if self.db:
            await self.db.update_trip(trip_id, trip.to_dict())
        
        self._trips_cache[trip_id] = trip
        return True
    
    async def share_trip(
        self,
        trip_id: str,
        user_id: str,
        collaborator_id: str,
        role: str = "viewer"
    ) -> bool:
        """
        Share a trip with another user.
        
        Args:
            trip_id: Trip ID
            user_id: Owner's user ID
            collaborator_id: User ID to share with
            role: Role for collaborator (viewer, editor)
            
        Returns:
            True if shared successfully
        """
        trip = await self.get_trip(trip_id, user_id)
        if not trip or not self._is_owner(trip, user_id):
            return False
        
        # Check if already shared
        if any(c.user_id == collaborator_id for c in trip.collaborators):
            # Update role
            for c in trip.collaborators:
                if c.user_id == collaborator_id:
                    c.role = role
                    break
        else:
            # Add new collaborator
            collaborator = TripCollaborator(
                user_id=collaborator_id,
                name="",  # Would fetch from user service
                email="",
                role=role
            )
            trip.collaborators.append(collaborator)
        
        trip.updated_at = datetime.now(timezone.utc).isoformat()
        
        if self.db:
            await self.db.update_trip(trip_id, trip.to_dict())
        
        self._trips_cache[trip_id] = trip
        return True
    
    async def get_ai_recommendations(
        self,
        trip_id: str,
        user_id: str,
        context: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """
        Get AI-powered recommendations for a trip.
        
        Args:
            trip_id: Trip ID
            user_id: User ID
            context: Additional context for recommendations
            
        Returns:
            List of recommendations
        """
        trip = await self.get_trip(trip_id, user_id)
        if not trip:
            return []
        
        # Build recommendation context
        from app.services.ai_recommendations import RecommendationContext
        
        rec_context = RecommendationContext(
            travel_dates=(trip.start_date, trip.end_date) if trip.start_date and trip.end_date else None,
            budget_max=trip.budget,
            group_size=trip.travelers,
            specific_interests=trip.tags
        )
        
        # Get recommendations
        recommendations = recommendation_service.get_recommendations(
            user_id=user_id,
            context=rec_context,
            limit=10
        )
        
        return recommendations
    
    async def duplicate_trip(
        self,
        trip_id: str,
        user_id: str,
        new_name: Optional[str] = None
    ) -> Optional[Trip]:
        """
        Duplicate a trip.
        
        Args:
            trip_id: Original trip ID
            user_id: User ID
            new_name: New trip name
            
        Returns:
            Duplicated Trip object
        """
        original = await self.get_trip(trip_id, user_id)
        if not original:
            return None
        
        # Create new trip
        new_trip = Trip(
            user_id=user_id,
            name=new_name or f"{original.name} (Copy)",
            description=original.description,
            budget=original.budget,
            currency=original.currency,
            travelers=original.travelers,
            tags=original.tags.copy(),
            status=TripStatus.PLANNING.value
        )
        
        # Copy destinations
        for dest in original.destinations:
            new_dest = TripDestination(
                name=dest.name,
                country=dest.country,
                city=dest.city,
                type=dest.type,
                latitude=dest.latitude,
                longitude=dest.longitude,
                description=dest.description,
                order=dest.order,
                duration_days=dest.duration_days
            )
            new_trip.destinations.append(new_dest)
        
        # Add owner
        owner = TripCollaborator(
            user_id=user_id,
            name="",
            email="",
            role="owner"
        )
        new_trip.collaborators.append(owner)
        
        if self.db:
            await self.db.create_trip(new_trip.to_dict())
        
        self._trips_cache[new_trip.id] = new_trip
        return new_trip
    
    async def update_status(
        self,
        trip_id: str,
        user_id: str,
        new_status: str
    ) -> Optional[Trip]:
        """
        Update trip status.
        """
        trip = await self.get_trip(trip_id, user_id)
        if not trip or not self._can_edit(trip, user_id):
            return None
        
        if new_status not in [s.value for s in TripStatus]:
            raise ValueError(f"Invalid status: {new_status}")
        
        trip.status = new_status
        trip.updated_at = datetime.now(timezone.utc).isoformat()
        
        if self.db:
            await self.db.update_trip(trip_id, trip.to_dict())
        
        self._trips_cache[trip_id] = trip
        return trip
    
    def _can_access(self, trip: Trip, user_id: str) -> bool:
        """Check if user can access trip."""
        if trip.is_public:
            return True
        return any(c.user_id == user_id for c in trip.collaborators)
    
    def _can_edit(self, trip: Trip, user_id: str) -> bool:
        """Check if user can edit trip."""
        return any(
            c.user_id == user_id and c.role in ('owner', 'editor')
            for c in trip.collaborators
        )
    
    def _is_owner(self, trip: Trip, user_id: str) -> bool:
        """Check if user is owner."""
        return any(
            c.user_id == user_id and c.role == 'owner'
            for c in trip.collaborators
        )


# Singleton instance
trip_service = TripManagementService()