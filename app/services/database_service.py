"""
Database Service
Production-grade database operations with connection pooling, query optimization, and monitoring
"""

import os
import logging
import threading
import time
from typing import Any, Dict, List, Optional, Union, Callable
from dataclasses import dataclass, field
from datetime import datetime
from functools import wraps
from contextlib import contextmanager
import hashlib

logger = logging.getLogger(__name__)


@dataclass
class QueryStats:
    """Query execution statistics"""
    query_hash: str
    query_template: str
    execution_count: int = 0
    total_time_ms: float = 0
    avg_time_ms: float = 0
    max_time_ms: float = 0
    min_time_ms: float = float('inf')
    last_executed: datetime = None


class QueryOptimizer:
    """
    Query optimization utilities and monitoring.
    """
    
    def __init__(self):
        self._query_stats: Dict[str, QueryStats] = {}
        self._slow_query_threshold_ms = 500  # Log queries slower than this
        self._lock = threading.RLock()
    
    def record_query(
        self,
        query: str,
        execution_time_ms: float,
        params: tuple = None
    ):
        """
        Record query execution for monitoring.
        
        Args:
            query: SQL query
            execution_time_ms: Execution time in milliseconds
            params: Query parameters
        """
        # Create template (replace params with placeholders)
        template = self._create_template(query, params)
        query_hash = hashlib.md5(template.encode()).hexdigest()[:12]
        
        with self._lock:
            if query_hash not in self._query_stats:
                self._query_stats[query_hash] = QueryStats(
                    query_hash=query_hash,
                    query_template=template
                )
            
            stats = self._query_stats[query_hash]
            stats.execution_count += 1
            stats.total_time_ms += execution_time_ms
            stats.avg_time_ms = stats.total_time_ms / stats.execution_count
            stats.max_time_ms = max(stats.max_time_ms, execution_time_ms)
            stats.min_time_ms = min(stats.min_time_ms, execution_time_ms)
            stats.last_executed = datetime.utcnow()
        
        # Log slow queries
        if execution_time_ms > self._slow_query_threshold_ms:
            logger.warning(
                f"SLOW QUERY ({execution_time_ms:.2f}ms): {template[:200]}"
            )
    
    def get_slow_queries(self, threshold_ms: float = None) -> List[QueryStats]:
        """Get queries that exceed threshold."""
        threshold = threshold_ms or self._slow_query_threshold_ms
        return [
            stats for stats in self._query_stats.values()
            if stats.avg_time_ms > threshold
        ]
    
    def get_most_frequent_queries(self, limit: int = 10) -> List[QueryStats]:
        """Get most frequently executed queries."""
        sorted_stats = sorted(
            self._query_stats.values(),
            key=lambda x: x.execution_count,
            reverse=True
        )
        return sorted_stats[:limit]
    
    def get_stats_summary(self) -> Dict[str, Any]:
        """Get query statistics summary."""
        with self._lock:
            total_queries = sum(s.execution_count for s in self._query_stats.values())
            total_time = sum(s.total_time_ms for s in self._query_stats.values())
            unique_queries = len(self._query_stats)
            slow_queries = len(self.get_slow_queries())
            
            return {
                "total_queries": total_queries,
                "unique_queries": unique_queries,
                "total_time_ms": total_time,
                "avg_query_time_ms": total_time / total_queries if total_queries > 0 else 0,
                "slow_queries_count": slow_queries,
                "slow_query_threshold_ms": self._slow_query_threshold_ms
            }
    
    def _create_template(self, query: str, params: tuple) -> str:
        """Create query template by normalizing."""
        template = query.strip()
        # Normalize whitespace
        template = ' '.join(template.split())
        return template


