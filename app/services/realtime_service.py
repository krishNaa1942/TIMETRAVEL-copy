"""
Real-time Trip Updates and Price Alerts Service
Production-grade service for real-time trip collaboration and price monitoring
"""

import os
import json
import logging
import asyncio
import threading
from typing import List, Dict, Any, Optional, Set
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from enum import Enum
import hashlib

logger = logging.getLogger(__name__)


class AlertStatus(Enum):
    """Price alert status"""
    ACTIVE = "active"
    TRIGGERED = "triggered"
    EXPIRED = "expired"
    CANCELLED = "cancelled"


class UpdateType(Enum):
    """Types of trip updates"""
    ITINERARY_CHANGED = "itinerary_changed"
    DESTINATION_ADDED = "destination_added"
    DATES_CHANGED = "dates_changed"
    BUDGET_CHANGED = "budget_changed"
    COLLABORATOR_ADDED = "collaborator_added"
    COLLABORATOR_REMOVED = "collaborator_removed"
    ACTIVITY_ADDED = "activity_added"
    NOTE_ADDED = "note_added"
    STATUS_CHANGED = "status_changed"


@dataclass
class PriceAlert:
    """Price alert configuration"""
    id: str
    user_id: str
    destination: str
    target_price: float
    current_price: float
    currency: str = "USD"
    threshold_percent: float = 10.0  # Alert when price drops by this percent
    status: AlertStatus = AlertStatus.ACTIVE
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: datetime = None
    last_checked: datetime = None
    triggered_at: datetime = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def __post_init__(self):
        if self.expires_at is None:
            self.expires_at = datetime.now(timezone.utc) + timedelta(days=30)


@dataclass
class TripUpdate:
    """Trip update event"""
    trip_id: str
    update_type: UpdateType
    user_id: str
    data: Dict[str, Any]
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    collaborator_ids: List[str] = field(default_factory=list)


