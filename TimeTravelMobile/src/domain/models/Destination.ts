/**
 * Destination Entity
 * Core domain entity representing a travel destination
 */
export interface Destination {
  readonly id: string;
  readonly label: string;
  readonly region: string;
  readonly bestSeason?: string;
  readonly highlight?: string;
  readonly tagline?: string;
  readonly category?: readonly string[];
  readonly lat: number;
  readonly lon: number;
  readonly rating?: number;
  readonly avgCost?: number;
  readonly bookingCount?: number;
  readonly imageUrl?: string;
  readonly image?: string;
}

/**
 * Destination Value Object for filtering
 */
export interface DestinationFilter {
  readonly regions?: readonly string[];
  readonly categories?: readonly string[];
  readonly maxBudget?: number;
  readonly minRating?: number;
  readonly season?: string;
}

/**
 * Creates a Destination from API response
 */
export function createDestination(data: Record<string, unknown>): Destination {
  return {
    id: data.id as string,
    label: data.label as string,
    region: data.region as string,
    bestSeason: data.best_season as string | undefined,
    highlight: data.highlight as string | undefined,
    tagline: data.tagline as string | undefined,
    category: data.category as readonly string[] | undefined,
    lat: data.lat as number,
    lon: data.lon as number,
    rating: data.rating as number | undefined,
    avgCost: data.avgCost as number | undefined,
    bookingCount: data.bookingCount as number | undefined,
    imageUrl: data.imageUrl as string | undefined,
    image: data.image as string | undefined,
  };
}