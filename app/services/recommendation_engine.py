"""
Production-Grade Recommendation Engine
======================================

This service provides deterministic, explainable travel recommendations.

Architecture:
    User Data → Feature Extraction → Scoring → Ranking → Explanations → Response

Key Principles:
    1. NO RANDOMNESS - Same inputs always produce same outputs
    2. FULLY EXPLAINABLE - Every recommendation has clear reasoning
    3. PERSONALIZED - Based on user behavior and preferences
    4. SCALABLE - Designed for millions of users
"""

import logging
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
import math

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────
# ENUMS AND TYPES
# ─────────────────────────────────────────────────────────────

class TravelStyle(str, Enum):
    BEACH = "beach"
    ADVENTURE = "adventure"
    CULTURAL = "cultural"
    SPIRITUAL = "spiritual"
    NATURE = "nature"
    LUXURY = "luxury"
    BUDGET = "budget"


class Season(str, Enum):
    SUMMER = "summer"
    WINTER = "winter"
    MONSOON = "monsoon"
    SPRING = "spring"
    ANY = "any"


# ─────────────────────────────────────────────────────────────
# DATA CLASSES
# ─────────────────────────────────────────────────────────────

@dataclass
class UserPreferences:
    """User's travel preferences"""
    travel_styles: List[TravelStyle] = field(default_factory=list)
    budget_range: Tuple[float, float] = (50, 300)
    preferred_seasons: List[Season] = field(default_factory=lambda: [Season.ANY])
    
    # Learned affinities (0-1)
    style_affinity: Dict[str, float] = field(default_factory=dict)
    activity_affinity: Dict[str, float] = field(default_factory=dict)
    region_affinity: Dict[str, float] = field(default_factory=dict)
    
    # Behavioral metrics
    price_sensitivity: float = 0.5
    distance_tolerance: float = 0.5


@dataclass
class UserProfile:
    """Complete user profile"""
    id: str
    preferences: UserPreferences
    last_active: datetime


@dataclass
class Destination:
    """Destination data for scoring"""
    id: str
    name: str
    country: str
    region: str
    categories: List[TravelStyle] = field(default_factory=list)
    activities: List[str] = field(default_factory=list)
    rating: float = 0.0
    review_count: int = 0
    booking_count: int = 0
    avg_daily_cost: float = 0.0
    
    # Scores (pre-computed, 0-1)
    safety_score: float = 0.5
    infrastructure_score: float = 0.5
    accessibility_score: float = 0.5
    trending_score: float = 0.5
    social_score: float = 0.5
    current_season_score: float = 0.5
    
    # Seasonal
    peak_season: Season = Season.ANY
    off_peak_season: Season = Season.ANY


@dataclass
class RecommendationContext:
    """Context for recommendation request"""
    current_season: Season = Season.ANY
    trip_duration: int = 7
    group_size: int = 2
    budget_override: Optional[float] = None


@dataclass
class ScoreBreakdown:
    """Detailed score breakdown"""
    preference_match: float = 0.0
    budget_fit: float = 0.0
    seasonality: float = 0.0
    popularity: float = 0.0
    quality: float = 0.0
    distance: float = 0.0
    trending: float = 0.0
    social_proof: float = 0.0
    
    def to_dict(self) -> Dict[str, float]:
        return {
            "preference_match": round(self.preference_match, 3),
            "budget_fit": round(self.budget_fit, 3),
            "seasonality": round(self.seasonality, 3),
            "popularity": round(self.popularity, 3),
            "quality": round(self.quality, 3),
            "distance": round(self.distance, 3),
            "trending": round(self.trending, 3),
            "social_proof": round(self.social_proof, 3)
        }


@dataclass
class RecommendationResult:
    """Final recommendation with all metadata"""
    destination: Destination
    score: float
    score_breakdown: ScoreBreakdown
    explanations: List[str]
    tags: List[str]


# ─────────────────────────────────────────────────────────────
# SCORING WEIGHTS
# ─────────────────────────────────────────────────────────────

SCORING_WEIGHTS = {
    "preference_match": 0.30,
    "budget_fit": 0.15,
    "seasonality": 0.10,
    "popularity": 0.10,
    "quality": 0.15,
    "distance": 0.05,
    "trending": 0.05,
    "social_proof": 0.10,
}


# ─────────────────────────────────────────────────────────────
# FEATURE ENGINEERING
# ─────────────────────────────────────────────────────────────

