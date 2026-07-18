/**
 * AI Journal Intelligence Engine
 * NLP-powered analysis, sentiment, tagging, and recommendations
 */

import { 
  AIAnalysis, 
  AIRecommendation, 
  AutoTag, 
  SentimentType, 
  MoodType,
  TravelCategory,
  TripType,
  JournalPlace,
  MOOD_CONFIG 
} from '@/types/journal';
import apiService from './api';

// ─────────────────────────────────────────────────────────────
// SENTIMENT ANALYSIS (Local + Backend)
// ─────────────────────────────────────────────────────────────

const POSITIVE_WORDS = new Set([
  'amazing', 'wonderful', 'beautiful', 'fantastic', 'incredible', 'loved',
  'breathtaking', 'stunning', 'perfect', 'memorable', 'unforgettable',
  'delightful', 'excellent', 'outstanding', 'brilliant', 'awesome',
  'paradise', 'dream', 'magical', 'bliss', 'enchanting', 'spectacular'
]);

const NEGATIVE_WORDS = new Set([
  'disappointing', 'terrible', 'awful', 'horrible', 'worst', 'hated',
  'disgusting', 'dreadful', 'poor', 'bad', 'waste', 'regret',
  'overcrowded', 'overpriced', 'dirty', 'unsafe', 'scary', 'rude'
]);

const INTENSITY_WORDS = new Set([
  'very', 'extremely', 'absolutely', 'totally', 'completely', 'really',
  'so', 'incredibly', 'exceptionally', 'remarkably'
]);

function analyzeSentimentLocal(text: string): { sentiment: SentimentType; score: number } {
  const words = text.toLowerCase().split(/\s+/);
  let positiveCount = 0;
  let negativeCount = 0;
  let intensityMultiplier = 1;

  for (let i = 0; i < words.length; i++) {
    const word = words[i].replace(/[^a-z]/g, '');
    
    if (INTENSITY_WORDS.has(word)) {
      intensityMultiplier = 1.5;
      continue;
    }
    
    if (POSITIVE_WORDS.has(word)) {
      positiveCount += intensityMultiplier;
    } else if (NEGATIVE_WORDS.has(word)) {
      negativeCount += intensityMultiplier;
    }
    
    intensityMultiplier = 1;
  }

  const total = positiveCount + negativeCount;
  if (total === 0) return { sentiment: 'neutral', score: 0 };

  const score = (positiveCount - negativeCount) / Math.max(total, 5);
  
  if (score > 0.2) return { sentiment: 'positive', score: Math.min(score, 1) };
  if (score < -0.2) return { sentiment: 'negative', score: Math.max(score, -1) };
  return { sentiment: 'neutral', score };
}

// ─────────────────────────────────────────────────────────────
// AUTO-TAGGING ENGINE
// ─────────────────────────────────────────────────────────────

const CATEGORY_KEYWORDS: Record<TravelCategory, string[]> = {
  beach: ['beach', 'ocean', 'sea', 'sand', 'waves', 'sunset', 'swimming', 'surfing', 'coastal', 'shore'],
  mountains: ['mountain', 'peak', 'hiking', 'trek', 'hill', 'valley', 'summit', 'trail', 'climb', 'altitude'],
  city: ['city', 'urban', 'downtown', 'skyscraper', 'metro', 'shopping', 'museum', 'gallery', 'nightlife', 'cafe'],
  countryside: ['village', 'countryside', 'rural', 'farm', 'peaceful', 'quiet', 'nature', 'fields', 'countryside'],
  adventure: ['adventure', 'thrill', 'extreme', 'rafting', 'bungee', 'paragliding', 'safari', 'explore', 'expedition'],
  food: ['food', 'cuisine', 'restaurant', 'delicious', 'taste', 'culinary', 'street food', 'local dish', 'dining'],
  culture: ['temple', 'church', 'mosque', 'heritage', 'history', 'culture', 'tradition', 'festival', 'art', 'ancient'],
  nightlife: ['nightlife', 'club', 'bar', 'party', 'dance', 'live music', 'pub', 'cocktail', 'evening'],
  spiritual: ['spiritual', 'meditation', 'yoga', 'temple', 'peaceful', 'sacred', 'pilgrimage', 'holy', 'blessing'],
  wildlife: ['wildlife', 'safari', 'animals', 'birds', 'national park', 'zoo', 'elephant', 'tiger', 'jungle'],
  road_trip: ['road trip', 'drive', 'highway', 'scenic', 'route', 'car', 'motorcycle', 'journey'],
  staycation: ['staycation', 'hotel', 'resort', 'spa', 'relax', 'pool', 'lazy', 'weekend getaway']
};

