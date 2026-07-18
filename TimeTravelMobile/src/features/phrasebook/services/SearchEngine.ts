/**
 * Search Engine - High-Performance Fuzzy Search
 * Production-grade search with Fuse.js-inspired weighted scoring
 */

import { Phrase, SearchResult, SearchOptions, SearchMatch } from '../types';

// ============================================
// DEFAULT OPTIONS
// ============================================

const DEFAULT_OPTIONS: SearchOptions = {
  fuzzy: true,
  maxResults: 50,
  threshold: 0.4,
  includeFields: ['english', 'local', 'pronunciation', 'tags'],
};

// ============================================
// LEVENSHTEIN DISTANCE (Optimized)
// ============================================

function levenshteinDistance(a: string, b: string): number {
  // Quick equality check
  if (a === b) return 0;
  
  const aLen = a.length;
  const bLen = b.length;
  
  // Empty string checks
  if (aLen === 0) return bLen;
  if (bLen === 0) return aLen;
  
  // Use single array (space optimization)
  const column = new Array<number>(aLen + 1);
  
  for (let i = 0; i <= aLen; i++) {
    column[i] = i;
  }
  
  for (let j = 1; j <= bLen; j++) {
    let prevDiagonal = column[0];
    column[0] = j;
    
    const bChar = b[j - 1];
    
    for (let i = 1; i <= aLen; i++) {
      const temp = column[i];
      const cost = a[i - 1] === bChar ? 0 : 1;
      column[i] = Math.min(
        column[i] + 1, // deletion
        column[i - 1] + 1, // insertion
        prevDiagonal + cost // substitution
      );
      prevDiagonal = temp;
    }
  }
  
  return column[aLen];
}

// ============================================
// FUZZY MATCH SCORER
// ============================================

function calculateFuzzyScore(
  text: string,
  query: string,
  isExactBonus: boolean = true
): { score: number; matchIndices: [number, number][] } {
  const textLower = text.toLowerCase();
  const queryLower = query.toLowerCase();
  
  // Exact match (highest score)
  if (textLower === queryLower) {
    return { score: 1.0, matchIndices: [[0, text.length]] };
  }
  
  // Starts with query
  if (textLower.startsWith(queryLower)) {
    return { 
      score: 0.95, 
      matchIndices: [[0, query.length]] 
    };
  }
  
  // Contains exact substring
  const exactIndex = textLower.indexOf(queryLower);
  if (exactIndex !== -1) {
    // Score based on position (earlier = better)
    const positionBonus = 1 - (exactIndex / text.length) * 0.3;
    return { 
      score: 0.8 * positionBonus, 
      matchIndices: [[exactIndex, exactIndex + query.length]] 
    };
  }
  
  // Word boundary matching
  const words = textLower.split(/\s+/);
  let wordMatchScore = 0;
  const wordMatches: [number, number][] = [];
  let currentPos = 0;
  
  for (const word of words) {
    if (word.startsWith(queryLower) || word.includes(queryLower)) {
      wordMatchScore = Math.max(wordMatchScore, 0.7);
      wordMatches.push([currentPos, currentPos + Math.min(word.length, query.length)]);
    }
    currentPos += word.length + 1;
  }
  
  if (wordMatchScore > 0) {
    return { score: wordMatchScore, matchIndices: wordMatches };
  }
  
  // Character-by-character fuzzy match
  let queryIdx = 0;
  let consecutiveMatches = 0;
  let maxConsecutive = 0;
  const charMatches: [number, number][] = [];
  let matchStart = -1;
  
  for (let i = 0; i < textLower.length && queryIdx < queryLower.length; i++) {
    if (textLower[i] === queryLower[queryIdx]) {
      if (matchStart === -1) matchStart = i;
      consecutiveMatches++;
      queryIdx++;
    } else {
      if (consecutiveMatches > maxConsecutive && matchStart !== -1) {
        maxConsecutive = consecutiveMatches;
        charMatches.push([matchStart, matchStart + consecutiveMatches]);
      }
      consecutiveMatches = 0;
      matchStart = -1;
    }
  }
  
  if (queryIdx === queryLower.length) {
    // All characters matched
    const coverage = query.length / text.length;
    const consecutiveness = maxConsecutive / query.length;
    const score = 0.5 * coverage + 0.3 * consecutiveness + 0.2;
    return { score, matchIndices: charMatches.length > 0 ? charMatches : [[0, query.length]] };
  }
  
  // Levenshtein-based fuzzy match
  const distance = levenshteinDistance(textLower, queryLower);
  const maxLen = Math.max(text.length, query.length);
  const similarity = 1 - distance / maxLen;
  
  return { 
    score: similarity * 0.6, 
    matchIndices: similarity > 0.5 ? [[0, Math.min(text.length, query.length)]] : [] 
  };
}

// ============================================
// WEIGHTED FIELD SEARCH
// ============================================