class ConnectionPool:
    """
    Database connection pool with health monitoring.
    """
    
    def __init__(
        self,
        database_url: str = None,
        pool_size: int = 10,
        max_overflow: int = 5,
        pool_timeout: int = 30,
        pool_recycle: int = 3600
    ):
        """
        Initialize connection pool.
        
        Args:
            database_url: Database connection URL
            pool_size: Number of connections to maintain
            max_overflow: Max connections beyond pool_size
            pool_timeout: Timeout for getting connection (seconds)
            pool_recycle: Recycle connections after this many seconds
        """
        self._database_url = database_url or os.environ.get("DATABASE_URL", "sqlite:///travel.db")
        self._pool_size = pool_size
        self._max_overflow = max_overflow
        self._pool_timeout = pool_timeout
        self._pool_recycle = pool_recycle
        
        self._engine = None
        self._session_factory = None
        self._lock = threading.RLock()
        
        # Statistics
        self._connections_created = 0
        self._connections_reused = 0
        self._connection_errors = 0
        
        self._initialize_pool()
    
    def _initialize_pool(self):
        """Initialize the connection pool."""
        try:
            from sqlalchemy import create_engine
            from sqlalchemy.orm import sessionmaker
            
            # Configure engine with pooling
            self._engine = create_engine(
                self._database_url,
                pool_size=self._pool_size,
                max_overflow=self._max_overflow,
                pool_timeout=self._pool_timeout,
                pool_recycle=self._pool_recycle,
                pool_pre_ping=True,  # Verify connections before use
                echo=False  # Set to True for SQL debugging
            )
            
            self._session_factory = sessionmaker(bind=self._engine)
            
            logger.info(
                f"Connection pool initialized "
                f"(size={self._pool_size}, max_overflow={self._max_overflow})"
            )
            
        except ImportError:
            logger.warning("SQLAlchemy not installed - connection pooling disabled")
            self._engine = None
            self._session_factory = None
    
    @contextmanager
    def get_session(self):
        """
        Get a database session from the pool.
        
        Usage:
            with pool.get_session() as session:
                user = session.query(User).first()
        """
        if not self._session_factory:
            raise RuntimeError("Connection pool not initialized")
        
        session = self._session_factory()
        try:
            yield session
            session.commit()
        except Exception as e:
            session.rollback()
            raise
        finally:
            session.close()
    
    @contextmanager
    def get_connection(self):
        """
        Get a raw connection from the pool.
        """
        if not self._engine:
            raise RuntimeError("Connection pool not initialized")
        
        conn = self._engine.connect()
        try:
            yield conn
        finally:
            conn.close()
    
    def get_pool_status(self) -> Dict[str, Any]:
        """Get connection pool status."""
        if not self._engine:
            return {"status": "not_initialized"}
        
        try:
            pool = self._engine.pool
            return {
                "status": "active",
                "pool_size": pool.size(),
                "checked_in": pool.checkedin(),
                "checked_out": pool.checkedout(),
                "overflow": pool.overflow(),
                "connections_created": self._connections_created,
                "connections_reused": self._connections_reused,
                "connection_errors": self._connection_errors
            }
        except Exception as e:
            return {"status": "error", "error": str(e)}
    
    def health_check(self) -> Dict[str, Any]:
        """Perform connection pool health check."""
        result = {
            "healthy": True,
            "can_connect": False,
            "latency_ms": None,
            "error": None
        }
        
        if not self._engine:
            result["healthy"] = False
            result["error"] = "Pool not initialized"
            return result
        
        try:
            start = time.time()
            with self.get_connection() as conn:
                conn.execute("SELECT 1")
            end = time.time()
            
            result["can_connect"] = True
            result["latency_ms"] = round((end - start) * 1000, 2)
            
        except Exception as e:
            result["healthy"] = False
            result["error"] = str(e)
            logger.error(f"Database health check failed: {e}")
        
        return result


