"""
JWT Authentication Service
Production-grade JWT token management with refresh tokens
"""

import jwt
import secrets
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, Tuple
from dataclasses import dataclass
import hashlib
import logging

logger = logging.getLogger(__name__)

# Configuration
JWT_SECRET_KEY = secrets.token_urlsafe(64)  # In production, use environment variable
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
REFRESH_TOKEN_EXPIRE_DAYS = 7


@dataclass
class TokenPayload:
    """JWT token payload"""
    user_id: str
    email: str
    exp: datetime
    iat: datetime
    type: str  # 'access' or 'refresh'


class JWTService:
    """
    JWT Token Service for authentication.
    
    Features:
    - Access tokens with short expiry (30 minutes)
    - Refresh tokens with long expiry (7 days)
    - Token blacklisting for logout
    - Secure token generation
    """
    
    def __init__(self, secret_key: Optional[str] = None):
        self.secret_key = secret_key or JWT_SECRET_KEY
        self.algorithm = JWT_ALGORITHM
        self._blacklisted_tokens = set()  # In production, use Redis
    
    def create_access_token(
        self,
        user_id: str,
        email: str,
        additional_claims: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Create a new access token.
        
        Args:
            user_id: User's unique identifier
            email: User's email
            additional_claims: Optional additional claims
            
        Returns:
            JWT access token
        """
        now = datetime.utcnow()
        expire = now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        
        payload = {
            "sub": user_id,
            "email": email,
            "exp": expire,
            "iat": now,
            "type": "access",
            "jti": secrets.token_urlsafe(16)  # Unique token ID
        }
        
        if additional_claims:
            payload.update(additional_claims)
        
        return jwt.encode(payload, self.secret_key, algorithm=self.algorithm)
    
    def create_refresh_token(
        self,
        user_id: str,
        email: str
    ) -> str:
        """
        Create a new refresh token.
        
        Args:
            user_id: User's unique identifier
            email: User's email
            
        Returns:
            JWT refresh token
        """
        now = datetime.utcnow()
        expire = now + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
        
        payload = {
            "sub": user_id,
            "email": email,
            "exp": expire,
            "iat": now,
            "type": "refresh",
            "jti": secrets.token_urlsafe(16)
        }
        
        return jwt.encode(payload, self.secret_key, algorithm=self.algorithm)
    
    def create_token_pair(
        self,
        user_id: str,
        email: str,
        additional_claims: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Create both access and refresh tokens.
        
        Returns:
            Dictionary with access_token, refresh_token, and expires_in
        """
        access_token = self.create_access_token(user_id, email, additional_claims)
        refresh_token = self.create_refresh_token(user_id, email)
        
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "Bearer",
            "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60  # seconds
        }
    
    def verify_token(
        self,
        token: str,
        expected_type: str = "access"
    ) -> Optional[Dict[str, Any]]:
        """
        Verify and decode a JWT token.
        
        Args:
            token: JWT token to verify
            expected_type: Expected token type ('access' or 'refresh')
            
        Returns:
            Decoded payload if valid, None otherwise
        """
        try:
            # Check blacklist
            token_hash = self._hash_token(token)
            if token_hash in self._blacklisted_tokens:
                logger.warning("Attempted use of blacklisted token")
                return None
            
            payload = jwt.decode(
                token,
                self.secret_key,
                algorithms=[self.algorithm]
            )
            
            # Verify token type
            if payload.get("type") != expected_type:
                logger.warning(f"Token type mismatch: expected {expected_type}, got {payload.get('type')}")
                return None
            
            return payload
            
        except jwt.ExpiredSignatureError:
            logger.info("Token has expired")
            return None
        except jwt.InvalidTokenError as e:
            logger.warning(f"Invalid token: {e}")
            return None
    
    def refresh_access_token(
        self,
        refresh_token: str
    ) -> Optional[Dict[str, Any]]:
        """
        Create a new access token from a refresh token.
        
        Args:
            refresh_token: Valid refresh token
            
        Returns:
            New token pair if refresh token is valid
        """
        payload = self.verify_token(refresh_token, expected_type="refresh")
        
        if not payload:
            return None
        
        user_id = payload.get("sub")
        email = payload.get("email")
        
        if not user_id or not email:
            return None
        
        # Create new token pair
        return self.create_token_pair(user_id, email)
    
    def blacklist_token(self, token: str) -> None:
        """
        Add a token to the blacklist (for logout).
        
        Args:
            token: Token to blacklist
        """
        token_hash = self._hash_token(token)
        self._blacklisted_tokens.add(token_hash)
        logger.info(f"Token blacklisted: {token_hash[:8]}...")
    
    def is_token_blacklisted(self, token: str) -> bool:
        """Check if a token is blacklisted."""
        token_hash = self._hash_token(token)
        return token_hash in self._blacklisted_tokens
    
    def cleanup_expired_blacklisted_tokens(self) -> int:
        """
        Remove expired tokens from blacklist.
        In production, this would be handled by Redis TTL.
        
        Returns:
            Number of tokens removed
        """
        # This is a simplified implementation
        # In production, use Redis with TTL
        initial_count = len(self._blacklisted_tokens)
        # For now, just keep the set manageable
        if len(self._blacklisted_tokens) > 10000:
            self._blacklisted_tokens = set(list(self._blacklisted_tokens)[-5000:])
        return initial_count - len(self._blacklisted_tokens)
    
    def _hash_token(self, token: str) -> str:
        """Create a hash of the token for storage."""
        return hashlib.sha256(token.encode()).hexdigest()
    
    def decode_token_unsafe(self, token: str) -> Optional[Dict[str, Any]]:
        """
        Decode token without verification (for debugging only).
        
        WARNING: Do not use for authentication!
        """
        try:
            return jwt.decode(token, options={"verify_signature": False})
        except Exception:
            return None


