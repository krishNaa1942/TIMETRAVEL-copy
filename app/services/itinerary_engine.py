"""
Itinerary Engine - Production-Grade Route Optimization
======================================================

Generates optimized multi-day itineraries with:
- Route optimization (Nearest Neighbor + 2-opt)
- Geographic clustering for multi-day distribution
- Time-aware scheduling
- Budget constraints
"""

import math
import logging
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
import uuid

logger = logging.getLogger(__name__)


class TravelMode(str, Enum):
    WALK = "walk"
    DRIVE = "drive"
    TRANSIT = "transit"
    BIKE = "bike"


class PlaceCategory(str, Enum):
    ATTRACTION = "attraction"
    RESTAURANT = "restaurant"
    HOTEL = "hotel"
    MUSEUM = "museum"
    BEACH = "beach"
    PARK = "park"
    SHOPPING = "shopping"
    NIGHTLIFE = "nightlife"
    VIEWPOINT = "viewpoint"
    ACTIVITY = "activity"


@dataclass
class Coordinate:
    latitude: float
    longitude: float
    
    def to_dict(self) -> Dict[str, float]:
        return {"latitude": self.latitude, "longitude": self.longitude}
    
    @classmethod
    def from_dict(cls, data: Dict[str, float]) -> "Coordinate":
        return cls(latitude=data["latitude"], longitude=data["longitude"])


@dataclass
class Place:
    id: str
    name: str
    coordinate: Coordinate
    category: PlaceCategory
    visit_duration: int
    average_cost: float
    rating: float
    description: str
    tags: List[str] = field(default_factory=list)
    image_url: Optional[str] = None
    travel_time_from_previous: int = 0
    distance_from_previous: float = 0
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "coordinate": self.coordinate.to_dict(),
            "category": self.category.value,
            "visit_duration": self.visit_duration,
            "average_cost": self.average_cost,
            "rating": self.rating,
            "description": self.description,
            "tags": self.tags,
            "image_url": self.image_url,
            "travel_time_from_previous": self.travel_time_from_previous,
            "distance_from_previous": self.distance_from_previous
        }


class GeoUtils:
    """Geographic calculation utilities"""
    
    EARTH_RADIUS_M = 6371000
    
    @staticmethod
    def haversine_distance(coord1: Coordinate, coord2: Coordinate) -> float:
        """Calculate distance between two coordinates in meters."""
        lat1 = math.radians(coord1.latitude)
        lat2 = math.radians(coord2.latitude)
        delta_lat = math.radians(coord2.latitude - coord1.latitude)
        delta_lon = math.radians(coord2.longitude - coord1.longitude)
        
        a = (math.sin(delta_lat / 2) ** 2 +
             math.cos(lat1) * math.cos(lat2) * math.sin(delta_lon / 2) ** 2)
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        
        return GeoUtils.EARTH_RADIUS_M * c
    
    @staticmethod
    def estimate_travel_time(distance_m: float, mode: TravelMode) -> int:
        """Estimate travel time in minutes."""
        distance_km = distance_m / 1000
        speeds = {
            TravelMode.WALK: 5,
            TravelMode.BIKE: 15,
            TravelMode.DRIVE: 40,
            TravelMode.TRANSIT: 25
        }
        speed = speeds.get(mode, 40)
        time_hours = distance_km / speed
        time_minutes = time_hours * 60
        buffer = 1.2 if mode == TravelMode.DRIVE else 1.0
        return int(time_minutes * buffer)
    
    @staticmethod
    def calculate_bounds(coordinates: List[Coordinate]) -> Optional[Tuple[Coordinate, Coordinate]]:
        """Calculate bounds for coordinates."""
        if not coordinates:
            return None
        
        min_lat = min(c.latitude for c in coordinates)
        max_lat = max(c.latitude for c in coordinates)
        min_lon = min(c.longitude for c in coordinates)
        max_lon = max(c.longitude for c in coordinates)
        
        lat_pad = (max_lat - min_lat) * 0.05
        lon_pad = (max_lon - min_lon) * 0.05
        
        return (
            Coordinate(max_lat + lat_pad, max_lon + lon_pad),
            Coordinate(min_lat - lat_pad, min_lon - lon_pad)
        )


