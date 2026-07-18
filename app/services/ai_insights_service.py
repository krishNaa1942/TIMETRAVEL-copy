"""
AI Insights Service
Production-grade AI-powered insights generation for travel recommendations
"""

import os
import logging
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
import json

logger = logging.getLogger(__name__)


class InsightType(Enum):
    """Types of AI insights"""
    RECOMMENDATION = "recommendation"
    TIP = "tip"
    ALERT = "alert"
    PREDICTION = "prediction"
    TREND = "trend"
    PERSONALIZED_SUGGESTION = "personalized_suggestion"
    PRICE_INSIGHT = "price_insight"
    SEASONAL_INSIGHT = "seasonal_insight"
    BUDGET_INSIGHT = "budget_insight"
    SAFETY_INSIGHT = "safety_insight"


class InsightPriority(Enum):
    """Priority levels for insights"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


@dataclass
class Insight:
    """AI-generated insight"""
    id: str
    type: InsightType
    title: str
    content: str
    priority: InsightPriority
    relevance_score: float
    is_actionable: bool
    action_text: Optional[str] = None
    action_data: Optional[Dict[str, Any]] = None
    expires_at: Optional[datetime] = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    is_read: bool = False
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "type": self.type.value,
            "title": self.title,
            "content": self.content,
            "priority": self.priority.value,
            "relevance_score": self.relevance_score,
            "is_actionable": self.is_actionable,
            "action_text": self.action_text,
            "action_data": self.action_data,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "created_at": self.created_at.isoformat(),
            "is_read": self.is_read
        }


@dataclass
class UserContext:
    """User context for insight generation"""
    user_id: str
    preferences: Dict[str, Any] = field(default_factory=dict)
    search_history: List[Dict[str, Any]] = field(default_factory=list)
    booking_history: List[Dict[str, Any]] = field(default_factory=list)
    saved_destinations: List[Dict[str, Any]] = field(default_factory=list)
    active_trips: List[Dict[str, Any]] = field(default_factory=list)
    upcoming_trips: List[Dict[str, Any]] = field(default_factory=list)
    past_destinations: List[str] = field(default_factory=list)
    budget_range: tuple = (0, float('inf'))
    home_location: Optional[str] = None


class AIInsightsService:
    """
    AI-powered insights generation service.
    
    Generates personalized insights based on:
    - User behavior patterns
    - Travel trends
    - Seasonal factors
    - Budget optimization
    - Safety considerations
    """
    
    def __init__(self, db_service=None, recommendation_service=None, embedding_service=None):
        """
        Initialize AI insights service.
        
        Args:
            db_service: Database service
            recommendation_service: AI recommendation service
            embedding_service: Embedding service
        """
        self.db = db_service
        self.recommendation_service = recommendation_service
        self.embedding_service = embedding_service
        
        # Try to import OpenAI for advanced insights
        self._openai_client = None
        self.api_key = os.environ.get("OPENAI_API_KEY")
        
        try:
            import openai
            if self.api_key:
                self._openai_client = openai.OpenAI(api_key=self.api_key)
                logger.info("AI Insights: OpenAI client initialized")
        except ImportError:
            logger.warning("OpenAI package not installed - using rule-based insights")
    
    def generate_insights(
        self,
        user_id: str,
        context: UserContext,
        insight_types: List[InsightType] = None,
        limit: int = 10
    ) -> List[Insight]:
        """
        Generate personalized insights for a user.
        
        Args:
            user_id: User ID
            context: User context data
            insight_types: Filter by insight types (optional)
            limit: Maximum number of insights
            
        Returns:
            List of generated insights
        """
        insights = []
        
        # Default to all insight types
        if not insight_types:
            insight_types = list(InsightType)
        
        # Generate different types of insights
        if InsightType.RECOMMENDATION in insight_types:
            insights.extend(self._generate_recommendation_insights(context))
        
        if InsightType.TIP in insight_types:
            insights.extend(self._generate_tip_insights(context))
        
        if InsightType.ALERT in insight_types:
            insights.extend(self._generate_alert_insights(context))
        
        if InsightType.PREDICTION in insight_types:
            insights.extend(self._generate_prediction_insights(context))
        
        if InsightType.TREND in insight_types:
            insights.extend(self._generate_trend_insights(context))
        
        if InsightType.PERSONALIZED_SUGGESTION in insight_types:
            insights.extend(self._generate_personalized_suggestions(context))
        
        if InsightType.PRICE_INSIGHT in insight_types:
            insights.extend(self._generate_price_insights(context))
        
        if InsightType.SEASONAL_INSIGHT in insight_types:
            insights.extend(self._generate_seasonal_insights(context))
        
        if InsightType.BUDGET_INSIGHT in insight_types:
            insights.extend(self._generate_budget_insights(context))
        
        if InsightType.SAFETY_INSIGHT in insight_types:
            insights.extend(self._generate_safety_insights(context))
        
        # Sort by relevance score and priority
        insights.sort(key=lambda x: (x.priority.value, -x.relevance_score))
        
        return insights[:limit]
    
    def _generate_recommendation_insights(self, context: UserContext) -> List[Insight]:
        """Generate personalized recommendation insights."""
        insights = []
        
        # Analyze search patterns
        if context.search_history:
            recent_searches = context.search_history[:5]
            search_terms = [s.get("query", "") for s in recent_searches if s.get("query")]
            
            if search_terms:
                # Generate insight based on search patterns
                insight = Insight(
                    id=f"rec_search_{context.user_id}_{datetime.utcnow().timestamp()}",
                    type=InsightType.RECOMMENDATION,
                    title="Based on your recent searches",
                    content=f"You've been searching for {', '.join(search_terms[:3])}. These destinations match your interests perfectly!",
                    priority=InsightPriority.MEDIUM,
                    relevance_score=0.85,
                    is_actionable=True,
                    action_text="View recommendations",
                    action_data={"type": "search_based", "terms": search_terms},
                    expires_at=datetime.utcnow() + timedelta(days=7)
                )
                insights.append(insight)
        
        # Analyze booking patterns
        if context.booking_history:
            booked_destinations = [b.get("destination", "") for b in context.booking_history if b.get("destination")]
            if booked_destinations:
                insight = Insight(
                    id=f"rec_book_{context.user_id}_{datetime.utcnow().timestamp()}",
                    type=InsightType.RECOMMENDATION,
                    title="Destinations you might love",
                    content=f"Since you enjoyed {booked_destinations[0]}, we found similar destinations you'd like to explore.",
                    priority=InsightPriority.HIGH,
                    relevance_score=0.9,
                    is_actionable=True,
                    action_text="See similar destinations",
                    action_data={"type": "booking_based", "destinations": booked_destinations},
                    expires_at=datetime.utcnow() + timedelta(days=14)
                )
                insights.append(insight)
        
        return insights
    
    def _generate_tip_insights(self, context: UserContext) -> List[Insight]:
        """Generate travel tips based on user context."""
        insights = []
        
        # Tips based on upcoming trips
        if context.upcoming_trips:
            for trip in context.upcoming_trips[:3]:
                destination = trip.get("destination", "")
                start_date = trip.get("start_date")
                
                if destination and start_date:
                    days_until = (start_date - datetime.utcnow().date()).days if isinstance(start_date, datetime) else 7
                    
                    if days_until <= 14:
                        insight = Insight(
                            id=f"tip_upcoming_{context.user_id}_{datetime.utcnow().timestamp()}",
                            type=InsightType.TIP,
                            title=f"Trip to {destination} coming up!",
                            content=f"Your trip is in {days_until} days. Make sure to check visa requirements and weather forecast.",
                            priority=InsightPriority.HIGH if days_until <= 7 else InsightPriority.MEDIUM,
                            relevance_score=0.95,
                            is_actionable=True,
                            action_text="View trip details",
                            action_data={"type": "trip", "trip_id": trip.get("id")},
                            expires_at=datetime.utcnow() + timedelta(days=days_until)
                        )
                        insights.append(insight)
        
        # General travel tips
        if context.preferences.get("travel_style") == "adventure":
            insight = Insight(
                id=f"tip_adventure_{context.user_id}",
                type=InsightType.TIP,
                title="Adventure Travel Tip",
                content="For adventure travel, consider travel insurance that covers extreme activities. Many standard policies exclude them.",
                priority=InsightPriority.LOW,
                relevance_score=0.7,
                is_actionable=True,
                action_text="Learn more",
                action_data={"type": "tip", "category": "adventure"},
                expires_at=datetime.utcnow() + timedelta(days=30)
            )
            insights.append(insight)
        
        return insights
    
    def _generate_alert_insights(self, context: UserContext) -> List[Insight]:
        """Generate alert insights (price drops, weather alerts, etc.)."""
        insights = []
        
        # Price alerts for saved destinations
        if context.saved_destinations:
            for dest in context.saved_destinations[:5]:
                # Simulated price alert (would integrate with actual price tracking)
                insight = Insight(
                    id=f"alert_price_{context.user_id}_{dest.get('id', 'unknown')}",
                    type=InsightType.ALERT,
                    title=f"Price Drop: {dest.get('name', 'Destination')}",
                    content=f"Great news! Flight prices to {dest.get('name', 'this destination')} have dropped by 15%.",
                    priority=InsightPriority.HIGH,
                    relevance_score=0.92,
                    is_actionable=True,
                    action_text="View deal",
                    action_data={"type": "price_alert", "destination_id": dest.get("id")},
                    expires_at=datetime.utcnow() + timedelta(days=3)
                )
                insights.append(insight)
        
        return insights
    
    def _generate_prediction_insights(self, context: UserContext) -> List[Insight]:
        """Generate prediction insights using AI."""
        insights = []
        
        # Predict best time to visit based on history
        if context.past_destinations:
            insight = Insight(
                id=f"pred_timing_{context.user_id}",
                type=InsightType.PREDICTION,
                title="Best Time to Book",
                content="Based on your travel patterns, booking 6-8 weeks in advance typically gets you the best deals for your preferred destinations.",
                priority=InsightPriority.MEDIUM,
                relevance_score=0.75,
                is_actionable=True,
                action_text="Set price alert",
                action_data={"type": "prediction", "category": "timing"},
                expires_at=datetime.utcnow() + timedelta(days=14)
            )
            insights.append(insight)
        
        return insights
    
    def _generate_trend_insights(self, context: UserContext) -> List[Insight]:
        """Generate trend-based insights."""
        insights = []
        
        # Seasonal trends
        current_month = datetime.utcnow().month
        trending_destinations = self._get_trending_destinations(current_month)
        
        if trending_destinations:
            insight = Insight(
                id=f"trend_season_{context.user_id}",
                type=InsightType.TREND,
                title="Trending This Month",
                content=f"{trending_destinations[0]} is trending this month with 40% more travelers than usual. Book early to get the best rates!",
                priority=InsightPriority.MEDIUM,
                relevance_score=0.8,
                is_actionable=True,
                action_text="Explore trending destinations",
                action_data={"type": "trend", "destinations": trending_destinations},
                expires_at=datetime.utcnow() + timedelta(days=30)
            )
            insights.append(insight)
        
        return insights
    
    def _generate_personalized_suggestions(self, context: UserContext) -> List[Insight]:
        """Generate personalized suggestions based on user profile."""
        insights = []
        
        # Budget-based suggestions
        if context.budget_range and context.budget_range[1] < 1000:
            insight = Insight(
                id=f"suggest_budget_{context.user_id}",
                type=InsightType.PERSONALIZED_SUGGESTION,
                title="Budget-Friendly Suggestions",
                content="We found several destinations that fit your budget perfectly. Southeast Asia offers amazing experiences at affordable prices.",
                priority=InsightPriority.MEDIUM,
                relevance_score=0.85,
                is_actionable=True,
                action_text="View budget trips",
                action_data={"type": "suggestion", "category": "budget"},
                expires_at=datetime.utcnow() + timedelta(days=7)
            )
            insights.append(insight)
        
        # Style-based suggestions
        travel_style = context.preferences.get("travel_style")
        if travel_style == "relaxation":
            insight = Insight(
                id=f"suggest_relax_{context.user_id}",
                type=InsightType.PERSONALIZED_SUGGESTION,
                title="Perfect for Relaxation",
                content="Based on your preference for relaxation travel, consider spa resorts in Bali or beach destinations in the Maldives.",
                priority=InsightPriority.MEDIUM,
                relevance_score=0.88,
                is_actionable=True,
                action_text="Explore relaxation trips",
                action_data={"type": "suggestion", "category": "relaxation"},
                expires_at=datetime.utcnow() + timedelta(days=14)
            )
            insights.append(insight)
        
        return insights
    
    def _generate_price_insights(self, context: UserContext) -> List[Insight]:
        """Generate price-related insights."""
        insights = []
        
        # Price prediction insight
        if context.upcoming_trips:
            for trip in context.upcoming_trips[:2]:
                insight = Insight(
                    id=f"price_pred_{context.user_id}_{trip.get('id', 'unknown')}",
                    type=InsightType.PRICE_INSIGHT,
                    title="Price Forecast",
                    content=f"Prices for {trip.get('destination', 'your destination')} are expected to rise by 10% in the next 2 weeks. Consider booking soon!",
                    priority=InsightPriority.HIGH,
                    relevance_score=0.9,
                    is_actionable=True,
                    action_text="Book now",
                    action_data={"type": "price_prediction", "trip_id": trip.get("id")},
                    expires_at=datetime.utcnow() + timedelta(days=14)
                )
                insights.append(insight)
        
        return insights
    
    def _generate_seasonal_insights(self, context: UserContext) -> List[Insight]:
        """Generate seasonal insights."""
        insights = []
        
        current_month = datetime.utcnow().month
        
        # Seasonal destination suggestions
        if current_month in [11, 12, 1, 2]:  # Winter months
            insight = Insight(
                id=f"seasonal_winter_{context.user_id}",
                type=InsightType.SEASONAL_INSIGHT,
                title="Winter Escape Ideas",
                content="Looking to escape the cold? Tropical destinations like Thailand, Bali, and the Caribbean are perfect right now!",
                priority=InsightPriority.MEDIUM,
                relevance_score=0.82,
                is_actionable=True,
                action_text="View warm destinations",
                action_data={"type": "seasonal", "category": "winter_escape"},
                expires_at=datetime.utcnow() + timedelta(days=60)
            )
            insights.append(insight)
        elif current_month in [6, 7, 8]:  # Summer months
            insight = Insight(
                id=f"seasonal_summer_{context.user_id}",
                type=InsightType.SEASONAL_INSIGHT,
                title="Summer Travel Ideas",
                content="Summer is peak travel season! European destinations, national parks, and coastal towns are at their best.",
                priority=InsightPriority.MEDIUM,
                relevance_score=0.82,
                is_actionable=True,
                action_text="Explore summer destinations",
                action_data={"type": "seasonal", "category": "summer"},
                expires_at=datetime.utcnow() + timedelta(days=90)
            )
            insights.append(insight)
        
        return insights
    
    def _generate_budget_insights(self, context: UserContext) -> List[Insight]:
        """Generate budget optimization insights."""
        insights = []
        
        # Budget tracking insight
        if context.active_trips:
            for trip in context.active_trips:
                budget = trip.get("budget", 0)
                spent = trip.get("actual_spent", 0)
                if budget > 0:
                    remaining = budget - spent
                    percent_used = (spent / budget) * 100
                    
                    if percent_used > 80:
                        insight = Insight(
                            id=f"budget_warn_{context.user_id}_{trip.get('id', 'unknown')}",
                            type=InsightType.BUDGET_INSIGHT,
                            title="Budget Alert",
                            content=f"You've used {percent_used:.0f}% of your trip budget. Consider reviewing upcoming expenses.",
                            priority=InsightPriority.HIGH,
                            relevance_score=0.95,
                            is_actionable=True,
                            action_text="View budget breakdown",
                            action_data={"type": "budget", "trip_id": trip.get("id")},
                            expires_at=datetime.utcnow() + timedelta(days=7)
                        )
                        insights.append(insight)
        
        return insights
    
    def _generate_safety_insights(self, context: UserContext) -> List[Insight]:
        """Generate safety-related insights."""
        insights = []
        
        # Safety alerts for upcoming destinations
        if context.upcoming_trips:
            for trip in context.upcoming_trips:
                destination = trip.get("destination", "")
                # Would normally check a safety database
                insight = Insight(
                    id=f"safety_{context.user_id}_{trip.get('id', 'unknown')}",
                    type=InsightType.SAFETY_INSIGHT,
                    title=f"Safety Update: {destination}",
                    content=f"Stay informed about local safety guidelines for {destination}. Check vaccination requirements and local regulations.",
                    priority=InsightPriority.MEDIUM,
                    relevance_score=0.88,
                    is_actionable=True,
                    action_text="View safety info",
                    action_data={"type": "safety", "destination": destination},
                    expires_at=datetime.utcnow() + timedelta(days=30)
                )
                insights.append(insight)
        
        return insights
    
    def _get_trending_destinations(self, month: int) -> List[str]:
        """Get trending destinations for a given month."""
        # Simulated trending destinations by month
        trending_by_month = {
            1: ["Maldives", "Dubai", "Thailand"],
            2: ["Bali", "Vietnam", "Caribbean"],
            3: ["Japan", "Spain", "Greece"],
            4: ["Netherlands", "Turkey", "Morocco"],
            5: ["Italy", "France", "Croatia"],
            6: ["Iceland", "Norway", "Canada"],
            7: ["Alaska", "Switzerland", "New Zealand"],
            8: ["Kenya", "South Africa", "Peru"],
            9: ["Portugal", "California", "Australia"],
            10: ["India", "Nepal", "Argentina"],
            11: ["Mexico", "Egypt", "South Africa"],
            12: ["New Zealand", "Australia", "Argentina"]
        }
        return trending_by_month.get(month, ["Paris", "Tokyo", "New York"])
    
    def generate_ai_summary(
        self,
        user_id: str,
        context: UserContext
    ) -> Dict[str, Any]:
        """
        Generate an AI-powered summary of user's travel profile.
        
        Uses OpenAI if available, otherwise uses rule-based generation.
        """
        # Build profile summary
        profile_data = {
            "travel_style": context.preferences.get("travel_style", "unknown"),
            "destinations_visited": len(context.past_destinations),
            "upcoming_trips": len(context.upcoming_trips),
            "saved_destinations": len(context.saved_destinations),
            "search_activity": len(context.search_history),
            "budget_preference": context.preferences.get("budget", "moderate")
        }
        
        # Try OpenAI generation
        if self._openai_client:
            try:
                return self._generate_openai_summary(profile_data, context)
            except Exception as e:
                logger.error(f"OpenAI summary generation failed: {e}")
        
        # Fallback to rule-based summary
        return self._generate_rule_summary(profile_data, context)
    
    def _generate_openai_summary(
        self,
        profile_data: Dict,
        context: UserContext
    ) -> Dict[str, Any]:
        """Generate summary using OpenAI."""
        prompt = f"""
        Generate a personalized travel profile summary for a user with the following data:
        - Travel style: {profile_data['travel_style']}
        - Destinations visited: {profile_data['destinations_visited']}
        - Upcoming trips: {profile_data['upcoming_trips']}
        - Saved destinations: {profile_data['saved_destinations']}
        - Budget preference: {profile_data['budget_preference']}
        
        Create a brief, engaging summary (2-3 sentences) highlighting their travel personality and suggestions.
        """
        
        response = self._openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=150,
            temperature=0.7
        )
        
        summary = response.choices[0].message.content
        
        return {
            "summary": summary,
            "travel_personality": profile_data["travel_style"].capitalize(),
            "recommendations_count": profile_data["saved_destinations"],
            "generated_by": "openai"
        }
    
    def _generate_rule_summary(
        self,
        profile_data: Dict,
        context: UserContext
    ) -> Dict[str, Any]:
        """Generate summary using rules."""
        style = profile_data["travel_style"]
        
        personality_map = {
            "adventure": "Adventure Seeker",
            "relaxation": "Relaxation Enthusiast",
            "cultural": "Culture Explorer",
            "business": "Business Traveler"
        }
        
        personality = personality_map.get(style, "Curious Traveler")
        
        if profile_data["destinations_visited"] > 10:
            experience_level = "experienced"
            summary = f"You're an {experience_level} traveler with a passion for {style} experiences. With {profile_data['destinations_visited']} destinations explored, you have a wealth of travel knowledge!"
        elif profile_data["destinations_visited"] > 5:
            experience_level = "intermediate"
            summary = f"You're building an impressive travel portfolio! Your {style} style is taking you places."
        else:
            experience_level = "emerging"
            summary = f"You're a {personality.lower()} with exciting journeys ahead. Start exploring to discover your perfect destinations!"
        
        return {
            "summary": summary,
            "travel_personality": personality,
            "recommendations_count": profile_data["saved_destinations"],
            "experience_level": experience_level,
            "generated_by": "rules"
        }


# Singleton instance
ai_insights_service = AIInsightsService()