"""
Security Utilities
Production-grade input sanitization, SQL injection prevention, and security helpers
"""

import re
import html
import logging
import secrets
import hashlib
import string
from typing import Any, Dict, List, Callable
from datetime import datetime, timezone
from functools import wraps

logger = logging.getLogger(__name__)


# ============================================================================
# INPUT SANITIZATION
# ============================================================================


class InputSanitizer:
    """
    Input sanitization utilities for preventing XSS and injection attacks.
    """

    # HTML tags that are allowed (whitelist)
    ALLOWED_TAGS = ["b", "i", "u", "strong", "em", "p", "br", "span", "a"]

    # HTML attributes that are allowed
    ALLOWED_ATTRS = ["href", "title", "class"]

    # Dangerous patterns to detect
    DANGEROUS_PATTERNS = [
        # SQL injection patterns
        r"('|(\-\-)|;|(\|\|)|(/\*)|(\*/))",
        r"(union\s+select)",
        r"(insert\s+into)",
        r"(delete\s+from)",
        r"(drop\s+table)",
        r"(exec\s*\()",
        r"(execute\s*\()",
        r"(xp_cmdshell)",
        r"(information_schema)",
        # XSS patterns
        r"<\s*script",
        r"javascript\s*:",
        r"on\w+\s*=",
        r"<\s*iframe",
        r"<\s*object",
        r"<\s*embed",
        r"<\s*form",
        r"expression\s*\(",
        r"<\s*img[^>]+onerror",
        # Path traversal
        r"\.\./",
        r"\.\.\\",
        # Command injection
        r"(\||`|;|\$\(|\$\{)",
        r"(eval\s*\()",
        r"(system\s*\()",
        r"(passthru\s*\()",
        r"(shell_exec\s*\()",
    ]

    @classmethod
    def sanitize_string(
        cls,
        value: str,
        max_length: int = None,
        allow_html: bool = False,
        strip_dangerous: bool = True,
    ) -> str:
        """
        Sanitize a string input.

        Args:
            value: Input string
            max_length: Maximum allowed length
            allow_html: Whether to allow HTML tags
            strip_dangerous: Whether to strip dangerous patterns

        Returns:
            Sanitized string
        """
        if not isinstance(value, str):
            return str(value)

        # Trim whitespace
        result = value.strip()

        # Truncate if needed
        if max_length:
            result = result[:max_length]

        # Handle HTML
        if not allow_html:
            result = html.escape(result)
        else:
            # Strip dangerous HTML but allow safe tags
            result = cls._sanitize_html(result)

        # Strip dangerous patterns
        if strip_dangerous:
            result = cls._strip_dangerous_patterns(result)

        return result

    @classmethod
    def sanitize_dict(
        cls, data: Dict[str, Any], schema: Dict[str, Dict] = None
    ) -> Dict[str, Any]:
        """
        Sanitize a dictionary input.

        Args:
            data: Input dictionary
            schema: Optional schema with field rules

        Returns:
            Sanitized dictionary
        """
        if not isinstance(data, dict):
            return {}

        result = {}

        for key, value in data.items():
            # Sanitize key
            clean_key = cls.sanitize_string(key, max_length=100)

            # Sanitize value based on type
            if isinstance(value, str):
                field_rules = schema.get(key, {}) if schema else {}
                clean_value = cls.sanitize_string(
                    value,
                    max_length=field_rules.get("max_length"),
                    allow_html=field_rules.get("allow_html", False),
                )
            elif isinstance(value, dict):
                clean_value = cls.sanitize_dict(value)
            elif isinstance(value, list):
                clean_value = cls.sanitize_list(value)
            elif isinstance(value, (int, float, bool)):
                clean_value = value
            elif value is None:
                clean_value = None
            else:
                clean_value = cls.sanitize_string(str(value))

            result[clean_key] = clean_value

        return result

    @classmethod
    def sanitize_list(cls, data: List[Any]) -> List[Any]:
        """Sanitize a list input."""
        if not isinstance(data, list):
            return []

        result = []
        for item in data:
            if isinstance(item, str):
                result.append(cls.sanitize_string(item))
            elif isinstance(item, dict):
                result.append(cls.sanitize_dict(item))
            elif isinstance(item, list):
                result.append(cls.sanitize_list(item))
            elif isinstance(item, (int, float, bool, type(None))):
                result.append(item)
            else:
                result.append(cls.sanitize_string(str(item)))

        return result

    @classmethod
    def detect_injection(cls, value: str) -> Dict[str, Any]:
        """
        Detect potential injection attacks in input.

        Args:
            value: Input string to check

        Returns:
            Dictionary with detection results
        """
        if not isinstance(value, str):
            return {"safe": True, "threats": []}

        threats = []

        for pattern in cls.DANGEROUS_PATTERNS:
            matches = re.findall(pattern, value, re.IGNORECASE)
            if matches:
                threats.append(
                    {
                        "pattern": pattern,
                        "matches": matches[:5],  # Limit matches reported
                    }
                )

        return {
            "safe": len(threats) == 0,
            "threats": threats,
            "risk_level": (
                "high" if len(threats) > 2 else "medium" if threats else "low"
            ),
        }

    @classmethod
    def _sanitize_html(cls, html_string: str) -> str:
        """Sanitize HTML allowing only safe tags."""
        # This is a simple implementation - in production use bleach or similar
        result = html_string

        # Remove script tags and content
        result = re.sub(
            r"<\s*script[^>]*>.*?<\s*/\s*script\s*>",
            "",
            result,
            flags=re.IGNORECASE | re.DOTALL,
        )

        # Remove dangerous attributes
        result = re.sub(
            r'\s+on\w+\s*=\s*["\'][^"\']*["\']', "", result, flags=re.IGNORECASE
        )

        # Remove javascript: URLs
        result = re.sub(r"javascript\s*:", "", result, flags=re.IGNORECASE)

        return result

    @classmethod
    def _strip_dangerous_patterns(cls, value: str) -> str:
        """Strip dangerous patterns from value."""
        result = value

        for pattern in cls.DANGEROUS_PATTERNS:
            result = re.sub(pattern, "", result, flags=re.IGNORECASE)

        return result