const TRIP_TYPE_INDICATORS: Record<TripType, string[]> = {
  solo: ['solo', 'alone', 'by myself', 'self-discovery', 'independent', 'me time', 'solo travel'],
  couple: ['romantic', 'couple', 'partner', 'anniversary', 'honeymoon', 'together', 'date'],
  family: ['family', 'kids', 'children', 'parents', 'family trip', 'kid-friendly', 'all ages'],
  friends: ['friends', 'group', 'buddies', 'gang', 'friends trip', 'together with friends'],
  business: ['business', 'conference', 'meeting', 'work trip', 'corporate', 'networking'],
  group: ['group tour', 'guided', 'tour group', 'organized tour']
};

const ACTIVITY_KEYWORDS: Record<string, string[]> = {
  photography: ['photography', 'photos', 'pictures', 'camera', 'shots', 'captured'],
  shopping: ['shopping', 'bought', 'market', 'souvenirs', 'store', 'mall'],
  swimming: ['swimming', 'pool', 'beach', 'snorkeling', 'diving', 'water'],
  hiking: ['hiking', 'trek', 'trail', 'walk', 'climb', 'nature walk'],
  dining: ['dining', 'ate', 'restaurant', 'food', 'cuisine', 'meal'],
  sightseeing: ['sightseeing', 'landmark', 'monument', 'famous', 'attraction', 'visited']
};

function extractTags(text: string, destination?: JournalPlace): AutoTag[] {
  const tags: AutoTag[] = [];
  const lowerText = text.toLowerCase();

  // Category tags
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const matches = keywords.filter(kw => lowerText.includes(kw));
    if (matches.length > 0) {
      tags.push({
        key: category,
        label: category.charAt(0).toUpperCase() + category.slice(1).replace('_', ' '),
        confidence: Math.min(matches.length / 3, 0.95),
        type: 'category'
      });
    }
  }

  // Trip type tags
  for (const [tripType, indicators] of Object.entries(TRIP_TYPE_INDICATORS)) {
    const matches = indicators.filter(ind => lowerText.includes(ind));
    if (matches.length > 0) {
      tags.push({
        key: tripType,
        label: tripType.charAt(0).toUpperCase() + tripType.slice(1) + ' Trip',
        confidence: Math.min(matches.length / 2, 0.9),
        type: 'trip_type'
      });
    }
  }

  // Activity tags
  for (const [activity, keywords] of Object.entries(ACTIVITY_KEYWORDS)) {
    const matches = keywords.filter(kw => lowerText.includes(kw));
    if (matches.length > 0) {
      tags.push({
        key: activity,
        label: activity.charAt(0).toUpperCase() + activity.slice(1),
        confidence: Math.min(matches.length / 2, 0.85),
        type: 'activity'
      });
    }
  }

  return tags.sort((a, b) => b.confidence - a.confidence).slice(0, 8);
}

// ─────────────────────────────────────────────────────────────
// HIGHLIGHT EXTRACTION
// ─────────────────────────────────────────────────────────────

function extractHighlights(text: string): string[] {
  const highlights: string[] = [];
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);

  // Look for superlative sentences
  const superlativePatterns = [
    /best .* (ever|in my life)/i,
    /most (beautiful|amazing|incredible|stunning)/i,
    /highlight.*was/i,
    / unforgettable /i,
    /must (visit|see|try)/i,
    /can't miss/i,
    /favorite part/i,
    /loved .* the most/i
  ];

  for (const sentence of sentences) {
    for (const pattern of superlativePatterns) {
      if (pattern.test(sentence)) {
        highlights.push(sentence.trim());
        break;
      }
    }
  }

  return highlights.slice(0, 3);
}

