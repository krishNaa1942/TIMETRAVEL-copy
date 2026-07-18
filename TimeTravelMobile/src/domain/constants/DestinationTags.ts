/**
 * Destination Metadata Registry
 * Centralized mapping of destinations to their characteristics
 */
import { TravelStyle } from '../models/UserPreferences';

export interface DestinationMetadata {
  readonly id: string;
  readonly tags: readonly TravelStyle[];
  readonly popularityTier: 'high' | 'medium' | 'low';
  readonly typicalBudgetRange: readonly [number, number];
  readonly bestMonths: readonly string[];
}

/**
 * Destination metadata mapping
 */
export const DESTINATION_METADATA: Record<string, DestinationMetadata> = {
  goa: {
    id: 'goa',
    tags: ['beaches', 'nightlife', 'relaxation', 'budget'],
    popularityTier: 'high',
    typicalBudgetRange: [15000, 50000],
    bestMonths: ['November', 'December', 'January', 'February'],
  },
  kerala: {
    id: 'kerala',
    tags: ['beaches', 'nature', 'relaxation', 'culture'],
    popularityTier: 'high',
    typicalBudgetRange: [20000, 60000],
    bestMonths: ['September', 'October', 'November', 'December'],
  },
  manali: {
    id: 'manali',
    tags: ['mountains', 'adventure', 'nature'],
    popularityTier: 'high',
    typicalBudgetRange: [12000, 40000],
    bestMonths: ['March', 'April', 'May', 'June', 'December', 'January'],
  },
  jaipur: {
    id: 'jaipur',
    tags: ['culture', 'luxury'],
    popularityTier: 'high',
    typicalBudgetRange: [15000, 50000],
    bestMonths: ['October', 'November', 'December', 'January', 'February'],
  },
  rishikesh: {
    id: 'rishikesh',
    tags: ['adventure', 'spiritual', 'budget'],
    popularityTier: 'high',
    typicalBudgetRange: [8000, 25000],
    bestMonths: ['September', 'October', 'November', 'March', 'April'],
  },
  varanasi: {
    id: 'varanasi',
    tags: ['culture', 'spiritual'],
    popularityTier: 'medium',
    typicalBudgetRange: [8000, 25000],
    bestMonths: ['October', 'November', 'February', 'March'],
  },
  leh: {
    id: 'leh',
    tags: ['adventure', 'mountains', 'nature'],
    popularityTier: 'medium',
    typicalBudgetRange: [30000, 80000],
    bestMonths: ['May', 'June', 'July', 'August', 'September'],
  },
  andaman: {
    id: 'andaman',
    tags: ['beaches', 'nature', 'adventure'],
    popularityTier: 'medium',
    typicalBudgetRange: [25000, 70000],
    bestMonths: ['October', 'November', 'December', 'January', 'February'],
  },
} as const;

/**
 * Get metadata for a destination by ID
 */
export function getDestinationMetadata(id: string): DestinationMetadata | undefined {
  return DESTINATION_METADATA[id.toLowerCase()];
}

/**
 * Get all destinations matching specific tags
 */
export function getDestinationsByTag(tag: TravelStyle): readonly string[] {
  return Object.values(DESTINATION_METADATA)
    .filter(meta => meta.tags.includes(tag))
    .map(meta => meta.id);
}

/**
 * Check if destination has a specific tag
 */
export function destinationHasTag(id: string, tag: TravelStyle): boolean {
  const meta = getDestinationMetadata(id);
  return meta?.tags.includes(tag) ?? false;
}