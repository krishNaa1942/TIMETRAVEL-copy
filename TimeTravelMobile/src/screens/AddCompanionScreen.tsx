/**
 * AddCompanionScreen - Add a travel companion (modal)
 * =====================================================
 * Form that POSTs to /api/trips/planner/<tripId>/companions.
 */

import React, { useState } from "react";
import { View, ScrollView, StyleSheet, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { Text, TextInput, Button } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import apiService from "@/services/api";
import { queryKeys } from "@/api/queryKeys";
import { colors, spacing } from "@/theme/colors";
import { RootStackParamList } from "@/navigation/types";

type AddCompanionRoute = RouteProp<RootStackParamList, "AddCompanion">;

const ROLES = ["traveler", "organizer"];

const AddCompanionScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<AddCompanionRoute>();
  const queryClient = useQueryClient();
  const tripId = route.params?.tripId;

  const [name, setName] = useState("");
  const [role, setRole] = useState("traveler");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!tripId) return;
      await apiService.post(`/trips/planner/${tripId}/companions`, {
        name,
        role,
        phone: phone || undefined,
        email: email || undefined,
      });
    },
    onSuccess: () => {
      if (tripId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.trips.detail(String(tripId)) });
      }
      navigation.goBack();
    },
    onError: (error: any) => {
      Alert.alert("Error", error?.message || "Could not add companion.");
    },
  });

  const handleSubmit = () => {
    if (!tripId) {
      Alert.alert("No trip selected", "Open this screen from a trip to add a companion.");
      return;
    }
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert("Name required", "Please enter the companion's name.");
      return;
    }
    setName(trimmed);
    addMutation.mutate();
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Add Companion</Text>
          <Text style={styles.subtitle}>Add someone traveling with you on this trip.</Text>

          <TextInput
            label="Name"
            mode="outlined"
            value={name}
            onChangeText={setName}
            style={styles.input}
            theme={{ colors: { text: colors.darkText, primary: colors.primary } }}
            placeholderTextColor={colors.gray}
            autoCapitalize="words"
          />

          <View style={styles.roleRow}>
            {ROLES.map((r) => (
              <Button
                key={r}
                mode={role === r ? "contained" : "outlined"}
                compact
                onPress={() => setRole(r)}
                style={styles.roleButton}
              >
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </Button>
            ))}
          </View>

          <TextInput
            label="Phone (optional)"
            mode="outlined"
            value={phone}
            onChangeText={setPhone}
            style={styles.input}
            theme={{ colors: { text: colors.darkText, primary: colors.primary } }}
            placeholderTextColor={colors.gray}
            keyboardType="phone-pad"
          />

          <TextInput
            label="Email (optional)"
            mode="outlined"
            value={email}
            onChangeText={setEmail}
            style={styles.input}
            theme={{ colors: { text: colors.darkText, primary: colors.primary } }}
            placeholderTextColor={colors.gray}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Button
            mode="contained"
            icon="account-plus"
            onPress={handleSubmit}
            loading={addMutation.isPending}
            disabled={addMutation.isPending}
            style={styles.submitButton}
          >
            Add Companion
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.darkBackground,
  },
  flex: {
    flex: 1,
  },
  content: {
    padding: spacing.md,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.darkText,
  },
  subtitle: {
    fontSize: 14,
    color: colors.gray,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  input: {
    marginBottom: spacing.md,
    backgroundColor: colors.darkSurface,
  },
  roleRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  roleButton: {
    flex: 1,
  },
  submitButton: {
    marginTop: spacing.sm,
    borderRadius: 8,
  },
});

export default AddCompanionScreen;