class RealtimeTripService:
    """
    Real-time trip collaboration service.
    
    Features:
    - Live trip updates via WebSocket
    - Collaborator presence
    - Activity feed
    - Conflict resolution
    """
    
    def __init__(self, websocket_service=None, db_service=None):
        """
        Initialize real-time trip service.
        
        Args:
            websocket_service: WebSocket service for real-time updates
            db_service: Database service for persistence
        """
        self.ws = websocket_service
        self.db = db_service
        
        # Trip collaborators cache (trip_id -> set of user_ids)
        self._trip_collaborators: Dict[str, Set[str]] = {}
        
        # User active trips (user_id -> set of trip_ids)
        self._user_trips: Dict[str, Set[str]] = {}
        
        # Recent activity feed (trip_id -> list of updates)
        self._activity_feed: Dict[str, List[TripUpdate]] = {}
        
        # Lock for thread safety
        self._lock = threading.RLock()
        
        logger.info("Real-time trip service initialized")
    
    async def join_trip(
        self,
        trip_id: str,
        user_id: str,
        websocket_client_id: str = None
    ) -> Dict[str, Any]:
        """
        Join a trip for real-time collaboration.
        
        Args:
            trip_id: Trip ID
            user_id: User ID
            websocket_client_id: WebSocket client ID
            
        Returns:
            Join result with collaborator info
        """
        with self._lock:
            # Add to trip collaborators
            if trip_id not in self._trip_collaborators:
                self._trip_collaborators[trip_id] = set()
            self._trip_collaborators[trip_id].add(user_id)
            
            # Add to user trips
            if user_id not in self._user_trips:
                self._user_trips[user_id] = set()
            self._user_trips[user_id].add(trip_id)
        
        # Join WebSocket room if client ID provided
        if websocket_client_id and self.ws:
            await self.ws.join_room(websocket_client_id, f"trip:{trip_id}")
        
        # Notify other collaborators
        await self._notify_collaborators(trip_id, UpdateType.COLLABORATOR_ADDED, {
            "user_id": user_id,
            "joined_at": datetime.now(timezone.utc).isoformat()
        }, exclude_user=user_id)
        
        # Get current collaborators
        collaborators = self.get_trip_collaborators(trip_id)
        
        logger.info(f"User {user_id} joined trip {trip_id}")
        
        return {
            "success": True,
            "trip_id": trip_id,
            "collaborators": collaborators,
            "recent_activity": self._get_recent_activity(trip_id, limit=10)
        }
    
    async def leave_trip(
        self,
        trip_id: str,
        user_id: str,
        websocket_client_id: str = None
    ) -> Dict[str, Any]:
        """
        Leave a trip collaboration.
        
        Args:
            trip_id: Trip ID
            user_id: User ID
            websocket_client_id: WebSocket client ID
            
        Returns:
            Leave result
        """
        with self._lock:
            if trip_id in self._trip_collaborators:
                self._trip_collaborators[trip_id].discard(user_id)
            
            if user_id in self._user_trips:
                self._user_trips[user_id].discard(trip_id)
        
        # Leave WebSocket room
        if websocket_client_id and self.ws:
            await self.ws.leave_room(websocket_client_id, f"trip:{trip_id}")
        
        # Notify remaining collaborators
        await self._notify_collaborators(trip_id, UpdateType.COLLABORATOR_REMOVED, {
            "user_id": user_id,
            "left_at": datetime.now(timezone.utc).isoformat()
        })
        
        logger.info(f"User {user_id} left trip {trip_id}")
        
        return {
            "success": True,
            "trip_id": trip_id
        }
    
    async def broadcast_update(
        self,
        trip_id: str,
        update_type: UpdateType,
        user_id: str,
        data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Broadcast a trip update to all collaborators.
        
        Args:
            trip_id: Trip ID
            update_type: Type of update
            user_id: User making the update
            data: Update data
            
        Returns:
            Broadcast result
        """
        # Create update record
        update = TripUpdate(
            trip_id=trip_id,
            update_type=update_type,
            user_id=user_id,
            data=data
        )
        
        # Add to activity feed
        with self._lock:
            if trip_id not in self._activity_feed:
                self._activity_feed[trip_id] = []
            self._activity_feed[trip_id].append(update)
            
            # Keep only last 100 updates
            if len(self._activity_feed[trip_id]) > 100:
                self._activity_feed[trip_id] = self._activity_feed[trip_id][-100:]
        
        # Notify collaborators
        await self._notify_collaborators(trip_id, update_type, {
            "user_id": user_id,
            "timestamp": update.timestamp.isoformat(),
            **data
        })
        
        return {
            "success": True,
            "update_id": f"{trip_id}_{update.timestamp.timestamp()}",
            "notified_count": len(self.get_trip_collaborators(trip_id))
        }
    
    async def update_itinerary(
        self,
        trip_id: str,
        user_id: str,
        day_number: int,
        activities: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Update trip itinerary."""
        return await self.broadcast_update(
            trip_id,
            UpdateType.ITINERARY_CHANGED,
            user_id,
            {
                "day_number": day_number,
                "activities": activities,
                "message": f"Updated day {day_number} itinerary"
            }
        )
    
    async def update_dates(
        self,
        trip_id: str,
        user_id: str,
        start_date: str,
        end_date: str
    ) -> Dict[str, Any]:
        """Update trip dates."""
        return await self.broadcast_update(
            trip_id,
            UpdateType.DATES_CHANGED,
            user_id,
            {
                "start_date": start_date,
                "end_date": end_date,
                "message": "Trip dates updated"
            }
        )
    
    async def update_budget(
        self,
        trip_id: str,
        user_id: str,
        budget: float,
        currency: str = "USD"
    ) -> Dict[str, Any]:
        """Update trip budget."""
        return await self.broadcast_update(
            trip_id,
            UpdateType.BUDGET_CHANGED,
            user_id,
            {
                "budget": budget,
                "currency": currency,
                "message": f"Budget updated to {currency} {budget}"
            }
        )
    
    async def add_activity(
        self,
        trip_id: str,
        user_id: str,
        day_number: int,
        activity: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Add activity to trip."""
        return await self.broadcast_update(
            trip_id,
            UpdateType.ACTIVITY_ADDED,
            user_id,
            {
                "day_number": day_number,
                "activity": activity,
                "message": f"Added activity: {activity.get('name', 'New activity')}"
            }
        )
    
    def get_trip_collaborators(self, trip_id: str) -> List[str]:
        """Get list of collaborators for a trip."""
        with self._lock:
            return list(self._trip_collaborators.get(trip_id, set()))
    
    def get_user_active_trips(self, user_id: str) -> List[str]:
        """Get trips a user is currently collaborating on."""
        return list(self._user_trips.get(user_id, set()))
    
    def get_online_collaborators(self, trip_id: str) -> List[str]:
        """Get online collaborators for a trip."""
        collaborators = self._trip_collaborators.get(trip_id, set())
        online = []
        
        if self.ws:
            for user_id in collaborators:
                if self.ws.is_user_online(user_id):
                    online.append(user_id)
        
        return online
    
    def _get_recent_activity(
        self,
        trip_id: str,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """Get recent activity for a trip."""
        updates = self._activity_feed.get(trip_id, [])[-limit:]
        return [
            {
                "update_type": u.update_type.value,
                "user_id": u.user_id,
                "timestamp": u.timestamp.isoformat(),
                "data": u.data
            }
            for u in updates
        ]
    
    async def _notify_collaborators(
        self,
        trip_id: str,
        update_type: UpdateType,
        data: Dict[str, Any],
        exclude_user: str = None
    ):
        """Notify all collaborators of an update."""
        if not self.ws:
            return
        
        collaborators = self.get_trip_collaborators(trip_id)
        
        from app.services.websocket_service import WebSocketMessage, MessageType as WsMsgType

        message = WebSocketMessage(
            type=WsMsgType(update_type.value),
            payload={"trip_id": trip_id, **data},
        ).to_json()

        for user_id in collaborators:
            if user_id != exclude_user:
                await self.ws.send_to_user(user_id, message)


class PriceAlertService:
    """
    Price monitoring and alerting service.
    
    Features:
    - Price tracking for destinations
    - Configurable alert thresholds
    - Real-time price notifications
    - Historical price data
    """
    
    def __init__(
        self,
        websocket_service=None,
        push_service=None,
        db_service=None
    ):
        """
        Initialize price alert service.
        
        Args:
            websocket_service: WebSocket service for real-time alerts
            push_service: Push notification service
            db_service: Database service for persistence
        """
        self.ws = websocket_service
        self.push = push_service
        self.db = db_service
        
        # Active price alerts (alert_id -> PriceAlert)
        self._alerts: Dict[str, PriceAlert] = {}
        
        # User alerts index (user_id -> set of alert_ids)
        self._user_alerts: Dict[str, Set[str]] = {}
        
        # Price cache (destination -> current price)
        self._price_cache: Dict[str, float] = {}
        
        # Background monitoring task
        self._running = False
        self._check_interval = 3600  # 1 hour
        
        # Lock for thread safety
        self._lock = threading.RLock()
        
        logger.info("Price alert service initialized")
    
    def create_alert(
        self,
        user_id: str,
        destination: str,
        target_price: float = None,
        threshold_percent: float = 10.0,
        current_price: float = None,
        currency: str = "USD",
        expires_days: int = 30
    ) -> PriceAlert:
        """
        Create a price alert for a destination.
        
        Args:
            user_id: User ID
            destination: Destination to monitor
            target_price: Target price (optional)
            threshold_percent: Percentage drop to trigger alert
            current_price: Current price (optional)
            currency: Currency code
            expires_days: Days until alert expires
            
        Returns:
            Created price alert
        """
        alert_id = hashlib.md5(f"{user_id}_{destination}_{datetime.now(timezone.utc).isoformat()}".encode()).hexdigest()[:12]
        
        # Get current price if not provided
        if current_price is None:
            current_price = self._price_cache.get(destination, 1000.0)
        
        # Set target price if not provided
        if target_price is None:
            target_price = current_price * (1 - threshold_percent / 100)
        
        alert = PriceAlert(
            id=alert_id,
            user_id=user_id,
            destination=destination,
            target_price=target_price,
            current_price=current_price,
            currency=currency,
            threshold_percent=threshold_percent,
            expires_at=datetime.now(timezone.utc) + timedelta(days=expires_days)
        )
        
        with self._lock:
            self._alerts[alert_id] = alert
            
            if user_id not in self._user_alerts:
                self._user_alerts[user_id] = set()
            self._user_alerts[user_id].add(alert_id)
        
        logger.info(f"Created price alert {alert_id} for {destination} at {target_price}")
        
        return alert
    
    def cancel_alert(self, alert_id: str) -> bool:
        """Cancel a price alert."""
        with self._lock:
            alert = self._alerts.get(alert_id)
            if alert:
                alert.status = AlertStatus.CANCELLED
                logger.info(f"Cancelled price alert {alert_id}")
                return True
        return False
    
    def get_user_alerts(self, user_id: str) -> List[PriceAlert]:
        """Get all alerts for a user."""
        alert_ids = self._user_alerts.get(user_id, set())
        return [self._alerts[aid] for aid in alert_ids if aid in self._alerts]
    
    def get_active_alerts_for_destination(self, destination: str) -> List[PriceAlert]:
        """Get active alerts for a destination."""
        return [
            alert for alert in self._alerts.values()
            if alert.destination == destination and alert.status == AlertStatus.ACTIVE
        ]
    
    async def update_price(
        self,
        destination: str,
        new_price: float,
        currency: str = "USD"
    ) -> List[Dict[str, Any]]:
        """
        Update price for a destination and check alerts.
        
        Args:
            destination: Destination name
            new_price: New price
            currency: Currency code
            
        Returns:
            List of triggered alerts
        """
        old_price = self._price_cache.get(destination)
        self._price_cache[destination] = new_price
        
        triggered_alerts = []
        
        if old_price is None:
            return triggered_alerts
        
        # Check for price drop
        price_change_percent = ((old_price - new_price) / old_price) * 100
        
        if price_change_percent > 0:
            # Price dropped - check alerts
            active_alerts = self.get_active_alerts_for_destination(destination)
            
            for alert in active_alerts:
                # Check if threshold met
                if new_price <= alert.target_price or price_change_percent >= alert.threshold_percent:
                    alert.status = AlertStatus.TRIGGERED
                    alert.triggered_at = datetime.now(timezone.utc)
                    alert.current_price = new_price
                    await self._send_alert_notification(alert, old_price, new_price)
                    
                    triggered_alerts.append({
                        "alert_id": alert.id,
                        "user_id": alert.user_id,
                        "destination": destination,
                        "old_price": old_price,
                        "new_price": new_price,
                        "drop_percent": price_change_percent
                    })
        
        return triggered_alerts
    
    async def check_all_alerts(self) -> Dict[str, Any]:
        """
        Check all active alerts against current prices.
        This would typically fetch prices from external APIs.
        """
        results = {
            "checked": 0,
            "triggered": 0,
            "errors": 0
        }
        
        # Get unique destinations with active alerts
        destinations = set()
        for alert in self._alerts.values():
            if alert.status == AlertStatus.ACTIVE:
                destinations.add(alert.destination)
        
        for destination in destinations:
            try:
                # Simulate price check (would call external API)
                # In production, this would fetch real prices
                current_price = self._price_cache.get(destination, 1000.0)
                
                # Simulate price fluctuation
                import random
                new_price = current_price * (1 + random.uniform(-0.05, 0.02))
                
                triggered = await self.update_price(destination, new_price)
                
                results["checked"] += 1
                results["triggered"] += len(triggered)
                
            except Exception as e:
                logger.error(f"Error checking price for {destination}: {e}")
                results["errors"] += 1
        
        return results
    
    async def start_monitoring(self):
        """Start background price monitoring."""
        self._running = True
        
        try:
            while self._running:
                try:
                    await asyncio.sleep(self._check_interval)
                    if not self._running:
                        break
                    results = await self.check_all_alerts()
                    logger.info(f"Price check results: {results}")
                    
                    await self._cleanup_expired_alerts()
                    
                except asyncio.CancelledError:
                    break
                except Exception as e:
                    logger.error(f"Price monitoring error: {e}")
        finally:
            self._running = False
    
    def stop_monitoring(self):
        """Stop background monitoring."""
        self._running = False
    
    async def _send_alert_notification(
        self,
        alert: PriceAlert,
        old_price: float,
        new_price: float
    ):
        """Send notification for triggered alert."""
        drop_percent = ((old_price - new_price) / old_price) * 100
        
        # Send WebSocket notification
        if self.ws:
            await self.ws.send_price_alert(
                alert.user_id,
                alert.destination,
                old_price,
                new_price,
                alert.currency
            )
        
        # Send push notification
        if self.push:
            await self.push.send_price_alert(
                alert.user_id,
                alert.destination,
                old_price,
                new_price,
                alert.currency
            )
        
        logger.info(f"Sent price alert notification to {alert.user_id} for {alert.destination}")
    
    async def _cleanup_expired_alerts(self):
        """Remove expired alerts."""
        now = datetime.now(timezone.utc)
        
        with self._lock:
            for alert_id, alert in list(self._alerts.items()):
                if alert.expires_at and alert.expires_at < now:
                    if alert.status == AlertStatus.ACTIVE:
                        alert.status = AlertStatus.EXPIRED


# Singleton instances
realtime_trip_service = RealtimeTripService()
price_alert_service = PriceAlertService()