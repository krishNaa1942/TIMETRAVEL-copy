"""
WebSocket Service
Production-grade real-time communication service
"""

import os
import json
import logging
import asyncio
import threading
from typing import Dict, List, Set, Any, Optional, Callable
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
import uuid

logger = logging.getLogger(__name__)


class MessageType(Enum):
    """WebSocket message types"""
    # Connection
    CONNECT = "connect"
    DISCONNECT = "disconnect"
    PING = "ping"
    PONG = "pong"
    
    # Trip updates
    TRIP_CREATED = "trip_created"
    TRIP_UPDATED = "trip_updated"
    TRIP_DELETED = "trip_deleted"
    TRIP_SHARED = "trip_shared"
    
    # Price alerts
    PRICE_DROP = "price_drop"
    PRICE_ALERT = "price_alert"
    
    # Notifications
    NOTIFICATION = "notification"
    INSIGHT = "insight"
    
    # Chat
    CHAT_MESSAGE = "chat_message"
    CHAT_TYPING = "chat_typing"
    
    # Collaboration
    COLLABORATOR_JOINED = "collaborator_joined"
    COLLABORATOR_LEFT = "collaborator_left"
    CURSOR_UPDATE = "cursor_update"
    
    # System
    ERROR = "error"
    ACK = "ack"


@dataclass
class WebSocketMessage:
    """WebSocket message structure"""
    type: MessageType
    payload: Dict[str, Any]
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    message_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    
    def to_json(self) -> str:
        return json.dumps({
            "type": self.type.value,
            "payload": self.payload,
            "timestamp": self.timestamp.isoformat(),
            "message_id": self.message_id
        })
    
    @classmethod
    def from_json(cls, data: str) -> 'WebSocketMessage':
        parsed = json.loads(data)
        return cls(
            type=MessageType(parsed["type"]),
            payload=parsed["payload"],
            timestamp=datetime.fromisoformat(parsed["timestamp"]),
            message_id=parsed["message_id"]
        )


@dataclass
class ConnectedClient:
    """Connected WebSocket client"""
    client_id: str
    user_id: str
    connection: Any  # WebSocket connection object
    rooms: Set[str] = field(default_factory=set)
    connected_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    last_activity: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    metadata: Dict[str, Any] = field(default_factory=dict)


