import React, { useState } from "react";
import { View, Image, ImageProps, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors } from "@/theme/colors";

interface ImageWithFallbackProps extends ImageProps {
  fallbackIcon?: keyof typeof MaterialCommunityIcons.glyphMap;
  fallbackSize?: number;
  fallbackUrl?: string;
  accessibilityLabel?: string;
}

export default function ImageWithFallback({
  fallbackIcon = "image-off",
  fallbackSize = 48,
  fallbackUrl,
  accessibilityLabel,
  style,
  ...rest
}: ImageWithFallbackProps) {
  const [hasError, setHasError] = useState(false);
  const [fallbackHasError, setFallbackHasError] = useState(false);

  const label = accessibilityLabel || (typeof rest.source === "object" && "uri" in rest.source ? (rest.source as any).uri : undefined);

  if (hasError && fallbackUrl && !fallbackHasError) {
    return (
      <Image
        {...rest}
        source={{ uri: fallbackUrl }}
        style={style}
        accessible={true}
        accessibilityLabel={label || "Image"}
        onError={() => setFallbackHasError(true)}
      />
    );
  }

  if (hasError) {
    return (
      <View
        style={[styles.fallback, style]}
        accessible={true}
        accessibilityLabel={label || "Image"}
        accessibilityRole="image"
      >
        <MaterialCommunityIcons
          name={fallbackIcon}
          size={fallbackSize}
          color={colors.gray}
        />
      </View>
    );
  }

  return (
    <Image
      {...rest}
      style={style}
      accessible={true}
      accessibilityLabel={label || "Image"}
      onError={() => setHasError(true)}
    />
  );
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: colors.border,
    justifyContent: "center",
    alignItems: "center",
  },
});
