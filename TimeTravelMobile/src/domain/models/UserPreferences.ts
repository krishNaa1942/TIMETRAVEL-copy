/**
 * UserPreferences Value Object
 * Immutable representation of user travel preferences
 */
export type TravelStyle =
  | 'beaches'
  | 'mountains'
  | 'culture'
  | 'adventure'
  | 'spiritual'
  | 'nightlife'
  | 'nature'
  | 'budget'
  | 'luxury'
  | 'relaxation';

export interface UserPreferences {
  readonly travelStyles: readonly TravelStyle[];
  readonly budgetRange?: readonly [number, number];
  readonly preferredSeason?: string;
  readonly groupType?: 'solo' | 'couple' | 'family' | 'friends';
}

/**
 * Factory function to create UserPreferences
 */
export function createUserPreferences(
  styles: TravelStyle[] = [],
  budget?: [number, number],
  season?: string
): UserPreferences {
  return {
    travelStyles: Object.freeze([...styles]),
    budgetRange: budget ? (Object.freeze([...budget]) as readonly [number, number]) : undefined,
    preferredSeason: season,
  };
}

/**
 * Default preferences for new users
 */
export const DEFAULT_PREFERENCES: UserPreferences = createUserPreferences([]);