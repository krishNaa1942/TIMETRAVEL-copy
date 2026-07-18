/**
 * Route Intelligence Service
 * Real-time adaptive routing with AI scoring, caching, and offline support
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import apiService from "./api";
import {
  GeoLocation,
  PlaceResult,
  Route,
  RouteComputeRequest,
  RouteComputeResponse,
  RoutePreferences,
  TravelMode,
  TrafficInfo,
  TrafficCondition,
  RouteMetrics,
  RouteStep,
  RouteLeg,
  CachedRoute,
  SmartStop,
  StopType,
  PredictiveResult,
  DepartureImpact,
  RouteError,
  RouteErrorType,
  RecentPlace,
  ROUTE_CACHE_TTL_MS,
  DEFAULT_PREFERENCES,
} from "@/types/route";

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────

const CACHE_KEY_PREFIX = "@route_cache:";
const RECENT_PLACES_KEY = "@recent_places";
const MAX_CACHED_ROUTES = 20;
const MAX_RECENT_PLACES = 20;

// Scoring weights
const SCORE_WEIGHTS = {
  time: 0.35,
  cost: 0.25,
  traffic: 0.25,
  preference: 0.15,
};

// Fuel efficiency (km/l) by mode
const FUEL_EFFICIENCY: Record<TravelMode, number> = {
  car: 14,
  bike: 45,
  walk: 0,
  transit: 0,
};

// Fuel price per liter (INR)
const FUEL_PRICE = 100;

// Carbon emission kg per liter
const CARBON_PER_LITER = 2.3;

// ─────────────────────────────────────────────────────────────
// ERROR FACTORY
// ─────────────────────────────────────────────────────────────

const createRouteError = (
  type: RouteErrorType,
  message: string,
  details?: Record<string, unknown>,
): RouteError => {
  const retryable = [
    "network",
    "timeout",
    "rate_limited",
    "service_unavailable",
  ].includes(type);
  return { type, message, retryable, details };
};

// ─────────────────────────────────────────────────────────────
// ROUTE SCORING ENGINE
// ─────────────────────────────────────────────────────────────

const calculateRouteScore = (
  metrics: Partial<RouteMetrics>,
  traffic: TrafficInfo,
  preferences: RoutePreferences,
  mode: TravelMode,
): number => {
  // Time score (lower is better, normalize to 0-100)
  const maxDuration = 300; // 5 hours baseline
  const timeScore = Math.max(
    0,
    100 - ((metrics.duration_minutes || 0) / maxDuration) * 100,
  );

  // Cost score (lower is better)
  const maxCost = 5000; // ₹5000 baseline
  const totalCost = (metrics.fuel_cost_inr || 0) + (metrics.toll_cost_inr || 0);
  const costScore = Math.max(0, 100 - (totalCost / maxCost) * 100);

  // Traffic score (less delay is better)
  const trafficScore = Math.max(0, 100 - traffic.delay_minutes * 2);

  // Preference score
  let preferenceScore = 50;

  if (preferences.avoidTolls && metrics.toll_cost_inr === 0)
    preferenceScore += 15;
  if (preferences.avoidHighways && mode === "car") preferenceScore += 10;
  if (preferences.scenic) preferenceScore += 10; // Would need scenic route data
  if (preferences.ecoFriendly && metrics.carbon_kg) {
    preferenceScore += Math.max(15, 30 - metrics.carbon_kg);
  }

  // Weighted final score
  const finalScore =
    timeScore * SCORE_WEIGHTS.time +
    costScore * SCORE_WEIGHTS.cost +
    trafficScore * SCORE_WEIGHTS.traffic +
    preferenceScore * SCORE_WEIGHTS.preference;

  return Math.round(finalScore * 10) / 10;
};

// ─────────────────────────────────────────────────────────────
// ESTIMATION HELPERS
// ─────────────────────────────────────────────────────────────

const estimateFuel = (distanceKm: number, mode: TravelMode): number => {
  const efficiency = FUEL_EFFICIENCY[mode];
  if (efficiency === 0) return 0;
  return distanceKm / efficiency;
};

const estimateFuelCost = (distanceKm: number, mode: TravelMode): number => {
  return estimateFuel(distanceKm, mode) * FUEL_PRICE;
};

const estimateCarbon = (distanceKm: number, mode: TravelMode): number => {
  return estimateFuel(distanceKm, mode) * CARBON_PER_LITER;
};

const estimateTollCost = (distanceKm: number, mode: TravelMode): number => {
  if (mode !== "car") return 0;
  // Rough estimate: ₹2 per km for highways
  const highwayPercentage = 0.6;
  return Math.round(distanceKm * highwayPercentage * 2);
};

const simulateTraffic = (mode: TravelMode): TrafficInfo => {
  const hour = new Date().getHours();
  const isPeakHour = (hour >= 8 && hour <= 10) || (hour >= 17 && hour <= 20);

  const conditions: TrafficCondition[] = [
    "free",
    "light",
    "moderate",
    "heavy",
    "congested",
  ];
  const weights = isPeakHour
    ? [0.1, 0.15, 0.25, 0.35, 0.15]
    : [0.4, 0.3, 0.2, 0.08, 0.02];

  const random = Math.random();
  let cumulative = 0;
  let condition: TrafficCondition = "free";

  for (let i = 0; i < conditions.length; i++) {
    cumulative += weights[i];
    if (random < cumulative) {
      condition = conditions[i];
      break;
    }
  }

  const delayMap: Record<TrafficCondition, number> = {
    free: 0,
    light: 5,
    moderate: 15,
    heavy: 30,
    congested: 45,
  };

  const congestionMap: Record<TrafficCondition, number> = {
    free: 0,
    light: 20,
    moderate: 40,
    heavy: 70,
    congested: 95,
  };

  return {
    condition,
    delay_minutes: delayMap[condition] * (mode === "car" ? 1 : 0.5),
    congestion_percentage: congestionMap[condition],
  };
};

// ─────────────────────────────────────────────────────────────
// ROUTE SERVICE
// ─────────────────────────────────────────────────────────────

export const routeService = {
  // ───────────────────────────────────────────────────────────
  // PLACES & AUTOCOMPLETE
  // ───────────────────────────────────────────────────────────

  async searchPlaces(
    query: string,
    near?: GeoLocation,
  ): Promise<PlaceResult[]> {
    if (!query.trim()) return [];

    try {
      const response = await apiService.get<{
        lat: number;
        lon: number;
        address?: string;
      }>(`/maps/geocode?q=${encodeURIComponent(query)}`);

      if (
        typeof response?.lat !== "number" ||
        typeof response?.lon !== "number"
      ) {
        return [];
      }

      const address = response.address || query;
      const primaryName = address.split(",")[0]?.trim() || query;
      const result: PlaceResult = {
        id: `geo_${response.lat}_${response.lon}`,
        name: primaryName,
        address,
        location: {
          lat: response.lat,
          lng: response.lon,
        },
      };

      return [result];
    } catch (error) {
      console.error("Places search failed:", error);
      // Return mock results for offline/demo
      return this.getMockPlaces(query);
    }
  },

  async reverseGeocode(location: GeoLocation): Promise<PlaceResult | null> {
    try {
      const response = await apiService.get<{
        address?: string;
        city?: string;
        state?: string;
        country?: string;
      }>(`/maps/reverse?lat=${location.lat}&lon=${location.lng}`);

      const address = response?.address?.trim();
      if (!address) {
        return null;
      }

      return {
        id: `rev_${location.lat}_${location.lng}`,
        name: response.city || address.split(",")[0] || "Selected location",
        address,
        location: {
          lat: location.lat,
          lng: location.lng,
        },
      };
    } catch (error) {
      return {
        id: `loc_${Date.now()}`,
        name: "Current Location",
        address: `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`,
        location,
      };
    }
  },

  getMockPlaces(query: string): PlaceResult[] {
    const mockData: PlaceResult[] = [
      {
        id: "1",
        name: "New Delhi Railway Station",
        address: "New Delhi, Delhi 110001",
        location: { lat: 28.6448, lng: 77.2167 },
      },
      {
        id: "2",
        name: "Indira Gandhi International Airport",
        address: "New Delhi, Delhi 110037",
        location: { lat: 28.5562, lng: 77.1 },
      },
      {
        id: "3",
        name: "India Gate",
        address: "Rajpath, New Delhi, Delhi",
        location: { lat: 28.6129, lng: 77.2295 },
      },
      {
        id: "4",
        name: "Connaught Place",
        address: "New Delhi, Delhi 110001",
        location: { lat: 28.6315, lng: 77.2167 },
      },
      {
        id: "5",
        name: "Chandni Chowk",
        address: "Old Delhi, Delhi 110006",
        location: { lat: 28.6506, lng: 77.2303 },
      },
      {
        id: "6",
        name: "Qutub Minar",
        address: "Mehrauli, New Delhi, Delhi",
        location: { lat: 28.5244, lng: 77.1855 },
      },
      {
        id: "7",
        name: "Red Fort",
        address: "Netaji Subhash Marg, Delhi",
        location: { lat: 28.6562, lng: 77.241 },
      },
      {
        id: "8",
        name: "Humayun's Tomb",
        address: "Mathura Road, New Delhi",
        location: { lat: 28.5931, lng: 77.2507 },
      },
      {
        id: "9",
        name: "Lotus Temple",
        address: "Bahapur, New Delhi",
        location: { lat: 28.5535, lng: 77.2588 },
      },
      {
        id: "10",
        name: "Akshardham Temple",
        address: "Noida Link Road, New Delhi",
        location: { lat: 28.6127, lng: 77.2773 },
      },
    ];

    const q = query.toLowerCase();
    return mockData.filter(
      (p) =>
        p.name.toLowerCase().includes(q) || p.address.toLowerCase().includes(q),
    );
  },

  // ───────────────────────────────────────────────────────────
  // RECENT PLACES
  // ───────────────────────────────────────────────────────────

  async getRecentPlaces(): Promise<RecentPlace[]> {
    try {
      const data = await AsyncStorage.getItem(RECENT_PLACES_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  async addRecentPlace(place: PlaceResult): Promise<void> {
    try {
      const recent = await this.getRecentPlaces();
      const existing = recent.findIndex((p) => p.id === place.id);

      if (existing >= 0) {
        recent[existing].usage_count += 1;
        recent[existing].last_used = new Date().toISOString();
      } else {
        recent.unshift({
          ...place,
          last_used: new Date().toISOString(),
          usage_count: 1,
        });
      }

      // Keep only top N
      const trimmed = recent.slice(0, MAX_RECENT_PLACES);
      await AsyncStorage.setItem(RECENT_PLACES_KEY, JSON.stringify(trimmed));
    } catch (error) {
      console.error("Failed to save recent place:", error);
    }
  },

  // ───────────────────────────────────────────────────────────
  // ROUTE COMPUTATION
  // ───────────────────────────────────────────────────────────

  async computeRoutes(
    request: RouteComputeRequest,
  ): Promise<RouteComputeResponse> {
    const cacheKey = this.getCacheKey(request);

    // Check cache first
    const cached = await this.getCachedRoute(cacheKey);
    if (cached) {
      return {
        routes: [cached],
        recommended_route_id: cached.id,
        compute_time_ms: 0,
        traffic_updated_at: new Date().toISOString(),
      };
    }

    try {
      // Try API call
      const response = await apiService.post<RouteComputeResponse>(
        "/route/compute",
        request,
      );

      // Cache the routes
      for (const route of response.routes) {
        await this.cacheRoute(route);
      }

      return response;
    } catch (error) {
      console.error("Route computation failed, using fallback:", error);

      // Fallback to mock routing for offline/demo
      return this.computeFallbackRoutes(request);
    }
  },

  async computeFallbackRoutes(
    request: RouteComputeRequest,
  ): Promise<RouteComputeResponse> {
    const { origin, destination, mode, preferences } = request;

    // Calculate distance (Haversine formula)
    const distanceKm = this.calculateDistance(origin, destination);

    // Estimate duration based on mode
    const speedMap: Record<TravelMode, number> = {
      car: 40, // km/h average with traffic
      bike: 25,
      walk: 5,
      transit: 25,
    };

    const durationMinutes = (distanceKm / speedMap[mode]) * 60;

    // Simulate traffic
    const traffic = simulateTraffic(mode);
    const durationWithTraffic = durationMinutes + traffic.delay_minutes;

    // Calculate costs
    const fuelCost = estimateFuelCost(distanceKm, mode);
    const tollCost = estimateTollCost(distanceKm, mode);

    // Generate geometry (simple straight line for demo)
    const geometry = this.interpolateGeometry(origin, destination, 50);

    // Build metrics
    const metrics: RouteMetrics = {
      distance_meters: distanceKm * 1000,
      distance_km: Math.round(distanceKm * 10) / 10,
      duration_seconds: Math.round(durationMinutes * 60),
      duration_minutes: Math.round(durationMinutes),
      duration_with_traffic_seconds: Math.round(durationWithTraffic * 60),
      traffic_delay_seconds: Math.round(traffic.delay_minutes * 60),
      fuel_cost_inr: Math.round(fuelCost),
      toll_cost_inr: tollCost,
      total_cost_inr: Math.round(fuelCost + tollCost),
      carbon_kg: Math.round(estimateCarbon(distanceKm, mode) * 10) / 10,
      fuel_liters: Math.round(estimateFuel(distanceKm, mode) * 10) / 10,
      score: 0,
      score_components: {
        time_score: 0,
        cost_score: 0,
        traffic_score: 0,
        preference_score: 0,
      },
    };

    // Calculate score
    metrics.score = calculateRouteScore(metrics, traffic, preferences, mode);

    // Build route
    const route: Route = {
      id: `route_${Date.now()}`,
      origin: {
        id: "origin",
        name: "Origin",
        address: `${origin.lat.toFixed(4)}, ${origin.lng.toFixed(4)}`,
        location: origin,
      },
      destination: {
        id: "dest",
        name: "Destination",
        address: `${destination.lat.toFixed(4)}, ${destination.lng.toFixed(4)}`,
        location: destination,
      },
      travel_mode: mode,
      geometry,
      metrics,
      traffic,
      legs: [
        {
          id: "leg_1",
          start_address: "Origin",
          end_address: "Destination",
          start_location: origin,
          end_location: destination,
          distance_meters: metrics.distance_meters,
          duration_seconds: metrics.duration_with_traffic_seconds,
          steps: [],
        },
      ],
      source: "api",
      reasoning: this.generateReasoning(metrics, traffic, mode),
    };

    // Generate alternatives
    const alternatives = this.generateAlternatives(route, request);
    const allRoutes = [route, ...alternatives];

    // Find best route
    const bestRoute = allRoutes.reduce((best, r) =>
      r.metrics.score > best.metrics.score ? r : best,
    );

    return {
      routes: allRoutes,
      recommended_route_id: bestRoute.id,
      compute_time_ms: 100,
      traffic_updated_at: new Date().toISOString(),
    };
  },

  generateAlternatives(
    baseRoute: Route,
    request: RouteComputeRequest,
  ): Route[] {
    const alternatives: Route[] = [];

    // Alternative 1: Avoid highways (if car mode)
    if (request.mode === "car" && !request.preferences.avoidHighways) {
      const altRoute = { ...baseRoute };
      altRoute.id = `route_${Date.now()}_alt1`;
      altRoute.metrics = {
        ...baseRoute.metrics,
        duration_minutes: Math.round(baseRoute.metrics.duration_minutes * 1.15),
        duration_seconds: Math.round(baseRoute.metrics.duration_seconds * 1.15),
        toll_cost_inr: 0,
        total_cost_inr: baseRoute.metrics.fuel_cost_inr,
        score: 0,
      };
      altRoute.metrics.score = calculateRouteScore(
        altRoute.metrics,
        baseRoute.traffic,
        { ...request.preferences, avoidHighways: true },
        request.mode,
      );
      altRoute.reasoning = "No tolls, scenic route through city roads";
      alternatives.push(altRoute);
    }

    // Alternative 2: Fastest (if not already)
    if (baseRoute.traffic.condition !== "free") {
      const altRoute = { ...baseRoute };
      altRoute.id = `route_${Date.now()}_alt2`;
      altRoute.traffic = {
        condition: "light",
        delay_minutes: 5,
        congestion_percentage: 20,
      };
      altRoute.metrics = {
        ...baseRoute.metrics,
        duration_with_traffic_seconds: baseRoute.metrics.duration_seconds + 300,
        traffic_delay_seconds: 300,
      };
      altRoute.metrics.score = calculateRouteScore(
        altRoute.metrics,
        altRoute.traffic,
        request.preferences,
        request.mode,
      );
      altRoute.reasoning = "Highway route, faster but with tolls";
      alternatives.push(altRoute);
    }

    return alternatives;
  },

  generateReasoning(
    metrics: RouteMetrics,
    traffic: TrafficInfo,
    mode: TravelMode,
  ): string {
    const parts: string[] = [];

    if (traffic.delay_minutes > 20) {
      parts.push(`expect ${traffic.delay_minutes}min traffic delay`);
    } else if (traffic.delay_minutes > 5) {
      parts.push("light traffic expected");
    } else {
      parts.push("clear roads");
    }

    if (metrics.toll_cost_inr > 0) {
      parts.push(`₹${metrics.toll_cost_inr} toll`);
    }

    if (metrics.carbon_kg > 5) {
      parts.push(`${metrics.carbon_kg}kg CO₂`);
    }

    return parts.join(", ");
  },

  // ───────────────────────────────────────────────────────────
  // SMART STOPS
  // ───────────────────────────────────────────────────────────

  async findSmartStops(route: Route, types?: StopType[]): Promise<SmartStop[]> {
    // In production, this would call the API
    // For now, return mock data

    const allTypes: StopType[] = ["fuel", "restaurant", "rest_stop", "atm"];
    const searchTypes = types || allTypes;

    const stops: SmartStop[] = [];

    for (
      let i = 0;
      i < route.geometry.length;
      i += Math.floor(route.geometry.length / 5)
    ) {
      const point = route.geometry[i];
      const distanceKm =
        (i / route.geometry.length) * route.metrics.distance_km;

      for (const type of searchTypes) {
        if (Math.random() > 0.3) {
          // 70% chance of finding each type
          stops.push({
            id: `stop_${i}_${type}`,
            name: this.getStopName(type),
            type,
            location: {
              lat: point.lat + (Math.random() - 0.5) * 0.01,
              lng: point.lng + (Math.random() - 0.5) * 0.01,
            },
            distance_from_route_meters: Math.floor(Math.random() * 500),
            distance_along_route_km: Math.round(distanceKm * 10) / 10,
            detour_time_minutes: Math.floor(Math.random() * 10) + 2,
            rating: 3.5 + Math.random() * 1.5,
          });
        }
      }
    }

    return stops;
  },

  getStopName(type: StopType): string {
    const names: Record<StopType, string[]> = {
      fuel: [
        "HP Petrol Pump",
        "Indian Oil",
        "Bharat Petroleum",
        "Shell Station",
      ],
      restaurant: [
        "Highway Dhaba",
        "McDonald's",
        "Haldiram's",
        "Saravana Bhavan",
      ],
      rest_stop: ["Rest Area", "Highway Stop", "Travel Plaza"],
      atm: ["SBI ATM", "HDFC ATM", "ICICI ATM", "Axis Bank ATM"],
      hospital: ["Fortis Hospital", "Apollo Clinic", "Government Hospital"],
      ev_charging: ["Tata Power EV", "Ather Grid", "Tesla Supercharger"],
    };

    const list = names[type];
    return list[Math.floor(Math.random() * list.length)];
  },

  // ───────────────────────────────────────────────────────────
  // PREDICTIVE ENGINE
  // ───────────────────────────────────────────────────────────

  async predictDepartureImpact(route: Route): Promise<PredictiveResult> {
    const currentHour = new Date().getHours();
    const currentETA = new Date(
      Date.now() + route.metrics.duration_with_traffic_seconds * 1000,
    );

    const impacts: DepartureImpact[] = [];

    // Predict for next 4 hours
    for (let i = 0; i <= 4; i++) {
      const departureHour = (currentHour + i) % 24;
      const departureTime = new Date(Date.now() + i * 60 * 60 * 1000);

      // Simulate traffic patterns
      const isPeak =
        (departureHour >= 8 && departureHour <= 10) ||
        (departureHour >= 17 && departureHour <= 20);
      const isNight = departureHour >= 22 || departureHour <= 5;

      let etaChange = 0;
      let condition: TrafficCondition = "moderate";

      if (isPeak) {
        etaChange = 15 + Math.floor(Math.random() * 20);
        condition = "heavy";
      } else if (isNight) {
        etaChange = -5 - Math.floor(Math.random() * 10);
        condition = "free";
      } else {
        etaChange = Math.floor(Math.random() * 10) - 5;
        condition = "light";
      }

      const probabilityOnTime = isPeak ? 60 : isNight ? 95 : 85;

      let recommendation = "";
      if (i === 0) {
        recommendation = "Leave now for optimal time";
      } else if (etaChange < -5) {
        recommendation = "Better traffic conditions expected";
      } else if (etaChange > 10) {
        recommendation = "Expect heavy traffic";
      }

      impacts.push({
        departure_time: departureTime.toISOString(),
        eta_change_minutes: etaChange,
        traffic_condition: condition,
        probability_on_time: probabilityOnTime,
        recommendation,
      });
    }

    // Find best departure time
    const bestImpact = impacts.reduce((best, imp) =>
      imp.eta_change_minutes < best.eta_change_minutes ? imp : best,
    );
    const worstImpact = impacts.reduce((worst, imp) =>
      imp.eta_change_minutes > worst.eta_change_minutes ? imp : worst,
    );

    return {
      current_eta: currentETA.toISOString(),
      impacts,
      best_departure_time: bestImpact.departure_time,
      worst_departure_time: worstImpact.departure_time,
    };
  },

  // ───────────────────────────────────────────────────────────
  // CACHING
  // ───────────────────────────────────────────────────────────

  getCacheKey(request: RouteComputeRequest): string {
    const origin = `${request.origin.lat.toFixed(3)}_${request.origin.lng.toFixed(3)}`;
    const dest = `${request.destination.lat.toFixed(3)}_${request.destination.lng.toFixed(3)}`;
    return `${CACHE_KEY_PREFIX}${origin}_${dest}_${request.mode}`;
  },

  async getCachedRoute(key: string): Promise<Route | null> {
    try {
      const data = await AsyncStorage.getItem(key);
      if (!data) return null;

      const cached: CachedRoute = JSON.parse(data);

      // Check expiration
      if (new Date(cached.expires_at) < new Date()) {
        await AsyncStorage.removeItem(key);
        return null;
      }

      // Update access count
      cached.access_count += 1;
      await AsyncStorage.setItem(key, JSON.stringify(cached));

      return { ...cached.route, source: "cache" };
    } catch {
      return null;
    }
  },

  async cacheRoute(route: Route): Promise<void> {
    try {
      const now = new Date();
      const expires = new Date(now.getTime() + ROUTE_CACHE_TTL_MS);

      const cached: CachedRoute = {
        id: route.id,
        origin_name: route.origin.name,
        destination_name: route.destination.name,
        route: {
          ...route,
          cached_at: now.toISOString(),
          expires_at: expires.toISOString(),
        },
        cached_at: now.toISOString(),
        expires_at: expires.toISOString(),
        access_count: 1,
      };

      const key = `${CACHE_KEY_PREFIX}${route.origin.id}_${route.destination.id}_${route.travel_mode}`;
      await AsyncStorage.setItem(key, JSON.stringify(cached));

      // Cleanup old caches
      await this.cleanupCache();
    } catch (error) {
      console.error("Failed to cache route:", error);
    }
  },

  async cleanupCache(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const routeKeys = keys.filter((k) => k.startsWith(CACHE_KEY_PREFIX));

      if (routeKeys.length <= MAX_CACHED_ROUTES) return;

      // Get all cached routes with metadata
      const routes: { key: string; cached: CachedRoute }[] = [];

      for (const key of routeKeys) {
        const data = await AsyncStorage.getItem(key);
        if (data) {
          routes.push({ key, cached: JSON.parse(data) });
        }
      }

      // Sort by access count and recency
      routes.sort((a, b) => {
        const scoreA =
          a.cached.access_count * 1000 +
          new Date(a.cached.cached_at).getTime() / 10000;
        const scoreB =
          b.cached.access_count * 1000 +
          new Date(b.cached.cached_at).getTime() / 10000;
        return scoreB - scoreA;
      });

      // Remove excess
      const toRemove = routes.slice(MAX_CACHED_ROUTES);
      for (const { key } of toRemove) {
        await AsyncStorage.removeItem(key);
      }
    } catch (error) {
      console.error("Cache cleanup failed:", error);
    }
  },

  async clearCache(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const routeKeys = keys.filter((k) => k.startsWith(CACHE_KEY_PREFIX));
      await AsyncStorage.multiRemove(routeKeys);
    } catch (error) {
      console.error("Failed to clear route cache:", error);
    }
  },

  // ───────────────────────────────────────────────────────────
  // GEO UTILITIES
  // ───────────────────────────────────────────────────────────

  calculateDistance(a: GeoLocation, b: GeoLocation): number {
    const R = 6371; // Earth's radius in km
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLng = ((b.lng - a.lng) * Math.PI) / 180;
    const lat1 = (a.lat * Math.PI) / 180;
    const lat2 = (b.lat * Math.PI) / 180;

    const sinDLat = Math.sin(dLat / 2);
    const sinDLng = Math.sin(dLng / 2);

    const haversine =
      sinDLat * sinDLat + sinDLng * sinDLng * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));

    return R * c;
  },

  interpolateGeometry(
    start: GeoLocation,
    end: GeoLocation,
    points: number,
  ): GeoLocation[] {
    const geometry: GeoLocation[] = [];

    for (let i = 0; i <= points; i++) {
      const t = i / points;
      geometry.push({
        lat: start.lat + (end.lat - start.lat) * t,
        lng: start.lng + (end.lng - start.lng) * t,
      });
    }

    return geometry;
  },

  // ───────────────────────────────────────────────────────────
  // CONFIG
  // ───────────────────────────────────────────────────────────

  async getConfig(): Promise<{ available: boolean }> {
    try {
      const response = await apiService.get<{ available: boolean }>(
        "/maps/config",
      );
      return response;
    } catch {
      return { available: true }; // Fallback
    }
  },
};

export default routeService;
