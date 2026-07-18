/**
 * TravelNoteCard - Journal Note Card Component
 * Beautiful card for displaying travel notes in feed
 */

import React, { memo, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { TravelNote, MoodType, AIAnalysis } from '@/types/journal';
import { PressableScale } from '@/components/UI/PressableScale';
import { GlassCard } from '@/components/UI/GlassCard';

// ─────────────────────────────────────────────────────────────
// MOOD CONFIG
// ─────────────────────────────────────────────────────────────

const MOOD_CONFIG: Record<MoodType, { icon: string; color: string; bg: string }> = {
  excited: { icon: '🎉', color: '#FF6B6B', bg: 'rgba(255, 107, 107, 0.15)' },
  happy: { icon: '😊', color: '#4ECDC4', bg: 'rgba(78, 205, 196, 0.15)' },
  peaceful: { icon: '😌', color: '#45B7D1', bg: 'rgba(69, 183, 209, 0.15)' },
  inspired: { icon: '✨', color: '#96CEB4', bg: 'rgba(150, 206, 180, 0.15)' },
  adventurous: { icon: '🗺️', color: '#FFEAA7', bg: 'rgba(255, 234, 167, 0.15)' },
  romantic: { icon: '💕', color: '#FD79A8', bg: 'rgba(253, 121, 168, 0.15)' },
  nostalgic: { icon: '🎞️', color: '#A29BFE', bg: 'rgba(162, 155, 254, 0.15)' },
  neutral: { icon: '😐', color: '#B2BEC3', bg: 'rgba(178, 190, 195, 0.15)' },
  relaxed: { icon: '🧘', color: '#74B9FF', bg: 'rgba(116, 185, 255, 0.15)' },
  grateful: { icon: '🙏', color: '#FFEAA7', bg: 'rgba(255, 234, 167, 0.15)' },
  curious: { icon: '🤔', color: '#81ECEC', bg: 'rgba(129, 236, 236, 0.15)' },
  tired: { icon: '😴', color: '#DFE6E9', bg: 'rgba(223, 230, 233, 0.15)' },
};

// ─────────────────────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────────────────────

interface TravelNoteCardProps {
  note: TravelNote;
  onPress?: () => void;
  onLike?: () => void;
  onSave?: () => void;
  onShare?: () => void;
  compact?: boolean;
  showAuthor?: boolean;
}

// ─────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────

const TravelNoteCard: React.FC<TravelNoteCardProps> = memo(({
  note,
  onPress,
  onLike,
  onSave,
  onShare,
  compact = false,
  showAuthor = false,
}) => {
  const { width } = useWindowDimensions();
  const cardWidth = width - 32;
  const moodConfig = MOOD_CONFIG[note.mood] || MOOD_CONFIG.neutral;

  // Format date
  const formatDate = useCallback((dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }, []);

  // Render stars
  const renderStars = useCallback(() => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Ionicons
          key={i}
          name={i <= note.rating ? 'star' : 'star-outline'}
          size={12}
          color={i <= note.rating ? '#FFD700' : '#666'}
        />
      );
    }
    return stars;
  }, [note.rating]);

  // Compact version for list
  if (compact) {
    return (
      <PressableScale onPress={onPress} style={styles.compactContainer}>
        <View style={[styles.compactImage, { backgroundColor: moodConfig.bg }]}>
          {note.media[0]?.url ? (
            <Image source={{ uri: note.media[0].url }} style={styles.compactImage} />
          ) : (
            <Text style={styles.moodEmoji}>{moodConfig.icon}</Text>
          )}
        </View>
        <View style={styles.compactContent}>
          <Text style={styles.compactTitle} numberOfLines={1}>{note.title}</Text>
          <Text style={styles.compactDestination}>{note.destination.name}</Text>
        </View>
        <View style={styles.compactActions}>
          <Ionicons name="heart" size={16} color={note.isLiked ? '#FF6B6B' : '#666'} />
          <Text style={styles.compactCount}>{note.social.likesCount}</Text>
        </View>
      </PressableScale>
    );
  }

  // Full card
  return (
    <PressableScale onPress={onPress} style={[styles.container, { width: cardWidth }]}>
      {/* Hero Image */}
      {note.media[0]?.url ? (
        <View style={styles.imageContainer}>
          <Image source={{ uri: note.media[0].url }} style={styles.heroImage} />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.7)']}
            style={styles.imageOverlay}
          />
          {/* Mood badge */}
          <View style={[styles.moodBadge, { backgroundColor: moodConfig.bg }]}>
            <Text style={styles.moodEmoji}>{moodConfig.icon}</Text>
          </View>
          {/* Rating */}
          <View style={styles.ratingBadge}>
            {renderStars()}
          </View>
        </View>
      ) : (
        <View style={[styles.noImageContainer, { backgroundColor: moodConfig.bg }]}>
          <Text style={styles.noImageEmoji}>{moodConfig.icon}</Text>
          <View style={styles.ratingBadge}>
            {renderStars()}
          </View>
        </View>
      )}

      {/* Content */}
      <View style={styles.content}>
        {/* Destination */}
        <View style={styles.destinationRow}>
          <Ionicons name="location" size={14} color="#4ECDC4" />
          <Text style={styles.destinationText}>
            {note.destination.name}, {note.destination.country}
          </Text>
        </View>

        {/* Title */}
        <Text style={styles.title} numberOfLines={2}>{note.title}</Text>

        {/* Content preview */}
        <Text style={styles.preview} numberOfLines={3}>
          {note.content}
        </Text>

        {/* Tags */}
        {note.aiAnalysis?.tags && note.aiAnalysis.tags.length > 0 && (
          <View style={styles.tagsRow}>
            {note.aiAnalysis.tags.slice(0, 3).map((tag, i) => (
              <View key={i} style={styles.tag}>
                <Text style={styles.tagText}>#{tag.label}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          {/* Author (for community feed) */}
          {showAuthor && (note as any).author && (
            <View style={styles.authorRow}>
              <Image 
                source={{ uri: (note as any).author.avatar || 'https://via.placeholder.com/32' }} 
                style={styles.authorAvatar} 
              />
              <Text style={styles.authorName}>{(note as any).author.name}</Text>
            </View>
          )}

          {/* Date */}
          {!showAuthor && (
            <Text style={styles.date}>{formatDate(note.createdAt)}</Text>
          )}

          {/* Social stats */}
          <View style={styles.socialStats}>
            <Pressable onPress={onLike} style={styles.socialButton}>
              <Ionicons 
                name={note.isLiked ? 'heart' : 'heart-outline'} 
                size={20} 
                color={note.isLiked ? '#FF6B6B' : '#666'} 
              />
              <Text style={styles.socialCount}>{note.social.likesCount}</Text>
            </Pressable>

            <Pressable style={styles.socialButton}>
              <Ionicons name="chatbubble-outline" size={18} color="#666" />
              <Text style={styles.socialCount}>{note.social.commentsCount}</Text>
            </Pressable>

            <Pressable onPress={onSave} style={styles.socialButton}>
              <Ionicons 
                name={note.isSaved ? 'bookmark' : 'bookmark-outline'} 
                size={18} 
                color={note.isSaved ? '#4ECDC4' : '#666'} 
              />
            </Pressable>

            <Pressable onPress={onShare} style={styles.socialButton}>
              <Ionicons name="share-outline" size={18} color="#666" />
            </Pressable>
          </View>
        </View>
      </View>
    </PressableScale>
  );
});

// ─────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1A1A2E',
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 16,
  },
  // Hero image
  imageContainer: {
    height: 200,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imageOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 80,
  },
  moodBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moodEmoji: {
    fontSize: 20,
  },
  ratingBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    gap: 2,
  },
  noImageContainer: {
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  noImageEmoji: {
    fontSize: 48,
  },
  // Content
  content: {
    padding: 16,
  },
  destinationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  destinationText: {
    color: '#4ECDC4',
    fontSize: 13,
    fontWeight: '600',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  preview: {
    color: '#A0A0A0',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  tagsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  tag: {
    backgroundColor: 'rgba(78, 205, 196, 0.15)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagText: {
    color: '#4ECDC4',
    fontSize: 12,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  authorAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  authorName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  date: {
    color: '#666',
    fontSize: 12,
  },
  socialStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  socialCount: {
    color: '#666',
    fontSize: 12,
  },
  // Compact
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A2E',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  compactImage: {
    width: 48,
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  compactContent: {
    flex: 1,
    marginLeft: 12,
  },
  compactTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  compactDestination: {
    color: '#666',
    fontSize: 12,
    marginTop: 2,
  },
  compactActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  compactCount: {
    color: '#666',
    fontSize: 12,
  },
});

export default TravelNoteCard;