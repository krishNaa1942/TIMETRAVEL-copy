"""
AI Recommendation Service
Production-grade recommendation engine using vector embeddings
"""

import math
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)


@dataclass
class UserPreferences:
    """User travel preferences"""
    travel_style: str = "adventure"  # adventure, relaxation, cultural, business
    budget_preference: str = "moderate"  # budget, moderate, luxury
    climate_preference: str = "moderate"  # tropical, cold, moderate
    activity_preferences: List[str] = None
    cuisine_preferences: List[str] = None
    accommodation_type: str = "hotel"  # hotel, hostel, resort, apartment
    
    def __post_init__(self):
        if self.activity_preferences is None:
            self.activity_preferences = []
        if self.cuisine_preferences is None:
            self.cuisine_preferences = []


@dataclass
class Destination:
    """Destination data for scoring"""
    id: str
    name: str
    country: str
    rating: float
    booking_count: int
    categories: List[str]
    climate: str
    avg_cost: float
    seasonality_score: float
    activities: List[str]
    cuisine_types: List[str]
    embedding: Optional[List[float]] = None


@dataclass
class RecommendationContext:
    """Context for recommendation scoring"""
    travel_dates: Optional[Tuple[datetime, datetime]] = None
    group_size: int = 1
    budget_min: float = 0
    budget_max: float = float('inf')
    specific_interests: List[str] = None
    
    def __post_init__(self):
        if self.specific_interests is None:
            self.specific_interests = []