# ============================================================================
# SQL INJECTION PREVENTION
# ============================================================================


class SQLSanitizer:
    """
    SQL injection prevention utilities.
    """

    # SQL keywords that should be validated
    SQL_KEYWORDS = {
        "SELECT",
        "INSERT",
        "UPDATE",
        "DELETE",
        "DROP",
        "UNION",
        "EXEC",
        "EXECUTE",
        "INFORMATION_SCHEMA",
        "XP_CMDSHELL",
        "TRUNCATE",
        "ALTER",
    }

    # Characters that indicate potential SQL injection
    DANGEROUS_CHARS = {"'", '"', ";", "--", "/*", "*/", "||", "&&"}

    @classmethod
    def validate_identifier(cls, identifier: str) -> bool:
        """
        Validate a SQL identifier (table name, column name).

        Args:
            identifier: SQL identifier to validate

        Returns:
            True if identifier is safe
        """
        if not identifier:
            return False

        # Must be alphanumeric with underscores
        if not re.match(r"^[a-zA-Z_][a-zA-Z0-9_]*$", identifier):
            return False

        # Must not be a SQL keyword
        if identifier.upper() in cls.SQL_KEYWORDS:
            return False

        return True

    @classmethod
    def escape_string(cls, value: str) -> str:
        """
        Escape a string for safe SQL usage.
        Note: Always prefer parameterized queries over escaping!

        Args:
            value: String to escape

        Returns:
            Escaped string
        """
        if not isinstance(value, str):
            return str(value)

        # Replace single quotes with double single quotes
        return value.replace("'", "''")

    @classmethod
    def detect_sql_injection(cls, value: str) -> Dict[str, Any]:
        """
        Detect SQL injection attempts.

        Args:
            value: Input to check

        Returns:
            Detection result
        """
        if not isinstance(value, str):
            return {"safe": True, "indicators": []}

        indicators = []
        upper_value = value.upper()

        # Check for SQL keywords in suspicious context
        for keyword in cls.SQL_KEYWORDS:
            if keyword in upper_value:
                # Check if it's likely part of an injection
                pattern = rf"\b{keyword}\b"
                if re.search(pattern, upper_value):
                    indicators.append(f"SQL keyword found: {keyword}")

        # Check for dangerous character sequences
        for char in cls.DANGEROUS_CHARS:
            if char in value:
                indicators.append(f"Dangerous character sequence: {repr(char)}")

        # Check for common injection patterns
        patterns = [
            (r"'\s*(OR|AND)\s*'", "Boolean injection pattern"),
            (r"UNION\s+SELECT", "UNION SELECT injection"),
            (r";\s*(DROP|DELETE|UPDATE)", "Query termination injection"),
            (r"'\s*;\s*--", "Comment injection"),
            (r"(\+|%2B){2,}", "Plus concatenation"),
        ]

        for pattern, description in patterns:
            if re.search(pattern, upper_value):
                indicators.append(description)

        return {
            "safe": len(indicators) == 0,
            "indicators": indicators,
            "risk_level": (
                "high" if len(indicators) > 2 else "medium" if indicators else "low"
            ),
        }