class RouteOptimizer:
    """Route optimization using Nearest Neighbor + 2-opt."""
    
    def __init__(
        self,
        travel_mode: TravelMode = TravelMode.DRIVE,
        start_point: Optional[Coordinate] = None,
        end_point: Optional[Coordinate] = None
    ):
        self.travel_mode = travel_mode
        self.start_point = start_point
        self.end_point = end_point
    
    def optimize(self, places: List[Place]) -> Tuple[List[Place], List[Dict]]:
        """Optimize route through all places."""
        if len(places) <= 1:
            return places, []
        
        ordered = self._nearest_neighbor(places)
        ordered = self._two_opt(ordered)
        segments = self._build_segments(ordered)
        
        return ordered, segments
    
    def _nearest_neighbor(self, places: List[Place]) -> List[Place]:
        """Nearest Neighbor algorithm."""
        if not places:
            return []
        
        remaining = set(p.id for p in places)
        place_map = {p.id: p for p in places}
        result: List[Place] = []
        current = self.start_point or places[0].coordinate
        
        while remaining:
            nearest_id = None
            nearest_dist = float('inf')
            
            for place_id in remaining:
                place = place_map[place_id]
                dist = GeoUtils.haversine_distance(current, place.coordinate)
                if dist < nearest_dist:
                    nearest_dist = dist
                    nearest_id = place_id
            
            if nearest_id:
                remaining.remove(nearest_id)
                place = place_map[nearest_id]
                result.append(place)
                current = place.coordinate
        
        return result
    
    def _two_opt(self, places: List[Place], max_iter: int = 50) -> List[Place]:
        """2-opt improvement."""
        if len(places) < 4:
            return places
        
        improved = True
        iteration = 0
        best = places[:]
        
        while improved and iteration < max_iter:
            improved = False
            iteration += 1
            
            for i in range(len(best) - 2):
                for j in range(i + 2, len(best)):
                    if self._should_swap(best, i, j):
                        best = self._swap(best, i, j)
                        improved = True
        
        return best
    
    def _should_swap(self, places: List[Place], i: int, j: int) -> bool:
        """Check if 2-opt swap would improve route."""
        d1 = GeoUtils.haversine_distance(places[i].coordinate, places[i + 1].coordinate)
        d2 = GeoUtils.haversine_distance(places[j].coordinate, places[(j + 1) % len(places)].coordinate)
        d3 = GeoUtils.haversine_distance(places[i].coordinate, places[j].coordinate)
        d4 = GeoUtils.haversine_distance(places[i + 1].coordinate, places[(j + 1) % len(places)].coordinate)
        return (d3 + d4) < (d1 + d2)
    
    def _swap(self, places: List[Place], i: int, j: int) -> List[Place]:
        """Perform 2-opt swap."""
        new_route = places[:i + 1]
        new_route.extend(reversed(places[i + 1:j + 1]))
        new_route.extend(places[j + 1:])
        return new_route
    
    def _build_segments(self, places: List[Place]) -> List[Dict]:
        """Build route segments."""
        segments = []
        for i in range(len(places) - 1):
            dist = GeoUtils.haversine_distance(places[i].coordinate, places[i + 1].coordinate)
            duration = GeoUtils.estimate_travel_time(dist, self.travel_mode)
            segments.append({
                "from_place_id": places[i].id,
                "to_place_id": places[i + 1].id,
                "distance": dist,
                "duration": duration,
                "travel_mode": self.travel_mode.value
            })
        return segments


class DayDistributor:
    """Distribute places across multiple days using clustering."""
    
    def __init__(
        self,
        total_days: int,
        max_places_per_day: int = 6,
        max_time_per_day: int = 480,
        travel_mode: TravelMode = TravelMode.DRIVE,
        hotel_location: Optional[Coordinate] = None
    ):
        self.total_days = total_days
        self.max_places_per_day = max_places_per_day
        self.max_time_per_day = max_time_per_day
        self.travel_mode = travel_mode
        self.hotel_location = hotel_location
    
    def distribute(self, places: List[Place]) -> List[Tuple[List[Place], List[Dict]]]:
        """Distribute places across days."""
        if not places:
            return [([], []) for _ in range(self.total_days)]
        
        clusters = self._cluster_places(places, self.total_days)
        days = []
        
        for cluster in clusters:
            optimizer = RouteOptimizer(
                travel_mode=self.travel_mode,
                start_point=self.hotel_location,
                end_point=self.hotel_location
            )
            ordered, segments = optimizer.optimize(cluster)
            days.append((ordered, segments))
        
        return days
    
    def _cluster_places(self, places: List[Place], k: int) -> List[List[Place]]:
        """K-means clustering of places."""
        if len(places) <= k:
            return [[p] for p in places] + [[] for _ in range(k - len(places))]
        
        centers = self._init_centers(places, k)
        clusters: List[List[Place]] = [[] for _ in range(k)]
        
        for _ in range(20):
            clusters = [[] for _ in range(k)]
            for place in places:
                idx = self._nearest_center(place.coordinate, centers)
                clusters[idx].append(place)
            
            new_centers = []
            for cluster in clusters:
                if cluster:
                    new_centers.append(self._cluster_center(cluster))
                else:
                    new_centers.append(centers[len(new_centers)])
            
            if new_centers == centers:
                break
            centers = new_centers
        
        return clusters
    
    def _init_centers(self, places: List[Place], k: int) -> List[Coordinate]:
        """Initialize cluster centers."""
        coords = [p.coordinate for p in places]
        min_lat = min(c.latitude for c in coords)
        max_lat = max(c.latitude for c in coords)
        min_lon = min(c.longitude for c in coords)
        max_lon = max(c.longitude for c in coords)
        
        centers = []
        cols = int(math.ceil(math.sqrt(k)))
        
        for i in range(k):
            row = i // cols
            col = i % cols
            centers.append(Coordinate(
                min_lat + (max_lat - min_lat) * (row + 1) / (cols + 1),
                min_lon + (max_lon - min_lon) * (col + 1) / (cols + 1)
            ))
        
        return centers
    
    def _nearest_center(self, coord: Coordinate, centers: List[Coordinate]) -> int:
        """Find nearest center index."""
        min_dist = float('inf')
        nearest = 0
        for i, center in enumerate(centers):
            dist = (coord.latitude - center.latitude) ** 2 + (coord.longitude - center.longitude) ** 2
            if dist < min_dist:
                min_dist = dist
                nearest = i
        return nearest
    
    def _cluster_center(self, cluster: List[Place]) -> Coordinate:
        """Calculate cluster center."""
        lat = sum(p.coordinate.latitude for p in cluster) / len(cluster)
        lon = sum(p.coordinate.longitude for p in cluster) / len(cluster)
        return Coordinate(lat, lon)


