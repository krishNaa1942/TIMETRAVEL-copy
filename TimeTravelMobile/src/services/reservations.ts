/**
 * Reservations Service V2 - AI-Powered Smart Booking Engine
 * Supports offline caching, intelligent parsing, and real-time sync
 */

import apiService from "./api";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { tripPlannerService } from "./tripPlanner";
import { cache } from "@/utils/cache";

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export type ReservationType =
  | "flight"
  | "hotel"
  | "restaurant"
  | "transport"
  | "activity"
  | "train"
  | "bus"
  | "cruise"
  | "other";
export type ReservationStatus =
  | "confirmed"
  | "pending"
  | "cancelled"
  | "completed";

export interface Reservation {
  id: number;
  trip_id: number;
  res_type: ReservationType;
  title: string;
  confirmation_code?: string;
  provider?: string;
  start_datetime?: string;
  end_datetime?: string;
  location?: string;
  amount?: number;
  currency: string;
  status: ReservationStatus;
  notes?: string;
  reminder_set?: boolean;
  reminder_time?: string;
  is_bookmarked?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ReservationCreateInput {
  trip_id: number;
  res_type: ReservationType;
  title: string;
  confirmation_code?: string;
  provider?: string;
  start_datetime?: string;
  end_datetime?: string;
  location?: string;
  amount?: number;
  currency?: string;
  notes?: string;
}

export interface ReservationUpdateInput extends Partial<ReservationCreateInput> {
  status?: ReservationStatus;
  is_bookmarked?: boolean;
}

export interface ReservationFilter {
  trip_id?: number;
  type?: ReservationType;
  status?: ReservationStatus;
  search?: string;
  date_from?: string;
  date_to?: string;
  sort_by?: "date" | "amount" | "type" | "status";
  sort_order?: "asc" | "desc";
}

export interface ReservationStats {
  total_count: number;
  by_type: Record<ReservationType, number>;
  by_status: Record<ReservationStatus, number>;
  total_amount: number;
  currency: string;
  upcoming_count: number;
  completed_count: number;
  upcoming_this_week: number;
}

export interface AIInsight {
  type: "warning" | "info" | "suggestion" | "reminder";
  title: string;
  message: string;
  icon: string;
  action?: { label: string; route: string };
}

export interface ParsedBooking {
  type: ReservationType;
  title: string;
  provider?: string;
  confirmation_code?: string;
  start_datetime?: string;
  end_datetime?: string;
  location?: string;
  amount?: number;
}

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────

const CACHE_KEY_PREFIX = "@reservations:";
const BOOKMARK_KEY_PREFIX = "@reservation_bookmarks:";
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export const RESERVATION_TYPES: Record<
  ReservationType,
  { emoji: string; label: string; color: string }
> = {
  flight: { emoji: "✈️", label: "Flight", color: "#3B82F6" },
  hotel: { emoji: "🏨", label: "Hotel", color: "#8B5CF6" },
  restaurant: { emoji: "🍽️", label: "Restaurant", color: "#F59E0B" },
  transport: { emoji: "🚗", label: "Transport", color: "#10B981" },
  activity: { emoji: "🎯", label: "Activity", color: "#EC4899" },
  train: { emoji: "🚂", label: "Train", color: "#6366F1" },
  bus: { emoji: "🚌", label: "Bus", color: "#14B8A6" },
  cruise: { emoji: "🚢", label: "Cruise", color: "#0EA5E9" },
  other: { emoji: "📋", label: "Other", color: "#64748B" },
};

export const STATUS_CONFIG: Record<
  ReservationStatus,
  { emoji: string; label: string; color: string }
> = {
  confirmed: { emoji: "✅", label: "Confirmed", color: "#10B981" },
  pending: { emoji: "⏳", label: "Pending", color: "#F59E0B" },
  cancelled: { emoji: "❌", label: "Cancelled", color: "#EF4444" },
  completed: { emoji: "🎉", label: "Completed", color: "#6366F1" },
};

// ─────────────────────────────────────────────────────────────
// AI PARSING ENGINE
// ─────────────────────────────────────────────────────────────

const parseEmailBooking = (text: string): ParsedBooking | null => {
  const lowerText = text.toLowerCase();

  // Detect type
  let detectedType: ReservationType = "other";
  if (
    lowerText.includes("flight") ||
    lowerText.includes("airline") ||
    lowerText.includes("departure") ||
    lowerText.includes("arrival") ||
    /airways|airlines|air\s*india|indigo|spicejet|vistara/i.test(text)
  ) {
    detectedType = "flight";
  } else if (
    lowerText.includes("hotel") ||
    lowerText.includes("check-in") ||
    lowerText.includes("check-out") ||
    /resort|stay|booking|room|suite/i.test(text)
  ) {
    detectedType = "hotel";
  } else if (
    lowerText.includes("restaurant") ||
    lowerText.includes("table") ||
    lowerText.includes("reservation")
  ) {
    detectedType = "restaurant";
  } else if (lowerText.includes("train") || lowerText.includes("railway")) {
    detectedType = "train";
  } else if (lowerText.includes("bus")) {
    detectedType = "bus";
  }

  // Extract confirmation code (uppercase alphanumeric, 4-8 chars)
  const confirmMatch =
    text.match(
      /(?:confirmation|booking|reference|PNR)\s*[:#]?\s*([A-Z0-9]{4,8})/i,
    ) || text.match(/\b([A-Z0-9]{6})\b/);

  // Extract provider
  const providerPatterns: Record<ReservationType, RegExp[]> = {
    flight: [
      /(air\s*india|indigo|spicejet|vistara|go\s*air|airasia|emirates|etihad|qatar|british\s*airways)/i,
    ],
    hotel: [/marriott|taj|oberoi|itc|hilton|hyatt|radisson|ibis|novotel/i],
    restaurant: [/zomato|swiggy|dineout/i],
    transport: [/ola|uber|zoomcar/i],
    activity: [/airbnb|viator|tripadvisor|thrillophilia/i],
    train: [/irctc|indian\s*railways/i],
    bus: [/redbus|makemytrip/i],
    cruise: [/carnival|royal\s*caribbean/i],
    other: [],
  };

  let provider: string | undefined;
  for (const pattern of providerPatterns[detectedType] || []) {
    const match = text.match(pattern);
    if (match) {
      provider = match[1];
      break;
    }
  }

  // Extract dates
  const dateMatch =
    text.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/) ||
    text.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);

