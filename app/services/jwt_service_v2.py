"""
Production-Grade JWT Authentication Service

Features:
- Short-lived access tokens (15 min default)
- Long-lived refresh tokens (7 days default)
- Token rotation on refresh (old refresh token invalidated)
- Redis-backed blacklisting
- Device fingerprinting
- Session management
- Rate limiting
"""

import jwt
import secrets
import hashlib
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any, List
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)

# ============================================================================
# CONFIGURATION
# ============================================================================


class JWTConfig:
    """JWT Configuration from environment variables"""

    # Secret key MUST come from environment (256-bit minimum)
    SECRET_KEY: str = os.environ.get("JWT_SECRET_KEY", "")

    # Token lifetimes
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(
        os.environ.get("ACCESS_TOKEN_EXPIRE_MINUTES", "15")
    )
    REFRESH_TOKEN_EXPIRE_DAYS: int = int(
        os.environ.get("REFRESH_TOKEN_EXPIRE_DAYS", "7")
    )

    # Algorithm
    ALGORITHM: str = "HS256"

    # Issuer and Audience
    ISSUER: str = os.environ.get("APP_NAME", "timetravel-api")
    AUDIENCE: str = os.environ.get("APP_NAME", "timetravel-app")

    @classmethod
    def validate(cls):
        """Validate configuration"""
        if not cls.SECRET_KEY:
            # Generate a stable secret for development / testing
            env = os.environ.get("FLASK_ENV", "")
            if env in ("development", "testing") or os.environ.get("TESTING"):
                cls.SECRET_KEY = "dev-secret-key-change-in-production-min-32-chars!"
                logger.warning(
                    "Using development JWT secret. Set JWT_SECRET_KEY in production!"
                )
            else:
                raise ValueError(
                    "JWT_SECRET_KEY environment variable is required in production"
                )
        if len(cls.SECRET_KEY) < 32:
            raise ValueError("JWT_SECRET_KEY must be at least 32 characters")


class TokenType(Enum):
    ACCESS = "access"
    REFRESH = "refresh"


@dataclass
class TokenPair:
    """Access and refresh token pair"""

    access_token: str
    refresh_token: str
    token_type: str = "Bearer"
    expires_in: int = 15 * 60  # 15 minutes in seconds


# ============================================================================
# REDIS TOKEN STORE (with fallback to in-memory for development)
# ============================================================================


