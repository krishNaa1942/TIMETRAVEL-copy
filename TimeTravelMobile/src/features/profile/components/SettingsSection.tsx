/**
 * SettingsSection Component - User settings with toggles
 */
import React, { memo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Switch,
  Platform,
} from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useUIStore } from "@/stores/uiStore";
import type { SettingsSectionProps, SettingItem } from "../types";

const SettingRow: React.FC<{
  setting: SettingItem;
  onToggle: (id: string, value: boolean) => void;
}> = ({ setting, onToggle }) => {
  const { themeDark } = useUIStore();

  const handleToggle = useCallback(
    async (value: boolean) => {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onToggle(setting.id, value);
    },
    [setting.id, onToggle],
  );

  if (setting.type === "toggle") {
    return (
      <View style={styles.settingRow}>
        <Text style={styles.settingIcon}>{setting.icon}</Text>
        <Text style={[styles.settingLabel, themeDark && styles.textDark]}>
          {setting.label}
        </Text>
        <Switch
          accessibilityLabel={setting.label}
          value={setting.value ?? false}
          onValueChange={handleToggle}
          trackColor={{ false: "#E5E7EB", true: "#8B5CF6" }}
          thumbColor="#FFFFFF"
        />
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={setting.label}
      onPress={() => setting.onPress?.()}
      style={({ pressed }) => [styles.settingRow, pressed && styles.pressed]}
    >
      <Text style={styles.settingIcon}>{setting.icon}</Text>
      <Text style={[styles.settingLabel, themeDark && styles.textDark]}>
        {setting.label}
      </Text>
      <Text style={[styles.chevron, themeDark && styles.chevronDark]}>›</Text>
    </Pressable>
  );
};

const SettingsSectionComponent: React.FC<SettingsSectionProps> = ({
  settings,
  onToggle,
}) => {
  const { themeDark } = useUIStore();

  return (
    <Animated.View
      entering={FadeIn.delay(700).duration(400)}
      style={[styles.container, themeDark && styles.containerDark]}
    >
      <Text style={[styles.title, themeDark && styles.textDark]}>Settings</Text>
      {settings.map((setting) => (
        <SettingRow key={setting.id} setting={setting} onToggle={onToggle} />
      ))}
    </Animated.View>
  );
};

const cardShadow =
  Platform.select({
    web: {
      boxShadow: "0px 2px 8px rgba(0, 0, 0, 0.1)",
    } as any,
    default: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 4,
    },
  }) ?? {};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    ...cardShadow,
  },
  containerDark: { backgroundColor: "#1F2937" },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12,
  },
  textDark: { color: "#F9FAFB" },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  settingIcon: { fontSize: 20, marginRight: 12 },
  settingLabel: { flex: 1, fontSize: 14, color: "#374151", fontWeight: "500" },
  chevron: { fontSize: 20, color: "#9CA3AF" },
  chevronDark: { color: "#6B7280" },
  pressed: { opacity: 0.72 },
});

export const SettingsSection = memo(SettingsSectionComponent);
export default SettingsSection;
