/**
 * Route Optimizer Service
 * Production-grade route optimization using Nearest Neighbor + 2-opt
 * 
 * Algorithms:
 * 1. Nearest Neighbor (O(n²)) - Fast approximation
 * 2. 2-opt improvement (O(n²) per iteration) - Refinement
 * 
 * @example
 * const optimizer = new RouteOptimizer({ travelMode: 'drive' });
 * const result = optimizer.optimize(places);
 */

import {
  Place,
  Coordinate,
  RouteSegment,
  TravelMode,
  OptimizationConfig,
  OptimizationResult
} from '@/types/itinerary';
import { haversineDistance, estimateTravelTime } from '@/utils/geoUtils';

/**
 * Default optimization configuration
 */
const DEFAULT_CONFIG: OptimizationConfig = {
  travelMode: 'drive',
  respectOpeningHours: false
};

/**
 * Route Optimizer Class
 * 
 * Implements production-grade route optimization:
 * - Nearest Neighbor for initial solution
 * - 2-opt for improvement
 * - Handles start/end points (hotel)
 * 
 * Time Complexity: O(n²) for NN, O(n² × iterations) for 2-opt
 * Space Complexity: O(n)
 */
export class RouteOptimizer {
  private config: OptimizationConfig;

  constructor(config: Partial<OptimizationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Optimize route through all places
   * 
   * Two-phase approach:
   * 1. Nearest Neighbor for quick initial solution
   * 2. 2-opt improvement for refinement
   * 
   * @param places - Places to optimize
   * @returns Optimization result with ordered places and metrics
   */
  optimize(places: Place[]): OptimizationResult {
    if (places.length === 0) {
      return this.emptyResult();
    }

    if (places.length === 1) {
      return this.singlePlaceResult(places[0]);
    }

    // Phase 1: Nearest Neighbor
    const nnResult = this.optimizeNearestNeighbor(places);

    // Phase 2: 2-opt improvement
    const improved = this.optimize2Opt(nnResult);

    return improved;
  }

  /**
   * Nearest Neighbor Algorithm
   * 
   * Algorithm:
   * 1. Start from hotel/first place
   * 2. Find nearest unvisited place
   * 3. Move to that place
   * 4. Repeat until all places visited
   * 5. Return to hotel if endpoint specified
   * 
   * Time: O(n²), Space: O(n)
   */
  optimizeNearestNeighbor(places: Place[]): OptimizationResult {
    const visited: Set<string> = new Set();
    const orderedPlaces: Place[] = [];
    const routeSegments: RouteSegment[] = [];

    let totalDistance = 0;
    let totalTravelTime = 0;
    let totalVisitTime = 0;

    // Starting point
    let currentLocation: Coordinate = this.config.startPoint || places[0].coordinate;
    let currentPlace: Place | null = null;

    while (visited.size < places.length) {
      // Find nearest unvisited place
      const nearest = this.findNearestUnvisited(currentLocation, places, visited);

      if (!nearest) break;

      // Mark as visited
      visited.add(nearest.place.id);

      // Calculate travel to this place
      const distance = haversineDistance(currentLocation, nearest.place.coordinate);
      const travelTime = estimateTravelTime(distance, this.config.travelMode);

      // Create route segment
      if (currentPlace) {
        routeSegments.push({
          from: currentPlace,
          to: nearest.place,
          distance,
          duration: travelTime,
          travelMode: this.config.travelMode
        });
      }

      // Update totals
      totalDistance += distance;
      totalTravelTime += travelTime;
      totalVisitTime += nearest.place.visitDuration;

      // Update tracking
      currentLocation = nearest.place.coordinate;
      currentPlace = nearest.place;
      orderedPlaces.push({
        ...nearest.place,
        travelTimeFromPrevious: orderedPlaces.length > 0 ? travelTime : 0,
        distanceFromPrevious: orderedPlaces.length > 0 ? distance : 0
      });
    }

    // Return to endpoint if specified
    if (this.config.endPoint && orderedPlaces.length > 0) {
      const returnDistance = haversineDistance(currentLocation, this.config.endPoint);
      const returnTime = estimateTravelTime(returnDistance, this.config.travelMode);

      totalDistance += returnDistance;
      totalTravelTime += returnTime;
    }

    return {
      orderedPlaces,
      routeSegments,
      totalDistance,
      totalTravelTime,
      totalVisitTime
    };
  }

  /**
   * 2-opt Improvement Algorithm
   * 
   * Swaps pairs of edges to reduce total distance
   * 
   * Time: O(n² × iterations), Space: O(n)
   */
  optimize2Opt(
    initialResult: OptimizationResult,
    maxIterations: number = 50
  ): OptimizationResult {
    if (initialResult.orderedPlaces.length < 4) {
      return initialResult;
    }

    let best = initialResult;
    let improved = true;
    let iterations = 0;

    while (improved && iterations < maxIterations) {
      improved = false;
      iterations++;

      const currentPlaces = best.orderedPlaces;

      // Try all pairs of edges
      for (let i = 0; i < currentPlaces.length - 2; i++) {
        for (let j = i + 2; j < currentPlaces.length; j++) {
          // Check if swap would improve
          if (this.shouldSwap(currentPlaces, i, j)) {
            // Perform swap
            const newPlaces = this.swap2Opt(currentPlaces, i, j);
            
            // Calculate new total distance
            const newDistance = this.calculateTotalDistance(newPlaces);

            if (newDistance < best.totalDistance) {
              // Rebuild route with new order
              best = this.rebuildRoute(newPlaces);
              improved = true;
            }
          }
        }
      }
    }

    return best;
  }

  /**
   * Find nearest unvisited place
   */
  private findNearestUnvisited(
    from: Coordinate,
    places: Place[],
    visited: Set<string>
  ): { place: Place; distance: number } | null {
    let nearest: Place | null = null;
    let minDistance = Infinity;

    for (const place of places) {
      if (visited.has(place.id)) continue;

      const distance = haversineDistance(from, place.coordinate);

      if (distance < minDistance) {
        minDistance = distance;
        nearest = place;
      }
    }

    return nearest ? { place: nearest, distance: minDistance } : null;
  }

  /**
   * Check if 2-opt swap would improve route
   */
  private shouldSwap(places: Place[], i: number, j: number): boolean {
    // Current edges: (i -> i+1) and (j -> j+1)
    const d1 = haversineDistance(places[i].coordinate, places[i + 1].coordinate);
    const d2 = j + 1 < places.length
      ? haversineDistance(places[j].coordinate, places[j + 1].coordinate)
      : 0;

    // New edges after swap: (i -> j) and (i+1 -> j+1)
    const d3 = haversineDistance(places[i].coordinate, places[j].coordinate);
    const d4 = j + 1 < places.length
      ? haversineDistance(places[i + 1].coordinate, places[j + 1].coordinate)
      : 0;

    return (d3 + d4) < (d1 + d2);
  }

  /**
   * Perform 2-opt swap by reversing segment
   */
  private swap2Opt(places: Place[], i: number, j: number): Place[] {
    const newPlaces = [...places];

    // Reverse segment between i+1 and j
    const segment = newPlaces.slice(i + 1, j + 1);
    segment.reverse();

    // Reconstruct
    return [
      ...newPlaces.slice(0, i + 1),
      ...segment,
      ...newPlaces.slice(j + 1)
    ];
  }

  /**
   * Calculate total distance of a route
   */
  private calculateTotalDistance(places: Place[]): number {
    let total = 0;

    // From start point
    if (this.config.startPoint && places.length > 0) {
      total += haversineDistance(this.config.startPoint, places[0].coordinate);
    }

    // Between places
    for (let i = 0; i < places.length - 1; i++) {
      total += haversineDistance(places[i].coordinate, places[i + 1].coordinate);
    }

    // To end point
    if (this.config.endPoint && places.length > 0) {
      total += haversineDistance(
        places[places.length - 1].coordinate,
        this.config.endPoint
      );
    }

    return total;
  }

  /**
   * Rebuild route segments after order change
   */
  private rebuildRoute(places: Place[]): OptimizationResult {
    const routeSegments: RouteSegment[] = [];
    let totalDistance = 0;
    let totalTravelTime = 0;
    let totalVisitTime = 0;

    let prevLocation: Coordinate = this.config.startPoint || places[0]?.coordinate;
    let prevPlace: Place | null = null;

    for (const place of places) {
      totalVisitTime += place.visitDuration;

      if (prevPlace) {
        const distance = haversineDistance(prevLocation, place.coordinate);
        const travelTime = estimateTravelTime(distance, this.config.travelMode);

        totalDistance += distance;
        totalTravelTime += travelTime;

        routeSegments.push({
          from: prevPlace,
          to: place,
          distance,
          duration: travelTime,
          travelMode: this.config.travelMode
        });
      }

      prevLocation = place.coordinate;
      prevPlace = place;
    }

    // Return to endpoint
    if (this.config.endPoint && places.length > 0) {
      const returnDistance = haversineDistance(prevLocation, this.config.endPoint);
      totalDistance += returnDistance;
      totalTravelTime += estimateTravelTime(returnDistance, this.config.travelMode);
    }

    // Update places with travel info
    const orderedPlaces = places.map((place, index) => {
      const prev = index > 0 ? places[index - 1] : null;
      const distance = prev ? haversineDistance(prev.coordinate, place.coordinate) : 0;
      const travelTime = prev ? estimateTravelTime(distance, this.config.travelMode) : 0;

      return {
        ...place,
        travelTimeFromPrevious: travelTime,
        distanceFromPrevious: distance
      };
    });

    return {
      orderedPlaces,
      routeSegments,
      totalDistance,
      totalTravelTime,
      totalVisitTime
    };
  }

  /**
   * Empty result helper
   */
  private emptyResult(): OptimizationResult {
    return {
      orderedPlaces: [],
      routeSegments: [],
      totalDistance: 0,
      totalTravelTime: 0,
      totalVisitTime: 0
    };
  }

  /**
   * Single place result helper
   */
  private singlePlaceResult(place: Place): OptimizationResult {
    return {
      orderedPlaces: [{
        ...place,
        travelTimeFromPrevious: 0,
        distanceFromPrevious: 0
      }],
      routeSegments: [],
      totalDistance: 0,
      totalTravelTime: 0,
      totalVisitTime: place.visitDuration
    };
  }
}

/**
 * Quick optimization function
 * 
 * @param places - Places to optimize
 * @param config - Optimization configuration
 * @returns Optimized route
 */
export function optimizeRoute(
  places: Place[],
  config: Partial<OptimizationConfig> = {}
): OptimizationResult {
  const optimizer = new RouteOptimizer(config);
  return optimizer.optimize(places);
}

/**
 * Calculate route metrics without optimization
 * 
 * Useful for comparing optimized vs original routes
 */
export function calculateRouteMetrics(
  places: Place[],
  travelMode: TravelMode = 'drive'
): { distance: number; travelTime: number; visitTime: number } {
  let distance = 0;
  let travelTime = 0;
  let visitTime = 0;

  for (let i = 0; i < places.length; i++) {
    visitTime += places[i].visitDuration;

    if (i > 0) {
      const d = haversineDistance(places[i - 1].coordinate, places[i].coordinate);
      distance += d;
      travelTime += estimateTravelTime(d, travelMode);
    }
  }

  return { distance, travelTime, visitTime };
}

export default {
  RouteOptimizer,
  optimizeRoute,
  calculateRouteMetrics
};