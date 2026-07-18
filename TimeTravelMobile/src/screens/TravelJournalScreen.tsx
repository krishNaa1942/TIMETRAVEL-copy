import React, { useEffect, useState, useCallback } from "react";
import { View, ScrollView, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { Text, TextInput } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import LoadingSpinner from "@/components/Common/LoadingSpinner";
import { journalService, TravelNote } from "@/services/journal";
import { colors, spacing } from "@/theme/colors";

const MOODS = ["😄", "😊", "😐", "😔", "🤩", "😎", "🥰", "😴"];

export default function TravelJournalScreen() {
  const [notes, setNotes] = useState<TravelNote[]>([]);
  const [community, setCommunity] = useState<TravelNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [tab, setTab] = useState<"mine" | "community">("mine");

  const [title, setTitle] = useState("");
  const [destination, setDestination] = useState("");
  const [content, setContent] = useState("");
  const [mood, setMood] = useState("😊");
  const [rating, setRating] = useState(5);
  const [isPublic, setIsPublic] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [mine, comm] = await Promise.all([
        journalService.listNotes(), journalService.communityNotes(),
      ]);
      setNotes(mine.notes || []);
      setCommunity(comm.notes || []);
    } catch { }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!title.trim() || !destination.trim() || !content.trim()) {
      Alert.alert("Error", "Fill title, destination and content"); return;
    }
    setCreating(true);
    try {
      await journalService.createNote({
        title: title.trim(), destination: destination.trim(),
        content: content.trim(), mood, rating, is_public: isPublic,
      });
      setShowCreate(false); setTitle(""); setContent(""); setDestination("");
      load();
    } catch (e: any) { Alert.alert("Error", e.message); }
    finally { setCreating(false); }
  };

  const handleDelete = (note: TravelNote) => {
    Alert.alert("Delete", `Delete "${note.title}"?`, [
      { text: "Cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        try { await journalService.deleteNote(note.id); load(); } catch {}
      }},
    ]);
  };

  const displayNotes = tab === "mine" ? notes : community;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>📔 Travel Journal</Text>
        <Text style={styles.subtitle}>Document your adventures & read others'</Text>

        {/* Tab switcher */}
        <View style={styles.tabRow}>
          <TouchableOpacity style={[styles.tab, tab === "mine" && styles.tabActive]} onPress={() => setTab("mine")}>
            <Text style={[styles.tabText, tab === "mine" && styles.tabTextActive]}>📝 My Notes ({notes.length})</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, tab === "community" && styles.tabActive]} onPress={() => setTab("community")}>
            <Text style={[styles.tabText, tab === "community" && styles.tabTextActive]}>🌍 Community ({community.length})</Text>
          </TouchableOpacity>
        </View>

        {tab === "mine" && (
          <TouchableOpacity style={styles.createBtn} onPress={() => setShowCreate(!showCreate)}>
            <Text style={styles.createBtnText}>{showCreate ? "✕ Cancel" : "✏️ Write Entry"}</Text>
          </TouchableOpacity>
        )}

        {showCreate && (
          <View style={styles.form}>
            <TextInput mode="outlined" label="Title" value={title} onChangeText={setTitle}
              style={styles.input} outlineColor={colors.border} activeOutlineColor={colors.primary} />
            <TextInput mode="outlined" label="Destination" value={destination} onChangeText={setDestination}
              style={styles.input} outlineColor={colors.border} activeOutlineColor={colors.primary} />
            <TextInput mode="outlined" label="Your story…" value={content} onChangeText={setContent}
              multiline numberOfLines={4} style={styles.input} outlineColor={colors.border} activeOutlineColor={colors.primary} />

            <Text style={styles.fieldLabel}>Mood</Text>
            <View style={styles.moodRow}>
              {MOODS.map(m => (
                <TouchableOpacity key={m} style={[styles.moodChip, mood === m && styles.moodActive]}
                  onPress={() => setMood(m)}>
                  <Text style={{ fontSize: 24 }}>{m}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Rating</Text>
            <View style={styles.ratingRow}>
              {[1, 2, 3, 4, 5].map(r => (
                <TouchableOpacity key={r} onPress={() => setRating(r)}>
                  <Text style={{ fontSize: 28 }}>{r <= rating ? "⭐" : "☆"}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.publicToggle} onPress={() => setIsPublic(!isPublic)}>
              <Text style={styles.publicText}>{isPublic ? "🌍 Public" : "🔒 Private"}</Text>
              <Text style={styles.publicHint}>Tap to toggle</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.submitBtn} onPress={handleCreate} disabled={creating}>
              <Text style={styles.submitText}>{creating ? "Saving…" : "💾 Save Entry"}</Text>
            </TouchableOpacity>
          </View>
        )}

        {loading ? <LoadingSpinner message="Loading journal…" /> : (
          displayNotes.length === 0 ? (
            <View style={styles.empty}>
              <Text style={{ fontSize: 48 }}>{tab === "mine" ? "📔" : "🌍"}</Text>
              <Text style={styles.emptyTitle}>{tab === "mine" ? "No entries yet" : "No community posts"}</Text>
              <Text style={styles.emptyText}>{tab === "mine" ? "Write about your travels!" : "Be the first to share!"}</Text>
            </View>
          ) : (
            displayNotes.map(note => (
              <TouchableOpacity key={note.id} style={styles.noteCard}
                onLongPress={tab === "mine" ? () => handleDelete(note) : undefined}>
                <View style={styles.noteHeader}>
                  <Text style={styles.noteMood}>{note.mood || "📝"}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.noteTitle}>{note.title}</Text>
                    <Text style={styles.noteDest}>📍 {note.destination}</Text>
                  </View>
                  {note.rating && (
                    <Text style={styles.noteRating}>{"⭐".repeat(Math.min(note.rating, 5))}</Text>
                  )}
                </View>
                <Text style={styles.noteContent} numberOfLines={3}>{note.content}</Text>
                <View style={styles.noteFooter}>
                  <Text style={styles.noteDate}>{note.created_at?.split("T")[0] || ""}</Text>
                  {note.is_public && <Text style={styles.publicBadge}>🌍 Public</Text>}
                </View>
              </TouchableOpacity>
            ))
          )
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.md, paddingBottom: 100 },
  title: { fontSize: 26, fontWeight: "800", color: colors.text, marginBottom: 4 },
  subtitle: { fontSize: 14, color: colors.gray, marginBottom: spacing.lg },
  tabRow: { flexDirection: "row", gap: 8, marginBottom: spacing.md },
  tab: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: "center" },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { fontSize: 13, fontWeight: "600", color: colors.text },
  tabTextActive: { color: "#FFF" },
  createBtn: { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 14, alignItems: "center", marginBottom: spacing.md },
  createBtnText: { color: "#FFF", fontWeight: "700", fontSize: 16 },
  form: { backgroundColor: colors.surface, borderRadius: 16, padding: spacing.md, marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.border },
  input: { marginBottom: spacing.sm, backgroundColor: "#FFF" },
  fieldLabel: { fontSize: 14, fontWeight: "600", color: colors.text, marginBottom: 6 },
  moodRow: { flexDirection: "row", gap: 8, marginBottom: spacing.md, flexWrap: "wrap" },
  moodChip: { padding: 6, borderRadius: 10, borderWidth: 2, borderColor: "transparent" },
  moodActive: { borderColor: colors.primary, backgroundColor: colors.primary + "15" },
  ratingRow: { flexDirection: "row", gap: 4, marginBottom: spacing.md },
  publicToggle: { flexDirection: "row", justifyContent: "space-between", backgroundColor: colors.background, borderRadius: 10, padding: spacing.sm, marginBottom: spacing.md },
  publicText: { fontSize: 14, fontWeight: "600", color: colors.text },
  publicHint: { fontSize: 12, color: colors.gray },
  submitBtn: { backgroundColor: "#10B981", borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  submitText: { color: "#FFF", fontWeight: "700", fontSize: 15 },
  noteCard: { backgroundColor: colors.surface, borderRadius: 16, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  noteHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 8 },
  noteMood: { fontSize: 28 },
  noteTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  noteDest: { fontSize: 12, color: colors.gray, marginTop: 2 },
  noteRating: { fontSize: 12 },
  noteContent: { fontSize: 14, color: colors.text, lineHeight: 22, marginBottom: 8 },
  noteFooter: { flexDirection: "row", justifyContent: "space-between" },
  noteDate: { fontSize: 12, color: colors.gray },
  publicBadge: { fontSize: 11, color: colors.primary, fontWeight: "600" },
  empty: { alignItems: "center", paddingVertical: spacing.xxl },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: colors.text, marginTop: spacing.sm },
  emptyText: { fontSize: 14, color: colors.gray },
});
