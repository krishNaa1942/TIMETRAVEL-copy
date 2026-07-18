/**
 * NewsFeedScreen V5 – AI Travel News Command Center
 * Premium news experience competing with Google News, Twitter/X, Bloomberg
 * 
 * Features:
 * - AI-powered personalization
 * - Featured hero news card
 * - Safety alerts with severity levels
 * - Travel insights panel
 * - Skeleton loading states
 * - Offline caching
 * - Bookmark & share functionality
 * - Premium glassmorphism UI
 */

import React, { useState, useEffect, useMemo, useCallback, memo } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
  Linking,
  Dimensions,
  Animated,
} from "react-native";
import { Text } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { newsService, NewsArticle } from "@/services/news";
import { colors, spacing } from "@/theme/colors";
import { useTravelIntelligence } from "@/stores/travelIntelligenceStore";
import { useAuthStore } from "@/stores/authStore";
import { usePreferenceStore } from "@/stores/preferenceStore";
import { PressableScale } from "@/components/UI/PressableScale";
import { GlassCard } from "@/components/UI/GlassCard";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CACHE_KEY = "@news_cache";
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// ─────────────────────────────────────────────────────────────
// TYPES & CONSTANTS
// ─────────────────────────────────────────────────────────────

type NewsTab = "foryou" | "trending" | "travel" | "safety";
type AlertLevel = "critical" | "warning" | "info";

interface EnhancedArticle extends NewsArticle {
  relevanceScore?: number;
  reason?: string;
  alertLevel?: AlertLevel;
  isBookmarked?: boolean;
}

interface CachedNews {
  articles: NewsArticle[];
  timestamp: number;
  tab: NewsTab;
}

const TABS: { key: NewsTab; label: string; icon: string }[] = [
  { key: "foryou", label: "For You", icon: "star-four-points" },
  { key: "trending", label: "Trending", icon: "fire" },
  { key: "travel", label: "Travel", icon: "airplane" },
  { key: "safety", label: "Alerts", icon: "shield-alert" },
];

const MOCK_INSIGHTS = [
  { icon: "airplane-alert", text: "Flights disrupted in 3 cities", color: "#F59E0B" },
  { icon: "weather-rainy", text: "Heavy rain in Kerala", color: "#3B82F6" },
  { icon: "party-popper", text: "Festival season in Jaipur", color: "#10B981" },
];

// ─────────────────────────────────────────────────────────────
// UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────────

const getTimeAgo = (dateStr?: string): string => {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return dateStr.split("T")[0];
};

const calculateRelevanceScore = (
  article: NewsArticle,
  preferences: any,
  activeTrip: any,
  searches: string[]
): { score: number; reason: string } => {
  let score = 50;
  let reason = "Trending in your region";
  
  const text = `${article.title} ${article.description || ""}`.toLowerCase();
  
  // Check user preferences
  if (preferences?.budget && text.includes("budget")) {
    score += 20;
    reason = "Matches your budget preference";
  }
  if (preferences?.categories?.includes("beach") && text.includes("beach")) {
    score += 15;
    reason = "Beach destination news";
  }
  
  // Check active trip
  if (activeTrip?.destination?.label) {
    const destName = activeTrip.destination.label.toLowerCase();
    if (text.includes(destName)) {
      score += 30;
      reason = `Affects your trip to ${activeTrip.destination.label}`;
    }
  }
  
  // Check recent searches
  if (searches.length > 0) {
    for (const search of searches) {
      if (text.includes(search.toLowerCase())) {
        score += 15;
        reason = `Because you searched "${search}"`;
        break;
      }
    }
  }
  
  // Safety alerts get higher priority
  if (text.includes("alert") || text.includes("warning") || text.includes("advisory")) {
    score += 25;
  }
  
  return { score: Math.min(100, score), reason };
};

// ─────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────

interface InsightsBarProps {
  insights: typeof MOCK_INSIGHTS;
}