  // Extract amount
  const amountMatch =
    text.match(/[₹$€£]\s*(\d[\d,]*)/) ||
    text.match(/(\d[\d,]*)\s*(rs|inr|usd|eur|£|€|\$)/i);

  // Build title
  let title = "";
  if (detectedType === "flight") {
    const fromMatch = text.match(/from\s+([A-Za-z\s]+)/i);
    const toMatch = text.match(/to\s+([A-Za-z\s]+)/i);
    if (fromMatch && toMatch) {
      title = `${fromMatch[1].trim()} → ${toMatch[1].trim()}`;
    }
  }
  if (!title) {
    title = provider
      ? `${provider} Booking`
      : `${RESERVATION_TYPES[detectedType].label} Booking`;
  }

  return {
    type: detectedType,
    title,
    provider,
    confirmation_code: confirmMatch?.[1],
    amount: amountMatch
      ? parseFloat(amountMatch[1].replace(/,/g, ""))
      : undefined,
  };
};

// ─────────────────────────────────────────────────────────────
// SMART INSIGHTS ENGINE
// ─────────────────────────────────────────────────────────────

const generateInsights = (reservations: Reservation[]): AIInsight[] => {
  const insights: AIInsight[] = [];
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  // Upcoming today
  const todayReservations = reservations.filter((r) => {
    if (!r.start_datetime) return false;
    const start = new Date(r.start_datetime).toISOString().split("T")[0];
    return start === today && r.status === "confirmed";
  });

  if (todayReservations.length > 0) {
    insights.push({
      type: "reminder",
      title: "Today's Bookings",
      message: `You have ${todayReservations.length} reservation${todayReservations.length > 1 ? "s" : ""} today!`,
      icon: "🔔",
    });
  }

  // Upcoming this week
  const weekReservations = reservations.filter((r) => {
    if (!r.start_datetime) return false;
    const start = r.start_datetime.split("T")[0];
    return start >= today && start <= weekLater && r.status === "confirmed";
  });

  if (weekReservations.length > 3) {
    insights.push({
      type: "info",
      title: "Busy Week Ahead",
      message: `${weekReservations.length} reservations scheduled this week.`,
      icon: "📅",
    });
  }

  // Missing essentials
  const hasFlight = reservations.some((r) => r.res_type === "flight");
  const hasHotel = reservations.some((r) => r.res_type === "hotel");

  if (hasFlight && !hasHotel) {
    insights.push({
      type: "suggestion",
      title: "Missing Hotel?",
      message: "You have a flight booked but no hotel. Need help finding one?",
      icon: "🏨",
      action: { label: "Find Hotels", route: "Places" },
    });
  }

  // Pending reservations
  const pending = reservations.filter((r) => r.status === "pending");
  if (pending.length > 0) {
    insights.push({
      type: "warning",
      title: "Pending Confirmations",
      message: `${pending.length} booking${pending.length > 1 ? "s" : ""} awaiting confirmation.`,
      icon: "⏳",
    });
  }

  // High spending
  const total = reservations.reduce((sum, r) => sum + (r.amount || 0), 0);
  if (total > 50000) {
    insights.push({
      type: "info",
      title: "Total Spending",
      message: `₹${(total / 1000).toFixed(0)}K total in reservations.`,
      icon: "💰",
    });
  }

  return insights;
};