class FeatureEngineer:
    """
    Convert raw data into normalized scoring features.
    All methods are DETERMINISTIC.
    """
    
    @staticmethod
    def normalize_rating(rating: float) -> float:
        """Normalize rating from 0-5 to 0-1"""
        return max(0, min(1, rating / 5.0))
    
    @staticmethod
    def sigmoid(value: float, midpoint: float = 0.5, steepness: float = 1.0) -> float:
        """Sigmoid normalization"""
        return 1 / (1 + math.exp(-steepness * (value - midpoint)))
    
    @staticmethod
    def log_normalize(value: float, midpoint: float = 3.0) -> float:
        """Log-scale normalization for count data"""
        if value <= 0:
            return 0.0
        return FeatureEngineer.sigmoid(math.log10(value + 1), midpoint, 1.0)
    
    @staticmethod
    def calculate_preference_match(
        destination: Destination,
        user: UserProfile
    ) -> Tuple[float, List[str]]:
        """Calculate preference match score"""
        matches = []
        total_score = 0.0
        total_weight = 0.0
        
        # 1. Travel style match (weight: 0.5)
        style_score = 0.0
        if destination.categories:
            for category in destination.categories:
                affinity = user.preferences.style_affinity.get(category.value, 0.3)
                if category in user.preferences.travel_styles:
                    style_score += 1.0 * (0.5 + affinity * 0.5)
                    matches.append(f"Matches your {category.value} preference")
                else:
                    style_score += affinity * 0.3
            style_score /= len(destination.categories)
        
        total_score += style_score * 0.5
        total_weight += 0.5
        
        # 2. Activity match (weight: 0.3)
        activity_score = 0.0
        if destination.activities and user.preferences.activity_affinity:
            matching_activities = []
            for activity in destination.activities:
                affinity = user.preferences.activity_affinity.get(activity, 0.3)
                activity_score += affinity
                if affinity > 0.5:
                    matching_activities.append(activity)
            
            activity_score /= len(destination.activities)
            if matching_activities:
                matches.append(f"Features {', '.join(matching_activities[:2])}")
        
        total_score += activity_score * 0.3
        total_weight += 0.3
        
        # 3. Region affinity (weight: 0.2)
        region_score = user.preferences.region_affinity.get(destination.region, 0.5)
        total_score += region_score * 0.2
        total_weight += 0.2
        
        final_score = total_score / total_weight if total_weight > 0 else 0.5
        return min(1.0, final_score), matches[:3]
    
    @staticmethod
    def calculate_budget_fit(
        avg_cost: float,
        budget_range: Tuple[float, float],
        price_sensitivity: float
    ) -> Tuple[float, float]:
        """Calculate budget fit score"""
        min_budget, max_budget = budget_range
        
        if min_budget <= avg_cost <= max_budget:
            return 1.0, 0.0
        
        if avg_cost < min_budget:
            under_percent = (min_budget - avg_cost) / min_budget
            score = 0.85 - (under_percent * 0.2)
            return max(0.5, score), -(min_budget - avg_cost)
        
        over_percent = (avg_cost - max_budget) / max_budget
        penalty = over_percent * price_sensitivity
        score = max(0, 1 - penalty)
        
        return score, avg_cost - max_budget
    
    @staticmethod
    def calculate_seasonality(
        destination: Destination,
        context: RecommendationContext
    ) -> Tuple[float, List[str]]:
        """Calculate seasonal appropriateness"""
        factors = []
        
        if destination.peak_season == context.current_season:
            factors.append("Peak season - ideal weather")
            return 1.0, factors
        
        if destination.off_peak_season == context.current_season:
            factors.append("Off-peak - fewer crowds")
            return 0.6, factors
        
        return destination.current_season_score, factors
    
    @staticmethod
    def calculate_popularity(destination: Destination) -> float:
        """Calculate normalized popularity"""
        booking_score = FeatureEngineer.log_normalize(destination.booking_count, 3.0)
        review_score = FeatureEngineer.log_normalize(destination.review_count, 2.5)
        rating_score = FeatureEngineer.normalize_rating(destination.rating)
        
        return (booking_score * 0.3) + (review_score * 0.2) + (rating_score * 0.5)
    
    @staticmethod
    def calculate_quality(destination: Destination) -> Tuple[float, List[str]]:
        """Calculate overall quality score"""
        factors = []
        
        score = (
            destination.safety_score * 0.4 +
            destination.infrastructure_score * 0.25 +
            destination.accessibility_score * 0.15 +
            FeatureEngineer.normalize_rating(destination.rating) * 0.2
        )
        
        if destination.safety_score > 0.9:
            factors.append("Excellent safety rating")
        if destination.rating >= 4.5:
            factors.append(f"Highly rated ({destination.rating}/5)")
        
        return score, factors