class DatabaseService:
    """
    Production database service with optimization features.
    
    Features:
    - Connection pooling
    - Query optimization
    - Slow query logging
    - Health monitoring
    - Query caching integration
    """
    
    def __init__(
        self,
        database_url: str = None,
        pool_size: int = 10
    ):
        """
        Initialize database service.
        
        Args:
            database_url: Database connection URL
            pool_size: Connection pool size
        """
        self._pool = ConnectionPool(database_url, pool_size)
        self._optimizer = QueryOptimizer()
        self._cache = None  # Will be set by set_cache
        
        logger.info("Database service initialized")
    
    def set_cache(self, cache_service):
        """Set cache service for query caching."""
        self._cache = cache_service
    
    @contextmanager
    def session(self):
        """Get a database session."""
        with self._pool.get_session() as session:
            yield session
    
    def execute_query(
        self,
        query: str,
        params: tuple = None,
        use_cache: bool = True,
        cache_ttl: int = 300,
        cache_key: str = None
    ) -> List[Dict]:
        """
        Execute a query with optimization.
        
        Args:
            query: SQL query
            params: Query parameters
            use_cache: Whether to use query cache
            cache_ttl: Cache TTL in seconds
            cache_key: Custom cache key
            
        Returns:
            Query results as list of dicts
        """
        # Check cache first
        if use_cache and self._cache and cache_key:
            cached = self._cache.get(cache_key)
            if cached is not None:
                return cached
        
        # Execute query
        start_time = time.time()
        
        with self._pool.get_connection() as conn:
            result = conn.execute(query, params or ())
            rows = [dict(row._mapping) for row in result] if result else []
        
        execution_time = (time.time() - start_time) * 1000
        
        # Record for optimization tracking
        self._optimizer.record_query(query, execution_time, params)
        
        # Cache result
        if use_cache and self._cache and cache_key and rows:
            self._cache.set(cache_key, rows, cache_ttl)
        
        return rows
    
    def execute_insert(
        self,
        table: str,
        data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Execute an INSERT statement safely.
        
        Args:
            table: Table name
            data: Data to insert
            
        Returns:
            Inserted record
        """
        from app.utils.security import SQLSanitizer
        
        if not SQLSanitizer.validate_identifier(table):
            raise ValueError(f"Invalid table name: {table}")
        
        columns = list(data.keys())
        for col in columns:
            if not SQLSanitizer.validate_identifier(col):
                raise ValueError(f"Invalid column name: {col}")
        
        placeholders = ', '.join(['?' for _ in columns])
        column_names = ', '.join(columns)
        values = tuple(data.values())
        
        query = f"INSERT INTO {table} ({column_names}) VALUES ({placeholders})"
        
        start_time = time.time()
        
        with self._pool.get_connection() as conn:
            result = conn.execute(query, values)
            conn.commit()
            
            # Get last row id
            last_id = result.lastrowid if hasattr(result, 'lastrowid') else None
        
        execution_time = (time.time() - start_time) * 1000
        self._optimizer.record_query(query, execution_time, values)
        
        return {"id": last_id, "affected_rows": result.rowcount if hasattr(result, 'rowcount') else 1}
    
    def execute_update(
        self,
        table: str,
        data: Dict[str, Any],
        where: str,
        where_params: tuple = ()
    ) -> Dict[str, Any]:
        """
        Execute an UPDATE statement safely.
        
        Args:
            table: Table name
            data: Data to update
            where: WHERE clause
            where_params: WHERE parameters
            
        Returns:
            Update result
        """
        from app.utils.security import SQLSanitizer
        
        if not SQLSanitizer.validate_identifier(table):
            raise ValueError(f"Invalid table name: {table}")
        
        columns = list(data.keys())
        for col in columns:
            if not SQLSanitizer.validate_identifier(col):
                raise ValueError(f"Invalid column name: {col}")
        
        set_clause = ', '.join([f"{col} = ?" for col in columns])
        values = tuple(data.values()) + where_params
        
        query = f"UPDATE {table} SET {set_clause} WHERE {where}"
        
        start_time = time.time()
        
        with self._pool.get_connection() as conn:
            result = conn.execute(query, values)
            conn.commit()
        
        execution_time = (time.time() - start_time) * 1000
        self._optimizer.record_query(query, execution_time, values)
        
        return {"affected_rows": result.rowcount if hasattr(result, 'rowcount') else 1}
    
    def execute_delete(
        self,
        table: str,
        where: str,
        where_params: tuple = ()
    ) -> Dict[str, Any]:
        """
        Execute a DELETE statement safely.
        """
        from app.utils.security import SQLSanitizer
        
        if not SQLSanitizer.validate_identifier(table):
            raise ValueError(f"Invalid table name: {table}")
        
        query = f"DELETE FROM {table} WHERE {where}"
        
        start_time = time.time()
        
        with self._pool.get_connection() as conn:
            result = conn.execute(query, where_params)
            conn.commit()
        
        execution_time = (time.time() - start_time) * 1000
        self._optimizer.record_query(query, execution_time, where_params)
        
        return {"affected_rows": result.rowcount if hasattr(result, 'rowcount') else 1}
    
    def health_check(self) -> Dict[str, Any]:
        """Perform database health check."""
        pool_health = self._pool.health_check()
        query_stats = self._optimizer.get_stats_summary()
        
        return {
            "database": pool_health,
            "queries": query_stats
        }
    
    def get_slow_queries(self, threshold_ms: float = None) -> List[Dict]:
        """Get slow queries for monitoring."""
        return [
            {
                "query": stats.query_template[:200],
                "execution_count": stats.execution_count,
                "avg_time_ms": round(stats.avg_time_ms, 2),
                "max_time_ms": round(stats.max_time_ms, 2)
            }
            for stats in self._optimizer.get_slow_queries(threshold_ms)
        ]


# Decorators for query optimization

def with_session(func: Callable) -> Callable:
    """
    Decorator to inject database session.
    
    Usage:
        @with_session
        def get_user(session, user_id):
            return session.query(User).get(user_id)
    """
    @wraps(func)
    def wrapper(*args, **kwargs):
        from app.services.database_service import db_service
        
        with db_service.session() as session:
            return func(session, *args, **kwargs)
    return wrapper


def query_cached(cache_key_builder: Callable, ttl: int = 300):
    """
    Decorator for caching query results.
    
    Usage:
        @query_cached(lambda args: f"user:{args[0]}", ttl=60)
        def get_user(user_id):
            ...
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            from app.services.database_service import db_service
            
            cache_key = cache_key_builder(*args, **kwargs)
            
            if db_service._cache:
                cached = db_service._cache.get(cache_key)
                if cached is not None:
                    return cached
            
            result = func(*args, **kwargs)
            
            if db_service._cache and result is not None:
                db_service._cache.set(cache_key, result, ttl)
            
            return result
        return wrapper
    return decorator


# Singleton instance
db_service = DatabaseService()