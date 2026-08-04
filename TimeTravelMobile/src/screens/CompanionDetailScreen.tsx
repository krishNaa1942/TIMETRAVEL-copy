/**
 * CompanionDetailScreen - Trip companion detail (modal)
 * =======================================================
 * Read-only detail for a travel companion.
 */

import React from "react";
import { View, ScrollView, StyleSheet } from "react-native";
import { Text, Divider } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRoute, RouteProp } from "@react-navigation/native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, spacing } from "@/theme/colors";
import { RootStackParamList } from "@/types";

type CompanionRoute = RouteProp<RootStackParamList, "CompanionDetail">;

const CompanionDetailScreen: React.FC = () => {
  const route = useRoute<CompanionRoute>();
  const companion = route.params?.companion;

  if (!companion) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <Text style={styles.empty}>Companion details unavailable</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View
            style={[
              styles.avatar,
              { backgroundColor: companion.avatar_color || colors.primary },
            ]}
          >
            <Text style={styles.avatarInitial}>
              {(companion.name || "?")[0].toUpperCase()}
            </Text>
          </View>
          <View style={styles.headerText}>
            <Text style={styles.name}>{companion.name}</Text>
            <Text style={styles.role}>{companion.role || "traveler"}</Text>
          </View>
        </View>

        <Divider style={styles.divider} />

        {companion.email ? (
          <View style={styles.row}>
            <MaterialCommunityIcons name="email-outline" size={20} color={colors.gray} />
            <Text style={styles.rowText}>{companion.email}</Text>
          </View>
        ) : null}

        {companion.phone ? (
          <View style={styles.row}>
            <MaterialCommunityIcons name="phone-outline" size={20} color={colors.gray} />
            <Text style={styles.rowText}>{companion.phone}</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.darkBackground,
  },
  content: {
    padding: spacing.md,
  },
  empty: {
    color: colors.gray,
    textAlign: "center",
    marginTop: spacing.xxl,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    fontSize: 26,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  headerText: {
    flex: 1,
    gap: spacing.xs,
  },
  name: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.darkText,
  },
  role: {
    fontSize: 14,
    color: colors.gray,
    textTransform: "capitalize",
  },
  divider: {
    backgroundColor: "#334155",
    marginVertical: spacing.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  rowText: {
    color: colors.darkText,
    fontSize: 15,
    flex: 1,
  },
});

export default CompanionDetailScreen;
