"""
Push Notification Service
Production-grade push notification service for FCM and APNs
"""

import os
import json
import logging
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
import hashlib

logger = logging.getLogger(__name__)


class NotificationPriority(Enum):
    """Notification priority levels"""
    NORMAL = "normal"
    HIGH = "high"


class NotificationType(Enum):
    """Types of notifications"""
    TRIP_REMINDER = "trip_reminder"
    PRICE_ALERT = "price_alert"
    TRIP_INVITATION = "trip_invitation"
    TRIP_UPDATE = "trip_update"
    CHAT_MESSAGE = "chat_message"
    INSIGHT = "insight"
    SYSTEM = "system"


@dataclass
class PushNotification:
    """Push notification payload"""
    title: str
    body: str
    data: Dict[str, Any] = field(default_factory=dict)
    image: Optional[str] = None
    priority: NotificationPriority = NotificationPriority.NORMAL
    notification_type: NotificationType = NotificationType.SYSTEM
    sound: str = "default"
    badge: Optional[int] = None
    ttl: int = 86400  # 24 hours
    created_at: datetime = field(default_factory=datetime.utcnow)
    
    def to_fcm_payload(self, token: str) -> Dict[str, Any]:
        """Convert to FCM payload format."""
        payload = {
            "token": token,
            "notification": {
                "title": self.title,
                "body": self.body,
            },
            "data": {
                "type": self.notification_type.value,
                "timestamp": self.created_at.isoformat(),
                **{k: str(v) for k, v in self.data.items()}
            },
            "android": {
                "priority": self.priority.value,
                "ttl": f"{self.ttl}s",
                "notification": {
                    "sound": self.sound,
                    "channel_id": "default"
                }
            },
            "apns": {
                "headers": {
                    "apns-priority": "10" if self.priority == NotificationPriority.HIGH else "5",
                    "apns-expiration": str(int(self.created_at.timestamp()) + self.ttl)
                },
                "payload": {
                    "aps": {
                        "alert": {
                            "title": self.title,
                            "body": self.body
                        },
                        "sound": self.sound,
                        "badge": self.badge
                    }
                }
            }
        }
        
        if self.image:
            payload["notification"]["image"] = self.image
            payload["android"]["notification"]["image"] = self.image
            payload["apns"]["payload"]["aps"]["mutable-content"] = 1
        
        return payload
    
    def to_apns_payload(self, token: str) -> Dict[str, Any]:
        """Convert to APNs payload format."""
        payload = {
            "aps": {
                "alert": {
                    "title": self.title,
                    "body": self.body
                },
                "sound": self.sound,
                "badge": self.badge,
                "mutable-content": 1 if self.image else 0
            },
            "data": {
                "type": self.notification_type.value,
                "timestamp": self.created_at.isoformat(),
                **self.data
            }
        }
        
        return payload


@dataclass
class DeviceToken:
    """Registered device token"""
    user_id: str
    token: str
    platform: str  # 'ios', 'android', 'web'
    device_id: Optional[str] = None
    device_name: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    last_used: datetime = field(default_factory=datetime.utcnow)
    is_active: bool = True