const InsightsBar = memo(({ insights }: InsightsBarProps) => (
  <ScrollView 
    horizontal 
    showsHorizontalScrollIndicator={false}
    contentContainerStyle={styles.insightsScroll}
  >
    {insights.map((insight, idx) => (
      <View key={idx} style={styles.insightChip}>
        <MaterialCommunityIcons name={insight.icon as any} size={14} color={insight.color} />
        <Text style={styles.insightText}>{insight.text}</Text>
      </View>
    ))}
  </ScrollView>
));
InsightsBar.displayName = "InsightsBar";

// ─────────────────────────────────────────────────────────────

interface NewsTabBarProps {
  activeTab: NewsTab;
  onTabPress: (tab: NewsTab) => void;
}

const NewsTabBar = memo(({ activeTab, onTabPress }: NewsTabBarProps) => (
  <View style={styles.tabContainer}>
    {TABS.map((tab) => {
      const isActive = activeTab === tab.key;
      return (
        <PressableScale
          key={tab.key}
          style={[styles.tab, isActive && styles.tabActive]}
          onPress={() => onTabPress(tab.key)}
        >
          <MaterialCommunityIcons
            name={tab.icon as any}
            size={16}
            color={isActive ? "#FFF" : "#64748B"}
          />
          <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
            {tab.label}
          </Text>
        </PressableScale>
      );
    })}
  </View>
));
NewsTabBar.displayName = "NewsTabBar";

// ─────────────────────────────────────────────────────────────

interface FeaturedNewsCardProps {
  article: EnhancedArticle;
  onBookmark: () => void;
  onShare: () => void;
  onPress: () => void;
}

const FeaturedNewsCard = memo(({ article, onBookmark, onShare, onPress }: FeaturedNewsCardProps) => (
  <PressableScale style={styles.featuredCard} onPress={onPress}>
    <Image
      source={{ 
        uri: article.image_url || "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800" 
      }}
      style={styles.featuredImage}
      resizeMode="cover"
    />
    <LinearGradient
      colors={["transparent", "rgba(0,0,0,0.9)"]}
      style={styles.featuredOverlay}
    >
      <View style={styles.featuredContent}>
        {article.source && (
          <View style={styles.featuredSourceBadge}>
            <Text style={styles.featuredSource}>{article.source}</Text>
          </View>
        )}
        <Text style={styles.featuredTitle} numberOfLines={3}>
          {article.title}
        </Text>
        <View style={styles.featuredMeta}>
          <Text style={styles.featuredTime}>{getTimeAgo(article.published_at)}</Text>
          {article.reason && (
            <View style={styles.reasonBadge}>
              <MaterialCommunityIcons name="brain" size={12} color="#667EEA" />
              <Text style={styles.reasonText}>{article.reason}</Text>
            </View>
          )}
        </View>
        <View style={styles.featuredActions}>
          <TouchableOpacity style={styles.actionBtn} onPress={onBookmark}>
            <MaterialCommunityIcons
              name={article.isBookmarked ? "bookmark" : "bookmark-outline"}
              size={20}
              color="#FFF"
            />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={onShare}>
            <MaterialCommunityIcons name="share-variant-outline" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>
    </LinearGradient>
  </PressableScale>
));
FeaturedNewsCard.displayName = "FeaturedNewsCard";

// ─────────────────────────────────────────────────────────────

interface NewsCardProps {
  article: EnhancedArticle;
  isSafety?: boolean;
  onBookmark: () => void;
  onShare: () => void;
  onPress: () => void;
}

