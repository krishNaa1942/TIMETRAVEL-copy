/**
 * WeatherCard – displays temperature, conditions, and packing tips
 */

import React from "react";
import { View, StyleSheet } from "react-native";
import { Text } from "react-native-paper";
import { WeatherData } from "@/types";
import { colors, spacing } from "@/theme/colors";

interface Props {
  weather: WeatherData;
}

function weatherEmoji(desc: string): string {
  const d = desc.toLowerCase();
  if (d.includes("sun") || d.includes("clear")) return "☀️";
  if (d.includes("cloud")) return "☁️";
  if (d.includes("rain") || d.includes("drizzle")) return "🌧️";
  if (d.includes("snow")) return "❄️";
  if (d.includes("thunder") || d.includes("storm")) return "⛈️";
  if (d.includes("mist") || d.includes("fog") || d.includes("haze")) return "🌫️";
  return "🌤️";
}

export default function WeatherCard({ weather }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.emoji}>{weatherEmoji(weather.description)}</Text>
        <View style={styles.headerText}>
          <Text style={styles.temp}>
            {Math.round(weather.temperature_c)}°C
          </Text>
          <Text style={styles.desc}>{weather.description}</Text>
        </View>
      </View>

      <View style={styles.stats}>
        <Stat label="Feels like" value={`${Math.round(weather.feels_like_c)}°C`} />
        <Stat label="Humidity" value={`${weather.humidity}%`} />
        <Stat label="Wind" value={`${weather.wind_speed_kmh.toFixed(1)} km/h`} />
      </View>

      {weather.packing_suggestions?.length > 0 && (
        <View style={styles.packing}>
          <Text style={styles.packLabel}>🧳 Packing Tips</Text>
          {weather.packing_suggestions.slice(0, 4).map((s, i) => (
            <Text key={i} style={styles.packItem}>
              • {s}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  emoji: {
    fontSize: 48,
    marginRight: spacing.md,
  },
  headerText: {
    flex: 1,
  },
  temp: {
    fontSize: 36,
    fontWeight: "800",
    color: colors.text,
  },
  desc: {
    fontSize: 15,
    color: colors.gray,
    textTransform: "capitalize",
  },
  stats: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  stat: {
    alignItems: "center",
  },
  statLabel: {
    fontSize: 11,
    color: colors.gray,
    marginBottom: 2,
  },
  statValue: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
  },
  packing: {
    marginTop: spacing.md,
  },
  packLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
    marginBottom: spacing.xs,
  },
  packItem: {
    fontSize: 13,
    color: colors.gray,
    marginLeft: spacing.sm,
    marginVertical: 2,
    lineHeight: 18,
  },
});