class TokenStore:
    """
    Token storage interface with Redis support and in-memory fallback.
    """

    def __init__(self, redis_url: str = None):
        self.redis_url = redis_url or os.environ.get("REDIS_URL", "")
        self._redis = None
        self._use_memory = False

        # In-memory fallback
        self._blacklist: Dict[str, float] = {}  # jti -> expiry
        self._sessions: Dict[str, Dict[str, Any]] = {}  # session_id -> data
        self._user_sessions: Dict[str, set] = {}  # user_id -> set of session_ids

    def _get_redis(self):
        """Lazy Redis connection with fallback"""
        if self._redis is None and self.redis_url and not self._use_memory:
            try:
                import redis

                pool = redis.ConnectionPool.from_url(
                    self.redis_url,
                    max_connections=10,
                    decode_responses=True,
                    socket_connect_timeout=3,
                    socket_timeout=3,
                )
                self._redis = redis.Redis(connection_pool=pool)
                self._redis.ping()
                logger.info("Connected to Redis for token storage (pool max 10)")
            except Exception as e:
                logger.critical(
                    f"Redis connection failed — blacklist degraded to in-memory (not shared across workers): {e}"
                )
                self._use_memory = True
                self._redis = None
        return self._redis

    # -------------------------------------------------------------------------
    # Blacklist Operations
    # -------------------------------------------------------------------------

    def blacklist_token(self, jti: str, expires_in: int) -> bool:
        """Add token to blacklist"""
        redis = self._get_redis()
        if redis:
            key = f"blacklist:{jti}"
            return redis.setex(key, expires_in, "1")
        else:
            self._blacklist[jti] = datetime.now(timezone.utc).timestamp() + expires_in
            return True

    def is_blacklisted(self, jti: str) -> bool:
        """Check if token is blacklisted"""
        redis = self._get_redis()
        if redis:
            key = f"blacklist:{jti}"
            return redis.exists(key) > 0
        else:
            # Clean expired entries
            now = datetime.now(timezone.utc).timestamp()
            expired = [j for j, exp in self._blacklist.items() if exp < now]
            for j in expired:
                del self._blacklist[j]
            return jti in self._blacklist

    # -------------------------------------------------------------------------
    # Refresh Token Operations
    # -------------------------------------------------------------------------

    def store_refresh_token(
        self,
        user_id: str,
        token_hash: str,
        session_id: str,
        device_id: str,
        expires_in: int,
    ) -> bool:
        """Store refresh token metadata"""
        redis = self._get_redis()

        if redis:
            # Add session to user's sessions
            redis.sadd(f"sessions:{user_id}", session_id)

            # Store session metadata
            session_data = {
                "token_hash": token_hash,
                "device_id": device_id,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }

            pipe = redis.pipeline()
            pipe.hset(f"session:{session_id}", mapping=session_data)
            pipe.expire(f"session:{session_id}", expires_in)
            pipe.expire(f"sessions:{user_id}", expires_in)
            pipe.execute()
        else:
            # In-memory storage
            if user_id not in self._user_sessions:
                self._user_sessions[user_id] = set()
            self._user_sessions[user_id].add(session_id)
            self._sessions[session_id] = {
                "token_hash": token_hash,
                "device_id": device_id,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "user_id": user_id,
                "expires_at": datetime.now(timezone.utc).timestamp() + expires_in,
            }

        return True

    def get_session(self, session_id: str) -> Optional[Dict[str, str]]:
        """Get session metadata"""
        redis = self._get_redis()

        if redis:
            return redis.hgetall(f"session:{session_id}")
        else:
            session = self._sessions.get(session_id)
            if session:
                # Check expiry
                if (
                    session.get("expires_at", 0)
                    < datetime.now(timezone.utc).timestamp()
                ):
                    del self._sessions[session_id]
                    return None
                return {k: v for k, v in session.items() if k != "expires_at"}
            return None

    def revoke_session(self, user_id: str, session_id: str) -> bool:
        """Revoke a specific session"""
        redis = self._get_redis()

        if redis:
            pipe = redis.pipeline()
            pipe.delete(f"session:{session_id}")
            pipe.srem(f"sessions:{user_id}", session_id)
            pipe.execute()
        else:
            self._sessions.pop(session_id, None)
            if user_id in self._user_sessions:
                self._user_sessions[user_id].discard(session_id)

        return True

    def revoke_all_sessions(self, user_id: str) -> int:
        """Revoke all sessions for a user"""
        redis = self._get_redis()

        if redis:
            sessions = redis.smembers(f"sessions:{user_id}")
            if not sessions:
                return 0

            pipe = redis.pipeline()
            for session_id in sessions:
                pipe.delete(f"session:{session_id}")
            pipe.delete(f"sessions:{user_id}")
            pipe.execute()

            return len(sessions)
        else:
            sessions = self._user_sessions.get(user_id, set())
            count = len(sessions)
            for sid in list(sessions):
                self._sessions.pop(sid, None)
            self._user_sessions[user_id] = set()
            return count

    def get_user_sessions(self, user_id: str) -> List[str]:
        """Get all session IDs for a user"""
        redis = self._get_redis()

        if redis:
            return list(redis.smembers(f"sessions:{user_id}"))
        else:
            # Clean expired
            now = datetime.now(timezone.utc).timestamp()
            for sid in list(self._sessions.keys()):
                if self._sessions[sid].get("expires_at", 0) < now:
                    del self._sessions[sid]
            return list(self._user_sessions.get(user_id, set()))


# ============================================================================
# JWT SERVICE
# ============================================================================


