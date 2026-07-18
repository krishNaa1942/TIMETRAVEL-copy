/**
 * PhrasebookScreen V6 – Travel Language Assistant
 * Next-generation phrase discovery and playback for travelers
 *
 * Features:
 * - Context-aware phrase suggestions based on trip data
 * - Text-to-Speech (TTS) pronunciation
 * - Smart category filtering
 * - Offline-first with AsyncStorage caching
 * - Bookmark & recently used phrases
 * - Ranked fuzzy search with debounce
 * - Skeleton loading states
 * - Glassmorphism UI design
 * - Virtualized list rendering
 * - Accessible controls and labels
 * - Haptic feedback
 */

import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  memo,
} from "react";
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { Text } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  phrasebookService,
  PhraseData,
  DestinationInfo,
} from "@/services/phrasebook";
import { colors, spacing } from "@/theme/colors";
import { useTravelIntelligence } from "@/stores/travelIntelligenceStore";
import { usePhrasebookStore } from "@/features/phrasebook/store/phrasebookStore";
import { PressableScale } from "@/components/UI/PressableScale";
import { GlassCard } from "@/components/UI/GlassCard";
import { useDebounce } from "@/hooks/useDebounce";
import { SearchEngine } from "@/features/phrasebook/services/SearchEngine";
import type {
  Phrase as FeaturePhrase,
  PhraseCategory as FeaturePhraseCategory,
} from "@/features/phrasebook/types";

// Phrase type definition
interface Phrase {
  id?: string;
  english: string;
  local: string;
  pronunciation?: string;
  category?: string;
  transliteration?: string;
  tags?: string[];
  difficulty?: "beginner" | "intermediate" | "advanced";
}

// Polyfill for expo-haptics (graceful fallback)
const Haptics = {
  impactAsync: async (_style: string) => {
    /* no-op on web */
  },
  notificationAsync: async (_type: string) => {
    /* no-op on web */
  },
  ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
  NotificationFeedbackType: {
    Success: "success",
    Warning: "warning",
    Error: "error",
  },
};

// Polyfill for expo-speech (graceful fallback)
const Speech = {
  speak: (
    text: string,
    options?: {
      language?: string;
      rate?: number;
      onDone?: () => void;
      onError?: () => void;
    },
  ) => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      if (options?.language) utterance.lang = options.language;
      if (options?.rate) utterance.rate = options.rate;
      utterance.onend = () => options?.onDone?.();
      utterance.onerror = () => options?.onError?.();
      window.speechSynthesis.speak(utterance);
    } else {
      options?.onDone?.();
    }
  },
  stop: () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  },
};

const CACHE_KEY = "@phrasebook_cache_v2";
const BOOKMARKS_KEY = "@phrasebook_bookmarks";
const RECENT_KEY = "@phrasebook_recent";
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// ─────────────────────────────────────────────────────────────
// TYPES & CONSTANTS
// ─────────────────────────────────────────────────────────────

type Category = FeaturePhraseCategory | "all";

interface EnhancedPhrase extends Phrase {
  id: string;
  isBookmarked?: boolean;
  isRecent?: boolean;
  contextScore?: number;
}

interface CachedPhrasebook {
  data: PhraseData;
  destination: string;
  timestamp: number;
}

interface CategorySummary {
  key: Category;
  label: string;
  icon: string;
  color: string;
  emoji: string;
  count: number;
  previews: string[];
}

const CATEGORIES: {
  key: Category;
  label: string;
  icon: string;
  color: string;
  emoji: string;
}[] = [
  {
    key: "all",
    label: "All",
    icon: "translate",
    color: "#7C3AED",
    emoji: "🌐",
  },
  {
    key: "greetings",
    label: "Greetings",
    icon: "hand-wave",
    color: "#10B981",
    emoji: "👋",
  },
  { key: "food", label: "Food", icon: "food", color: "#F59E0B", emoji: "🍽️" },
  {
    key: "transport",
    label: "Transport",
    icon: "bus",
    color: "#3B82F6",
    emoji: "🚌",
  },
  {
    key: "emergency",
    label: "Emergency",
    icon: "alert-circle",
    color: "#EF4444",
    emoji: "🆘",
  },
  {
    key: "shopping",
    label: "Shopping",
    icon: "shopping",
    color: "#EC4899",
    emoji: "🛍️",
  },
  {
    key: "directions",
    label: "Directions",
    icon: "map-marker",
    color: "#06B6D4",
    emoji: "📍",
  },
  {
    key: "accommodation",
    label: "Stay",
    icon: "bed",
    color: "#8B5CF6",
    emoji: "🛏️",
  },
  {
    key: "health",
    label: "Health",
    icon: "heart-pulse",
    color: "#14B8A6",
    emoji: "🏥",
  },
  {
    key: "social",
    label: "Social",
    icon: "account-group",
    color: "#6366F1",
    emoji: "🫶",
  },
  {
    key: "money",
    label: "Money",
    icon: "cash-multiple",
    color: "#16A34A",
    emoji: "💵",
  },
  {
    key: "time",
    label: "Time",
    icon: "clock-outline",
    color: "#64748B",
    emoji: "⏰",
  },
  {
    key: "weather",
    label: "Weather",
    icon: "weather-sunny",
    color: "#F97316",
    emoji: "☀️",
  },
];

const normalizeCategory = (value?: string): Category | null => {
  switch (value?.toLowerCase()) {
    case "greetings":
    case "food":
    case "transport":
    case "emergency":
    case "shopping":
    case "directions":
    case "accommodation":
    case "health":
    case "social":
    case "money":
    case "time":
    case "weather":
      return value.toLowerCase() as Category;
    default:
      return null;
  }
};

