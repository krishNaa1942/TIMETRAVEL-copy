import React, { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AuthHero } from "./components/AuthHero";
import { AuthFormCard } from "./components/AuthFormCard";
import { useAuthScreen } from "./hooks/useAuthScreen";
import { colors, spacing } from "@/theme/colors";

export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const auth = useAuthScreen();
  const useNativeDriver = Platform.OS !== "web";
  const animationProps = { useNativeDriver };

  const heroOpacity = useRef(new Animated.Value(0)).current;
  const heroTranslateY = useRef(new Animated.Value(20)).current;
  const heroScale = useRef(new Animated.Value(0.985)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardTranslateY = useRef(new Animated.Value(28)).current;
  const cardScale = useRef(new Animated.Value(0.965)).current;
  const ambientPulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (Platform.OS === "web") {
      heroOpacity.setValue(1);
      heroTranslateY.setValue(0);
      heroScale.setValue(1);
      cardOpacity.setValue(1);
      cardTranslateY.setValue(0);
      cardScale.setValue(1);
      ambientPulse.setValue(0);
      return;
    }

    const intro = Animated.sequence([
      Animated.parallel([
        Animated.timing(heroOpacity, {
          toValue: 1,
          duration: 520,
          easing: Easing.out(Easing.cubic),
          ...animationProps,
        }),
        Animated.spring(heroTranslateY, {
          toValue: 0,
          tension: 60,
          friction: 11,
          ...animationProps,
        }),
        Animated.spring(heroScale, {
          toValue: 1,
          tension: 50,
          friction: 8,
          ...animationProps,
        }),
      ]),
      Animated.delay(140),
      Animated.parallel([
        Animated.timing(cardOpacity, {
          toValue: 1,
          duration: 560,
          easing: Easing.out(Easing.cubic),
          ...animationProps,
        }),
        Animated.spring(cardTranslateY, {
          toValue: 0,
          tension: 64,
          friction: 11,
          ...animationProps,
        }),
        Animated.spring(cardScale, {
          toValue: 1,
          tension: 48,
          friction: 9,
          ...animationProps,
        }),
      ]),
    ]);

    const ambientLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(ambientPulse, {
          toValue: 1,
          duration: 7000,
          easing: Easing.inOut(Easing.quad),
          ...animationProps,
        }),
        Animated.timing(ambientPulse, {
          toValue: 0,
          duration: 7000,
          easing: Easing.inOut(Easing.quad),
          ...animationProps,
        }),
      ]),
    );

    intro.start();
    ambientLoop.start();

    return () => {
      intro.stop();
      ambientLoop.stop();
    };
  }, [
    ambientPulse,
    cardOpacity,
    cardScale,
    cardTranslateY,
    heroOpacity,
    heroScale,
    heroTranslateY,
  ]);

  const statusBarStyle =
    colorScheme === "light" ? "dark-content" : "light-content";
  const topPadding = Math.max(insets.top + spacing.lg, spacing.xl);
  const bottomPadding = Math.max(insets.bottom + spacing.xxl, spacing.xl);
  const heroStyle = {
    opacity: heroOpacity,
    transform: [{ translateY: heroTranslateY }, { scale: heroScale }],
  } as const;
  const cardStyle = {
    opacity: cardOpacity,
    transform: [{ translateY: cardTranslateY }, { scale: cardScale }],
  } as const;

  const topGlowOpacity = ambientPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.16, 0.26],
  });
  const topGlowScale = ambientPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.08],
  });
  const topGlowTranslateY = ambientPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -18],
  });

  const bottomGlowOpacity = ambientPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.12, 0.2],
  });
  const bottomGlowScale = ambientPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1.02, 0.96],
  });
  const bottomGlowTranslateY = ambientPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 16],
  });

  return (
    <View style={styles.container}>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle={statusBarStyle}
      />

      <LinearGradient
        colors={["#040816", "#0A1422", "#08192A"]}
        locations={[0, 0.56, 1]}
        start={{ x: 0.08, y: 0 }}
        end={{ x: 0.95, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      <LinearGradient
        colors={["rgba(37, 99, 235, 0.16)", "rgba(37, 99, 235, 0)"]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={styles.ambientLayer}>
        <Animated.View
          style={[
            styles.topGlow,
            {
              opacity: topGlowOpacity,
              transform: [
                { translateY: topGlowTranslateY },
                { scale: topGlowScale },
              ],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.bottomGlow,
            {
              opacity: bottomGlowOpacity,
              transform: [
                { translateY: bottomGlowTranslateY },
                { scale: bottomGlowScale },
              ],
            },
          ]}
        />
        <View style={styles.centerWash} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: topPadding, paddingBottom: bottomPadding },
          ]}
        >
          <View style={styles.stack}>
            <Animated.View style={heroStyle}>
              <AuthHero
                offline={auth.isOffline}
                cachedName={auth.currentUserName}
              />
            </Animated.View>

            <View style={styles.connectorWrap}>
              <View style={styles.connectorDot} />
              <View style={styles.connectorLine} />
              <Text style={styles.connectorLabel}>Start here</Text>
            </View>

            <Animated.View style={cardStyle}>
              <AuthFormCard
                mode={auth.mode}
                values={auth.values}
                errors={auth.errors}
                feedback={auth.feedback}
                isSubmitting={auth.isSubmitting}
                loadingProvider={auth.loadingProvider}
                acceptedTerms={auth.acceptedTerms}
                passwordStrength={auth.passwordStrength}
                showPassword={auth.showPassword}
                showConfirmPassword={auth.showConfirmPassword}
                title={auth.cardTitle}
                subtitle={auth.cardSubtitle}
                googleReady={auth.googleReady}
                appleReady={auth.appleReady}
                googleHint={auth.googleHint}
                appleHint={auth.appleHint}
                submitLabel={auth.submitLabel}
                switchLabel={auth.switchLabel}
                switchPrompt={auth.switchPrompt}
                onChangeMode={auth.setMode}
                onChangeField={auth.updateField}
                onToggleAcceptedTerms={auth.toggleAcceptedTerms}
                onTogglePasswordVisibility={auth.togglePasswordVisibility}
                onToggleConfirmPasswordVisibility={
                  auth.toggleConfirmPasswordVisibility
                }
                onSubmit={auth.submit}
                onGooglePress={auth.signInWithGoogle}
                onApplePress={auth.signInWithApple}
              />
            </Animated.View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const topGlowShadow =
  Platform.select({
    web: {
      boxShadow: "0px 0px 80px rgba(37, 99, 235, 0.32)",
    } as any,
    default: {
      shadowColor: "#2563EB",
      shadowOpacity: 0.32,
      shadowRadius: 80,
      shadowOffset: { width: 0, height: 18 },
    },
  }) ?? {};

const bottomGlowShadow =
  Platform.select({
    web: {
      boxShadow: "0px 0px 92px rgba(14, 165, 233, 0.28)",
    } as any,
    default: {
      shadowColor: "#0EA5E9",
      shadowOpacity: 0.28,
      shadowRadius: 92,
      shadowOffset: { width: 0, height: 24 },
    },
  }) ?? {};

const connectorDotShadow =
  Platform.select({
    web: {
      boxShadow: "0px 0px 14px rgba(96, 165, 250, 0.45)",
    } as any,
    default: {
      shadowColor: "#60A5FA",
      shadowOpacity: 0.45,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 0 },
    },
  }) ?? {};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.darkBackground,
  },
  ambientLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  topGlow: {
    position: "absolute",
    top: -48,
    right: -90,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "rgba(37, 99, 235, 0.24)",
    ...topGlowShadow,
  },
  bottomGlow: {
    position: "absolute",
    bottom: 40,
    left: -100,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "rgba(14, 165, 233, 0.12)",
    ...bottomGlowShadow,
  },
  centerWash: {
    position: "absolute",
    top: "26%",
    left: 0,
    right: 0,
    height: 180,
    backgroundColor: "rgba(15, 23, 42, 0.1)",
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
  },
  stack: {
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
  },
  connectorWrap: {
    alignItems: "center",
    paddingVertical: spacing.sm,
    marginBottom: -spacing.xs,
  },
  connectorDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: "rgba(96, 165, 250, 0.95)",
    ...connectorDotShadow,
    marginBottom: 8,
  },
  connectorLine: {
    width: 1,
    height: 22,
    backgroundColor: "rgba(148, 163, 184, 0.26)",
  },
  connectorLabel: {
    marginTop: 8,
    color: "rgba(226, 232, 240, 0.74)",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
});