const getBookmarkKey = (tripId: number): string =>
  `${BOOKMARK_KEY_PREFIX}${tripId}`;

const readBookmarkIds = async (tripId: number): Promise<Set<number>> => {
  try {
    const raw = await AsyncStorage.getItem(getBookmarkKey(tripId));
    if (!raw) return new Set();

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();

    return new Set(
      parsed
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value)),
    );
  } catch {
    return new Set();
  }
};

const writeBookmarkIds = async (
  tripId: number,
  bookmarkIds: Set<number>,
): Promise<void> => {
  await AsyncStorage.setItem(
    getBookmarkKey(tripId),
    JSON.stringify([...bookmarkIds]),
  );
};

const applyBookmarkState = async (
  tripId: number,
  reservations: Reservation[],
): Promise<Reservation[]> => {
  const bookmarkIds = await readBookmarkIds(tripId);
  return reservations.map((reservation) => ({
    ...reservation,
    is_bookmarked: bookmarkIds.has(reservation.id),
  }));
};

const computeReservationStats = (
  reservations: Reservation[],
): ReservationStats => {
  const byType: ReservationStats["by_type"] = {
    flight: 0,
    hotel: 0,
    restaurant: 0,
    transport: 0,
    activity: 0,
    train: 0,
    bus: 0,
    cruise: 0,
    other: 0,
  };
  const byStatus: ReservationStats["by_status"] = {
    confirmed: 0,
    pending: 0,
    cancelled: 0,
    completed: 0,
  };

  const now = new Date();
  const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  let totalAmount = 0;
  let currency = "INR";
  let upcomingCount = 0;
  let completedCount = 0;
  let upcomingThisWeek = 0;

  for (const reservation of reservations) {
    byType[reservation.res_type] += 1;
    byStatus[reservation.status] += 1;

    if (reservation.amount) {
      totalAmount += reservation.amount;
      currency = reservation.currency || currency;
    }

    if (reservation.status === "completed") {
      completedCount += 1;
    }

    if (!reservation.start_datetime || reservation.status === "cancelled") {
      continue;
    }

    const startDate = new Date(reservation.start_datetime);
    if (startDate > now) {
      upcomingCount += 1;
    }
    if (startDate >= now && startDate <= weekLater) {
      upcomingThisWeek += 1;
    }
  }

  return {
    total_count: reservations.length,
    by_type: byType,
    by_status: byStatus,
    total_amount: totalAmount,
    currency,
    upcoming_count: upcomingCount,
    completed_count: completedCount,
    upcoming_this_week: upcomingThisWeek,
  };
};