const resolvePhraseCategory = (phrase: Phrase): FeaturePhraseCategory => {
  const directCategory = normalizeCategory(phrase.category);
  if (directCategory && directCategory !== "all") {
    return directCategory;
  }

  const text = [
    phrase.english,
    phrase.local,
    phrase.pronunciation,
    phrase.category,
    ...(phrase.tags || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (
    /hello|hi|good morning|good evening|thank|please|sorry|excuse|goodbye|welcome/.test(
      text,
    )
  )
    return "greetings";
  if (
    /food|eat|drink|water|menu|restaurant|order|bill|vegetarian|spicy|meal|breakfast|lunch|dinner/.test(
      text,
    )
  )
    return "food";
  if (
    /bus|train|taxi|airport|station|ticket|flight|gate|boarding|subway|metro|ride|platform/.test(
      text,
    )
  )
    return "transport";
  if (
    /help|emergency|doctor|hospital|police|fire|ambulance|danger|lost|passport|sick|injury|poison/.test(
      text,
    )
  )
    return "emergency";
  if (
    /hotel|room|checkout|check-in|checkin|reservation|booking|stay|hostel|guesthouse|accommodation|bed|key/.test(
      text,
    )
  )
    return "accommodation";
  if (
    /doctor|medicine|pharmacy|clinic|hospital|pain|fever|allergy|health|injury|sick|cough|medicine/.test(
      text,
    )
  )
    return "health";
  if (
    /friends|social|chat|meet|party|family|conversation|hang out|hangout|invite/.test(
      text,
    )
  )
    return "social";
  if (
    /cash|money|currency|exchange|bank|change|price|cost|atm|credit|debit|pay|payment|bill/.test(
      text,
    )
  )
    return "money";
  if (
    /time|clock|late|early|hour|minute|schedule|today|tomorrow|tonight|now|date/.test(
      text,
    )
  )
    return "time";
  if (
    /weather|rain|hot|cold|snow|sunny|storm|wind|forecast|temperature|humid/.test(
      text,
    )
  )
    return "weather";
  if (
    /buy|shop|price|cost|cheap|expensive|market|store|souvenir|discount/.test(
      text,
    )
  )
    return "shopping";
  if (
    /where|direction|left|right|straight|map|address|near|far|road|turn|route|way/.test(
      text,
    )
  )
    return "directions";

  return directCategory && directCategory !== "all"
    ? (directCategory as FeaturePhraseCategory)
    : "greetings";
};

const createPhraseId = (
  destination: string,
  phrase: Phrase,
  index: number,
): string => {
  const base = [
    destination,
    phrase.english,
    phrase.local,
    phrase.pronunciation || "",
  ]
    .filter(Boolean)
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${base || "phrase"}-${index}`;
};

const buildSearchTags = (
  phrase: Phrase,
  destination: string,
  category: Category,
): string[] =>
  Array.from(
    new Set(
      [
        destination,
        category,
        phrase.category,
        phrase.english,
        phrase.local,
        phrase.pronunciation,
        phrase.transliteration,
        ...(phrase.tags || []),
      ].filter(Boolean) as string[],
    ),
  );

const resolveSpeechLanguage = (
  language?: string,
  localText?: string,
): string => {
  const value = `${language || ""} ${localText || ""}`.toLowerCase();

  if (/japanese|ja\b|日本/.test(value)) return "ja-JP";
  if (/korean|ko\b|한국/.test(value)) return "ko-KR";
  if (/chinese|mandarin|zh\b|中文|汉/.test(value)) return "zh-CN";
  if (/arabic|ar\b|العربية/.test(value)) return "ar-SA";
  if (/thai|th\b|ไทย/.test(value)) return "th-TH";
  if (/french|fr\b|français|francais/.test(value)) return "fr-FR";
  if (/german|de\b|deutsch/.test(value)) return "de-DE";
  if (/italian|it\b|italiano/.test(value)) return "it-IT";
  if (/portuguese|pt\b|português|portugues/.test(value)) return "pt-BR";
  if (/spanish|es\b|español/.test(value)) return "es-ES";
  if (/hindi|hi\b|हिंदी/.test(value)) return "hi-IN";

  return "en-US";
};

// ─────────────────────────────────────────────────────────────
// UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────────

const detectCategory = (phrase: Phrase): Category => {
  const resolved = resolvePhraseCategory(phrase);
  return resolved;
};

// ─────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
// Category Grid
interface CategoryGridProps {
  activeCategory: Category;
  onCategoryPress: (cat: Category) => void;
  summaries: CategorySummary[];
}

const CategoryGrid = memo(
  ({ activeCategory, onCategoryPress, summaries }: CategoryGridProps) => (
    <View style={styles.categoryGrid}>
      {summaries.map((item) => {
        const isActive = activeCategory === item.key;
        const previewLines =
          item.previews.length > 0 ? item.previews : ["Tap to explore"];

        return (
          <PressableScale
            key={item.key}
            style={[
              styles.categoryCard,
              isActive && styles.categoryCardActive,
              { borderColor: isActive ? item.color : "#E2E8F0" },
            ]}
            accessibilityRole="button"
            accessibilityLabel={`${item.label} category, ${item.count} phrases`}
            accessibilityState={{ selected: isActive }}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onCategoryPress(item.key);
            }}
          >
            <View style={styles.categoryCardTop}>
              <Text style={styles.categoryCardEmoji}>{item.emoji}</Text>
              <View
                style={[
                  styles.categoryCountPill,
                  { backgroundColor: `${item.color}18` },
                ]}
              >
                <Text
                  style={[styles.categoryCountPillText, { color: item.color }]}
                >
                  {item.count}
                </Text>
              </View>
            </View>

            <Text
              style={[
                styles.categoryCardTitle,
                isActive && styles.categoryCardTitleActive,
              ]}
            >
              {item.label}
            </Text>

            <Text style={styles.categoryCardSubtext}>
              {item.count > 0
                ? `${item.count} phrases available`
                : "No phrases yet"}
            </Text>

            <View style={styles.categoryPreviewList}>
              {previewLines.slice(0, 2).map((line, index) => (
                <Text
                  key={`${item.key}-${index}`}
                  style={[
                    styles.categoryPreviewText,
                    isActive && styles.categoryPreviewTextActive,
                  ]}
                  numberOfLines={1}
                >
                  {line}
                </Text>
              ))}
              {previewLines.length > 2 && (
                <Text style={styles.categoryPreviewMore}>
                  +{previewLines.length - 2} more
                </Text>
              )}
            </View>
          </PressableScale>
        );
      })}
    </View>
  ),
);
CategoryGrid.displayName = "CategoryGrid";

// ─────────────────────────────────────────────────────────────
// Phrase Card
interface PhraseCardProps {
  phrase: EnhancedPhrase;
  onPlay: () => void;
  onBookmark: () => void;
  language?: string;
}

const PhraseCard = memo(
  ({ phrase, onPlay, onBookmark, language }: PhraseCardProps) => {
    const category = detectCategory(phrase);
    const categoryConfig = CATEGORIES.find((c) => c.key === category);
    const [isPlaying, setIsPlaying] = useState(false);

    useEffect(() => {
      return () => {
        Speech.stop();
      };
    }, []);

    const handlePlay = async () => {
      if (isPlaying) {
        Speech.stop();
        setIsPlaying(false);
        return;
      }

      setIsPlaying(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      Speech.speak(phrase.local, {
        language: resolveSpeechLanguage(language, phrase.local),
        rate: 0.8,
        onDone: () => setIsPlaying(false),
        onError: () => setIsPlaying(false),
      });

      onPlay();
    };

    return (
      <GlassCard intensity={40} tint="light" style={styles.phraseCard}>
        {/* Header row */}
        <View style={styles.phraseHeader}>
          <View style={styles.phraseCategoryRow}>
            {categoryConfig && (
              <View
                style={[
                  styles.phraseCategoryBadge,
                  { backgroundColor: `${categoryConfig.color}20` },
                ]}
              >
                <Text style={styles.phraseCategoryEmoji}>
                  {categoryConfig.emoji}
                </Text>
                <Text
                  style={[
                    styles.phraseCategoryText,
                    { color: categoryConfig.color },
                  ]}
                >
                  {categoryConfig.label}
                </Text>
              </View>
            )}
            {phrase.isRecent && (
              <View style={styles.recentBadge}>
                <MaterialCommunityIcons
                  name="history"
                  size={10}
                  color="#64748B"
                />
                <Text style={styles.recentText}>Recent</Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            onPress={onBookmark}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel={`Bookmark ${phrase.english}`}
            accessibilityState={{ selected: !!phrase.isBookmarked }}
          >
            <MaterialCommunityIcons
              name={phrase.isBookmarked ? "star" : "star-outline"}
              size={22}
              color={phrase.isBookmarked ? "#F59E0B" : "#94A3B8"}
            />
          </TouchableOpacity>
        </View>

        {/* English text */}
        <Text style={styles.phraseEnglish}>{phrase.english}</Text>

        {/* Local translation */}
        <View style={styles.phraseLocalRow}>
          <Text style={styles.phraseLocal}>{phrase.local}</Text>
          <PressableScale
            style={styles.playButton}
            onPress={handlePlay}
            accessibilityRole="button"
            accessibilityLabel={`Play pronunciation for ${phrase.english}`}
          >
            <LinearGradient
              colors={
                isPlaying ? ["#10B981", "#059669"] : ["#7C3AED", "#6D28D9"]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.playButtonGradient}
            >
              <MaterialCommunityIcons
                name={isPlaying ? "stop" : "volume-high"}
                size={18}
                color="#FFF"
              />
            </LinearGradient>
          </PressableScale>
        </View>

        {/* Pronunciation */}
        {phrase.pronunciation && (
          <View style={styles.pronunciationRow}>
            <MaterialCommunityIcons
              name="account-tie-voice"
              size={14}
              color="#94A3B8"
            />
            <Text style={styles.pronunciation}>{phrase.pronunciation}</Text>
          </View>
        )}
      </GlassCard>
    );
  },
);
PhraseCard.displayName = "PhraseCard";

// ─────────────────────────────────────────────────────────────
// Language Header
const LanguageHeader = memo(
  ({
    language,
    script,
    phraseCount,
    categoryCount,
    bookmarkCount,
    beginnerCount,
  }: {
    language: string;
    script?: string;
    phraseCount: number;
    categoryCount: number;
    bookmarkCount: number;
    beginnerCount: number;
  }) => (
    <LinearGradient
      colors={["#1E293B", "#0F172A"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.languageHeader}
    >
      <View style={styles.languageHeaderTop}>
        <View style={styles.languageHeaderIdentity}>
          <Text style={styles.languageEmoji}>🌍</Text>
          <View>
            <Text style={styles.languageName}>{language}</Text>
            {script && (
              <Text style={styles.languageScript}>Script: {script}</Text>
            )}
          </View>
        </View>
        <View style={styles.languageHeaderBadge}>
          <Text style={styles.languageHeaderBadgeText}>Scan-friendly</Text>
        </View>
      </View>

      <Text style={styles.languageHeaderHint}>
        Browse essentials first, then jump into a category card to preview real
        phrases before you search.
      </Text>

      <View style={styles.languageStatsGrid}>
        <View style={styles.languageStatCard}>
          <Text style={styles.languageStatValue}>{phraseCount}</Text>
          <Text style={styles.languageStatLabel}>phrases</Text>
        </View>
        <View style={styles.languageStatCard}>
          <Text style={styles.languageStatValue}>{categoryCount}</Text>
          <Text style={styles.languageStatLabel}>categories</Text>
        </View>
        <View style={styles.languageStatCard}>
          <Text style={styles.languageStatValue}>{bookmarkCount}</Text>
          <Text style={styles.languageStatLabel}>saved</Text>
        </View>
        <View style={styles.languageStatCard}>
          <Text style={styles.languageStatValue}>{beginnerCount}</Text>
          <Text style={styles.languageStatLabel}>beginner</Text>
        </View>
      </View>
    </LinearGradient>
  ),
);
LanguageHeader.displayName = "LanguageHeader";

// ─────────────────────────────────────────────────────────────
// Search Bar
interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}

const SearchBar = memo(
  ({
    value = "",
    onChangeText,
    placeholder = "Search phrases...",
  }: SearchBarProps) => (
    <View style={styles.searchContainer}>
      <MaterialCommunityIcons name="magnify" size={20} color="#94A3B8" />
      <TextInput
        style={styles.searchInput}
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        value={value}
        onChangeText={onChangeText}
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityLabel={placeholder}
      />
      {value.length > 0 && (
        <TouchableOpacity
          onPress={() => onChangeText("")}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
        >
          <MaterialCommunityIcons
            name="close-circle"
            size={20}
            color="#94A3B8"
          />
        </TouchableOpacity>
      )}
    </View>
  ),
);
SearchBar.displayName = "SearchBar";

// ─────────────────────────────────────────────────────────────
// Skeleton Loader
const PhraseSkeleton = memo(() => (
  <View style={styles.skeletonContainer}>
    {Array.from({ length: 5 }).map((_, i) => (
      <View key={i} style={styles.skeletonCard}>
        <View style={styles.skeletonHeader}>
          <View style={styles.skeletonBadge} />
          <View style={styles.skeletonStar} />
        </View>
        <View style={styles.skeletonLineLarge} />
        <View style={styles.skeletonLineMedium} />
        <View style={styles.skeletonPronunciation} />
      </View>
    ))}
  </View>
));
PhraseSkeleton.displayName = "PhraseSkeleton";

// ─────────────────────────────────────────────────────────────
// Empty State
interface EmptyStateProps {
  type: "no-destination" | "no-results" | "error";
  onAction?: () => void;
  actionLabel?: string;
}

const EmptyState = memo(({ type, onAction, actionLabel }: EmptyStateProps) => {
  const config = {
    "no-destination": {
      emoji: "🗺️",
      title: "Select a Destination",
      subtitle:
        "Choose where you're traveling to load essentials, categories, and local phrases.",
    },
    "no-results": {
      emoji: "🔍",
      title: "No Phrases Found",
      subtitle: "Try Essentials, Greetings, Food, or Emergency.",
    },
    error: {
      emoji: "⚠️",
      title: "Something Went Wrong",
      subtitle: "Please check your connection and try again",
    },
  };

  const { emoji, title, subtitle } = config[type];

  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconWrap}>
        <Text style={styles.emptyEmoji}>{emoji}</Text>
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySubtitle}>{subtitle}</Text>
      {onAction && actionLabel && (
        <PressableScale style={styles.emptyButton} onPress={onAction}>
          <LinearGradient
            colors={["#7C3AED", "#6D28D9"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.emptyButtonGradient}
          >
            <Text style={styles.emptyButtonText}>{actionLabel}</Text>
          </LinearGradient>
        </PressableScale>
      )}
    </View>
  );
});
EmptyState.displayName = "EmptyState";

// ─────────────────────────────────────────────────────────────
// Destination Selector
interface DestinationSelectorProps {
  destinations: DestinationInfo[];
  selected: string;
  onSelect: (dest: string) => void;
}

const DestinationSelector = memo(
  ({ destinations, selected, onSelect }: DestinationSelectorProps) => (
    <FlatList
      horizontal
      data={destinations}
      keyExtractor={(item) => item.key}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.destinationsScroll}
      renderItem={({ item }) => {
        const isSelected = selected === item.key || selected === item.label;
        return (
          <PressableScale
            style={[
              styles.destinationChip,
              isSelected && styles.destinationChipActive,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Select destination ${item.label}`}
            accessibilityState={{ selected: isSelected }}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onSelect(item.key);
            }}
          >
            <Text
              style={[
                styles.destinationChipText,
                isSelected && styles.destinationChipTextActive,
              ]}
            >
              {item.label}
            </Text>
          </PressableScale>
        );
      }}
    />
  ),
);
DestinationSelector.displayName = "DestinationSelector";