// ─────────────────────────────────────────────────────────────
// SUMMARY GENERATION
// ─────────────────────────────────────────────────────────────

function generateSummary(
  text: string, 
  destination?: JournalPlace, 
  mood?: MoodType,
  tags?: AutoTag[]
): string {
  const wordCount = text.split(/\s+/).length;
  const sentiment = analyzeSentimentLocal(text);
  
  let summary = '';
  
  if (destination) {
    const location = destination.city || destination.name;
    
    if (sentiment.sentiment === 'positive') {
      summary = `A wonderful experience in ${location}`;
    } else if (sentiment.sentiment === 'negative') {
      summary = `A challenging visit to ${location}`;
    } else {
      summary = `A trip to ${location}`;
    }
  } else {
    summary = sentiment.sentiment === 'positive' 
      ? 'A memorable travel experience' 
      : 'A travel experience';
  }

  if (mood) {
    const moodConfig = MOOD_CONFIG[mood];
    summary += ` that left the traveler feeling ${moodConfig.label.toLowerCase()}`;
  }

  // Add category context
  const categoryTags = tags?.filter(t => t.type === 'category').slice(0, 2);
  if (categoryTags && categoryTags.length > 0) {
    summary += `. Featured ${categoryTags.map(t => t.label.toLowerCase()).join(' and ')}`;
  }

  return summary + '.';
}

// ─────────────────────────────────────────────────────────────
// RECOMMENDATIONS ENGINE
// ─────────────────────────────────────────────────────────────

function generateRecommendations(
  text: string,
  destination?: JournalPlace,
  tags?: AutoTag[]
): AIRecommendation[] {
  const recommendations: AIRecommendation[] = [];
  const lowerText = text.toLowerCase();

  // Location-based recommendations
  if (destination) {
    // If positive experience, recommend similar places
    const sentiment = analyzeSentimentLocal(text);
    
    if (sentiment.sentiment === 'positive') {
      recommendations.push({
        type: 'place',
        title: `Explore more of ${destination.name}`,
        description: `Discover hidden gems and local favorites in ${destination.name}`,
        relevanceScore: 0.9
      });
    }
  }

  // Category-based recommendations
  const categories = tags?.filter(t => t.type === 'category') || [];
  
  for (const cat of categories.slice(0, 2)) {
    if (cat.key === 'beach') {
      recommendations.push({
        type: 'activity',
        title: 'Try water sports',
        description: 'Enhance your beach experience with snorkeling or surfing',
        relevanceScore: 0.85
      });
    } else if (cat.key === 'mountains') {
      recommendations.push({
        type: 'tip',
        title: 'Pack layers',
        description: 'Mountain weather can change quickly - bring warm clothes',
        relevanceScore: 0.8
      });
    } else if (cat.key === 'food') {
      recommendations.push({
        type: 'food',
        title: 'Take a food tour',
        description: 'Discover local culinary traditions with a guided food tour',
        relevanceScore: 0.85
      });
    }
  }

  // Activity-based tips
  if (lowerText.includes('first time') || lowerText.includes('first visit')) {
    recommendations.push({
      type: 'tip',
      title: 'Book in advance',
      description: 'Popular attractions can sell out - reserve tickets early',
      relevanceScore: 0.9
    });
  }

  return recommendations.slice(0, 4);
}

// ─────────────────────────────────────────────────────────────
// MOOD DETECTION FROM TEXT
// ─────────────────────────────────────────────────────────────

const MOOD_INDICATORS: Partial<Record<MoodType, string[]>> = {
  excited: ['excited', 'thrilled', 'cant wait', 'so excited', 'pumped', 'amazing'],
  happy: ['happy', 'joy', 'wonderful', 'smile', 'great time', 'enjoyed'],
  relaxed: ['relaxed', 'peaceful', 'calm', 'serene', 'tranquil', 'chill'],
  grateful: ['grateful', 'thankful', 'blessed', 'appreciated', 'lucky'],
  adventurous: ['adventure', 'explore', 'thrill', 'exciting', 'daring', 'brave'],
  romantic: ['romantic', 'love', 'romantic getaway', 'couple', 'together forever'],
  nostalgic: ['nostalgic', 'memories', 'reminds me', 'childhood', 'used to'],
  inspired: ['inspired', 'motivated', 'life-changing', 'eye-opening', 'perspective'],
  peaceful: ['peaceful', 'quiet', 'zen', 'meditation', 'spiritual', 'mindful'],
  curious: ['curious', 'wonder', 'interesting', 'fascinating', 'learned'],
  tired: ['tired', 'exhausted', 'draining', 'long day', 'worn out'],
};