class PushNotificationService:
    """
    Production-grade push notification service.
    
    Features:
    - Firebase Cloud Messaging (FCM) integration
    - Apple Push Notification Service (APNs) support
    - Device token management
    - Notification templates
    - Batch notifications
    - Delivery tracking
    """
    
    def __init__(self, db_service=None):
        """
        Initialize push notification service.
        
        Args:
            db_service: Database service for token storage
        """
        self.db = db_service
        
        # Device tokens storage (user_id -> list of DeviceToken)
        self._tokens: Dict[str, List[DeviceToken]] = {}
        
        # Firebase Admin SDK
        self._firebase_app = None
        self._fcm_available = False
        
        # Try to initialize Firebase
        try:
            import firebase_admin
            from firebase_admin import messaging
            
            # Check for credentials
            cred_path = os.environ.get("FIREBASE_CREDENTIALS_PATH")
            cred_json = os.environ.get("FIREBASE_CREDENTIALS_JSON")
            
            if cred_json:
                import json
                cred_dict = json.loads(cred_json)
                cred = firebase_admin.credentials.Certificate(cred_dict)
                self._firebase_app = firebase_admin.initialize_app(cred)
                self._fcm_available = True
                logger.info("Firebase initialized from JSON credentials")
            elif cred_path and os.path.exists(cred_path):
                cred = firebase_admin.credentials.Certificate(cred_path)
                self._firebase_app = firebase_admin.initialize_app(cred)
                self._fcm_available = True
                logger.info("Firebase initialized from credentials file")
            else:
                logger.warning("Firebase credentials not found - push notifications disabled")
                
            self._messaging = messaging if self._fcm_available else None
            
        except ImportError:
            logger.warning("firebase-admin not installed - push notifications disabled")
        except Exception as e:
            logger.error(f"Firebase initialization error: {e}")
    
    def register_device(
        self,
        user_id: str,
        token: str,
        platform: str,
        device_id: str = None,
        device_name: str = None
    ) -> bool:
        """
        Register a device token for push notifications.
        
        Args:
            user_id: User ID
            token: Device push token
            platform: Platform (ios, android, web)
            device_id: Optional device identifier
            device_name: Optional device name
            
        Returns:
            True if registration successful
        """
        device_token = DeviceToken(
            user_id=user_id,
            token=token,
            platform=platform.lower(),
            device_id=device_id,
            device_name=device_name
        )
        
        if user_id not in self._tokens:
            self._tokens[user_id] = []
        
        # Check if token already exists
        for existing in self._tokens[user_id]:
            if existing.token == token:
                existing.last_used = datetime.utcnow()
                existing.is_active = True
                return True
        
        self._tokens[user_id].append(device_token)
        logger.info(f"Registered device for user {user_id} on {platform}")
        
        return True
    
    def unregister_device(self, user_id: str, token: str) -> bool:
        """
        Unregister a device token.
        
        Args:
            user_id: User ID
            token: Device push token
            
        Returns:
            True if unregistration successful
        """
        if user_id in self._tokens:
            for device in self._tokens[user_id]:
                if device.token == token:
                    device.is_active = False
                    logger.info(f"Unregistered device for user {user_id}")
                    return True
        return False
    
    async def send_notification(
        self,
        user_id: str,
        notification: PushNotification
    ) -> Dict[str, Any]:
        """
        Send notification to all devices of a user.
        
        Args:
            user_id: Target user ID
            notification: Notification to send
            
        Returns:
            Delivery result with success count
        """
        devices = self._get_active_devices(user_id)
        
        if not devices:
            logger.warning(f"No active devices for user {user_id}")
            return {
                "success": False,
                "message": "No active devices",
                "sent_count": 0
            }
        
        results = []
        success_count = 0
        
        for device in devices:
            try:
                result = await self._send_to_device(device, notification)
                results.append({
                    "device_id": device.device_id,
                    "platform": device.platform,
                    "success": result
                })
                if result:
                    success_count += 1
            except Exception as e:
                logger.error(f"Failed to send to device {device.device_id}: {e}")
                results.append({
                    "device_id": device.device_id,
                    "platform": device.platform,
                    "success": False,
                    "error": str(e)
                })
        
        return {
            "success": success_count > 0,
            "sent_count": success_count,
            "total_devices": len(devices),
            "results": results
        }
    
    async def send_batch_notifications(
        self,
        user_ids: List[str],
        notification: PushNotification
    ) -> Dict[str, Any]:
        """
        Send notification to multiple users.
        
        Args:
            user_ids: List of user IDs
            notification: Notification to send
            
        Returns:
            Batch delivery results
        """
        results = []
        success_count = 0
        
        for user_id in user_ids:
            result = await self.send_notification(user_id, notification)
            results.append({
                "user_id": user_id,
                "success": result["success"],
                "sent_count": result["sent_count"]
            })
            if result["success"]:
                success_count += 1
        
        return {
            "total_users": len(user_ids),
            "successful_deliveries": success_count,
            "results": results
        }
    
    async def send_trip_reminder(
        self,
        user_id: str,
        trip_id: str,
        destination: str,
        days_until: int
    ) -> Dict[str, Any]:
        """Send trip reminder notification."""
        notification = PushNotification(
            title=f"Trip to {destination} coming up!",
            body=f"Your trip is in {days_until} days. Don't forget to check your itinerary!",
            notification_type=NotificationType.TRIP_REMINDER,
            priority=NotificationPriority.HIGH,
            data={
                "trip_id": trip_id,
                "destination": destination,
                "days_until": str(days_until)
            }
        )
        
        return await self.send_notification(user_id, notification)
    
    async def send_price_alert(
        self,
        user_id: str,
        destination: str,
        old_price: float,
        new_price: float,
        currency: str = "USD"
    ) -> Dict[str, Any]:
        """Send price drop alert."""
        drop_percent = round(((old_price - new_price) / old_price) * 100, 1)
        
        notification = PushNotification(
            title=f"Price Drop: {destination} 🔥",
            body=f"Prices dropped by {drop_percent}%! Now {currency} {new_price:.0f} (was {old_price:.0f})",
            notification_type=NotificationType.PRICE_ALERT,
            priority=NotificationPriority.HIGH,
            data={
                "destination": destination,
                "old_price": str(old_price),
                "new_price": str(new_price),
                "currency": currency
            }
        )
        
        return await self.send_notification(user_id, notification)
    
    async def send_trip_invitation(
        self,
        user_id: str,
        trip_id: str,
        trip_name: str,
        inviter_name: str
    ) -> Dict[str, Any]:
        """Send trip invitation notification."""
        notification = PushNotification(
            title=f"You're invited! ✈️",
            body=f"{inviter_name} invited you to join their trip: {trip_name}",
            notification_type=NotificationType.TRIP_INVITATION,
            priority=NotificationPriority.HIGH,
            data={
                "trip_id": trip_id,
                "trip_name": trip_name,
                "inviter_name": inviter_name
            }
        )
        
        return await self.send_notification(user_id, notification)
    
    async def send_chat_message(
        self,
        user_id: str,
        trip_id: str,
        sender_name: str,
        message_preview: str
    ) -> Dict[str, Any]:
        """Send chat message notification."""
        notification = PushNotification(
            title=sender_name,
            body=message_preview[:100],  # Truncate for preview
            notification_type=NotificationType.CHAT_MESSAGE,
            data={
                "trip_id": trip_id,
                "sender_name": sender_name
            }
        )
        
        return await self.send_notification(user_id, notification)
    
    def _get_active_devices(self, user_id: str) -> List[DeviceToken]:
        """Get active devices for a user."""
        devices = self._tokens.get(user_id, [])
        return [d for d in devices if d.is_active]
    
    async def _send_to_device(
        self,
        device: DeviceToken,
        notification: PushNotification
    ) -> bool:
        """Send notification to a specific device."""
        if not self._fcm_available:
            logger.warning("FCM not available - simulating notification send")
            return True
        
        try:
            from firebase_admin import messaging
            
            # Build FCM message
            fcm_payload = notification.to_fcm_payload(device.token)
            
            message = messaging.Message(
                token=device.token,
                notification=messaging.Notification(
                    title=notification.title,
                    body=notification.body,
                    image=notification.image
                ),
                data={k: str(v) for k, v in notification.data.items()},
                android=messaging.AndroidConfig(
                    priority="high" if notification.priority == NotificationPriority.HIGH else "normal",
                    notification=messaging.AndroidNotification(
                        sound=notification.sound,
                        channel_id="travel_updates"
                    )
                ),
                apns=messaging.APNSConfig(
                    headers={
                        "apns-priority": "10" if notification.priority == NotificationPriority.HIGH else "5"
                    },
                    payload=messaging.APNSPayload(
                        aps=messaging.Aps(
                            alert=messaging.ApsAlert(
                                title=notification.title,
                                body=notification.body
                            ),
                            sound=notification.sound,
                            badge=notification.badge
                        )
                    )
                )
            )
            
            # Send the message
            response = self._messaging.send(message)
            logger.info(f"Successfully sent message to {device.device_id}: {response}")
            
            # Update last used
            device.last_used = datetime.utcnow()
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to send FCM message: {e}")
            
            # Check if token is invalid
            if "invalid-registration-token" in str(e).lower() or "not-registered" in str(e).lower():
                device.is_active = False
                logger.warning(f"Token for device {device.device_id} is invalid, deactivated")
            
            return False


# Singleton instance
push_notification_service = PushNotificationService()