// ─────────────────────────────────────────────────────────────
// Context Suggestions
interface HelpfulSuggestionsProps {
  context: string;
  phrases: EnhancedPhrase[];
  onPhrasePress: (phrase: EnhancedPhrase) => void;
}

const HelpfulSuggestions = memo(
  ({ context, phrases, onPhrasePress }: HelpfulSuggestionsProps) => {
    if (phrases.length === 0) return null;

    return (
      <View style={styles.contextSection}>
        <View style={styles.contextHeader}>
          <MaterialCommunityIcons
            name="compass-outline"
            size={16}
            color="#7C3AED"
          />
          <Text style={styles.contextTitle}>Helpful for {context}</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {phrases.slice(0, 4).map((phrase, idx) => (
            <PressableScale
              key={idx}
              style={styles.contextPhraseChip}
              onPress={() => onPhrasePress(phrase)}
              accessibilityRole="button"
              accessibilityLabel={`Use suggested phrase ${phrase.english}`}
            >
              <Text style={styles.contextPhraseText} numberOfLines={1}>
                {phrase.english}
              </Text>
            </PressableScale>
          ))}
        </ScrollView>
      </View>
    );
  },
);
HelpfulSuggestions.displayName = "HelpfulSuggestions";

interface PhrasebookScreenErrorBoundaryProps {
  children: React.ReactNode;
}