// ─────────────────────────────────────────────────────────────
// SERVICE
// ─────────────────────────────────────────────────────────────

export const reservationService = {
  // Create reservation
  async create(data: ReservationCreateInput): Promise<Reservation> {
    const response = await apiService.post<{ reservation: Reservation }>(
      "/reservations",
      {
        ...data,
        currency: data.currency || "INR",
        status: "pending",
      },
    );
    await this.invalidateCache(data.trip_id);
    const bookmarkedReservations = await applyBookmarkState(
      response.reservation.trip_id,
      [response.reservation],
    );
    return bookmarkedReservations[0];
  },

  // Update reservation
  async update(id: number, data: ReservationUpdateInput): Promise<Reservation> {
    const response = await apiService.put<{ reservation: Reservation }>(
      `/reservations/${id}`,
      data,
    );
    // Invalidate cache for this reservation's trip
    const allCache = await AsyncStorage.getAllKeys();
    const reservationCacheKeys = allCache.filter((k) =>
      k.startsWith(CACHE_KEY_PREFIX),
    );
    for (const key of reservationCacheKeys) {
      await AsyncStorage.removeItem(key);
    }
    const bookmarkedReservations = await applyBookmarkState(
      response.reservation.trip_id,
      [response.reservation],
    );
    return bookmarkedReservations[0];
  },

  // Delete reservation
  async delete(id: number, tripId: number): Promise<void> {
    await apiService.delete(`/reservations/${id}`);
    await this.invalidateCache(tripId);
    const bookmarkIds = await readBookmarkIds(tripId);
    if (bookmarkIds.delete(id)) {
      await writeBookmarkIds(tripId, bookmarkIds);
    }
  },

  // List with filtering
  async list(
    params: ReservationFilter = {},
  ): Promise<{ reservations: Reservation[]; total: number }> {
    const applyFilters = (reservations: Reservation[]): Reservation[] => {
      let filtered = [...reservations];

      if (params.type) {
        filtered = filtered.filter(
          (reservation) => reservation.res_type === params.type,
        );
      }
      if (params.status) {
        filtered = filtered.filter(
          (reservation) => reservation.status === params.status,
        );
      }
      if (params.search) {
        const query = params.search.toLowerCase();
        filtered = filtered.filter(
          (reservation) =>
            reservation.title.toLowerCase().includes(query) ||
            reservation.provider?.toLowerCase().includes(query) ||
            reservation.confirmation_code?.toLowerCase().includes(query) ||
            reservation.location?.toLowerCase().includes(query),
        );
      }
      if (params.date_from) {
        const startDate = new Date(params.date_from);
        filtered = filtered.filter(
          (reservation) =>
            !reservation.start_datetime ||
            new Date(reservation.start_datetime) >= startDate,
        );
      }
      if (params.date_to) {
        const endDate = new Date(params.date_to);
        filtered = filtered.filter(
          (reservation) =>
            !reservation.start_datetime ||
            new Date(reservation.start_datetime) <= endDate,
        );
      }

      if (params.sort_by === "amount") {
        filtered.sort((a, b) => (a.amount || 0) - (b.amount || 0));
      } else if (params.sort_by === "type") {
        filtered.sort((a, b) => a.res_type.localeCompare(b.res_type));
      } else if (params.sort_by === "status") {
        filtered.sort((a, b) => a.status.localeCompare(b.status));
      } else {
        filtered.sort((a, b) => {
          const dateA = a.start_datetime
            ? new Date(a.start_datetime).getTime()
            : Infinity;
          const dateB = b.start_datetime
            ? new Date(b.start_datetime).getTime()
            : Infinity;
          return dateA - dateB;
        });
      }

      if (params.sort_order === "desc") {
        filtered.reverse();
      }

      return filtered;
    };

    if (params.trip_id) {
      const reservations = await this.getByTrip(params.trip_id);
      const filtered = applyFilters(reservations);
      return { reservations: filtered, total: filtered.length };
    }

    const trips = await tripPlannerService.listTrips();
    const reservationsByTrip = await Promise.all(
      trips.trips.map((trip) => this.getByTrip(trip.id)),
    );
    const reservations = reservationsByTrip.flat();
    const filtered = applyFilters(reservations);
    return { reservations: filtered, total: filtered.length };
  },

  // Get by trip (with caching)
  async getByTrip(tripId: number, useCache = true): Promise<Reservation[]> {
    const cacheKey = `trip_${tripId}`;

    if (useCache) {
      const cached = await cache.get<Reservation[]>(cacheKey);
      if (cached) {
        return applyBookmarkState(tripId, cached);
      }
    }

    const response = await apiService.get<{ reservations: Reservation[] }>(
      `/reservations/trip/${tripId}`,
    );
    await cache.set(cacheKey, response.reservations, { ttl: CACHE_TTL });
    return applyBookmarkState(tripId, response.reservations);
  },

  // Get stats
  async getStats(tripId: number): Promise<ReservationStats> {
    const reservations = await this.getByTrip(tripId);
    return computeReservationStats(reservations);
  },

  // Get upcoming reservations
  async getUpcoming(tripId: number, days = 7): Promise<Reservation[]> {
    const reservations = await this.getByTrip(tripId);
    const now = new Date();
    const cutoff = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    return reservations
      .filter((reservation) => {
        if (!reservation.start_datetime || reservation.status === "cancelled")
          return false;
        const startDate = new Date(reservation.start_datetime);
        return startDate >= now && startDate <= cutoff;
      })
      .sort((a, b) => {
        const dateA = a.start_datetime
          ? new Date(a.start_datetime).getTime()
          : Infinity;
        const dateB = b.start_datetime
          ? new Date(b.start_datetime).getTime()
          : Infinity;
        return dateA - dateB;
      });
  },

  // Toggle bookmark
  async toggleBookmark(id: number, tripId: number): Promise<Reservation> {
    const bookmarkIds = await readBookmarkIds(tripId);
    if (bookmarkIds.has(id)) {
      bookmarkIds.delete(id);
    } else {
      bookmarkIds.add(id);
    }
    await writeBookmarkIds(tripId, bookmarkIds);

    const reservations = await this.getByTrip(tripId);
    const reservation = reservations.find((item) => item.id === id);
    if (!reservation) {
      throw new Error("Reservation not found");
    }

    return {
      ...reservation,
      is_bookmarked: bookmarkIds.has(id),
    };
  },

  // Parse booking from text
  parseBookingText: parseEmailBooking,

  // Generate AI insights
  generateInsights,

  // Invalidate cache
  async invalidateCache(tripId: number): Promise<void> {
    await cache.invalidate(`trip_${tripId}`);
  },

  // Offline sync
  async syncOffline(): Promise<void> {
    // Get offline queue and sync
    const offlineQueue = await AsyncStorage.getItem("@offline_reservations");
    if (offlineQueue) {
      const items = JSON.parse(offlineQueue);
      for (const item of items) {
        try {
          await this.create(item);
        } catch {
          // Keep in queue if failed
        }
      }
      await AsyncStorage.removeItem("@offline_reservations");
    }
  },
};

export default reservationService;
