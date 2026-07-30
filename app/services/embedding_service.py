"""
Embedding Service
Production-grade vector embedding service using OpenAI embeddings
"""

import os
import hashlib
import logging
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from datetime import datetime, timezone
import threading

try:
    import numpy as np

    HAS_NUMPY = True
except ImportError:
    HAS_NUMPY = False

logger = logging.getLogger(__name__)


@dataclass
class EmbeddingResult:
    """Result of an embedding operation"""

    vector: List[float]
    dimension: int
    model: str
    created_at: datetime
    tokens_used: int = 0


@dataclass
class DestinationEmbedding:
    """Embedding for a destination"""

    destination_id: str
    name: str
    country: str
    embedding: List[float]
    metadata: Dict[str, Any]
    created_at: datetime
    updated_at: datetime


@dataclass
class UserEmbedding:
    """Embedding for user preferences"""

    user_id: str
    embedding: List[float]
    based_on_searches: bool = False
    based_on_bookings: bool = False
    based_on_favorites: bool = False
    search_history_count: int = 0
    booking_history_count: int = 0
    created_at: datetime = None
    updated_at: datetime = None

    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.now(timezone.utc)
        if self.updated_at is None:
            self.updated_at = datetime.now(timezone.utc)


class EmbeddingService:
    """
    Production-grade embedding service for AI-powered recommendations.

    Features:
    - OpenAI text-embedding-3-small integration
    - Embedding caching for performance
    - Batch processing for efficiency
    - Similarity search with cosine/inner product
    - User preference vector generation
    """

    # OpenAI embedding models
    EMBEDDING_MODEL_SMALL = "text-embedding-3-small"
    EMBEDDING_MODEL_LARGE = "text-embedding-3-large"
    EMBEDDING_DIMENSION_SMALL = 1536
    EMBEDDING_DIMENSION_LARGE = 3072

    # Cache settings
    CACHE_TTL_SECONDS = 86400  # 24 hours
    MAX_CACHE_SIZE = 10000

    def __init__(self, db_service=None, cache_service=None):
        """
        Initialize embedding service.

        Args:
            db_service: Database service for persistence
            cache_service: Redis cache service (optional)
        """
        self.db = db_service
        self.cache = cache_service
        self._embedding_cache: Dict[str, EmbeddingResult] = {}
        self._cache_lock = threading.Lock()

        # OpenAI API configuration
        self.api_key = os.environ.get("OPENAI_API_KEY")
        self.model = self.EMBEDDING_MODEL_SMALL
        self.dimension = self.EMBEDDING_DIMENSION_SMALL

        # Try to import OpenAI
        self._openai_client = None
        try:
            import openai

            if self.api_key:
                self._openai_client = openai.OpenAI(api_key=self.api_key)
                logger.info("OpenAI client initialized successfully")
            else:
                logger.warning("OPENAI_API_KEY not set - embeddings will use fallback")
        except ImportError:
            logger.warning(
                "OpenAI package not installed - embeddings will use fallback"
            )

    def generate_embedding(self, text: str) -> List[float]:
        """
        Generate embedding for text.

        Args:
            text: Text to embed

        Returns:
            Embedding vector
        """
        if not text or not text.strip():
            return self._get_zero_vector()

        # Check cache
        cache_key = self._get_cache_key(text)
        cached = self._get_cached_embedding(cache_key)
        if cached:
            return cached.vector

        # Generate new embedding
        embedding = self._generate_embedding_internal(text)

        # Cache result
        self._cache_embedding(cache_key, embedding)

        return embedding

    def generate_batch_embeddings(
        self, texts: List[str], batch_size: int = 100
    ) -> List[List[float]]:
        """
        Generate embeddings for multiple texts efficiently.

        Args:
            texts: List of texts to embed
            batch_size: Batch size for API calls

        Returns:
            List of embedding vectors
        """
        if not texts:
            return []

        results = []
        uncached_texts = []
        uncached_indices = []

        # Check cache for each text
        for i, text in enumerate(texts):
            cache_key = self._get_cache_key(text)
            cached = self._get_cached_embedding(cache_key)
            if cached:
                results.append((i, cached.vector))
            else:
                uncached_texts.append(text)
                uncached_indices.append(i)

        # Process uncached texts in batches
        if uncached_texts:
            batch_embeddings = self._batch_embed(uncached_texts, batch_size)

            # Cache and collect results
            for idx, (text, embedding) in enumerate(
                zip(uncached_texts, batch_embeddings)
            ):
                original_idx = uncached_indices[idx]
                results.append((original_idx, embedding))

                # Cache the embedding
                cache_key = self._get_cache_key(text)
                self._cache_embedding(cache_key, embedding)

        # Sort by original index and extract vectors
        results.sort(key=lambda x: x[0])
        return [r[1] for r in results]

    def create_destination_embedding(
        self,
        destination_id: str,
        name: str,
        country: str,
        description: str = "",
        activities: List[str] = None,
        categories: List[str] = None,
        climate: str = "",
        cuisine_types: List[str] = None,
        metadata: Dict[str, Any] = None,
    ) -> DestinationEmbedding:
        """
        Create embedding for a destination.

        Combines all destination information into a rich text representation
        and generates an embedding for semantic search.
        """
        # Build comprehensive text representation
        text_parts = [f"{name}, {country}"]

        if description:
            text_parts.append(description)

        if activities:
            text_parts.append(f"Activities: {', '.join(activities)}")

        if categories:
            text_parts.append(f"Categories: {', '.join(categories)}")

        if climate:
            text_parts.append(f"Climate: {climate}")

        if cuisine_types:
            text_parts.append(f"Cuisine: {', '.join(cuisine_types)}")

        combined_text = ". ".join(text_parts)

        # Generate embedding
        embedding = self.generate_embedding(combined_text)

        return DestinationEmbedding(
            destination_id=destination_id,
            name=name,
            country=country,
            embedding=embedding,
            metadata=metadata or {},
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )

    def create_user_embedding(
        self,
        user_id: str,
        search_history: List[Dict[str, Any]] = None,
        booking_history: List[Dict[str, Any]] = None,
        favorites: List[Dict[str, Any]] = None,
        explicit_preferences: Dict[str, Any] = None,
    ) -> UserEmbedding:
        """
        Create embedding for user preferences.

        Generates a vector representation of user interests based on:
        - Search history (weighted by recency)
        - Booking history (strong signal)
        - Saved favorites (strong signal)
        - Explicit preferences
        """
        text_parts = []

        # Add explicit preferences
        if explicit_preferences:
            prefs_text = self._preferences_to_text(explicit_preferences)
            if prefs_text:
                text_parts.append(f"Preferences: {prefs_text}")

        # Add search history with decay weighting
        if search_history:
            search_text = self._searches_to_text(search_history)
            if search_text:
                text_parts.append(f"Recent searches: {search_text}")

        # Add booking history (strong signal)
        if booking_history:
            bookings_text = self._bookings_to_text(booking_history)
            if bookings_text:
                text_parts.append(f"Booked destinations: {bookings_text}")

        # Add favorites (strong signal)
        if favorites:
            favorites_text = self._favorites_to_text(favorites)
            if favorites_text:
                text_parts.append(f"Saved favorites: {favorites_text}")

        # Combine all signals
        combined_text = ". ".join(text_parts) if text_parts else "New user"

        # Generate embedding
        embedding = self.generate_embedding(combined_text)

        return UserEmbedding(
            user_id=user_id,
            embedding=embedding,
            based_on_searches=bool(search_history),
            based_on_bookings=bool(booking_history),
            based_on_favorites=bool(favorites),
            search_history_count=len(search_history) if search_history else 0,
            booking_history_count=len(booking_history) if booking_history else 0,
        )

    def similarity_search(
        self,
        query_embedding: List[float],
        candidate_embeddings: List[List[float]],
        top_k: int = 10,
        threshold: float = 0.0,
    ) -> List[Dict[str, Any]]:
        """
        Perform similarity search using cosine similarity.

        Args:
            query_embedding: Query vector
            candidate_embeddings: List of candidate vectors
            top_k: Number of top results
            threshold: Minimum similarity threshold

        Returns:
            List of results with similarity scores
        """
        if not candidate_embeddings:
            return []

        similarities = []

        for idx, candidate in enumerate(candidate_embeddings):
            sim = self.cosine_similarity(query_embedding, candidate)
            if sim >= threshold:
                similarities.append({"index": idx, "similarity": sim})

        # Sort by similarity
        similarities.sort(key=lambda x: x["similarity"], reverse=True)

        return similarities[:top_k]

    def cosine_similarity(self, vec1: List[float], vec2: List[float]) -> float:
        """
        Calculate cosine similarity between two vectors.

        Args:
            vec1: First vector
            vec2: Second vector

        Returns:
            Similarity score between -1 and 1
        """
        if HAS_NUMPY:
            return self._cosine_similarity_numpy(vec1, vec2)
        else:
            return self._cosine_similarity_python(vec1, vec2)

    def _cosine_similarity_numpy(self, vec1: List[float], vec2: List[float]) -> float:
        """NumPy-optimized cosine similarity."""
        arr1 = np.array(vec1)
        arr2 = np.array(vec2)

        dot_product = np.dot(arr1, arr2)
        norm1 = np.linalg.norm(arr1)
        norm2 = np.linalg.norm(arr2)

        if norm1 == 0 or norm2 == 0:
            return 0.0

        return float(dot_product / (norm1 * norm2))

    def _cosine_similarity_python(self, vec1: List[float], vec2: List[float]) -> float:
        """Pure Python cosine similarity."""
        if len(vec1) != len(vec2):
            return 0.0

        dot_product = sum(a * b for a, b in zip(vec1, vec2))
        norm1 = sum(a * a for a in vec1) ** 0.5
        norm2 = sum(b * b for b in vec2) ** 0.5

        if norm1 == 0 or norm2 == 0:
            return 0.0

        return dot_product / (norm1 * norm2)

    def euclidean_distance(self, vec1: List[float], vec2: List[float]) -> float:
        """Calculate Euclidean distance between two vectors."""
        if HAS_NUMPY:
            return float(np.linalg.norm(np.array(vec1) - np.array(vec2)))
        else:
            return sum((a - b) ** 2 for a, b in zip(vec1, vec2)) ** 0.5

    def dot_product(self, vec1: List[float], vec2: List[float]) -> float:
        """Calculate dot product between two vectors."""
        return sum(a * b for a, b in zip(vec1, vec2))

    # Private methods

    def _generate_embedding_internal(self, text: str) -> List[float]:
        """Internal method to generate embedding."""
        if self._openai_client:
            try:
                response = self._openai_client.embeddings.create(
                    model=self.model, input=text
                )
                return response.data[0].embedding
            except Exception as e:
                logger.error(f"OpenAI embedding error: {e}")

        # Fallback to feature-based embedding
        return self._fallback_embedding(text)

    def _batch_embed(self, texts: List[str], batch_size: int) -> List[List[float]]:
        """Process texts in batches."""
        embeddings = []

        for i in range(0, len(texts), batch_size):
            batch = texts[i : i + batch_size]

            if self._openai_client:
                try:
                    response = self._openai_client.embeddings.create(
                        model=self.model, input=batch
                    )
                    batch_embeddings = [item.embedding for item in response.data]
                    embeddings.extend(batch_embeddings)
                except Exception as e:
                    logger.error(f"Batch embedding error: {e}")
                    # Fallback for batch
                    for text in batch:
                        embeddings.append(self._fallback_embedding(text))
            else:
                for text in batch:
                    embeddings.append(self._fallback_embedding(text))

        return embeddings

    def _fallback_embedding(self, text: str) -> List[float]:
        """
        Generate a deterministic pseudo-embedding from text features.
        Used when OpenAI is not available.
        """
        # Create feature vector from text characteristics
        features = [0.0] * self.dimension

        # Hash-based features for consistency
        text_lower = text.lower()

        # Travel style features
        styles = [
            "adventure",
            "relaxation",
            "cultural",
            "business",
            "nature",
            "beach",
            "mountain",
            "city",
        ]
        for i, style in enumerate(styles):
            if style in text_lower:
                features[i] = 1.0

        # Budget features
        budgets = ["budget", "moderate", "luxury", "cheap", "expensive"]
        for i, budget in enumerate(budgets):
            if budget in text_lower:
                features[10 + i] = 1.0

        # Activity features
        activities = [
            "hiking",
            "swimming",
            "sightseeing",
            "shopping",
            "dining",
            "museums",
            "nightlife",
            "spa",
        ]
        for i, activity in enumerate(activities):
            if activity in text_lower:
                features[20 + i] = 1.0

        # Climate features
        climates = ["tropical", "cold", "moderate", "warm", "cool", "hot"]
        for i, climate in enumerate(climates):
            if climate in text_lower:
                features[30 + i] = 1.0

        # Hash-based features for uniqueness
        text_hash = hashlib.md5(text.encode()).hexdigest()
        for i in range(min(32, self.dimension - 40)):
            features[40 + i] = int(text_hash[i : i + 2], 16) / 255.0

        return features

    def _get_cache_key(self, text: str) -> str:
        """Generate cache key for text."""
        return hashlib.md5(f"{self.model}:{text}".encode()).hexdigest()

    def _get_cached_embedding(self, cache_key: str) -> Optional[EmbeddingResult]:
        """Get cached embedding if available."""
        with self._cache_lock:
            cached = self._embedding_cache.get(cache_key)
            if cached:
                # Check if still valid
                age = (datetime.now(timezone.utc) - cached.created_at).total_seconds()
                if age < self.CACHE_TTL_SECONDS:
                    return cached
                else:
                    del self._embedding_cache[cache_key]
            return None

    def _cache_embedding(self, cache_key: str, embedding: List[float]):
        """Cache embedding for future use."""
        with self._cache_lock:
            # LRU eviction if cache is full
            if len(self._embedding_cache) >= self.MAX_CACHE_SIZE:
                # Remove oldest entries
                sorted_keys = sorted(
                    self._embedding_cache.keys(),
                    key=lambda k: self._embedding_cache[k].created_at,
                )
                for key in sorted_keys[: self.MAX_CACHE_SIZE // 4]:
                    del self._embedding_cache[key]

            self._embedding_cache[cache_key] = EmbeddingResult(
                vector=embedding,
                dimension=len(embedding),
                model=self.model,
                created_at=datetime.now(timezone.utc),
            )

    def _preferences_to_text(self, preferences: Dict[str, Any]) -> str:
        """Convert preferences dict to text."""
        parts = []

        if "travel_style" in preferences:
            parts.append(f"Travel style: {preferences['travel_style']}")

        if "budget" in preferences:
            parts.append(f"Budget: {preferences['budget']}")

        if "activities" in preferences:
            parts.append(f"Activities: {', '.join(preferences['activities'])}")

        if "climate" in preferences:
            parts.append(f"Climate: {preferences['climate']}")

        return ". ".join(parts)

    def _searches_to_text(
        self, searches: List[Dict[str, Any]], decay_factor: float = 0.95
    ) -> str:
        """Convert search history to weighted text."""
        if not searches:
            return ""

        # Sort by recency
        sorted_searches = sorted(
            searches, key=lambda x: x.get("timestamp", ""), reverse=True
        )

        # Weight recent searches more
        weighted_terms = []
        weight = 1.0

        for search in sorted_searches[:20]:  # Limit to 20 most recent
            query = search.get("query", "")
            if query:
                # Repeat based on weight (integer count)
                repeat_count = max(1, int(weight * 3))
                weighted_terms.extend([query] * repeat_count)
                weight *= decay_factor

        return ", ".join(set(weighted_terms))

    def _bookings_to_text(self, bookings: List[Dict[str, Any]]) -> str:
        """Convert booking history to text."""
        if not bookings:
            return ""

        destinations = []
        for booking in bookings[:10]:  # Limit to 10
            dest = booking.get("destination", "")
            if dest:
                destinations.append(dest)

        return ", ".join(destinations)

    def _favorites_to_text(self, favorites: List[Dict[str, Any]]) -> str:
        """Convert favorites to text."""
        if not favorites:
            return ""

        destinations = []
        for fav in favorites[:20]:  # Limit to 20
            dest = fav.get("destination", "") or fav.get("name", "")
            if dest:
                destinations.append(dest)

        return ", ".join(destinations)

    def _get_zero_vector(self) -> List[float]:
        """Return zero vector of appropriate dimension."""
        return [0.0] * self.dimension


# Singleton instance
embedding_service = EmbeddingService()
