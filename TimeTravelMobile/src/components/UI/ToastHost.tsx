/**
 * ToastHost — app-wide error/success toasts (Phase E1)
 * ======================================================
 * Imperative singleton so any screen/service can surface errors without
 * prop drilling:
 *
 *     import { toast } from "@/components/UI/ToastHost";
 *     toast.error("Could not delete trip");
 *     toast.success("Trip saved");
 *
 * Mount <ToastHost /> once inside PaperProvider (see App.tsx).
 */

import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Snackbar, Text, useTheme } from "react-native-paper";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

type ToastTone = "error" | "success" | "info";

interface ToastRequest {
  id: number;
  message: string;
  tone: ToastTone;
  duration?: number;
}

type Listener = (request: ToastRequest) => void;

let nextId = 1;
const listeners = new Set<Listener>();

function emit(message: string, tone: ToastTone, duration?: number) {
  const request: ToastRequest = { id: nextId++, message, tone, duration };
  listeners.forEach((listener) => listener(request));
}

export const toast = {
  show: (message: string, tone: ToastTone = "info", duration?: number) =>
    emit(message, tone, duration),
  error: (message: string, duration?: number) =>
    emit(message, "error", duration),
  success: (message: string, duration?: number) =>
    emit(message, "success", duration),
};

const TONE_COLORS: Record<ToastTone, string> = {
  error: "#DC2626",
  success: "#16A34A",
  info: "#4F46E5",
};

const TONE_ICONS: Record<ToastTone, keyof typeof MaterialCommunityIcons.glyphMap> = {
  error: "alert-circle-outline",
  success: "check-circle-outline",
  info: "information-outline",
};

export const ToastHost: React.FC = () => {
  const theme = useTheme();
  const [current, setCurrent] = useState<ToastRequest | null>(null);
  const [visible, setVisible] = useState(false);
  const currentRef = useRef<ToastRequest | null>(null);

  useEffect(() => {
    const listener: Listener = (request) => {
      currentRef.current = request;
      setCurrent(request);
      setVisible(true);
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const onDismiss = () => {
    setVisible(false);
    currentRef.current = null;
  };

  const tone = current?.tone ?? "info";
  const accent = TONE_COLORS[tone];

  return (
    <View pointerEvents="none" style={styles.host}>
      <Snackbar
        visible={visible}
        onDismiss={onDismiss}
        duration={current?.duration ?? (tone === "error" ? 5000 : 3000)}
        action={
          tone === "error"
            ? { label: "Dismiss", onPress: onDismiss, textColor: "#FCA5A5" }
            : undefined
        }
        style={[styles.snackbar, { backgroundColor: "#111827" }]}
      >
        <View style={styles.row}>
          <MaterialCommunityIcons
            name={TONE_ICONS[tone]}
            size={18}
            color={accent}
          />
          <Text style={[styles.text, { color: theme.colors.surface }]}>
            {current?.message ?? ""}
          </Text>
        </View>
      </Snackbar>
    </View>
  );
};

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  snackbar: {
    marginHorizontal: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 2,
  },
  text: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
  },
});

export default ToastHost;