interface PhrasebookScreenErrorBoundaryState {
  hasError: boolean;
}

class PhrasebookScreenErrorBoundary extends React.Component<
  PhrasebookScreenErrorBoundaryProps,
  PhrasebookScreenErrorBoundaryState
> {
  state: PhrasebookScreenErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): PhrasebookScreenErrorBoundaryState {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorBoundary}>
          <EmptyState
            type="error"
            actionLabel="Retry"
            onAction={() => this.setState({ hasError: false })}
          />
        </View>
      );
    }

    return this.props.children;
  }
}

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────

export default function PhrasebookScreen() {
  const selectedDestination =
    usePhrasebookStore((state) => state.selectedDestination) || "";
  const selectDestination = usePhrasebookStore(
    (state) => state.selectDestination,
  );
  const searchQuery = usePhrasebookStore((state) => state.searchQuery) || "";
  const setSearchQuery = usePhrasebookStore((state) => state.setSearchQuery);
  const activeCategory = usePhrasebookStore((state) => state.activeCategory);
  const setActiveCategory = usePhrasebookStore(
    (state) => state.setActiveCategory,
  );
  const showBookmarksOnly = usePhrasebookStore(
    (state) => state.showBookmarksOnly,
  );
  const toggleBookmarksOnly = usePhrasebookStore(
    (state) => state.toggleBookmarksOnly,
  );

  const [destinations, setDestinations] = useState<DestinationInfo[]>([]);
  const [phraseData, setPhraseData] = useState<PhraseData | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [initLoading, setInitLoading] = useState(true);
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [recentPhrases, setRecentPhrases] = useState<string[]>([]);

  const { activeTrip } = useTravelIntelligence();
  const loadRequestIdRef = useRef(0);
  const debouncedSearch = useDebounce(searchQuery, 300);
  const selectedDestinationLabel = useMemo(() => {
    const match = destinations.find(
      (destination) =>
        destination.key === selectedDestination ||
        destination.label === selectedDestination,
    );
    return match?.label || selectedDestination;
  }, [destinations, selectedDestination]);

  useEffect(() => {
    return () => {
      loadRequestIdRef.current += 1;
    };
  }, []);

  // Initialize
  useEffect(() => {
    const init = async () => {
      try {
        const response = await phrasebookService.getDestinations();
        // API returns { destinations: [{ key, label, language, script }, ...] }
        const destList = (response.destinations || []) as DestinationInfo[];
        setDestinations(destList);

        // Use active trip destination if available, otherwise persisted or first destination
        const initialDest =
          activeTrip?.destination?.label ||
          selectedDestination ||
          destList[0]?.key ||
          "";
        if (initialDest) {
          await loadPhrases(initialDest);
        }

        // Load bookmarks and recent
        await loadBookmarks();
        await loadRecentPhrases();
      } catch (e) {
        console.error("Init error:", e);
      } finally {
        setInitLoading(false);
      }
    };
    init();
  }, [activeTrip?.destination?.label, selectedDestination]);

  const readCachedPhrases = useCallback(async (destination: string) => {
    try {
      const cached = await AsyncStorage.getItem(`${CACHE_KEY}_${destination}`);
      if (cached) {
        const data: CachedPhrasebook = JSON.parse(cached);
        if (Date.now() - data.timestamp < CACHE_TTL) {
          return data.data;
        }
      }
    } catch (e) {
      // Ignore cache errors
    }
    return null;
  }, []);

  const loadBookmarks = async () => {
    try {
      const saved = await AsyncStorage.getItem(BOOKMARKS_KEY);
      if (saved) {
        setBookmarks(new Set(JSON.parse(saved)));
      }
    } catch (e) {
      // Ignore
    }
  };

  const loadRecentPhrases = async () => {
    try {
      const saved = await AsyncStorage.getItem(RECENT_KEY);
      if (saved) {
        setRecentPhrases(JSON.parse(saved));
      }
    } catch (e) {
      // Ignore
    }
  };

  const loadPhrases = useCallback(
    async (destination: string) => {
      if (!destination) return;

      const requestId = ++loadRequestIdRef.current;
      if (destination !== selectedDestination) {
        selectDestination(destination);
      }

      setLoading(true);

      try {
        // Try cache first
        const cached = await readCachedPhrases(destination);
        if (requestId !== loadRequestIdRef.current) {
          return;
        }

        if (cached) {
          setPhraseData(cached);
          return;
        }

        const response = await phrasebookService.getPhrases(destination);
        if (requestId !== loadRequestIdRef.current) {
          return;
        }
        setPhraseData(response);

        // Cache the data
        await AsyncStorage.setItem(
          `${CACHE_KEY}_${destination}`,
          JSON.stringify({
            data: response,
            destination,
            timestamp: Date.now(),
          }),
        );
      } catch (e: any) {
        if (requestId === loadRequestIdRef.current) {
          Alert.alert("Error", e.message || "Failed to load phrases");
        }
      } finally {
        if (requestId === loadRequestIdRef.current) {
          setLoading(false);
        }
      }
    },
    [readCachedPhrases, selectDestination, selectedDestination],
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadPhrases(selectedDestination);
    setRefreshing(false);
  }, [selectedDestination, loadPhrases]);

  const toggleBookmark = useCallback(
    async (phrase: Phrase) => {
      const key = `${phrase.english}|${phrase.local}`;
      const newBookmarks = new Set(bookmarks);

      if (newBookmarks.has(key)) {
        newBookmarks.delete(key);
      } else {
        newBookmarks.add(key);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      setBookmarks(newBookmarks);
      await AsyncStorage.setItem(
        BOOKMARKS_KEY,
        JSON.stringify([...newBookmarks]),
      );
    },
    [bookmarks],
  );

  const addToRecent = useCallback(
    async (phrase: Phrase) => {
      const key = phrase.english;
      const newRecent = [key, ...recentPhrases.filter((r) => r !== key)].slice(
        0,
        10,
      );
      setRecentPhrases(newRecent);
      await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(newRecent));
    },
    [recentPhrases],
  );

  // ─────────────────────────────────────────────────────────────
  // COMPUTED VALUES
  // ─────────────────────────────────────────────────────────────
  const indexedPhrases = useMemo<FeaturePhrase[]>(() => {
    if (!phraseData?.phrases) return [];

    const destinationTag =
      phraseData.destination ||
      selectedDestinationLabel ||
      selectedDestination ||
      "phrasebook";

    return phraseData.phrases.map((phrase, index) => {
      const category = resolvePhraseCategory(phrase);
      return {
        id: createPhraseId(destinationTag, phrase, index),
        english: phrase.english,
        local: phrase.local,
        pronunciation: phrase.pronunciation,
        transliteration: phrase.transliteration,
        category,
        difficulty: phrase.difficulty || "beginner",
        tags: buildSearchTags(phrase, destinationTag, category),
      };
    });
  }, [
    phraseData?.phrases,
    phraseData?.destination,
    selectedDestination,
    selectedDestinationLabel,
  ]);

  const enhancedPhrases = useMemo((): EnhancedPhrase[] => {
    return indexedPhrases.map((phrase) => {
      const key = `${phrase.english}|${phrase.local}`;
      return {
        ...phrase,
        isBookmarked: bookmarks.has(key),
        isRecent: recentPhrases.includes(phrase.english),
        category: phrase.category || "greetings",
      };
    });
  }, [indexedPhrases, bookmarks, recentPhrases]);

  const searchEngine = useMemo(() => {
    const engine = new SearchEngine();
    if (indexedPhrases.length > 0) {
      engine.indexPhrases(indexedPhrases);
    }
    return engine;
  }, [indexedPhrases]);

  const searchResults = useMemo(() => {
    const query =
      typeof debouncedSearch === "string" ? debouncedSearch.trim() : "";
    if (!query || indexedPhrases.length === 0) {
      return null;
    }

    return searchEngine.search(query, {
      maxResults: 100,
      threshold: 0.25,
      includeFields: ["english", "local", "pronunciation", "tags"],
    });
  }, [debouncedSearch, indexedPhrases, searchEngine]);

  const categorySummaries = useMemo<CategorySummary[]>(() => {
    return CATEGORIES.map((category) => {
      const phrasesForCategory =
        category.key === "all"
          ? enhancedPhrases
          : enhancedPhrases.filter(
              (phrase) => phrase.category === category.key,
            );

      const sortedPreviews = [...phrasesForCategory].sort((a, b) => {
        if (a.isRecent !== b.isRecent) return a.isRecent ? -1 : 1;
        if (a.isBookmarked !== b.isBookmarked) return a.isBookmarked ? -1 : 1;
        if (a.difficulty !== b.difficulty) {
          const difficultyOrder = {
            beginner: 0,
            intermediate: 1,
            advanced: 2,
          };
          return (
            difficultyOrder[a.difficulty || "beginner"] -
            difficultyOrder[b.difficulty || "beginner"]
          );
        }
        return 0;
      });

      return {
        ...category,
        count: phrasesForCategory.length,
        previews: sortedPreviews.slice(0, 3).map((phrase) => phrase.english),
      };
    });
  }, [enhancedPhrases]);

  const beginnerCount = useMemo(
    () =>
      enhancedPhrases.filter((phrase) => phrase.difficulty === "beginner")
        .length,
    [enhancedPhrases],
  );

  const essentialPhrases = useMemo(() => {
    if (!enhancedPhrases.length) return [];

    const priorityCategories: Category[] = [
      "greetings",
      "emergency",
      "food",
      "transport",
      "accommodation",
      "health",
    ];

    return enhancedPhrases
      .filter(
        (phrase) =>
          phrase.difficulty === "beginner" ||
          priorityCategories.includes(
            normalizeCategory(phrase.category) || "greetings",
          ),
      )
      .sort((a, b) => {
        const aPriority = priorityCategories.includes(
          normalizeCategory(a.category) || "greetings",
        )
          ? 0
          : 1;
        const bPriority = priorityCategories.includes(
          normalizeCategory(b.category) || "greetings",
        )
          ? 0
          : 1;
        if (aPriority !== bPriority) return aPriority - bPriority;
        if (a.isRecent !== b.isRecent) return a.isRecent ? -1 : 1;
        if (a.isBookmarked !== b.isBookmarked) return a.isBookmarked ? -1 : 1;
        return 0;
      })
      .slice(0, 6);
  }, [enhancedPhrases]);

  const filteredPhrases = useMemo(() => {
    let result = enhancedPhrases;

    if (showBookmarksOnly) {
      result = result.filter((phrase) => phrase.isBookmarked);
    }

    if (activeCategory !== "all") {
      result = result.filter((phrase) => phrase.category === activeCategory);
    }

    if (searchResults) {
      if (searchResults.length === 0) {
        return [];
      }

      const scoreById = new Map(
        searchResults.map((entry) => [entry.phrase.id, entry.score]),
      );
      result = result.filter((phrase) => scoreById.has(phrase.id));
      result = [...result].sort((a, b) => {
        const scoreDifference =
          (scoreById.get(b.id) || 0) - (scoreById.get(a.id) || 0);
        if (scoreDifference !== 0) return scoreDifference;
        if (a.isRecent !== b.isRecent) return a.isRecent ? -1 : 1;
        if (a.isBookmarked !== b.isBookmarked) return a.isBookmarked ? -1 : 1;
        return 0;
      });
      return result;
    }

    return [...result].sort((a, b) => {
      if (a.isRecent !== b.isRecent) return a.isRecent ? -1 : 1;
      if (a.isBookmarked !== b.isBookmarked) return a.isBookmarked ? -1 : 1;
      return 0;
    });
  }, [enhancedPhrases, showBookmarksOnly, activeCategory, searchResults]);

  const bookmarkCount = useMemo(
    () => enhancedPhrases.filter((p) => p.isBookmarked).length,
    [enhancedPhrases],
  );

  const contextSuggestions = useMemo(() => {
    if (!enhancedPhrases.length) return [];

    const priorityCategories: Category[] = [
      "emergency",
      "transport",
      "food",
      "accommodation",
      "health",
    ];
    return enhancedPhrases
      .filter((phrase) =>
        priorityCategories.includes(
          normalizeCategory(phrase.category) || "greetings",
        ),
      )
      .slice(0, 4);
  }, [enhancedPhrases]);

  const renderPhrase = useCallback(
    ({ item }: { item: EnhancedPhrase }) => (
      <PhraseCard
        phrase={item}
        onPlay={() => addToRecent(item)}
        onBookmark={() => toggleBookmark(item)}
        language={phraseData?.language}
      />
    ),
    [toggleBookmark, addToRecent, phraseData?.language],
  );

  const keyExtractor = useCallback(
    (item: EnhancedPhrase, index: number) =>
      item.id || `${item.english}_${index}`,
    [],
  );

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────

  if (initLoading) {
    return <PhraseSkeleton />;
  }

  return (
    <PhrasebookScreenErrorBoundary>
      <SafeAreaView style={styles.container} edges={["top"]}>
        {/* Header */}
        <LinearGradient colors={["#7C3AED", "#6D28D9"]} style={styles.header}>
          <View style={styles.headerContent}>
            <View>
              <Text style={styles.headerTitle}>Phrasebook</Text>
              <Text style={styles.headerSubtitle}>
                {selectedDestinationLabel
                  ? `For ${selectedDestinationLabel}`
                  : "Speak like a local"}
              </Text>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={[
                  styles.headerAction,
                  showBookmarksOnly && styles.headerActionActive,
                ]}
                onPress={toggleBookmarksOnly}
                accessibilityRole="button"
                accessibilityLabel={
                  showBookmarksOnly
                    ? "Show all phrases"
                    : "Show bookmarked phrases only"
                }
                accessibilityState={{ selected: showBookmarksOnly }}
              >
                <MaterialCommunityIcons
                  name={showBookmarksOnly ? "star" : "star-outline"}
                  size={22}
                  color="#FFF"
                />
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>

        {/* Destination Overview */}
        {phraseData && (
          <LanguageHeader
            language={phraseData.language || "Unknown"}
            script={phraseData.script}
            phraseCount={phraseData.phrases?.length || 0}
            categoryCount={CATEGORIES.length - 1}
            bookmarkCount={bookmarkCount}
            beginnerCount={beginnerCount}
          />
        )}

        {/* Search Bar */}
        {phraseData && (
          <View style={styles.searchSection}>
            <SearchBar
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={`Search phrases or tap a card in ${phraseData.language || selectedDestinationLabel || "this language"}...`}
            />
          </View>
        )}

        {/* Essentials */}
        {phraseData && essentialPhrases.length > 0 && (
          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Essential phrases</Text>
                <Text style={styles.sectionSubtitle}>
                  Fast access to the phrases travelers reach for first.
                </Text>
              </View>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.railScroll}
            >
              {essentialPhrases.map((phrase) => {
                const categoryConfig = CATEGORIES.find(
                  (category) => category.key === phrase.category,
                );

                return (
                  <PressableScale
                    key={phrase.id}
                    style={styles.railCard}
                    onPress={() => {
                      setSearchQuery(phrase.english);
                      addToRecent(phrase);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Search for essential phrase ${phrase.english}`}
                  >
                    <View
                      style={[
                        styles.railBadge,
                        {
                          backgroundColor: `${categoryConfig?.color || "#7C3AED"}18`,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.railBadgeText,
                          { color: categoryConfig?.color || "#7C3AED" },
                        ]}
                      >
                        {categoryConfig?.label || "Travel"}
                      </Text>
                    </View>
                    <Text style={styles.railEnglish} numberOfLines={1}>
                      {phrase.english}
                    </Text>
                    <Text style={styles.railLocal} numberOfLines={1}>
                      {phrase.local}
                    </Text>
                  </PressableScale>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Category Grid */}
        {phraseData && (
          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Browse categories</Text>
                <Text style={styles.sectionSubtitle}>
                  Tap a card to preview phrases before you scroll the full list.
                </Text>
              </View>
            </View>
            <CategoryGrid
              activeCategory={activeCategory}
              onCategoryPress={setActiveCategory}
              summaries={categorySummaries}
            />
          </View>
        )}

        {/* Destination Selector */}
        {destinations.length > 0 && (
          <DestinationSelector
            destinations={destinations}
            selected={selectedDestination}
            onSelect={loadPhrases}
          />
        )}

        {/* Helpful Suggestions */}
        {contextSuggestions.length > 0 && !showBookmarksOnly && (
          <HelpfulSuggestions
            context={selectedDestinationLabel || "your trip"}
            phrases={contextSuggestions}
            onPhrasePress={(phrase) => {
              setSearchQuery(phrase.english);
              addToRecent(phrase);
            }}
          />
        )}

        {/* Loading State */}
        {loading && <PhraseSkeleton />}

        {/* Empty States */}
        {!loading && !phraseData && (
          <EmptyState
            type={destinations.length === 0 ? "error" : "no-destination"}
            onAction={
              destinations.length > 0
                ? () => loadPhrases(destinations[0].key)
                : undefined
            }
            actionLabel={
              destinations.length > 0 ? "Load First Destination" : undefined
            }
          />
        )}

        {!loading && phraseData && filteredPhrases.length === 0 && (
          <EmptyState
            type="no-results"
            onAction={showBookmarksOnly ? toggleBookmarksOnly : undefined}
            actionLabel={showBookmarksOnly ? "Show All Phrases" : undefined}
          />
        )}

        {/* Phrases List */}
        {!loading && filteredPhrases.length > 0 && (
          <FlashList
            data={filteredPhrases}
            renderItem={renderPhrase}
            keyExtractor={keyExtractor}
            contentContainerStyle={styles.phrasesList}
            showsVerticalScrollIndicator={false}
            refreshing={refreshing}
            onRefresh={handleRefresh}
            removeClippedSubviews
          />
        )}
      </SafeAreaView>
    </PhrasebookScreenErrorBoundary>
  );
}

// ─────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  errorBoundary: { flex: 1, backgroundColor: "#F8FAFC" },

  // Header
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "900",
    color: "#FFF",
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
    marginTop: 2,
  },
  headerActions: { flexDirection: "row", gap: 8 },
  headerAction: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerActionActive: { backgroundColor: "rgba(255,255,255,0.3)" },

  // Destinations
  destinationsScroll: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    gap: 8,
  },
  destinationChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#FFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  destinationChipActive: { backgroundColor: "#7C3AED", borderColor: "#7C3AED" },
  destinationChipText: { fontSize: 13, fontWeight: "600", color: "#64748B" },
  destinationChipTextActive: { color: "#FFF" },

  // Search
  searchSection: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 10,
  },
  searchInput: { flex: 1, fontSize: 14, color: "#0F172A", padding: 0 },

  // Overview and Browse Sections
  languageHeader: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    borderRadius: 18,
    padding: spacing.md,
    gap: 12,
  },
  languageHeaderTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  languageHeaderIdentity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flexShrink: 1,
  },
  languageEmoji: { fontSize: 28 },
  languageName: { fontSize: 18, fontWeight: "700", color: "#FFF" },
  languageScript: {
    fontSize: 12,
    color: "rgba(255,255,255,0.6)",
    marginTop: 2,
  },
  languageHeaderBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  languageHeaderBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#E0E7FF",
  },
  languageHeaderHint: {
    fontSize: 12,
    lineHeight: 18,
    color: "rgba(255,255,255,0.72)",
  },
  languageStatsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  languageStatCard: {
    width: "48%",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  languageStatValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFF",
  },
  languageStatLabel: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: "700",
    color: "#CBD5E1",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },

  sectionBlock: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
  },
  sectionSubtitle: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
    color: "#64748B",
  },
  railScroll: {
    gap: 12,
    paddingRight: spacing.lg,
  },
  railCard: {
    width: 170,
    minHeight: 112,
    padding: 14,
    borderRadius: 18,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    justifyContent: "space-between",
  },
  railBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 10,
  },
  railBadgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  railEnglish: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
  },
  railLocal: {
    marginTop: 4,
    fontSize: 18,
    fontWeight: "800",
    color: colors.primary,
  },

  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  categoryCard: {
    width: "48%",
    minHeight: 154,
    padding: 12,
    borderRadius: 18,
    borderWidth: 1,
    backgroundColor: "#FFF",
    justifyContent: "space-between",
  },
  categoryCardActive: {
    backgroundColor: "#F8F5FF",
  },
  categoryCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  categoryCardEmoji: { fontSize: 22 },
  categoryCountPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  categoryCountPillText: {
    fontSize: 11,
    fontWeight: "700",
  },
  categoryCardTitle: {
    marginTop: 8,
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
  },
  categoryCardTitleActive: {
    color: colors.primary,
  },
  categoryCardSubtext: {
    marginTop: 2,
    fontSize: 11,
    color: "#64748B",
  },
  categoryPreviewList: {
    marginTop: 10,
    gap: 4,
  },
  categoryPreviewText: {
    fontSize: 12,
    color: "#334155",
  },
  categoryPreviewTextActive: {
    color: "#1E293B",
  },
  categoryPreviewMore: {
    fontSize: 11,
    fontWeight: "600",
    color: "#94A3B8",
  },

  // Context Suggestions
  contextSection: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  contextHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  contextTitle: { fontSize: 13, fontWeight: "600", color: "#7C3AED" },
  contextPhraseChip: {
    backgroundColor: "#EEF2FF",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginRight: 8,
  },
  contextPhraseText: { fontSize: 12, fontWeight: "500", color: "#7C3AED" },

  // Phrases List
  phrasesList: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 120,
    paddingTop: spacing.sm,
  },

  // Phrase Card
  phraseCard: { marginBottom: 10, borderRadius: 16, padding: spacing.md },
  phraseHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  phraseCategoryRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  phraseCategoryBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  phraseCategoryEmoji: { fontSize: 12 },
  phraseCategoryText: { fontSize: 10, fontWeight: "600" },
  recentBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  recentText: { fontSize: 10, color: "#64748B", fontWeight: "500" },
  phraseEnglish: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0F172A",
    marginBottom: 6,
  },
  phraseLocalRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  phraseLocal: { flex: 1, fontSize: 20, fontWeight: "700", color: "#7C3AED" },
  playButton: { width: 44, height: 44, borderRadius: 22, overflow: "hidden" },
  playButtonGradient: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  pronunciationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
  },
  pronunciation: { fontSize: 13, color: "#64748B", fontStyle: "italic" },

  // Skeleton
  skeletonContainer: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  skeletonCard: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: 10,
  },
  skeletonHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  skeletonBadge: {
    width: 80,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#E2E8F0",
  },
  skeletonStar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#E2E8F0",
  },
  skeletonLineLarge: {
    height: 16,
    backgroundColor: "#E2E8F0",
    borderRadius: 8,
    width: "80%",
    marginBottom: 8,
  },
  skeletonLineMedium: {
    height: 20,
    backgroundColor: "#E2E8F0",
    borderRadius: 10,
    width: "60%",
    marginBottom: 8,
  },
  skeletonPronunciation: {
    height: 12,
    backgroundColor: "#E2E8F0",
    borderRadius: 6,
    width: "40%",
  },

  // Empty State
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xxl * 2,
    paddingHorizontal: spacing.lg,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  emptyEmoji: { fontSize: 36 },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  emptyButton: { borderRadius: 14, overflow: "hidden" },
  emptyButtonGradient: { paddingHorizontal: 20, paddingVertical: 12 },
  emptyButtonText: { fontSize: 14, fontWeight: "700", color: "#FFF" },
});