# ============================================================================
# QUERY BUILDER
# ============================================================================


class SafeQueryBuilder:
    """
    Safe SQL query builder with parameterization.
    """

    def __init__(self):
        self._params = []
        self._query_parts = []

    def select(self, table: str, columns: List[str] = None) -> "SafeQueryBuilder":
        """
        Add SELECT clause.

        Args:
            table: Table name
            columns: Column names (default: all)
        """
        if not SQLSanitizer.validate_identifier(table):
            raise ValueError(f"Invalid table name: {table}")

        if columns:
            for col in columns:
                if not SQLSanitizer.validate_identifier(col):
                    raise ValueError(f"Invalid column name: {col}")
            cols = ", ".join(columns)
        else:
            cols = "*"

        self._query_parts.append(f"SELECT {cols} FROM {table}")
        return self

    def where(self, condition: str, *params) -> "SafeQueryBuilder":
        """
        Add WHERE clause with parameters.

        Args:
            condition: WHERE condition with placeholders
            *params: Parameter values
        """
        self._query_parts.append(f"WHERE {condition}")
        self._params.extend(params)
        return self

    def where_eq(self, column: str, value: Any) -> "SafeQueryBuilder":
        """
        Add equality condition.

        Args:
            column: Column name
            value: Value to compare
        """
        if not SQLSanitizer.validate_identifier(column):
            raise ValueError(f"Invalid column name: {column}")

        self._query_parts.append(f"WHERE {column} = ?")
        self._params.append(value)
        return self

    def order_by(self, column: str, direction: str = "ASC") -> "SafeQueryBuilder":
        """Add ORDER BY clause."""
        if not SQLSanitizer.validate_identifier(column):
            raise ValueError(f"Invalid column name: {column}")

        direction = direction.upper()
        if direction not in ("ASC", "DESC"):
            raise ValueError(f"Invalid direction: {direction}")

        self._query_parts.append(f"ORDER BY {column} {direction}")
        return self

    def limit(self, limit: int) -> "SafeQueryBuilder":
        """Add LIMIT clause."""
        if not isinstance(limit, int) or limit < 0:
            raise ValueError(f"Invalid limit: {limit}")

        self._query_parts.append(f"LIMIT {limit}")
        return self

    def offset(self, offset: int) -> "SafeQueryBuilder":
        """Add OFFSET clause."""
        if not isinstance(offset, int) or offset < 0:
            raise ValueError(f"Invalid offset: {offset}")

        self._query_parts.append(f"OFFSET {offset}")
        return self

    def build(self) -> tuple:
        """
        Build the query.

        Returns:
            Tuple of (query, params)
        """
        query = " ".join(self._query_parts)
        return query, self._params.copy()