class WebSocketService:
    """
    Production-grade WebSocket service for real-time features.
    
    Features:
    - Connection management with rooms
    - Message broadcasting
    - User presence tracking
    - Trip collaboration
    - Price alerts
    - Typing indicators
    """
    
    def __init__(self):
        """Initialize WebSocket service."""
        # Client connections by client_id
        self._clients: Dict[str, ConnectedClient] = {}
        
        # User connections by user_id (one user can have multiple connections)
        self._user_connections: Dict[str, Set[str]] = {}
        
        # Room membership (room_id -> set of client_ids)
        self._rooms: Dict[str, Set[str]] = {}
        
        # Message handlers
        self._handlers: Dict[MessageType, List[Callable]] = {}
        
        # Background tasks
        self._running = False
        self._heartbeat_interval = 30  # seconds
        
        # Lock for thread safety
        self._lock = threading.RLock()
        
        logger.info("WebSocket service initialized")
    
    async def connect(self, user_id: str, connection: Any, metadata: Dict = None) -> str:
        """
        Register a new WebSocket connection.
        
        Args:
            user_id: User ID
            connection: WebSocket connection object
            metadata: Optional connection metadata
            
        Returns:
            Client ID for the connection
        """
        client_id = str(uuid.uuid4())
        
        with self._lock:
            client = ConnectedClient(
                client_id=client_id,
                user_id=user_id,
                connection=connection,
                metadata=metadata or {}
            )
            
            self._clients[client_id] = client
            
            if user_id not in self._user_connections:
                self._user_connections[user_id] = set()
            self._user_connections[user_id].add(client_id)
        
        # Send connection acknowledgment
        await self._send_to_client(client_id, WebSocketMessage(
            type=MessageType.CONNECT,
            payload={"client_id": client_id, "user_id": user_id}
        ))
        
        logger.info(f"Client {client_id} connected for user {user_id}")
        return client_id
    
    async def disconnect(self, client_id: str):
        """
        Handle client disconnection.
        
        Args:
            client_id: Client ID to disconnect
        """
        with self._lock:
            client = self._clients.get(client_id)
            if not client:
                return
            
            # Remove from all rooms
            for room_id in client.rooms:
                if room_id in self._rooms:
                    self._rooms[room_id].discard(client_id)
                    if not self._rooms[room_id]:
                        del self._rooms[room_id]
            
            # Remove from user connections
            if client.user_id in self._user_connections:
                self._user_connections[client.user_id].discard(client_id)
                if not self._user_connections[client.user_id]:
                    del self._user_connections[client.user_id]
            
            # Remove client
            del self._clients[client_id]
        
        logger.info(f"Client {client_id} disconnected")
    
    async def join_room(self, client_id: str, room_id: str):
        """
        Add a client to a room.
        
        Args:
            client_id: Client ID
            room_id: Room to join
        """
        with self._lock:
            client = self._clients.get(client_id)
            if not client:
                return
            
            client.rooms.add(room_id)
            
            if room_id not in self._rooms:
                self._rooms[room_id] = set()
            self._rooms[room_id].add(client_id)
        
        # Notify room members
        await self.broadcast_to_room(room_id, WebSocketMessage(
            type=MessageType.COLLABORATOR_JOINED,
            payload={"user_id": client.user_id, "room_id": room_id}
        ), exclude_client=client_id)
        
        logger.info(f"Client {client_id} joined room {room_id}")
    
    async def leave_room(self, client_id: str, room_id: str):
        """
        Remove a client from a room.
        
        Args:
            client_id: Client ID
            room_id: Room to leave
        """
        with self._lock:
            client = self._clients.get(client_id)
            if not client:
                return
            
            client.rooms.discard(room_id)
            
            if room_id in self._rooms:
                self._rooms[room_id].discard(client_id)
        
        # Notify room members
        await self.broadcast_to_room(room_id, WebSocketMessage(
            type=MessageType.COLLABORATOR_LEFT,
            payload={"user_id": client.user_id, "room_id": room_id}
        ))
        
        logger.info(f"Client {client_id} left room {room_id}")
    
    async def send_to_user(self, user_id: str, message: WebSocketMessage):
        """
        Send a message to all connections of a user.
        
        Args:
            user_id: Target user ID
            message: Message to send
        """
        client_ids = self._user_connections.get(user_id, set()).copy()
        
        for client_id in client_ids:
            await self._send_to_client(client_id, message)
    
    async def broadcast_to_room(
        self,
        room_id: str,
        message: WebSocketMessage,
        exclude_client: str = None
    ):
        """
        Broadcast a message to all clients in a room.
        
        Args:
            room_id: Room to broadcast to
            message: Message to send
            exclude_client: Optional client ID to exclude
        """
        client_ids = self._rooms.get(room_id, set()).copy()
        
        for client_id in client_ids:
            if client_id != exclude_client:
                await self._send_to_client(client_id, message)
    
    async def broadcast_to_all(self, message: WebSocketMessage):
        """
        Broadcast a message to all connected clients.
        
        Args:
            message: Message to send
        """
        client_ids = list(self._clients.keys())
        
        for client_id in client_ids:
            await self._send_to_client(client_id, message)
    
    async def handle_message(self, client_id: str, data: str):
        """
        Handle incoming message from client.
        
        Args:
            client_id: Client ID
            data: Raw message data
        """
        try:
            message = WebSocketMessage.from_json(data)
            
            # Update last activity
            client = self._clients.get(client_id)
            if client:
                client.last_activity = datetime.now(timezone.utc)
            
            # Handle ping/pong
            if message.type == MessageType.PING:
                await self._send_to_client(client_id, WebSocketMessage(
                    type=MessageType.PONG,
                    payload={"timestamp": datetime.now(timezone.utc).isoformat()}
                ))
                return
            
            # Call registered handlers
            handlers = self._handlers.get(message.type, [])
            for handler in handlers:
                try:
                    await handler(client_id, message)
                except Exception as e:
                    logger.error(f"Handler error for {message.type}: {e}")
            
            # Send acknowledgment
            await self._send_to_client(client_id, WebSocketMessage(
                type=MessageType.ACK,
                payload={"message_id": message.message_id}
            ))
            
        except Exception as e:
            logger.error(f"Error handling message from {client_id}: {e}")
            await self._send_to_client(client_id, WebSocketMessage(
                type=MessageType.ERROR,
                payload={"error": str(e)}
            ))
    
    def on_message(self, message_type: MessageType):
        """
        Decorator to register message handlers.
        
        Usage:
            @ws_service.on_message(MessageType.CHAT_MESSAGE)
            async def handle_chat(client_id, message):
                ...
        """
        def decorator(func: Callable):
            if message_type not in self._handlers:
                self._handlers[message_type] = []
            self._handlers[message_type].append(func)
            return func
        return decorator
    
    async def send_trip_update(
        self,
        trip_id: str,
        update_type: MessageType,
        data: Dict[str, Any],
        user_ids: List[str] = None
    ):
        """
        Send trip update to collaborators.
        
        Args:
            trip_id: Trip ID
            update_type: Type of update (TRIP_CREATED, TRIP_UPDATED, etc.)
            data: Update data
            user_ids: Specific users to notify (default: all collaborators)
        """
        room_id = f"trip:{trip_id}"
        message = WebSocketMessage(
            type=update_type,
            payload={"trip_id": trip_id, **data}
        )
        
        if user_ids:
            for user_id in user_ids:
                await self.send_to_user(user_id, message)
        else:
            await self.broadcast_to_room(room_id, message)
    
    async def send_price_alert(
        self,
        user_id: str,
        destination: str,
        old_price: float,
        new_price: float,
        currency: str = "USD"
    ):
        """
        Send price drop alert to user.
        
        Args:
            user_id: User ID
            destination: Destination name
            old_price: Previous price
            new_price: New price
            currency: Currency code
        """
        drop_percent = ((old_price - new_price) / old_price) * 100
        
        message = WebSocketMessage(
            type=MessageType.PRICE_DROP,
            payload={
                "destination": destination,
                "old_price": old_price,
                "new_price": new_price,
                "currency": currency,
                "drop_percent": round(drop_percent, 1)
            }
        )
        
        await self.send_to_user(user_id, message)
    
    async def send_notification(
        self,
        user_id: str,
        title: str,
        body: str,
        data: Dict[str, Any] = None
    ):
        """
        Send notification to user.
        
        Args:
            user_id: User ID
            title: Notification title
            body: Notification body
            data: Additional data
        """
        message = WebSocketMessage(
            type=MessageType.NOTIFICATION,
            payload={
                "title": title,
                "body": body,
                "data": data or {}
            }
        )
        
        await self.send_to_user(user_id, message)
    
    async def send_insight(
        self,
        user_id: str,
        insight_type: str,
        title: str,
        content: str
    ):
        """
        Send AI insight to user.
        
        Args:
            user_id: User ID
            insight_type: Type of insight
            title: Insight title
            content: Insight content
        """
        message = WebSocketMessage(
            type=MessageType.INSIGHT,
            payload={
                "insight_type": insight_type,
                "title": title,
                "content": content
            }
        )
        
        await self.send_to_user(user_id, message)
    
    def get_online_users(self) -> List[str]:
        """Get list of online user IDs."""
        return list(self._user_connections.keys())
    
    def is_user_online(self, user_id: str) -> bool:
        """Check if a user is online."""
        return user_id in self._user_connections
    
    def get_room_users(self, room_id: str) -> List[str]:
        """Get list of user IDs in a room."""
        client_ids = self._rooms.get(room_id, set())
        users = set()
        for client_id in client_ids:
            client = self._clients.get(client_id)
            if client:
                users.add(client.user_id)
        return list(users)
    
    def get_user_rooms(self, user_id: str) -> List[str]:
        """Get rooms a user is in."""
        rooms = set()
        client_ids = self._user_connections.get(user_id, set())
        for client_id in client_ids:
            client = self._clients.get(client_id)
            if client:
                rooms.update(client.rooms)
        return list(rooms)
    
    async def _send_to_client(self, client_id: str, message: WebSocketMessage):
        """Send message to a specific client."""
        client = self._clients.get(client_id)
        if client and client.connection:
            try:
                if hasattr(client.connection, 'send'):
                    await client.connection.send(message.to_json())
                elif hasattr(client.connection, 'send_text'):
                    await client.connection.send_text(message.to_json())
            except Exception as e:
                logger.error(f"Error sending to client {client_id}: {e}")
                # Connection likely broken, schedule cleanup
                await self.disconnect(client_id)
    
    async def start_heartbeat(self):
        """Start heartbeat task to detect stale connections."""
        self._running = True
        
        while self._running:
            try:
                await asyncio.sleep(self._heartbeat_interval)
                
                now = datetime.now(timezone.utc)
                stale_clients = []
                
                with self._lock:
                    for client_id, client in self._clients.items():
                        age = (now - client.last_activity).total_seconds()
                        if age > self._heartbeat_interval * 3:
                            stale_clients.append(client_id)
                
                # Clean up stale connections
                for client_id in stale_clients:
                    logger.info(f"Cleaning up stale client {client_id}")
                    await self.disconnect(client_id)
                    
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Heartbeat error: {e}")
    
    def stop(self):
        """Stop the WebSocket service."""
        self._running = False


# Singleton instance
websocket_service = WebSocketService()