const NewsCard = memo(({ article, isSafety, onBookmark, onShare, onPress }: NewsCardProps) => {
  const alertColors = {
    critical: "#EF4444",
    warning: "#F59E0B",
    info: "#3B82F6",
  };
  
  const alertColor = isSafety ? alertColors[article.alertLevel || "info"] : "#667EEA";
  
  return (
    <PressableScale style={styles.newsCard} onPress={onPress}>
      <View style={styles.newsCardRow}>
        {article.image_url ? (
          <Image source={{ uri: article.image_url }} style={styles.newsCardImage} />
        ) : (
          <View style={[styles.newsCardImage, styles.newsCardImagePlaceholder]}>
            <MaterialCommunityIcons 
              name={isSafety ? "shield-alert" : "newspaper-variant-outline"} 
              size={24} 
              color="#94A3B8" 
            />
          </View>
        )}
        <View style={styles.newsCardContent}>
          <View style={styles.newsCardHeader}>
            {isSafety && (
              <View style={[styles.alertBadge, { backgroundColor: `${alertColor}20` }]}>
                <View style={[styles.alertDot, { backgroundColor: alertColor }]} />
                <Text style={[styles.alertText, { color: alertColor }]}>
                  {article.alertLevel?.toUpperCase() || "ADVISORY"}
                </Text>
              </View>
            )}
            {article.source && !isSafety && (
              <Text style={styles.newsCardSource}>{article.source}</Text>
            )}
            <Text style={styles.newsCardTime}>{getTimeAgo(article.published_at)}</Text>
          </View>
          <Text style={styles.newsCardTitle} numberOfLines={2}>
            {article.title}
          </Text>
          {article.description && (
            <Text style={styles.newsCardDesc} numberOfLines={2}>
              {article.description}
            </Text>
          )}
          {article.reason && (
            <View style={styles.miniReasonBadge}>
              <MaterialCommunityIcons name="brain" size={10} color="#667EEA" />
              <Text style={styles.miniReasonText}>{article.reason}</Text>
            </View>
          )}
        </View>
      </View>
      <View style={styles.newsCardActions}>
        <TouchableOpacity onPress={onBookmark} style={styles.cardActionBtn}>
          <MaterialCommunityIcons
            name={article.isBookmarked ? "bookmark" : "bookmark-outline"}
            size={18}
            color="#64748B"
          />
        </TouchableOpacity>
        <TouchableOpacity onPress={onShare} style={styles.cardActionBtn}>
          <MaterialCommunityIcons name="share-variant-outline" size={18} color="#64748B" />
        </TouchableOpacity>
        <MaterialCommunityIcons name="chevron-right" size={18} color="#CBD5E1" />
      </View>
    </PressableScale>
  );
});
NewsCard.displayName = "NewsCard";

// ─────────────────────────────────────────────────────────────

interface NewsSkeletonProps {
  count?: number;
}

const NewsSkeleton = memo(({ count = 5 }: NewsSkeletonProps) => (
  <View>
    {/* Featured skeleton */}
    <View style={styles.skeletonFeatured}>
      <View style={styles.skeletonFeaturedImage} />
      <View style={styles.skeletonFeaturedContent}>
        <View style={styles.skeletonLineLarge} />
        <View style={styles.skeletonLineMedium} />
      </View>
    </View>
    {/* Card skeletons */}
    {Array.from({ length: count }).map((_, i) => (
      <View key={i} style={styles.skeletonCard}>
        <View style={styles.skeletonCardImage} />
        <View style={styles.skeletonCardContent}>
          <View style={styles.skeletonLineSmall} />
          <View style={styles.skeletonLineLarge} />
          <View style={styles.skeletonLineMedium} />
        </View>
      </View>
    ))}
  </View>
));
NewsSkeleton.displayName = "NewsSkeleton";

// ─────────────────────────────────────────────────────────────

interface EmptyStateProps {
  type: "no-news" | "offline" | "error";
  onRetry?: () => void;
}

const EmptyState = memo(({ type, onRetry }: EmptyStateProps) => {
  const config = {
    "no-news": {
      icon: "newspaper-variant-outline",
      title: "No Articles Found",
      subtitle: "Check back later for updates",
    },
    offline: {
      icon: "wifi-off",
      title: "You're Offline",
      subtitle: "Connect to the internet to get latest news",
    },
    error: {
      icon: "alert-circle-outline",
      title: "Something Went Wrong",
      subtitle: "We couldn't load the news",
    },
  };
  
  const { icon, title, subtitle } = config[type];
  
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconWrap}>
        <MaterialCommunityIcons name={icon as any} size={48} color="#64748B" />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySubtitle}>{subtitle}</Text>
      {onRetry && (
        <PressableScale style={styles.retryBtn} onPress={onRetry}>
          <MaterialCommunityIcons name="refresh" size={18} color="#FFF" />
          <Text style={styles.retryBtnText}>Try Again</Text>
        </PressableScale>
      )}
    </View>
  );
});
EmptyState.displayName = "EmptyState";

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────