# ============================================================================
# PASSWORD SECURITY
# ============================================================================


class PasswordSecurity:
    """
    Password hashing and validation utilities.
    """

    MIN_LENGTH = 8
    MIN_UPPERCASE = 1
    MIN_LOWERCASE = 1
    MIN_DIGITS = 1
    MIN_SPECIAL = 1

    @classmethod
    def hash_password(cls, password: str) -> str:
        """
        Hash a password using bcrypt.

        Args:
            password: Plain text password

        Returns:
            Hashed password
        """
        try:
            import bcrypt

            salt = bcrypt.gensalt()
            return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")
        except ImportError:
            # Fallback to hashlib
            import hashlib

            salt = secrets.token_hex(16)
            hashed = hashlib.sha256((password + salt).encode()).hexdigest()
            return f"sha256${salt}${hashed}"

    @classmethod
    def verify_password(cls, password: str, hashed: str) -> bool:
        """
        Verify a password against a hash.

        Args:
            password: Plain text password
            hashed: Hashed password

        Returns:
            True if password matches
        """
        try:
            import bcrypt

            return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
        except ImportError:
            # Handle fallback format
            if hashed.startswith("sha256$"):
                parts = hashed.split("$")
                if len(parts) == 3:
                    salt = parts[1]
                    expected = parts[2]
                    computed = hashlib.sha256((password + salt).encode()).hexdigest()
                    return secrets.compare_digest(computed, expected)
            return False

    @classmethod
    def validate_strength(cls, password: str) -> Dict[str, Any]:
        """
        Validate password strength.

        Args:
            password: Password to validate

        Returns:
            Validation result with requirements
        """
        result = {"valid": True, "errors": [], "strength": 0}

        if len(password) < cls.MIN_LENGTH:
            result["valid"] = False
            result["errors"].append(f"Must be at least {cls.MIN_LENGTH} characters")
        else:
            result["strength"] += 20

        uppercase = sum(1 for c in password if c.isupper())
        if uppercase < cls.MIN_UPPERCASE:
            result["valid"] = False
            result["errors"].append(
                f"Must have at least {cls.MIN_UPPERCASE} uppercase letter"
            )
        else:
            result["strength"] += 20

        lowercase = sum(1 for c in password if c.islower())
        if lowercase < cls.MIN_LOWERCASE:
            result["valid"] = False
            result["errors"].append(
                f"Must have at least {cls.MIN_LOWERCASE} lowercase letter"
            )
        else:
            result["strength"] += 20

        digits = sum(1 for c in password if c.isdigit())
        if digits < cls.MIN_DIGITS:
            result["valid"] = False
            result["errors"].append(f"Must have at least {cls.MIN_DIGITS} digit")
        else:
            result["strength"] += 20

        special = sum(1 for c in password if c in "!@#$%^&*()_+-=[]{}|;:,.<>?")
        if special < cls.MIN_SPECIAL:
            result["valid"] = False
            result["errors"].append(
                f"Must have at least {cls.MIN_SPECIAL} special character"
            )
        else:
            result["strength"] += 20

        return result

    @classmethod
    def generate_secure(cls, length: int = 16) -> str:
        """Generate a secure random password."""
        alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
        password = "".join(secrets.choice(alphabet) for _ in range(length))
        return password


# ============================================================================
# TOKEN SECURITY
# ============================================================================


class TokenSecurity:
    """
    Token generation and validation utilities.
    """

    @staticmethod
    def generate_token(length: int = 32) -> str:
        """Generate a secure random token."""
        return secrets.token_urlsafe(length)

    @staticmethod
    def generate_otp(length: int = 6) -> str:
        """Generate a numeric OTP."""
        return "".join(secrets.choice(string.digits) for _ in range(length))

    @staticmethod
    def hash_token(token: str) -> str:
        """Hash a token for storage."""
        return hashlib.sha256(token.encode()).hexdigest()

    @staticmethod
    def verify_token_hash(token: str, hashed: str) -> bool:
        """Verify a token against its hash."""
        computed = hashlib.sha256(token.encode()).hexdigest()
        return secrets.compare_digest(computed, hashed)