function detectMoodFromText(text: string): MoodType | null {
  const lowerText = text.toLowerCase();
  
  for (const [mood, indicators] of Object.entries(MOOD_INDICATORS)) {
    if (indicators?.some(ind => lowerText.includes(ind))) {
      return mood as MoodType;
    }
  }
  
  return null;
}

// ─────────────────────────────────────────────────────────────
// MAIN AI SERVICE
// ─────────────────────────────────────────────────────────────

export const journalAIService = {
  /**
   * Analyze journal content locally (fast, works offline)
   */
  analyzeLocal(
    content: string,
    destination?: JournalPlace,
    mood?: MoodType
  ): AIAnalysis {
    const sentiment = analyzeSentimentLocal(content);
    const tags = extractTags(content, destination);
    const highlights = extractHighlights(content);
    const recommendations = generateRecommendations(content, destination, tags);
    const summary = generateSummary(content, destination, mood, tags);
    
    const wordCount = content.split(/\s+/).filter(w => w.length > 0).length;
    const readingTime = Math.ceil(wordCount / 200); // Average reading speed

    return {
      sentiment: sentiment.sentiment,
      sentimentScore: sentiment.score,
      tags,
      summary,
      highlights,
      recommendations,
      wordCount,
      readingTime,
    };
  },

  /**
   * Analyze journal content via backend AI (more accurate)
   */
  async analyzeWithBackend(
    content: string,
    destination?: JournalPlace,
    mood?: MoodType
  ): Promise<AIAnalysis> {
    try {
      const response = await apiService.post<{ analysis: AIAnalysis }>('/journal/analyze', {
        content,
        mood,
        destination: destination ? {
          name: destination.name,
          lat: destination.lat,
          lng: destination.lng,
          country: destination.country,
        } : null,
      });
      
      return response.analysis;
    } catch (error) {
      // Fallback to local analysis
      console.log('Backend AI unavailable, using local analysis');
      return this.analyzeLocal(content, destination, mood);
    }
  },

  /**
   * Detect mood from text content
   */
  detectMood(content: string): MoodType | null {
    return detectMoodFromText(content);
  },

  /**
   * Extract tags from content
   */
  extractTags(content: string): AutoTag[] {
    return extractTags(content);
  },

  /**
   * Get quick sentiment
   */
  getQuickSentiment(content: string): SentimentType {
    return analyzeSentimentLocal(content).sentiment;
  },

  /**
   * Generate smart summary for feed display
   */
  generateFeedSummary(content: string, maxLength: number = 120): string {
    if (content.length <= maxLength) return content;
    
    // Try to find a good breaking point
    const truncated = content.substring(0, maxLength);
    const lastSentence = truncated.lastIndexOf('.');
    const lastSpace = truncated.lastIndexOf(' ');
    
    const breakPoint = lastSentence > maxLength * 0.7 
      ? lastSentence + 1 
      : lastSpace;
    
    return truncated.substring(0, breakPoint) + '...';
  },

  /**
   * Calculate content quality score
   */
  calculateQualityScore(
    content: string,
    hasMedia: boolean,
    hasLocation: boolean,
    rating: number
  ): number {
    let score = 0;
    
    // Content length (0-40 points)
    const wordCount = content.split(/\s+/).filter(w => w.length > 0).length;
    if (wordCount >= 100) score += 40;
    else if (wordCount >= 50) score += 30;
    else if (wordCount >= 25) score += 20;
    else score += wordCount * 0.8;
    
    // Media (0-25 points)
    if (hasMedia) score += 25;
    
    // Location (0-15 points)
    if (hasLocation) score += 15;
    
    // Rating (0-20 points)
    score += rating * 4;
    
    return Math.min(100, score);
  }
};

export default journalAIService;