interface FieldWeight {
  field: 'english' | 'local' | 'pronunciation' | 'tags';
  weight: number;
}

const FIELD_WEIGHTS: FieldWeight[] = [
  { field: 'english', weight: 1.0 },
  { field: 'local', weight: 0.9 },
  { field: 'pronunciation', weight: 0.7 },
  { field: 'tags', weight: 0.5 },
];

// ============================================
// SEARCH ENGINE CLASS
// ============================================

export class SearchEngine {
  private phraseIndex: Map<string, Phrase> = new Map();
  private trigramIndex: Map<string, Set<string>> = new Map();
  private isIndexed: boolean = false;

  // Build trigrams for a string
  private buildTrigrams(text: string): string[] {
    const trigrams: string[] = [];
    const normalized = text.toLowerCase().replace(/\s+/g, ' ');
    
    for (let i = 0; i < normalized.length - 2; i++) {
      trigrams.push(normalized.slice(i, i + 3));
    }
    
    return trigrams;
  }

  // Index phrases for fast search
  indexPhrases(phrases: Phrase[]): void {
    this.phraseIndex.clear();
    this.trigramIndex.clear();
    
    for (const phrase of phrases) {
      this.phraseIndex.set(phrase.id, phrase);
      
      // Build trigrams for all searchable fields
      const searchableText = [
        phrase.english,
        phrase.local,
        phrase.pronunciation || '',
        ...phrase.tags,
      ].join(' ');
      
      const trigrams = this.buildTrigrams(searchableText);
      
      for (const trigram of trigrams) {
        if (!this.trigramIndex.has(trigram)) {
          this.trigramIndex.set(trigram, new Set());
        }
        this.trigramIndex.get(trigram)!.add(phrase.id);
      }
    }
    
    this.isIndexed = true;
  }

  // Quick candidate selection using trigrams
  private getCandidates(query: string): Set<string> {
    const trigrams = this.buildTrigrams(query);
    
    if (trigrams.length === 0) {
      return new Set(this.phraseIndex.keys());
    }
    
    // Count trigram matches per phrase
    const matchCounts = new Map<string, number>();
    
    for (const trigram of trigrams) {
      const phraseIds = this.trigramIndex.get(trigram);
      if (phraseIds) {
        for (const id of phraseIds) {
          matchCounts.set(id, (matchCounts.get(id) || 0) + 1);
        }
      }
    }
    
    // Filter candidates with at least 30% trigram overlap
    const threshold = trigrams.length * 0.3;
    const candidates = new Set<string>();
    
    for (const [id, count] of matchCounts) {
      if (count >= threshold) {
        candidates.add(id);
      }
    }
    
    return candidates;
  }

  // Main search method
  search(query: string, options: Partial<SearchOptions> = {}): SearchResult[] {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    
    if (!query.trim()) {
      return [];
    }
    
    // Get candidate phrases using trigram index
    const candidateIds = this.isIndexed 
      ? this.getCandidates(query)
      : new Set(this.phraseIndex.keys());
    
    const results: SearchResult[] = [];
    
    for (const id of candidateIds) {
      const phrase = this.phraseIndex.get(id);
      if (!phrase) continue;
      
      let bestScore = 0;
      const allMatches: SearchMatch[] = [];
      
      // Search in each field with weights
      for (const { field, weight } of FIELD_WEIGHTS) {
        if (!opts.includeFields.includes(field)) continue;
        
        let fieldValue: string;
        switch (field) {
          case 'english':
            fieldValue = phrase.english;
            break;
          case 'local':
            fieldValue = phrase.local;
            break;
          case 'pronunciation':
            fieldValue = phrase.pronunciation || '';
            break;
          case 'tags':
            fieldValue = phrase.tags.join(' ');
            break;
        }
        
        if (!fieldValue) continue;
        
        const { score, matchIndices } = calculateFuzzyScore(fieldValue, query);
        const weightedScore = score * weight;
        
        if (weightedScore > 0) {
          bestScore = Math.max(bestScore, weightedScore);
          
          if (matchIndices.length > 0) {
            allMatches.push({
              field,
              indices: matchIndices[0],
              value: fieldValue,
            });
          }
        }
      }
      
      // Apply threshold
      if (bestScore >= opts.threshold) {
        results.push({
          phrase,
          score: bestScore,
          matches: allMatches,
        });
      }
    }
    
    // Sort by score descending
    results.sort((a, b) => b.score - a.score);
    
    // Return top results
    return results.slice(0, opts.maxResults);
  }

  // Quick search for autocomplete
  quickSearch(query: string, limit: number = 10): Phrase[] {
    const results = this.search(query, { 
      maxResults: limit, 
      threshold: 0.5,
      fuzzy: false,
    });
    
    return results.map(r => r.phrase);
  }

  // Clear index
  clear(): void {
    this.phraseIndex.clear();
    this.trigramIndex.clear();
    this.isIndexed = false;
  }
}

// Singleton instance
export const searchEngine = new SearchEngine();