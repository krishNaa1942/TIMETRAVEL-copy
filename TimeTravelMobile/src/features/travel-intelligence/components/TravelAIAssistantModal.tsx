import React, { memo, useEffect, useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Button,
  Chip,
  Modal,
  Portal,
  Snackbar,
  Text,
  TextInput,
} from "react-native-paper";

import { GlassCard } from "@/components/UI/GlassCard";
import type { AIAssistantResponse } from "../types";

interface Props {
  visible: boolean;
  contextLabel: string;
  suggestions: string[];
  loading: boolean;
  onClose: () => void;
  onSubmit: (query: string) => Promise<AIAssistantResponse>;
}

export const TravelAIAssistantModal = memo(
  ({
    visible,
    contextLabel,
    suggestions,
    loading,
    onClose,
    onSubmit,
  }: Props) => {
    const [query, setQuery] = useState("");
    const [response, setResponse] = useState<AIAssistantResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [snackbarVisible, setSnackbarVisible] = useState(false);
    const [lastQuery, setLastQuery] = useState("");

    useEffect(() => {
      if (!visible) {
        setQuery("");
        setResponse(null);
        setError(null);
        setSnackbarVisible(false);
        setLastQuery("");
      }
    }, [visible]);

    const canSubmit = query.trim().length > 0 && !loading;

    const handleSubmit = async (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) {
        return;
      }

      setError(null);
      setLastQuery(trimmed);

      try {
        const result = await onSubmit(trimmed);
        setResponse(result);
        setSnackbarVisible(true);
      } catch (submissionError) {
        const message =
          submissionError instanceof Error
            ? submissionError.message
            : "AI assistant request failed.";
        setError(message);
        setSnackbarVisible(true);
      }
    };

    const followUpSuggestions = useMemo(() => {
      return response?.followUpQuestions?.length
        ? response.followUpQuestions
        : suggestions;
    }, [response?.followUpQuestions, suggestions]);

    return (
      <Portal>
        <Modal
          visible={visible}
          onDismiss={onClose}
          contentContainerStyle={styles.modalContainer}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <GlassCard style={styles.card}>
              <Text variant="headlineSmall" style={styles.title}>
                Travel AI Assistant
              </Text>
              <Text variant="bodyMedium" style={styles.subtitle}>
                Ask about predictions, budgeting, destinations, or your travel
                DNA.
              </Text>

              <View style={styles.contextBanner}>
                <Text variant="labelSmall" style={styles.contextLabel}>
                  Context
                </Text>
                <Text variant="bodyMedium" style={styles.contextText}>
                  {contextLabel}
                </Text>
              </View>

              <TextInput
                value={query}
                onChangeText={setQuery}
                mode="outlined"
                placeholder="Ask something about your travel data"
                multiline
                style={styles.input}
                numberOfLines={4}
                outlineStyle={styles.inputOutline}
              />

              <View style={styles.suggestionRow}>
                {suggestions.slice(0, 3).map((item) => (
                  <Chip
                    key={item}
                    style={styles.suggestionChip}
                    onPress={() => setQuery(item)}
                  >
                    {item}
                  </Chip>
                ))}
              </View>

              <View style={styles.actionRow}>
                <Button mode="text" onPress={onClose}>
                  Close
                </Button>
                <Button
                  mode="contained"
                  onPress={() => void handleSubmit(query)}
                  disabled={!canSubmit}
                  loading={loading}
                >
                  Ask AI
                </Button>
              </View>

              {loading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" />
                  <Text variant="bodySmall" style={styles.loadingText}>
                    Thinking through your travel pattern...
                  </Text>
                </View>
              ) : null}

              {response ? (
                <View style={styles.responseCard}>
                  <Text variant="labelSmall" style={styles.responseLabel}>
                    Response
                  </Text>
                  <Text variant="bodyMedium" style={styles.responseText}>
                    {response.response}
                  </Text>

                  {response.insights?.length ? (
                    <View style={styles.responseBlock}>
                      <Text variant="labelSmall" style={styles.responseLabel}>
                        Related insights
                      </Text>
                      <View style={styles.responseChipRow}>
                        {response.insights.slice(0, 3).map((insight) => (
                          <Chip
                            key={insight.id}
                            compact
                            style={styles.responseChip}
                          >
                            {insight.title}
                          </Chip>
                        ))}
                      </View>
                    </View>
                  ) : null}

                  {response.followUpQuestions?.length ? (
                    <View style={styles.responseBlock}>
                      <Text variant="labelSmall" style={styles.responseLabel}>
                        Continue with
                      </Text>
                      <View style={styles.responseChipRow}>
                        {followUpSuggestions.map((item) => (
                          <Chip
                            key={item}
                            compact
                            style={styles.responseChip}
                            onPress={() => setQuery(item)}
                          >
                            {item}
                          </Chip>
                        ))}
                      </View>
                    </View>
                  ) : null}
                </View>
              ) : null}

              {error ? (
                <View style={styles.errorCard}>
                  <Text variant="labelSmall" style={styles.responseLabel}>
                    Error
                  </Text>
                  <Text variant="bodyMedium" style={styles.errorText}>
                    {error}
                  </Text>
                  <Button
                    mode="text"
                    onPress={() => void handleSubmit(lastQuery || query)}
                    disabled={!lastQuery && !query.trim()}
                  >
                    Retry
                  </Button>
                </View>
              ) : null}

              <Snackbar
                visible={snackbarVisible}
                onDismiss={() => setSnackbarVisible(false)}
                duration={2200}
              >
                {error ? error : response ? "Assistant response ready" : ""}
              </Snackbar>
            </GlassCard>
          </KeyboardAvoidingView>
        </Modal>
      </Portal>
    );
  },
);

const styles = StyleSheet.create({
  modalContainer: {
    margin: 18,
  },
  card: {
    padding: 18,
    maxHeight: "92%",
  },
  title: {
    color: "#0F172A",
    fontWeight: "800",
  },
  subtitle: {
    color: "#475569",
    marginTop: 6,
  },
  contextBanner: {
    marginTop: 14,
    padding: 12,
    borderRadius: 16,
    backgroundColor: "rgba(14, 165, 233, 0.08)",
  },
  contextLabel: {
    color: "#0369A1",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  contextText: {
    color: "#0F172A",
    marginTop: 4,
  },
  input: {
    marginTop: 16,
    backgroundColor: "rgba(255,255,255,0.9)",
  },
  inputOutline: {
    borderRadius: 16,
  },
  suggestionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  suggestionChip: {
    backgroundColor: "rgba(15, 118, 110, 0.12)",
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 16,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 14,
  },
  loadingText: {
    color: "#475569",
  },
  responseCard: {
    marginTop: 16,
    padding: 14,
    borderRadius: 16,
    backgroundColor: "rgba(15, 23, 42, 0.04)",
  },
  responseBlock: {
    marginTop: 14,
  },
  responseLabel: {
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  responseText: {
    color: "#0F172A",
    marginTop: 6,
    lineHeight: 22,
  },
  responseChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  responseChip: {
    backgroundColor: "rgba(255,255,255,0.84)",
  },
  errorCard: {
    marginTop: 16,
    padding: 14,
    borderRadius: 16,
    backgroundColor: "rgba(239, 68, 68, 0.08)",
  },
  errorText: {
    color: "#991B1B",
    marginTop: 6,
  },
});

TravelAIAssistantModal.displayName = "TravelAIAssistantModal";
