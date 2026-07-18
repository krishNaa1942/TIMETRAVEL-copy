/**
 * useTravelDNA Hook
 * Computes and manages user's travel personality DNA
 */

import { useMemo } from 'react';
import { useUserBehaviorStore } from '@/stores/userBehaviorStore';
import { computeTravelDNA, getDominantPersonality } from '../utils/profileHelpers';
import type { TravelDNA, PersonalityConfig } from '../types';

interface UseTravelDNAReturn {
  dna: TravelDNA;
  dominantPersonality: PersonalityConfig;
  isLoading: boolean;
}

export const useTravelDNA = (): UseTravelDNAReturn => {
  const { savedDestinations, viewedDestinations } = useUserBehaviorStore();

  const dna = useMemo((): TravelDNA => {
    // Compute Travel DNA with empty category preferences (could be enhanced later)
    return computeTravelDNA(viewedDestinations || [], savedDestinations || [], []);
  }, [savedDestinations, viewedDestinations]);

  const dominantPersonality = useMemo((): PersonalityConfig => {
    return getDominantPersonality(dna);
  }, [dna]);

  return {
    dna,
    dominantPersonality,
    isLoading: false,
  };
};

export default useTravelDNA;