# ============================================================================
# SECURITY DECORATORS
# ============================================================================


def sanitize_inputs(schema: Dict[str, Dict] = None):
    """
    Decorator to sanitize function inputs.

    Usage:
        @sanitize_inputs(schema={'name': {'max_length': 100}})
        def create_user(data):
            ...
    """

    def decorator(func: Callable):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Sanitize kwargs
            if kwargs:
                kwargs = InputSanitizer.sanitize_dict(kwargs, schema)

            # Sanitize args (if they're dicts or strings)
            new_args = []
            for arg in args:
                if isinstance(arg, dict):
                    new_args.append(InputSanitizer.sanitize_dict(arg, schema))
                elif isinstance(arg, str):
                    new_args.append(InputSanitizer.sanitize_string(arg))
                elif isinstance(arg, list):
                    new_args.append(InputSanitizer.sanitize_list(arg))
                else:
                    new_args.append(arg)

            return func(*new_args, **kwargs)

        return wrapper

    return decorator


def require_strong_password(password_field: str = "password"):
    """
    Decorator to validate password strength.

    Usage:
        @require_strong_password('password')
        def create_user(password, **kwargs):
            ...
    """

    def decorator(func: Callable):
        @wraps(func)
        def wrapper(*args, **kwargs):
            password = kwargs.get(password_field)
            if password:
                validation = PasswordSecurity.validate_strength(password)
                if not validation["valid"]:
                    raise ValueError(
                        f"Password too weak: {', '.join(validation['errors'])}"
                    )
            return func(*args, **kwargs)

        return wrapper

    return decorator


# ============================================================================
# SECURITY AUDIT
# ============================================================================


class SecurityAudit:
    """
    Security audit logging utilities.
    """

    @staticmethod
    def log_security_event(
        event_type: str,
        user_id: str = None,
        ip_address: str = None,
        details: Dict = None,
        risk_level: str = "low",
    ):
        """
        Log a security-related event.

        Args:
            event_type: Type of security event
            user_id: User ID involved
            ip_address: IP address of request
            details: Additional details
            risk_level: Risk level (low, medium, high, critical)
        """
        event = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "event_type": event_type,
            "user_id": user_id,
            "ip_address": ip_address,
            "details": details or {},
            "risk_level": risk_level,
        }

        if risk_level in ("high", "critical"):
            logger.warning(f"SECURITY EVENT: {event}")
        else:
            logger.info(f"SECURITY EVENT: {event}")

    @staticmethod
    def log_failed_login(user_id: str, ip_address: str, reason: str):
        """Log a failed login attempt."""
        SecurityAudit.log_security_event(
            event_type="FAILED_LOGIN",
            user_id=user_id,
            ip_address=ip_address,
            details={"reason": reason},
            risk_level="medium",
        )

    @staticmethod
    def log_suspicious_activity(user_id: str, activity: str, details: Dict = None):
        """Log suspicious activity."""
        SecurityAudit.log_security_event(
            event_type="SUSPICIOUS_ACTIVITY",
            user_id=user_id,
            details={"activity": activity, **(details or {})},
            risk_level="high",
        )


# Singleton instances
input_sanitizer = InputSanitizer()
sql_sanitizer = SQLSanitizer()


# ============================================================================
# MODULE-LEVEL CONVENIENCE FUNCTIONS
# ============================================================================


def hash_password(password: str) -> str:
    """
    Hash a password using bcrypt.
    Convenience function for PasswordSecurity.hash_password.

    Args:
        password: Plain text password

    Returns:
        Hashed password
    """
    return PasswordSecurity.hash_password(password)


def verify_password(password: str, hashed: str) -> bool:
    """
    Verify a password against a hash.
    Convenience function for PasswordSecurity.verify_password.

    Args:
        password: Plain text password
        hashed: Hashed password

    Returns:
        True if password matches
    """
    return PasswordSecurity.verify_password(password, hashed)