export default function NewsFeedScreen() {
  const [articles, setArticles] = useState<EnhancedArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<NewsTab>("foryou");
  const [available, setAvailable] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [bookmarks, setBookmarks] = useState<string[]>([]);
  const [isOffline, setIsOffline] = useState(false);

  const { activeTrip, recentSearches } = useTravelIntelligence();
  const user = useAuthStore((s) => s.user);
  const preferences = usePreferenceStore((s) => s.preferences);

  // Load cached news on mount
  useEffect(() => {
    loadCachedNews();
    loadBookmarks();
    newsService.getStatus().then(r => setAvailable(r.available)).catch(() => {
      setAvailable(false);
      setIsOffline(true);
    });
  }, []);

  // Fetch news when tab changes
  useEffect(() => {
    fetchNews();
  }, [activeTab]);

  const loadCachedNews = async () => {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        const data: CachedNews = JSON.parse(cached);
        if (Date.now() - data.timestamp < CACHE_DURATION) {
          setArticles(enhanceArticles(data.articles));
          setLoading(false);
        }
      }
    } catch (e) {
      // Ignore cache errors
    }
  };

  const loadBookmarks = async () => {
    try {
      const saved = await AsyncStorage.getItem("@news_bookmarks");
      if (saved) setBookmarks(JSON.parse(saved));
    } catch (e) {
      // Ignore
    }
  };

  const enhanceArticles = useCallback((rawArticles: NewsArticle[]): EnhancedArticle[] => {
    return rawArticles.map(article => {
      const { score, reason } = calculateRelevanceScore(
        article,
        preferences,
        activeTrip,
        recentSearches || []
      );
      
      // Determine alert level for safety news
      let alertLevel: AlertLevel = "info";
      const text = `${article.title} ${article.description || ""}`.toLowerCase();
      if (text.includes("critical") || text.includes("emergency") || text.includes("danger")) {
        alertLevel = "critical";
      } else if (text.includes("warning") || text.includes("alert") || text.includes("caution")) {
        alertLevel = "warning";
      }
      
      return {
        ...article,
        relevanceScore: score,
        reason,
        alertLevel,
        isBookmarked: bookmarks.includes(article.url),
      };
    });
  }, [preferences, activeTrip, recentSearches, bookmarks]);

  const fetchNews = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    
    try {
      let response: { articles: NewsArticle[] };
      
      switch (activeTab) {
        case "trending":
          response = await newsService.getTrending(20);
          break;
        case "safety":
          response = await newsService.getSafetyNews(activeTrip?.destination?.label);
          break;
        case "foryou":
          // Fetch both trending and travel, then merge and sort by relevance
          const [trending, travel] = await Promise.all([
            newsService.getTrending(10),
            newsService.getTravelNews(activeTrip?.destination?.label, undefined, 10),
          ]);
          response = { articles: [...(trending.articles || []), ...(travel.articles || [])] };
          break;
        default:
          response = await newsService.getTravelNews(undefined, "travel", 20);
      }
      
      const enhanced = enhanceArticles(response.articles || []);
      
      // Sort by relevance for "For You" tab
      if (activeTab === "foryou") {
        enhanced.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
      }
      
      setArticles(enhanced);
      setLastUpdated(new Date());
      setIsOffline(false);
      
      // Cache the results
      try {
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({
          articles: response.articles || [],
          timestamp: Date.now(),
          tab: activeTab,
        }));
      } catch (e) {
        // Ignore cache errors
      }
    } catch (error) {
      console.error("Failed to fetch news:", error);
      // If we have cached data, keep showing it
      if (articles.length === 0) {
        setIsOffline(true);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab, activeTrip, articles.length, enhanceArticles]);

  const handleRefresh = useCallback(() => {
    fetchNews(true);
  }, [fetchNews]);

  const handleTabChange = useCallback((tab: NewsTab) => {
    setActiveTab(tab);
  }, []);

  const handleArticlePress = useCallback((article: NewsArticle) => {
    if (article.url) {
      Linking.openURL(article.url).catch(() => {});
    }
  }, []);

  const handleBookmark = useCallback(async (article: NewsArticle) => {
    const newBookmarks = bookmarks.includes(article.url)
      ? bookmarks.filter(u => u !== article.url)
      : [...bookmarks, article.url];
    
    setBookmarks(newBookmarks);
    
    // Update article bookmark status
    setArticles(prev => prev.map(a => 
      a.url === article.url ? { ...a, isBookmarked: !a.isBookmarked } : a
    ));
    
    try {
      await AsyncStorage.setItem("@news_bookmarks", JSON.stringify(newBookmarks));
    } catch (e) {
      // Ignore
    }
  }, [bookmarks]);

  const handleShare = useCallback((article: NewsArticle) => {
    if (article.url) {
      // Share functionality would use expo-sharing or react-native-share
      // For now, just open the URL
      Linking.openURL(article.url).catch(() => {});
    }
  }, []);

  // ─────────────────────────────────────────────────────────────
  // COMPUTED VALUES
  // ─────────────────────────────────────────────────────────────

  const featuredArticle = useMemo(() => articles[0], [articles]);
  const regularArticles = useMemo(() => articles.slice(1), [articles]);

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────

  if (!available && !isOffline) {
    return (
      <SafeAreaView style={styles.container}>
        <EmptyState type="error" onRetry={() => newsService.getStatus().then(r => setAvailable(r.available))} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <LinearGradient
        colors={["#0F172A", "#1E293B"]}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.headerTitle}>Travel Intelligence</Text>
            <Text style={styles.headerSubtitle}>
              {user?.name?.split(" ")[0] ? `Personalized for ${user.name.split(" ")[0]}` : "AI-powered news feed"}
            </Text>
          </View>
          <TouchableOpacity style={styles.headerIcon}>
            <MaterialCommunityIcons name="bell-outline" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>
        
        {/* Insights Bar */}
        <InsightsBar insights={MOCK_INSIGHTS} />
      </LinearGradient>

      {/* Tab Bar */}
      <NewsTabBar activeTab={activeTab} onTabPress={handleTabChange} />

      {/* Content */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#667EEA"
          />
        }
      >
        {/* Last Updated */}
        {lastUpdated && (
          <View style={styles.lastUpdatedRow}>
            <MaterialCommunityIcons name="clock-outline" size={12} color="#94A3B8" />
            <Text style={styles.lastUpdatedText}>
              Updated {Math.floor((Date.now() - lastUpdated.getTime()) / 60000)} min ago
            </Text>
          </View>
        )}

        {loading ? (
          <NewsSkeleton />
        ) : isOffline && articles.length === 0 ? (
          <EmptyState type="offline" onRetry={handleRefresh} />
        ) : articles.length === 0 ? (
          <EmptyState type="no-news" onRetry={handleRefresh} />
        ) : (
          <>
            {/* Featured Article */}
            {featuredArticle && activeTab !== "safety" && (
              <FeaturedNewsCard
                article={featuredArticle}
                onBookmark={() => handleBookmark(featuredArticle)}
                onShare={() => handleShare(featuredArticle)}
                onPress={() => handleArticlePress(featuredArticle)}
              />
            )}

            {/* Section Title */}
            {regularArticles.length > 0 && (
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleRow}>
                  <MaterialCommunityIcons
                    name={activeTab === "safety" ? "shield-alert" : "newspaper-variant"}
                    size={18}
                    color="#667EEA"
                  />
                  <Text style={styles.sectionTitle}>
                    {activeTab === "trending" ? "Trending Now" :
                     activeTab === "safety" ? "Travel Alerts" :
                     activeTab === "foryou" ? "Recommended for You" :
                     "Travel News"}
                  </Text>
                </View>
                <Text style={styles.articleCount}>
                  {regularArticles.length + (activeTab !== "safety" ? 1 : 0)} articles
                </Text>
              </View>
            )}

            {/* News Cards */}
            {(activeTab === "safety" ? articles : regularArticles).map((article, index) => (
              <NewsCard
                key={`${article.url}-${index}`}
                article={article}
                isSafety={activeTab === "safety"}
                onBookmark={() => handleBookmark(article)}
                onShare={() => handleShare(article)}
                onPress={() => handleArticlePress(article)}
              />
            ))}
          </>
        )}
      </ScrollView>

      {/* Offline Banner */}
      {isOffline && articles.length > 0 && (
        <View style={styles.offlineBanner}>
          <MaterialCommunityIcons name="wifi-off" size={16} color="#FFF" />
          <Text style={styles.offlineBannerText}>Showing cached news</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },

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
    marginBottom: spacing.md,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.6)",
    marginTop: 2,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    alignItems: "center",
  },

  // Insights
  insightsScroll: {
    paddingRight: spacing.lg,
    gap: 8,
  },
  insightChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  insightText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFF",
  },

  // Tabs
  tabContainer: {
    flexDirection: "row",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: 8,
    backgroundColor: "#FFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    gap: 6,
  },
  tabActive: {
    backgroundColor: "#0F172A",
  },
  tabText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
  },
  tabTextActive: {
    color: "#FFF",
  },

  // Scroll
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 120,
  },

  // Last Updated
  lastUpdatedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginVertical: spacing.sm,
  },
  lastUpdatedText: {
    fontSize: 11,
    color: "#94A3B8",
  },

  // Featured Card
  featuredCard: {
    height: 280,
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: spacing.lg,
  },
  featuredImage: {
    width: "100%",
    height: "100%",
  },
  featuredOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    padding: spacing.md,
  },
  featuredContent: {
    gap: 8,
  },
  featuredSourceBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  featuredSource: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFF",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  featuredTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#FFF",
    lineHeight: 28,
  },
  featuredMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  featuredTime: {
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
  },
  reasonBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(102,126,234,0.3)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
  },
  reasonText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#FFF",
  },
  featuredActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  actionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },

  // Section Header
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
  },
  articleCount: {
    fontSize: 12,
    color: "#94A3B8",
    fontWeight: "500",
  },

  // News Card
  newsCard: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  newsCardRow: {
    flexDirection: "row",
    gap: 12,
  },
  newsCardImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
  },
  newsCardImagePlaceholder: {
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
  },
  newsCardContent: {
    flex: 1,
    gap: 4,
  },
  newsCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  newsCardSource: {
    fontSize: 11,
    fontWeight: "600",
    color: "#667EEA",
  },
  newsCardTime: {
    fontSize: 11,
    color: "#94A3B8",
  },
  newsCardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
    lineHeight: 20,
  },
  newsCardDesc: {
    fontSize: 12,
    color: "#64748B",
    lineHeight: 18,
  },
  miniReasonBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  miniReasonText: {
    fontSize: 10,
    fontWeight: "500",
    color: "#667EEA",
  },
  newsCardActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  cardActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
  },

  // Alert Badge
  alertBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
  },
  alertDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  alertText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },

  // Skeleton
  skeletonFeatured: {
    height: 280,
    borderRadius: 20,
    backgroundColor: "#E2E8F0",
    marginBottom: spacing.lg,
    overflow: "hidden",
  },
  skeletonFeaturedImage: {
    flex: 1,
    backgroundColor: "#E2E8F0",
  },
  skeletonFeaturedContent: {
    position: "absolute",
    bottom: 16,
    left: 16,
    right: 16,
    gap: 8,
  },
  skeletonCard: {
    flexDirection: "row",
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: 12,
  },
  skeletonCardImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: "#E2E8F0",
  },
  skeletonCardContent: {
    flex: 1,
    gap: 8,
  },
  skeletonLineLarge: {
    height: 16,
    backgroundColor: "#E2E8F0",
    borderRadius: 8,
    width: "100%",
  },
  skeletonLineMedium: {
    height: 14,
    backgroundColor: "#E2E8F0",
    borderRadius: 7,
    width: "70%",
  },
  skeletonLineSmall: {
    height: 12,
    backgroundColor: "#E2E8F0",
    borderRadius: 6,
    width: "40%",
  },

  // Empty State
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xxl * 2,
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
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
  },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0F172A",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
    marginTop: spacing.lg,
  },
  retryBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFF",
  },

  // Offline Banner
  offlineBanner: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F59E0B",
    paddingVertical: 10,
    gap: 8,
  },
  offlineBannerText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFF",
  },
});