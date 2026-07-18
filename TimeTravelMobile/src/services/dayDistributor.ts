/**
 * Day Distributor Service
 * Distributes places across multiple days using geographic clustering
 * 
 * Features:
 * - K-means style clustering
 * - Time constraint balancing
 * - Workload distribution
 * 
 * @example
 * const distributor = new DayDistributor({ totalDays: 3 });
 * const result = distributor.distribute(places);
 */

import {
  Place,
  Coordinate,
  ItineraryDay,
  TravelMode,
  DistributionConfig,
  DistributionResult
} from '@/types/itinerary';
import { RouteOptimizer } from './routeOptimizer';
import { calculateBounds, haversineDistance } from '@/utils/geoUtils';

/**
 * Default distribution configuration
 */
const DEFAULT_CONFIG: DistributionConfig = {
  totalDays: 1,
  maxPlacesPerDay: 6,
  maxVisitTimePerDay: 480,    // 8 hours
  maxTravelTimePerDay: 120,   // 2 hours
  startHour: 9,
  endHour: 20,
  travelMode: 'drive'
};

/**
 * Day Distributor Class
 * 
 * Distributes places across multiple days:
 * 1. Cluster nearby places geographically
 * 2. Balance workload per day
 * 3. Respect time constraints
 */
export class DayDistributor {
  private config: DistributionConfig;
  private optimizer: RouteOptimizer;

  constructor(config: Partial<DistributionConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.optimizer = new RouteOptimizer({
      travelMode: this.config.travelMode,
      startPoint: this.config.hotelLocation,
      endPoint: this.config.hotelLocation,
      respectOpeningHours: false
    });
  }

  /**
   * Distribute places across days
   * 
   * Algorithm:
   * 1. Sort places by location (geographic clustering)
   * 2. Group into clusters for each day
   * 3. Optimize each day's route
   * 4. Balance if needed
   */
  distribute(places: Place[]): DistributionResult {
    const warnings: string[] = [];

    if (places.length === 0) {
      return this.emptyResult(warnings);
    }

    // Calculate total time needed
    const totalVisitTime = places.reduce((sum, p) => sum + p.visitDuration, 0);
    const avgVisitTimePerDay = totalVisitTime / this.config.totalDays;

    // Check if feasible
    const availableTimePerDay = (this.config.endHour - this.config.startHour) * 60;
    if (avgVisitTimePerDay > availableTimePerDay * 0.7) {
      warnings.push('Tight schedule - consider adding more days or reducing places');
    }

    // Step 1: Cluster places geographically
    const clusters = this.clusterPlaces(places, this.config.totalDays);

    // Step 2: Create days from clusters
    const days: ItineraryDay[] = [];
    let totalTravelTime = 0;
    let totalDistance = 0;

    for (let i = 0; i < clusters.length; i++) {
      const cluster = clusters[i];

      // Optimize route for this day
      const optimized = this.optimizer.optimize(cluster);

      // Check constraints
      if (optimized.orderedPlaces.length > this.config.maxPlacesPerDay) {
        warnings.push(
          `Day ${i + 1} has ${optimized.orderedPlaces.length} places (max: ${this.config.maxPlacesPerDay})`
        );
      }

      if (optimized.totalTravelTime > this.config.maxTravelTimePerDay) {
        warnings.push(
          `Day ${i + 1} has ${optimized.totalTravelTime}min travel (max: ${this.config.maxTravelTimePerDay})`
        );
      }

      // Calculate bounds
      const bounds = optimized.orderedPlaces.length > 0
        ? calculateBounds(optimized.orderedPlaces.map(p => p.coordinate))
        : undefined;

      // Create start location placeholder if hotel location exists
      const startLocation = this.config.hotelLocation ? {
        id: 'hotel',
        name: 'Hotel',
        coordinate: this.config.hotelLocation,
        category: 'hotel' as const,
        visitDuration: 0,
        averageCost: 0,
        rating: 0,
        description: 'Starting point',
        tags: []
      } : undefined;

      const day: ItineraryDay = {
        dayNumber: i + 1,
        places: optimized.orderedPlaces,
        totalVisitTime: optimized.totalVisitTime,
        totalTravelTime: optimized.totalTravelTime,
        totalDistance: optimized.totalDistance,
        totalTime: optimized.totalVisitTime + optimized.totalTravelTime,
        routeSegments: optimized.routeSegments,
        bounds: bounds || undefined,
        startLocation
      };

      days.push(day);
      totalTravelTime += optimized.totalTravelTime;
      totalDistance += optimized.totalDistance;
    }

    // Step 3: Balance days if needed
    const balancedDays = this.balanceDays(days);

    return {
      days: balancedDays,
      totalPlaces: places.length,
      totalVisitTime,
      totalTravelTime,
      totalDistance,
      warnings
    };
  }