class AIRecommendationService:
    """
    AI-powered recommendation engine for travel destinations.
    
    Uses a multi-factor scoring algorithm:
    - Preference matching (vector similarity)
    - Popularity score
    - Context relevance
    - Seasonality
    - Social proof
    """
    
    # Weights for scoring components
    WEIGHTS = {
        "preference_match": 0.35,
        "popularity": 0.20,
        "context_relevance": 0.25,
        "seasonality": 0.10,
        "social_proof": 0.10
    }
    
    def __init__(self, db_service=None, embedding_service=None):
        """
        Initialize the recommendation service.
        
        Args:
            db_service: Database service for fetching data
            embedding_service: Service for generating embeddings
        """
        self.db = db_service
        self.embedding_service = embedding_service
        self._destination_cache = {}
        self._user_embedding_cache = {}
    
    def get_recommendations(
        self,
        user_id: str,
        context: RecommendationContext,
        limit: int = 10,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """
        Get personalized destination recommendations for a user.
        
        Args:
            user_id: User ID to get recommendations for
            context: Recommendation context (dates, budget, etc.)
            limit: Maximum number of recommendations
            offset: Pagination offset
            
        Returns:
            List of recommended destinations with scores
        """
        try:
            # Get user preferences
            user_prefs = self._get_user_preferences(user_id)
            
            # Get candidate destinations
            candidates = self._get_candidate_destinations(context)
            
            # Score each destination
            scored_destinations = []
            for dest in candidates:
                score = self._calculate_score(user_prefs, dest, context, user_id)
                scored_destinations.append({
                    "destination": dest,
                    "score": score,
                    "score_breakdown": self._get_score_breakdown(user_prefs, dest, context)
                })
            
            # Sort by score and paginate
            scored_destinations.sort(key=lambda x: x["score"], reverse=True)
            
            # Apply pagination
            paginated = scored_destinations[offset:offset + limit]
            
            # Format response
            return [
                {
                    "id": item["destination"].id,
                    "name": item["destination"].name,
                    "country": item["destination"].country,
                    "rating": item["destination"].rating,
                    "score": round(item["score"], 3),
                    "score_breakdown": item["score_breakdown"],
                    "reason": self._generate_recommendation_reason(item),
                    "highlights": self._get_destination_highlights(item["destination"])
                }
                for item in paginated
            ]
            
        except Exception as e:
            logger.error(f"Error getting recommendations for user {user_id}: {e}")
            return self._get_fallback_recommendations(limit)
    
    def _calculate_score(
        self,
        user_prefs: UserPreferences,
        destination: Destination,
        context: RecommendationContext,
        user_id: str
    ) -> float:
        """
        Calculate recommendation score using multi-factor algorithm.
        
        Score = (preference_match * 0.35) + 
                (popularity * 0.20) + 
                (context_relevance * 0.25) + 
                (seasonality * 0.10) + 
                (social_proof * 0.10)
        """
        # 1. Preference Match (Vector Similarity)
        preference_score = self._calculate_preference_match(user_prefs, destination)
        
        # 2. Popularity Score (normalized)
        popularity_score = self._calculate_popularity_score(destination)
        
        # 3. Context Relevance
        context_score = self._calculate_context_relevance(destination, context)
        
        # 4. Seasonality
        seasonal_score = self._calculate_seasonality(destination, context)
        
        # 5. Social Proof
        social_score = self._calculate_social_proof(user_id, destination)
        
        # Weighted sum
        final_score = (
            preference_score * self.WEIGHTS["preference_match"] +
            popularity_score * self.WEIGHTS["popularity"] +
            context_score * self.WEIGHTS["context_relevance"] +
            seasonal_score * self.WEIGHTS["seasonality"] +
            social_score * self.WEIGHTS["social_proof"]
        )
        
        return min(max(final_score, 0), 1)  # Clamp to [0, 1]
    
    def _calculate_preference_match(
        self,
        user_prefs: UserPreferences,
        destination: Destination
    ) -> float:
        """Calculate preference match using embedding similarity or feature matching."""
        # If embeddings available, use vector similarity
        if destination.embedding and self.embedding_service:
            user_embedding = self._get_user_embedding(user_prefs)
            return self._cosine_similarity(user_embedding, destination.embedding)
        
        # Fallback to feature-based matching
        score = 0.0
        total_weight = 0.0
        
        # Travel style match
        if destination.categories:
            style_match = 1.0 if user_prefs.travel_style in destination.categories else 0.3
            score += style_match * 0.3
            total_weight += 0.3
        
        # Budget match
        budget_score = self._calculate_budget_match(user_prefs.budget_preference, destination.avg_cost)
        score += budget_score * 0.25
        total_weight += 0.25
        
        # Climate preference match
        if user_prefs.climate_preference:
            climate_match = 1.0 if user_prefs.climate_preference == destination.climate else 0.5
            score += climate_match * 0.2
            total_weight += 0.2
        
        # Activity match
        if user_prefs.activity_preferences and destination.activities:
            activity_overlap = len(set(user_prefs.activity_preferences) & set(destination.activities))
            activity_score = min(activity_overlap / max(len(user_prefs.activity_preferences), 1), 1.0)
            score += activity_score * 0.25
            total_weight += 0.25
        
        return score / max(total_weight, 0.001)
    
    def _calculate_budget_match(self, budget_pref: str, avg_cost: float) -> float:
        """Calculate budget preference match."""
        budget_ranges = {
            "budget": (0, 100),
            "moderate": (100, 300),
            "luxury": (300, float('inf'))
        }
        
        pref_range = budget_ranges.get(budget_pref, (0, float('inf')))
        
        if pref_range[0] <= avg_cost <= pref_range[1]:
            return 1.0
        elif avg_cost < pref_range[0]:
            return 0.8  # Cheaper than expected is okay
        else:
            # More expensive - score decreases with distance
            diff = avg_cost - pref_range[1]
            return max(0, 1 - (diff / 500))
    
    def _calculate_popularity_score(self, destination: Destination) -> float:
        """Calculate normalized popularity score."""
        # Assume max_bookings is around 10000 for normalization
        max_bookings = 10000
        booking_score = min(destination.booking_count / max_bookings, 1.0)
        
        # Combine with rating
        rating_score = destination.rating / 5.0
        
        return (booking_score * 0.4 + rating_score * 0.6)
    
    def _calculate_context_relevance(
        self,
        destination: Destination,
        context: RecommendationContext
    ) -> float:
        """Calculate context relevance score."""
        score = 0.5  # Base score
        weights_sum = 0
        
        # Budget match
        if context.budget_max > 0:
            if destination.avg_cost <= context.budget_max:
                score += 0.3
            weights_sum += 0.3
        
        # Group size consideration
        if context.group_size > 4:
            # Large group - check if destination is suitable
            if "family" in destination.categories or "groups" in destination.categories:
                score += 0.2
            weights_sum += 0.2
        
        # Specific interests match
        if context.specific_interests:
            interest_overlap = len(
                set(context.specific_interests) & set(destination.activities)
            )
            interest_score = min(interest_overlap / len(context.specific_interests), 1.0)
            score += interest_score * 0.3
            weights_sum += 0.3
        
        return score / max(weights_sum, 0.001) if weights_sum > 0 else score
    
    def _calculate_seasonality(
        self,
        destination: Destination,
        context: RecommendationContext
    ) -> float:
        """Calculate seasonal score based on travel dates."""
        if not context.travel_dates:
            return destination.seasonality_score
        
        # Get month from travel dates
        start_month = context.travel_dates[0].month
        
        # Seasonal scoring by month (simplified)
        # This would typically use historical weather/tourism data
        seasonal_multipliers = {
            1: 0.8, 2: 0.7, 3: 0.9, 4: 1.0,
            5: 1.0, 6: 0.9, 7: 0.8, 8: 0.8,
            9: 0.9, 10: 1.0, 11: 0.8, 12: 0.7
        }
        
        # Adjust for tropical vs cold destinations
        if destination.climate == "tropical":
            tropical_months = [11, 12, 1, 2, 3]  # Winter escape
            if start_month in tropical_months:
                return min(destination.seasonality_score * 1.2, 1.0)
        
        return destination.seasonality_score * seasonal_multipliers.get(start_month, 1.0)
    
    def _calculate_social_proof(self, user_id: str, destination: Destination) -> float:
        """Calculate social proof score based on similar users."""
        # This would typically query the database for:
        # - Friends who visited
        # - Reviews from similar users
        # - Overall engagement metrics
        
        # Simplified implementation
        base_score = 0.5
        
        # High rating indicates social proof
        if destination.rating >= 4.5:
            base_score += 0.3
        elif destination.rating >= 4.0:
            base_score += 0.2
        
        # High booking count indicates popularity
        if destination.booking_count > 1000:
            base_score += 0.2
        
        return min(base_score, 1.0)
    
    def _get_user_embedding(self, user_prefs: UserPreferences) -> List[float]:
        """Generate user embedding from preferences."""
        # This would typically use the embedding service
        # For now, return a feature-based embedding
        features = [
            1.0 if user_prefs.travel_style == "adventure" else 0.0,
            1.0 if user_prefs.travel_style == "relaxation" else 0.0,
            1.0 if user_prefs.travel_style == "cultural" else 0.0,
            1.0 if user_prefs.travel_style == "business" else 0.0,
            1.0 if user_prefs.budget_preference == "budget" else 0.0,
            1.0 if user_prefs.budget_preference == "moderate" else 0.0,
            1.0 if user_prefs.budget_preference == "luxury" else 0.0,
            1.0 if user_prefs.climate_preference == "tropical" else 0.0,
            1.0 if user_prefs.climate_preference == "cold" else 0.0,
            1.0 if user_prefs.climate_preference == "moderate" else 0.0,
        ]
        return features
    
    def _cosine_similarity(self, vec1: List[float], vec2: List[float]) -> float:
        """Calculate cosine similarity between two vectors."""
        if len(vec1) != len(vec2):
            return 0.0
        
        dot_product = sum(a * b for a, b in zip(vec1, vec2))
        norm1 = math.sqrt(sum(a * a for a in vec1))
        norm2 = math.sqrt(sum(b * b for b in vec2))
        
        if norm1 == 0 or norm2 == 0:
            return 0.0
        
        return dot_product / (norm1 * norm2)
    
    def _get_score_breakdown(
        self,
        user_prefs: UserPreferences,
        destination: Destination,
        context: RecommendationContext
    ) -> Dict[str, float]:
        """Get detailed score breakdown for transparency."""
        return {
            "preference_match": round(self._calculate_preference_match(user_prefs, destination), 3),
            "popularity": round(self._calculate_popularity_score(destination), 3),
            "context_relevance": round(self._calculate_context_relevance(destination, context), 3),
            "seasonality": round(self._calculate_seasonality(destination, context), 3),
            "social_proof": round(self._calculate_social_proof("", destination), 3)
        }
    
    def _generate_recommendation_reason(self, item: Dict) -> str:
        """Generate human-readable recommendation reason."""
        destination = item["destination"]
        breakdown = item["score_breakdown"]
        
        reasons = []
        
        if breakdown["preference_match"] > 0.7:
            reasons.append(f"Matches your travel preferences perfectly")
        elif breakdown["preference_match"] > 0.5:
            reasons.append(f"Aligns well with your interests")
        
        if breakdown["popularity"] > 0.8:
            reasons.append("Highly rated by travelers")
        
        if breakdown["seasonality"] > 0.9:
            reasons.append("Perfect time to visit")
        
        if breakdown["social_proof"] > 0.7:
            reasons.append("Popular choice")
        
        if not reasons:
            reasons.append("Recommended based on your profile")
        
        return " • ".join(reasons[:2])
    
    def _get_destination_highlights(self, destination: Destination) -> List[str]:
        """Get key highlights for a destination."""
        highlights = []
        
        if destination.rating >= 4.5:
            highlights.append(f"Excellent rating ({destination.rating})")
        
        unique_activities = destination.activities[:3] if destination.activities else []
        highlights.extend(unique_activities)
        
        return highlights[:5]
    
    def _get_user_preferences(self, user_id: str) -> UserPreferences:
        """Fetch user preferences from database."""
        try:
            from app.models.entities import User, TripQuery
            from app.models.database import db
            
            user = db.session.get(User, int(user_id))
            if not user:
                return UserPreferences()
            
            # Get user's trip history to infer preferences
            recent_trips = user.trips.order_by(
                TripQuery.created_at.desc()
            ).limit(5).all() if hasattr(user, 'trips') else []
            
            # Infer preferences from trip history
            travel_styles = []
            budgets = []
            for trip in recent_trips:
                if trip.travel_class:
                    travel_styles.append(trip.travel_class)
                if trip.estimated_budget:
                    budgets.append(trip.estimated_budget)
            
            # Determine dominant travel style
            if travel_styles:
                style = max(set(travel_styles), key=travel_styles.count)
                if style == "economy":
                    budget_pref = "budget"
                elif style == "business":
                    budget_pref = "luxury"
                else:
                    budget_pref = "moderate"
            else:
                style = "adventure"
                budget_pref = "moderate"
            
            return UserPreferences(
                travel_style=style,
                budget_preference=budget_pref,
                climate_preference="moderate",
                activity_preferences=[],
                cuisine_preferences=[]
            )
        except Exception as e:
            logger.warning(f"Could not fetch user preferences: {e}")
            return UserPreferences()
    
    def _get_candidate_destinations(
        self,
        context: RecommendationContext
    ) -> List[Destination]:
        """Get candidate destinations from database for scoring."""
        try:
            from app.models.entities import Destination as DestinationModel, TripQuery
            from app.models.database import db
            
            # Query destinations with filters
            query = DestinationModel.query
            
            # Filter by budget if specified
            if context.budget_max > 0 and context.budget_max < float('inf'):
                query = query.filter(
                    DestinationModel.avg_daily_cost <= context.budget_max
                )
            
            # Order by safety score (higher is better)
            query = query.order_by(
                DestinationModel.safety_score.desc().nullslast()
            )
            
            # Limit candidates for performance
            destinations = query.limit(50).all()
            
            if not destinations:
                # Fallback to popular destinations from trip queries
                popular_destinations = db.session.query(
                    TripQuery.destination,
                    db.func.count(TripQuery.id).label('count')
                ).group_by(
                    TripQuery.destination
                ).order_by(
                    db.desc('count')
                ).limit(10).all()
                
                return [
                    Destination(
                        id=f"popular_{i}",
                        name=dest.destination,
                        country="India",
                        rating=4.0,
                        booking_count=dest.count,
                        categories=[],
                        climate="moderate",
                        avg_cost=0,
                        seasonality_score=0.8,
                        activities=[],
                        cuisine_types=[]
                    )
                    for i, dest in enumerate(popular_destinations)
                ]
            
            return [
                Destination(
                    id=str(d.id),
                    name=d.name,
                    country=d.country or "India",
                    rating=d.safety_score / 2 if d.safety_score else 3.5,
                    booking_count=0,
                    categories=[d.best_season] if d.best_season else [],
                    climate="moderate",
                    avg_cost=d.avg_daily_cost or 0,
                    seasonality_score=0.8,
                    activities=[],
                    cuisine_types=[]
                )
                for d in destinations
            ]
        except Exception as e:
            logger.error(f"Error fetching candidate destinations: {e}")
            return []
    
    def _get_fallback_recommendations(self, limit: int) -> List[Dict]:
        """Get fallback recommendations when scoring fails."""
        return [
            {
                "id": "fallback_1",
                "name": "Popular Destination",
                "country": "Country",
                "score": 0.8,
                "reason": "Popular choice",
                "highlights": []
            }
        ][:limit]


# Singleton instance
recommendation_service = AIRecommendationService()