# ─────────────────────────────────────────────────────────────
# SCORING ENGINE
# ─────────────────────────────────────────────────────────────

class ScoringEngine:
    """
    DETERMINISTIC scoring engine.
    Same inputs ALWAYS produce same outputs. NO RANDOMNESS.
    """
    
    def __init__(self, weights: Dict[str, float] = None):
        self.weights = weights or SCORING_WEIGHTS
        self._validate_weights()
    
    def _validate_weights(self):
        """Ensure weights sum to 1.0"""
        total = sum(self.weights.values())
        if abs(total - 1.0) > 0.001:
            raise ValueError(f"Weights must sum to 1.0, got {total}")
    
    def calculate_score(
        self,
        destination: Destination,
        user: UserProfile,
        context: RecommendationContext
    ) -> Tuple[float, ScoreBreakdown]:
        """Calculate final score"""
        # Calculate all features
        pref_score, _ = FeatureEngineer.calculate_preference_match(destination, user)
        budget_score, _ = FeatureEngineer.calculate_budget_fit(
            destination.avg_daily_cost,
            user.preferences.budget_range,
            user.preferences.price_sensitivity
        )
        seasonal_score, _ = FeatureEngineer.calculate_seasonality(destination, context)
        quality_score, _ = FeatureEngineer.calculate_quality(destination)
        
        breakdown = ScoreBreakdown(
            preference_match=pref_score,
            budget_fit=budget_score,
            seasonality=seasonal_score,
            popularity=FeatureEngineer.calculate_popularity(destination),
            quality=quality_score,
            distance=0.5,  # Would calculate from user location
            trending=destination.trending_score,
            social_proof=(
                FeatureEngineer.normalize_rating(destination.rating) * 0.5 +
                FeatureEngineer.log_normalize(destination.review_count) * 0.3 +
                destination.social_score * 0.2
            )
        )
        
        # Weighted sum
        raw_score = (
            breakdown.preference_match * self.weights["preference_match"] +
            breakdown.budget_fit * self.weights["budget_fit"] +
            breakdown.seasonality * self.weights["seasonality"] +
            breakdown.popularity * self.weights["popularity"] +
            breakdown.quality * self.weights["quality"] +
            breakdown.distance * self.weights["distance"] +
            breakdown.trending * self.weights["trending"] +
            breakdown.social_proof * self.weights["social_proof"]
        )
        
        final_score = round(raw_score * 100, 1)
        
        return min(100, max(0, final_score)), breakdown


# ─────────────────────────────────────────────────────────────
# RANKING ENGINE
# ─────────────────────────────────────────────────────────────