class JWTServiceV2:
    """
    Production-Grade JWT Service.

    Features:
    - Short-lived access tokens (15 min default)
    - Long-lived refresh tokens (7 days default)
    - Token rotation on refresh (old refresh token invalidated)
    - Redis-backed blacklisting
    - Device fingerprinting
    - Session management
    """

    def __init__(self, token_store: TokenStore = None):
        # Validate configuration
        JWTConfig.validate()

        self.secret_key = JWTConfig.SECRET_KEY
        self.algorithm = JWTConfig.ALGORITHM
        self.token_store = token_store or TokenStore()

    # -------------------------------------------------------------------------
    # Token Generation
    # -------------------------------------------------------------------------

    def create_access_token(
        self,
        user_id: str,
        email: str,
        session_id: str,
        device_id: Optional[str] = None,
        additional_claims: Optional[Dict[str, Any]] = None,
    ) -> str:
        """Create a new access token"""
        now = datetime.now(timezone.utc)
        expire = now + timedelta(minutes=JWTConfig.ACCESS_TOKEN_EXPIRE_MINUTES)

        payload = {
            "sub": user_id,
            "email": email,
            "type": TokenType.ACCESS.value,
            "jti": secrets.token_urlsafe(16),
            "iat": int(now.timestamp()),
            "exp": int(expire.timestamp()),
            "iss": JWTConfig.ISSUER,
            "aud": JWTConfig.AUDIENCE,
            "sid": session_id,
        }

        if device_id:
            payload["device_id"] = device_id

        if additional_claims:
            payload.update(additional_claims)

        return jwt.encode(payload, self.secret_key, algorithm=self.algorithm)

    def create_refresh_token(
        self, user_id: str, email: str, session_id: str, device_id: Optional[str] = None
    ) -> str:
        """Create a new refresh token and store it"""
        now = datetime.now(timezone.utc)
        expire = now + timedelta(days=JWTConfig.REFRESH_TOKEN_EXPIRE_DAYS)

        jti = secrets.token_urlsafe(32)  # Longer for refresh tokens

        payload = {
            "sub": user_id,
            "email": email,
            "type": TokenType.REFRESH.value,
            "jti": jti,
            "iat": int(now.timestamp()),
            "exp": int(expire.timestamp()),
            "iss": JWTConfig.ISSUER,
            "aud": JWTConfig.AUDIENCE,
            "sid": session_id,
        }

        if device_id:
            payload["device_id"] = device_id

        token = jwt.encode(payload, self.secret_key, algorithm=self.algorithm)

        # Store token hash
        token_hash = self._hash_token(token)
        expires_in = JWTConfig.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60

        self.token_store.store_refresh_token(
            user_id=user_id,
            token_hash=token_hash,
            session_id=session_id,
            device_id=device_id or "unknown",
            expires_in=expires_in,
        )

        return token

    def create_token_pair(
        self,
        user_id: str,
        email: str,
        device_id: Optional[str] = None,
        additional_claims: Optional[Dict[str, Any]] = None,
    ) -> TokenPair:
        """Create both access and refresh tokens"""
        session_id = secrets.token_urlsafe(16)

        access_token = self.create_access_token(
            user_id=user_id,
            email=email,
            session_id=session_id,
            device_id=device_id,
            additional_claims=additional_claims,
        )

        refresh_token = self.create_refresh_token(
            user_id=user_id, email=email, session_id=session_id, device_id=device_id
        )

        return TokenPair(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=JWTConfig.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )

    # -------------------------------------------------------------------------
    # Token Verification
    # -------------------------------------------------------------------------

    def verify_token(
        self, token: str, expected_type: TokenType = TokenType.ACCESS
    ) -> Optional[Dict[str, Any]]:
        """Verify and decode a JWT token"""
        try:
            payload = jwt.decode(
                token,
                self.secret_key,
                algorithms=[self.algorithm],
                issuer=JWTConfig.ISSUER,
                audience=JWTConfig.AUDIENCE,
                options={
                    "verify_exp": True,
                    "verify_iat": True,
                    "verify_iss": True,
                    "verify_aud": True,
                },
            )

            # Verify token type
            token_type = payload.get("type")
            if token_type != expected_type.value:
                logger.warning(
                    f"Token type mismatch: expected {expected_type.value}, got {token_type}"
                )
                return None

            # Check blacklist
            jti = payload.get("jti")
            if self.token_store.is_blacklisted(jti):
                logger.warning(f"Attempted use of blacklisted token: {jti[:8]}...")
                return None

            return payload

        except jwt.ExpiredSignatureError:
            logger.info("Token has expired")
            return None
        except jwt.InvalidIssuerError:
            logger.warning("Invalid token issuer")
            return None
        except jwt.InvalidAudienceError:
            logger.warning("Invalid token audience")
            return None
        except jwt.InvalidTokenError as e:
            logger.warning(f"Invalid token: {e}")
            return None

    # -------------------------------------------------------------------------
    # Token Refresh (with rotation)
    # -------------------------------------------------------------------------

    def refresh_tokens(
        self, refresh_token: str, device_id: Optional[str] = None
    ) -> Optional[TokenPair]:
        """
        Create new token pair from refresh token.

        IMPORTANT: Implements token rotation!
        - Old refresh token is invalidated
        - New access + refresh tokens are issued
        - Same session ID is maintained
        """
        payload = self.verify_token(refresh_token, TokenType.REFRESH)

        if not payload:
            return None

        user_id = payload.get("sub")
        email = payload.get("email")
        session_id = payload.get("sid")
        old_jti = payload.get("jti")

        if not all([user_id, email, session_id]):
            return None

        # Verify the stored token hash matches
        session = self.token_store.get_session(session_id)
        if not session:
            logger.warning(f"Session not found: {session_id[:8]}...")
            return None

        # Verify token hash (prevents token substitution)
        token_hash = self._hash_token(refresh_token)
        if session.get("token_hash") != token_hash:
            logger.warning("Token hash mismatch - potential token theft")
            self.token_store.revoke_all_sessions(user_id)
            return None

        # Blacklist the old refresh token's JTI
        ttl = JWTConfig.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60
        self.token_store.blacklist_token(old_jti, ttl)

        # Create new token pair with SAME session ID
        new_access_token = self.create_access_token(
            user_id=user_id, email=email, session_id=session_id, device_id=device_id
        )

        new_refresh_token = self.create_refresh_token(
            user_id=user_id, email=email, session_id=session_id, device_id=device_id
        )

        return TokenPair(
            access_token=new_access_token,
            refresh_token=new_refresh_token,
            expires_in=JWTConfig.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )

    # -------------------------------------------------------------------------
    # Logout & Revocation
    # -------------------------------------------------------------------------

    def logout(self, access_token: str, logout_all_devices: bool = False) -> bool:
        """Logout user by invalidating tokens"""
        payload = self.verify_token(access_token, TokenType.ACCESS)

        if not payload:
            return False

        user_id = payload.get("sub")
        jti = payload.get("jti")
        session_id = payload.get("sid")

        # Blacklist the access token
        ttl = JWTConfig.ACCESS_TOKEN_EXPIRE_MINUTES * 60
        self.token_store.blacklist_token(jti, ttl)

        if logout_all_devices:
            count = self.token_store.revoke_all_sessions(user_id)
            logger.info(f"Logged out user {user_id} from {count} devices")
        else:
            self.token_store.revoke_session(user_id, session_id)
            logger.info(f"Logged out user {user_id} from session {session_id[:8]}...")

        return True

    # -------------------------------------------------------------------------
    # Session Management
    # -------------------------------------------------------------------------

    def get_active_sessions(self, user_id: str) -> List[Dict[str, Any]]:
        """Get all active sessions for a user"""
        session_ids = self.token_store.get_user_sessions(user_id)
        sessions = []

        for sid in session_ids:
            session = self.token_store.get_session(sid)
            if session:
                session["session_id"] = sid
                sessions.append(session)

        return sessions

    def revoke_session(self, user_id: str, session_id: str) -> bool:
        """Revoke a specific session"""
        return self.token_store.revoke_session(user_id, session_id)

    # -------------------------------------------------------------------------
    # Utilities
    # -------------------------------------------------------------------------

    def _hash_token(self, token: str) -> str:
        """Create SHA-256 hash of token for storage"""
        return hashlib.sha256(token.encode()).hexdigest()

    def decode_token_unsafe(self, token: str) -> Optional[Dict[str, Any]]:
        """Decode token without verification (for debugging only).

        WARNING: Never call this in production code paths.
        """
        logger.warning(
            "decode_token_unsafe called - this bypasses signature verification"
        )
        try:
            return jwt.decode(token, options={"verify_signature": False})
        except Exception:
            return None


# Singleton instance
jwt_service_v2 = JWTServiceV2()