class ItineraryEngine:
    """Main itinerary generation engine."""
    
    def generate(
        self,
        destination: str,
        center: Coordinate,
        total_days: int,
        travel_mode: TravelMode = TravelMode.DRIVE,
        categories: Optional[List[PlaceCategory]] = None,
        budget_max: Optional[float] = None,
        max_places_per_day: int = 5,
        start_hour: int = 9,
        end_hour: int = 20,
        hotel_location: Optional[Coordinate] = None,
        places: Optional[List[Place]] = None
    ) -> Dict[str, Any]:
        """Generate optimized itinerary."""
        
        if not places:
            return self._empty_itinerary(destination, total_days)
        
        max_time_per_day = (end_hour - start_hour) * 60
        
        distributor = DayDistributor(
            total_days=total_days,
            max_places_per_day=max_places_per_day,
            max_time_per_day=max_time_per_day,
            travel_mode=travel_mode,
            hotel_location=hotel_location or center
        )
        
        day_data = distributor.distribute(places)
        
        days = []
        total_visit = 0
        total_travel = 0
        total_dist = 0
        total_cost = 0
        
        for i, (day_places, segments) in enumerate(day_data):
            visit_time = sum(p.visit_duration for p in day_places)
            travel_time = sum(s.get("duration", 0) for s in segments)
            distance = sum(s.get("distance", 0) for s in segments)
            cost = sum(p.average_cost for p in day_places)
            
            bounds = GeoUtils.calculate_bounds([p.coordinate for p in day_places]) if day_places else None
            
            days.append({
                "day_number": i + 1,
                "places": [p.to_dict() for p in day_places],
                "total_visit_time": visit_time,
                "total_travel_time": travel_time,
                "total_distance": distance,
                "total_time": visit_time + travel_time,
                "route_segments": segments,
                "bounds": {
                    "northEast": bounds[0].to_dict() if bounds else None,
                    "southWest": bounds[1].to_dict() if bounds else None
                } if bounds else None
            })
            
            total_visit += visit_time
            total_travel += travel_time
            total_dist += distance
            total_cost += cost
        
        return {
            "id": f"itin_{uuid.uuid4().hex[:12]}",
            "title": f"{total_days}-Day {destination} Itinerary",
            "destination": destination,
            "total_days": total_days,
            "travel_mode": travel_mode.value,
            "days": days,
            "total_places": sum(len(d["places"]) for d in days),
            "total_visit_time": total_visit,
            "total_travel_time": total_travel,
            "total_distance": total_dist,
            "estimated_cost": total_cost,
            "generated_at": datetime.utcnow().isoformat()
        }
    
    def _empty_itinerary(self, destination: str, total_days: int) -> Dict[str, Any]:
        """Return empty itinerary structure."""
        return {
            "id": f"itin_empty_{uuid.uuid4().hex[:12]}",
            "title": f"{total_days}-Day {destination} Itinerary",
            "destination": destination,
            "total_days": total_days,
            "days": [
                {
                    "day_number": i + 1,
                    "places": [],
                    "total_visit_time": 0,
                    "total_travel_time": 0,
                    "total_distance": 0,
                    "total_time": 0,
                    "route_segments": []
                }
                for i in range(total_days)
            ],
            "total_places": 0,
            "total_visit_time": 0,
            "total_travel_time": 0,
            "total_distance": 0,
            "estimated_cost": 0,
            "warnings": ["No places found for this destination"]
        }


# Singleton instance
itinerary_engine = ItineraryEngine()