class RankingEngine:
    """Rank and diversify recommendations."""
    
    def __init__(
        self,
        scoring_engine: ScoringEngine,
        min_score: float = 40.0,
        max_same_category: int = 2
    ):
        self.scoring_engine = scoring_engine
        self.min_score = min_score
        self.max_same_category = max_same_category
    
    def rank(
        self,
        destinations: List[Destination],
        user: UserProfile,
        context: RecommendationContext
    ) -> List[RecommendationResult]:
        """Rank destinations for a user."""
        # Score all
        scored = []
        for dest in destinations:
            score, breakdown = self.scoring_engine.calculate_score(dest, user, context)
            if score >= self.min_score:
                scored.append((dest, score, breakdown))
        
        # Sort by score (descending)
        scored.sort(key=lambda x: (x[1], x[2].quality), reverse=True)
        
        # Apply diversity
        ranked = self._apply_diversity(scored)
        
        # Generate results
        results = []
        for rank, (dest, score, breakdown) in enumerate(ranked, 1):
            result = RecommendationResult(
                destination=dest,
                score=score,
                score_breakdown=breakdown,
                explanations=self._generate_explanations(dest, score, breakdown),
                tags=self._generate_tags(dest, breakdown)
            )
            results.append(result)
        
        return results
    
    def _apply_diversity(self, scored: List[Tuple[Destination, float, ScoreBreakdown]]) -> List:
        """Prevent same-category clustering"""
        if not scored:
            return []
        
        result = []
        remaining = list(scored)
        last_category = None
        consecutive_count = 0
        
        while remaining:
            best_idx = 0
            best_score = -1
            
            for i, (dest, score, _) in enumerate(remaining):
                primary_cat = dest.categories[0].value if dest.categories else 'other'
                is_same = primary_cat == last_category
                violates = is_same and consecutive_count >= self.max_same_category
                
                if not violates and score > best_score:
                    best_idx = i
                    best_score = score
            
            if best_score < 0:
                best_idx = 0
                consecutive_count = 0
            
            selected = remaining.pop(best_idx)
            primary_cat = selected[0].categories[0].value if selected[0].categories else 'other'
            
            if primary_cat == last_category:
                consecutive_count += 1
            else:
                consecutive_count = 1
                last_category = primary_cat
            
            result.append(selected)
        
        return result
    
    def _generate_explanations(self, dest: Destination, score: float, breakdown: ScoreBreakdown) -> List[str]:
        """Generate human-readable explanations"""
        explanations = []
        
        if breakdown.preference_match > 0.7:
            explanations.append("Matches your travel preferences")
        if breakdown.budget_fit > 0.8:
            explanations.append("Within your budget")
        if breakdown.quality > 0.8:
            explanations.append(f"Highly rated ({dest.rating}/5)")
        if breakdown.seasonality > 0.8:
            explanations.append("Perfect timing for your trip")
        
        return explanations[:3]
    
    def _generate_tags(self, dest: Destination, breakdown: ScoreBreakdown) -> List[str]:
        """Generate UI tags"""
        tags = []
        
        if dest.rating >= 4.5:
            tags.append("Top Rated")
        if breakdown.budget_fit > 0.8:
            tags.append("Budget Friendly")
        if dest.trending_score > 0.7:
            tags.append("Trending")
        if breakdown.quality > 0.85:
            tags.append("High Quality")
        
        if dest.categories:
            tags.append(dest.categories[0].value.title())
        
        return tags[:3]


# ─────────────────────────────────────────────────────────────
# RECOMMENDATION SERVICE
# ─────────────────────────────────────────────────────────────

class RecommendationService:
    """
    Main service for generating recommendations.
    """
    
    def __init__(self, db_service=None, cache_service=None):
        self.db = db_service
        self.cache = cache_service
        self.scoring_engine = ScoringEngine()
        self.ranking_engine = RankingEngine(self.scoring_engine)
    
    def get_recommendations(
        self,
        user_id: str,
        context: RecommendationContext,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """Get personalized recommendations for a user."""
        try:
            # Get user profile
            user = self._get_user_profile(user_id)
            
            # Get candidate destinations
            destinations = self._get_candidate_destinations(context)
            
            # Rank
            ranked = self.ranking_engine.rank(destinations, user, context)
            
            # Format response
            return [self._format_result(r) for r in ranked[:limit]]
            
        except Exception as e:
            logger.error(f"Error getting recommendations: {e}")
            return self._get_fallback_recommendations(limit)
    
    def _get_user_profile(self, user_id: str) -> UserProfile:
        """Fetch user profile from database."""
        # Default profile
        return UserProfile(
            id=user_id,
            preferences=UserPreferences(),
            last_active=datetime.utcnow()
        )
    
    def _get_candidate_destinations(self, context: RecommendationContext) -> List[Destination]:
        """Fetch candidate destinations."""
        # Would query database
        return []
    
    def _format_result(self, result: RecommendationResult) -> Dict[str, Any]:
        """Format result for API response."""
        return {
            "id": result.destination.id,
            "name": result.destination.name,
            "country": result.destination.country,
            "region": result.destination.region,
            "score": result.score,
            "score_breakdown": result.score_breakdown.to_dict(),
            "explanations": result.explanations,
            "tags": result.tags,
            "rating": result.destination.rating,
            "avg_daily_cost": result.destination.avg_daily_cost,
            "categories": [c.value for c in result.destination.categories],
        }
    
    def _get_fallback_recommendations(self, limit: int) -> List[Dict]:
        """Fallback recommendations on error."""
        return []


# Singleton instance
recommendation_service = RecommendationService()