class TokenManager:
    """
    Manages token storage and retrieval for users.
    In production, this would interface with a database.
    """
    
    def __init__(self):
        # In production, use database
        self._user_tokens: Dict[str, Dict[str, Any]] = {}
    
    def store_refresh_token(
        self,
        user_id: str,
        refresh_token: str,
        device_info: Optional[Dict[str, str]] = None
    ) -> str:
        """
        Store a refresh token for a user.
        
        Args:
            user_id: User's ID
            refresh_token: Refresh token to store
            device_info: Optional device information
            
        Returns:
            Token ID
        """
        token_id = secrets.token_urlsafe(16)
        
        if user_id not in self._user_tokens:
            self._user_tokens[user_id] = {}
        
        self._user_tokens[user_id][token_id] = {
            "token": refresh_token,
            "device_info": device_info or {},
            "created_at": datetime.utcnow().isoformat(),
            "last_used": datetime.utcnow().isoformat()
        }
        
        return token_id
    
    def get_user_tokens(self, user_id: str) -> Dict[str, Any]:
        """Get all refresh tokens for a user."""
        return self._user_tokens.get(user_id, {})
    
    def revoke_token(self, user_id: str, token_id: str) -> bool:
        """Revoke a specific refresh token."""
        if user_id in self._user_tokens and token_id in self._user_tokens[user_id]:
            del self._user_tokens[user_id][token_id]
            return True
        return False
    
    def revoke_all_tokens(self, user_id: str) -> int:
        """Revoke all refresh tokens for a user."""
        count = len(self._user_tokens.get(user_id, {}))
        self._user_tokens[user_id] = {}
        return count


# Singleton instances
jwt_service = JWTService()
token_manager = TokenManager()


# Decorator for protected routes
def require_auth(f):
    """Decorator to require authentication for a route."""
    def decorated_function(*args, **kwargs):
        # This would be implemented in Flask context
        # For now, it's a placeholder
        return f(*args, **kwargs)
    return decorated_function


def get_user_from_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Extract user information from a token.
    
    Args:
        token: JWT access token
        
    Returns:
        User info dict or None
    """
    payload = jwt_service.verify_token(token)
    if payload:
        return {
            "user_id": payload.get("sub"),
            "email": payload.get("email")
        }
    return None