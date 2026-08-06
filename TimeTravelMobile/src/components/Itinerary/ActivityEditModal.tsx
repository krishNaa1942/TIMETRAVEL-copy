/**
 * ActivityEditModal — tap-to-edit for a saved trip's activity.
 * Persists via PUT /api/trips/planner/<trip>/places/<place>.
 */

import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { tripPlannerService } from "@/services/tripPlanner";
import type { ItineraryPalette } from "./palette";

interface Props {
  visible: boolean;
  tripId: number | null;
  placeId: number | null;
  initialName: string;
  initialNotes: string;
  initialCost: string;
  palette: ItineraryPalette;
  onClose: () => void;
  onSaved: () => void;
}

const ActivityEditModal: React.FC<Props> = ({
  visible,
  tripId,
  placeId,
  initialName,
  initialNotes,
  initialCost,
  palette,
  onClose,
  onSaved,
}) => {
  const [name, setName] = useState(initialName);
  const [notes, setNotes] = useState(initialNotes);
  const [cost, setCost] = useState(initialCost);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setName(initialName);
      setNotes(initialNotes);
      setCost(initialCost);
      setError(null);
    }
  }, [visible, initialName, initialNotes, initialCost]);

  const handleSave = async () => {
    if (!tripId || !placeId) return;
    setSaving(true);
    setError(null);
    try {
      const parsedCost = parseFloat(cost.replace(/[^0-9.]/g, ""));
      await tripPlannerService.updatePlace(tripId, placeId, {
        name: name.trim() || initialName,
        notes: notes.trim() || undefined,
        estimated_cost: Number.isFinite(parsedCost) ? parsedCost : undefined,
      });
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e?.message || "Could not save changes.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: palette.surface }]}>
          <Text style={[styles.title, { color: palette.text }]}>Edit activity</Text>

          <Text style={[styles.fieldLabel, { color: palette.textSecondary }]}>
            Activity
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            style={[styles.input, { color: palette.inputText, backgroundColor: palette.surfaceAlt, borderColor: palette.border }]}
            placeholder="Activity name"
            placeholderTextColor={palette.textMuted}
          />

          <Text style={[styles.fieldLabel, { color: palette.textSecondary }]}>
            Notes / description
          </Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            multiline
            style={[styles.input, styles.multiline, { color: palette.inputText, backgroundColor: palette.surfaceAlt, borderColor: palette.border }]}
            placeholder="What to expect…"
            placeholderTextColor={palette.textMuted}
          />

          <Text style={[styles.fieldLabel, { color: palette.textSecondary }]}>
            Estimated cost (₹)
          </Text>
          <TextInput
            value={cost}
            onChangeText={setCost}
            keyboardType="numeric"
            style={[styles.input, { color: palette.inputText, backgroundColor: palette.surfaceAlt, borderColor: palette.border }]}
            placeholder="e.g. 500"
            placeholderTextColor={palette.textMuted}
          />

          {error ? (
            <Text style={[styles.error, { color: palette.danger }]}>{error}</Text>
          ) : null}

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: palette.textMuted }]}
              onPress={onClose}
              disabled={saving}
              accessibilityRole="button"
            >
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: palette.accent }]}
              onPress={handleSave}
              disabled={saving}
              accessibilityRole="button"
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.buttonText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.6)",
    justifyContent: "center",
    padding: 24,
  },
  card: { borderRadius: 20, padding: 20 },
  title: { fontSize: 18, fontWeight: "800", marginBottom: 16 },
  fieldLabel: { fontSize: 12, fontWeight: "700", marginBottom: 6, marginTop: 10 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  multiline: { minHeight: 72, textAlignVertical: "top" },
  error: { fontSize: 12, marginTop: 10 },
  actions: { flexDirection: "row", gap: 10, marginTop: 20 },
  button: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonText: { color: "#FFF", fontSize: 14, fontWeight: "800" },
});

export default ActivityEditModal;