  /**
   * Cluster places using geographic proximity (K-means style)
   */
  private clusterPlaces(places: Place[], k: number): Place[][] {
    if (places.length <= k) {
      // One place per cluster (or empty clusters)
      const clusters: Place[][] = Array(k).fill(null).map(() => []);
      places.forEach((place, i) => {
        if (i < k) clusters[i].push(place);
        else clusters[0].push(place);
      });
      return clusters;
    }

    // Initialize cluster centers
    const centers = this.initializeCenters(places, k);

    // Assign places to nearest center
    let clusters: Place[][] = Array(k).fill(null).map(() => []);
    let changed = true;
    let iterations = 0;
    const maxIterations = 50;

    while (changed && iterations < maxIterations) {
      changed = false;
      iterations++;

      // Clear clusters
      clusters = Array(k).fill(null).map(() => []);

      // Assign each place to nearest center
      for (const place of places) {
        let minDist = Infinity;
        let nearestCluster = 0;

        for (let i = 0; i < centers.length; i++) {
          const dist = this.distanceSquared(place.coordinate, centers[i]);
          if (dist < minDist) {
            minDist = dist;
            nearestCluster = i;
          }
        }

        clusters[nearestCluster].push(place);
      }

      // Update centers
      for (let i = 0; i < k; i++) {
        if (clusters[i].length > 0) {
          const newCenter = this.calculateCenter(clusters[i]);
          if (!this.coordinatesEqual(centers[i], newCenter)) {
            centers[i] = newCenter;
            changed = true;
          }
        }
      }
    }

    // Balance clusters by time constraint
    clusters = this.balanceClustersByTime(clusters);

    return clusters;
  }

  /**
   * Initialize cluster centers spread across the area
   */
  private initializeCenters(places: Place[], k: number): Coordinate[] {
    // Find bounds
    let minLat = Infinity, maxLat = -Infinity;
    let minLon = Infinity, maxLon = -Infinity;

    for (const place of places) {
      minLat = Math.min(minLat, place.coordinate.latitude);
      maxLat = Math.max(maxLat, place.coordinate.latitude);
      minLon = Math.min(minLon, place.coordinate.longitude);
      maxLon = Math.max(maxLon, place.coordinate.longitude);
    }

    const centers: Coordinate[] = [];

    // Grid-based initialization
    const cols = Math.ceil(Math.sqrt(k));
    const rows = Math.ceil(k / cols);

    const latStep = (maxLat - minLat) / (rows + 1);
    const lonStep = (maxLon - minLon) / (cols + 1);

    for (let r = 1; r <= rows && centers.length < k; r++) {
      for (let c = 1; c <= cols && centers.length < k; c++) {
        centers.push({
          latitude: minLat + r * latStep,
          longitude: minLon + c * lonStep
        });
      }
    }

    return centers;
  }

  /**
   * Calculate center of a cluster
   */
  private calculateCenter(cluster: Place[]): Coordinate {
    let sumLat = 0;
    let sumLon = 0;

    for (const place of cluster) {
      sumLat += place.coordinate.latitude;
      sumLon += place.coordinate.longitude;
    }

    return {
      latitude: sumLat / cluster.length,
      longitude: sumLon / cluster.length
    };
  }

  /**
   * Calculate squared distance between coordinates
   */
  private distanceSquared(a: Coordinate, b: Coordinate): number {
    const dLat = a.latitude - b.latitude;
    const dLon = a.longitude - b.longitude;
    return dLat * dLat + dLon * dLon;
  }

  /**
   * Check if coordinates are approximately equal
   */
  private coordinatesEqual(a: Coordinate, b: Coordinate): boolean {
    return Math.abs(a.latitude - b.latitude) < 0.0001 &&
           Math.abs(a.longitude - b.longitude) < 0.0001;
  }

  /**
   * Balance clusters by visit time
   */
  private balanceClustersByTime(clusters: Place[][]): Place[][] {
    const maxTime = this.config.maxVisitTimePerDay;

    // Calculate total time per cluster
    const clusterTimes = clusters.map(c =>
      c.reduce((sum, p) => sum + p.visitDuration, 0)
    );

    // Move places from overloaded to underloaded clusters
    for (let i = 0; i < clusters.length; i++) {
      if (clusterTimes[i] > maxTime) {
        // Find places to move
        for (const place of [...clusters[i]]) {
          if (clusterTimes[i] <= maxTime) break;

          // Find underloaded cluster
          for (let j = 0; j < clusters.length; j++) {
            if (i !== j && clusterTimes[j] + place.visitDuration < maxTime) {
              // Move place
              clusters[i] = clusters[i].filter(p => p.id !== place.id);
              clusters[j].push(place);
              clusterTimes[i] -= place.visitDuration;
              clusterTimes[j] += place.visitDuration;
              break;
            }
          }
        }
      }
    }

    return clusters;
  }

  /**
   * Balance days after initial distribution
   */
  private balanceDays(days: ItineraryDay[]): ItineraryDay[] {
    // Re-number days
    return days.map((day, i) => ({
      ...day,
      dayNumber: i + 1
    }));
  }

  /**
   * Empty result helper
   */
  private emptyResult(warnings: string[]): DistributionResult {
    return {
      days: Array(this.config.totalDays).fill(null).map((_, i) => ({
        dayNumber: i + 1,
        places: [],
        totalVisitTime: 0,
        totalTravelTime: 0,
        totalDistance: 0,
        totalTime: 0,
        routeSegments: []
      })),
      totalPlaces: 0,
      totalVisitTime: 0,
      totalTravelTime: 0,
      totalDistance: 0,
      warnings: [...warnings, 'No places to distribute']
    };
  }
}

/**
 * Quick distribution function
 */
export function distributePlaces(
  places: Place[],
  config: Partial<DistributionConfig> = {}
): DistributionResult {
  const distributor = new DayDistributor(config);
  return distributor.distribute(places);
}

export default {
  DayDistributor,
  distributePlaces
};