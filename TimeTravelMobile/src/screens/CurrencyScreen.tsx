/**
 * CurrencyScreen - Smart Travel Finance Tool
 * Transforms currency conversion into actionable travel insights
 * Google Currency + Travel Assistant combined
 */

import React, {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
  memo,
} from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Animated,
  Dimensions,
  FlatList,
  Platform,
} from "react-native";
import { Text } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { currencyService, ConversionResult } from "@/services/currency";
import { colors, spacing } from "@/theme/colors";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const shouldUseNativeDriver = Platform.OS !== "web";

// ─────────────────────────────────────────────────────────────
// CONSTANTS & DATA
// ─────────────────────────────────────────────────────────────

interface CurrencyInfo {
  code: string;
  name: string;
  symbol: string;
  flag: string;
  country: string;
}

const CURRENCIES: CurrencyInfo[] = [
  {
    code: "INR",
    name: "Indian Rupee",
    symbol: "₹",
    flag: "🇮🇳",
    country: "India",
  },
  { code: "USD", name: "US Dollar", symbol: "$", flag: "🇺🇸", country: "USA" },
  { code: "EUR", name: "Euro", symbol: "€", flag: "🇪🇺", country: "Europe" },
  {
    code: "GBP",
    name: "British Pound",
    symbol: "£",
    flag: "🇬🇧",
    country: "UK",
  },
  {
    code: "JPY",
    name: "Japanese Yen",
    symbol: "¥",
    flag: "🇯🇵",
    country: "Japan",
  },
  {
    code: "AUD",
    name: "Australian Dollar",
    symbol: "A$",
    flag: "🇦🇺",
    country: "Australia",
  },
  {
    code: "CAD",
    name: "Canadian Dollar",
    symbol: "C$",
    flag: "🇨🇦",
    country: "Canada",
  },
  {
    code: "SGD",
    name: "Singapore Dollar",
    symbol: "S$",
    flag: "🇸🇬",
    country: "Singapore",
  },
  {
    code: "AED",
    name: "UAE Dirham",
    symbol: "د.إ",
    flag: "🇦🇪",
    country: "UAE",
  },
  {
    code: "THB",
    name: "Thai Baht",
    symbol: "฿",
    flag: "🇹🇭",
    country: "Thailand",
  },
  {
    code: "MYR",
    name: "Malaysian Ringgit",
    symbol: "RM",
    flag: "🇲🇾",
    country: "Malaysia",
  },
  {
    code: "CHF",
    name: "Swiss Franc",
    symbol: "Fr",
    flag: "🇨🇭",
    country: "Switzerland",
  },
  {
    code: "CNY",
    name: "Chinese Yuan",
    symbol: "¥",
    flag: "🇨🇳",
    country: "China",
  },
  {
    code: "KRW",
    name: "South Korean Won",
    symbol: "₩",
    flag: "🇰🇷",
    country: "South Korea",
  },
  {
    code: "VND",
    name: "Vietnamese Dong",
    symbol: "₫",
    flag: "🇻🇳",
    country: "Vietnam",
  },
  {
    code: "NZD",
    name: "New Zealand Dollar",
    symbol: "NZ$",
    flag: "🇳🇿",
    country: "New Zealand",
  },
];

const QUICK_PRESETS = [100, 1000, 10000, 50000];

// Cost reference for insights (in USD, approximate)
const COST_REFERENCES: Record<
  string,
  { meal: number; transport: number; hotel: number }
> = {
  USD: { meal: 15, transport: 2.5, hotel: 120 },
  EUR: { meal: 12, transport: 2, hotel: 100 },
  GBP: { meal: 15, transport: 3, hotel: 130 },
  INR: { meal: 200, transport: 20, hotel: 3000 },
  THB: { meal: 100, transport: 30, hotel: 1500 },
  AED: { meal: 30, transport: 5, hotel: 350 },
  SGD: { meal: 10, transport: 2, hotel: 150 },
  JPY: { meal: 1000, transport: 200, hotel: 12000 },
  AUD: { meal: 18, transport: 3, hotel: 140 },
  CAD: { meal: 15, transport: 3, hotel: 130 },
};

// Currency strength (relative to USD, lower = stronger)
const CURRENCY_STRENGTH: Record<string, number> = {
  KRW: 0.00075,
  VND: 0.00004,
  INR: 0.012,
  THB: 0.028,
  JPY: 0.0067,
  CNY: 0.14,
  MYR: 0.22,
  AED: 0.27,
  AUD: 0.65,
  CAD: 0.74,
  SGD: 0.74,
  EUR: 1.08,
  USD: 1,
  GBP: 1.27,
  CHF: 1.13,
  NZD: 0.6,
};

const swapBtnShadow = (
  Platform.OS === "web"
    ? { boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.1)" }
    : { elevation: 4 }
) as any;

const resultHeroCardShadow = (
  Platform.OS === "web"
    ? { boxShadow: "0px 4px 12px rgba(0, 0, 0, 0.1)" }
    : { elevation: 8 }
) as any;

// ─────────────────────────────────────────────────────────────
// UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────────

const formatNumber = (n: number, decimals: number = 2): string => {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

const getCurrencyInfo = (code: string): CurrencyInfo =>
  CURRENCIES.find((c) => c.code === code) || CURRENCIES[0];

// ─────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────

interface CurrencyChipProps {
  currency: CurrencyInfo;
  isSelected: boolean;
  onPress: () => void;
  size?: "normal" | "compact";
}

const CurrencyChip = memo(
  ({ currency, isSelected, onPress, size = "normal" }: CurrencyChipProps) => (
    <TouchableOpacity
      style={[
        styles.currencyChip,
        isSelected && styles.currencyChipActive,
        size === "compact" && styles.currencyChipCompact,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={styles.currencyFlag}>{currency.flag}</Text>
      <Text
        style={[styles.currencyCode, isSelected && styles.currencyCodeActive]}
      >
        {currency.code}
      </Text>
    </TouchableOpacity>
  ),
);

CurrencyChip.displayName = "CurrencyChip";

// ─────────────────────────────────────────────────────────────

interface QuickPresetButtonProps {
  amount: number;
  currency: string;
  onPress: () => void;
  isActive: boolean;
}

const QuickPresetButton = memo(
  ({ amount, currency, onPress, isActive }: QuickPresetButtonProps) => (
    <TouchableOpacity
      style={[styles.presetBtn, isActive && styles.presetBtnActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.presetText, isActive && styles.presetTextActive]}>
        {getCurrencyInfo(currency).symbol}
        {formatNumber(amount, 0)}
      </Text>
    </TouchableOpacity>
  ),
);

QuickPresetButton.displayName = "QuickPresetButton";

// ─────────────────────────────────────────────────────────────

interface SwapButtonProps {
  onPress: () => void;
}

const SwapButton = memo(({ onPress }: SwapButtonProps) => {
  const rotation = useRef(new Animated.Value(0)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(rotation, {
        toValue: 1,
        duration: 200,
        useNativeDriver: shouldUseNativeDriver,
      }),
      Animated.timing(rotation, {
        toValue: 0,
        duration: 0,
        useNativeDriver: shouldUseNativeDriver,
      }),
    ]).start();
    onPress();
  };

  const rotate = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "180deg"],
  });

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.7}
      style={styles.swapBtnOuter}
    >
      <Animated.View style={[styles.swapBtn, { transform: [{ rotate }] }]}>
        <MaterialCommunityIcons
          name="swap-vertical"
          size={24}
          color={colors.primary}
        />
      </Animated.View>
    </TouchableOpacity>
  );
});

SwapButton.displayName = "SwapButton";

// ─────────────────────────────────────────────────────────────

interface ResultHeroCardProps {
  result: ConversionResult;
  fromInfo: CurrencyInfo;
  toInfo: CurrencyInfo;
  insight: TravelInsight | null;
  strengthInfo: StrengthInfo | null;
}

interface TravelInsight {
  meals: number;
  transport: number;
  hotelNights: number;
  tip: string;
}

interface StrengthInfo {
  stronger: string;
  weaker: string;
  ratio: number;
  direction: "stronger" | "weaker" | "equal";
}

const ResultHeroCard = memo(
  ({
    result,
    fromInfo,
    toInfo,
    insight,
    strengthInfo,
  }: ResultHeroCardProps) => {
    const scaleAnim = useRef(new Animated.Value(0.9)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: shouldUseNativeDriver,
          tension: 100,
          friction: 8,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: shouldUseNativeDriver,
        }),
      ]).start();
    }, []);

    return (
      <Animated.View
        style={[
          styles.resultHeroCard,
          { transform: [{ scale: scaleAnim }], opacity: opacityAnim },
        ]}
      >
        {/* From Amount */}
        <View style={styles.resultFromRow}>
          <Text style={styles.resultFlag}>{fromInfo.flag}</Text>
          <Text style={styles.resultFromAmount}>
            {fromInfo.symbol}
            {formatNumber(result.amount)}
          </Text>
          <Text style={styles.resultFromCode}>{result.from}</Text>
        </View>

        {/* Divider with equals */}
        <View style={styles.resultDivider}>
          <View style={styles.resultDividerLine} />
          <View style={styles.resultEqualsBadge}>
            <MaterialCommunityIcons
              name="approximately-equal"
              size={20}
              color={colors.gray}
            />
          </View>
          <View style={styles.resultDividerLine} />
        </View>

        {/* To Amount - HERO */}
        <View style={styles.resultToRow}>
          <Text style={styles.resultFlagLarge}>{toInfo.flag}</Text>
          <Text style={styles.resultToAmount}>
            {toInfo.symbol}
            {formatNumber(result.converted)}
          </Text>
          <Text style={styles.resultToCode}>{result.to}</Text>
        </View>

        {/* Rate */}
        <View style={styles.resultRateRow}>
          <Text style={styles.resultRateText}>
            1 {result.from} = {formatNumber(result.rate, 4)} {result.to}
          </Text>
        </View>

        {/* Strength Indicator */}
        {strengthInfo && strengthInfo.direction !== "equal" && (
          <View
            style={[
              styles.strengthRow,
              strengthInfo.direction === "stronger"
                ? styles.strengthRowPositive
                : styles.strengthRowNegative,
            ]}
          >
            <MaterialCommunityIcons
              name={
                strengthInfo.direction === "stronger"
                  ? "trending-up"
                  : "trending-down"
              }
              size={16}
              color={
                strengthInfo.direction === "stronger" ? "#10B981" : "#EF4444"
              }
            />
            <Text
              style={[
                styles.strengthText,
                strengthInfo.direction === "stronger"
                  ? styles.strengthTextPositive
                  : styles.strengthTextNegative,
              ]}
            >
              {strengthInfo.stronger} is{" "}
              {Math.abs(strengthInfo.ratio).toFixed(1)}x stronger than{" "}
              {strengthInfo.weaker}
            </Text>
          </View>
        )}

        {/* Travel Insight */}
        {insight && (
          <View style={styles.insightCard}>
            <View style={styles.insightHeader}>
              <MaterialCommunityIcons
                name="lightbulb-outline"
                size={18}
                color="#F59E0B"
              />
              <Text style={styles.insightTitle}>What can you buy?</Text>
            </View>
            <View style={styles.insightItems}>
              {insight.meals > 0 && (
                <View style={styles.insightItem}>
                  <MaterialCommunityIcons
                    name="food"
                    size={16}
                    color={colors.gray}
                  />
                  <Text style={styles.insightItemText}>
                    {Math.floor(insight.meals)} meals
                  </Text>
                </View>
              )}
              {insight.transport > 0 && (
                <View style={styles.insightItem}>
                  <MaterialCommunityIcons
                    name="bus"
                    size={16}
                    color={colors.gray}
                  />
                  <Text style={styles.insightItemText}>
                    {Math.floor(insight.transport)} rides
                  </Text>
                </View>
              )}
              {insight.hotelNights > 0 && (
                <View style={styles.insightItem}>
                  <MaterialCommunityIcons
                    name="bed"
                    size={16}
                    color={colors.gray}
                  />
                  <Text style={styles.insightItemText}>
                    {Math.floor(insight.hotelNights)} hotel nights
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.insightTip}>{insight.tip}</Text>
          </View>
        )}
      </Animated.View>
    );
  },
);

ResultHeroCard.displayName = "ResultHeroCard";

// ─────────────────────────────────────────────────────────────

interface RecentCurrencyProps {
  recents: string[];
  onSelect: (code: string) => void;
  currentFrom: string;
  currentTo: string;
}

const RecentCurrencyBar = memo(
  ({ recents, onSelect, currentFrom, currentTo }: RecentCurrencyProps) => {
    if (recents.length === 0) return null;

    const filteredRecents = recents
      .filter((c) => c !== currentFrom && c !== currentTo)
      .slice(0, 4);

    return (
      <View style={styles.recentBar}>
        <Text style={styles.recentLabel}>Recent:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.recentRow}>
            {filteredRecents.map((code) => {
              const info = getCurrencyInfo(code);
              return (
                <TouchableOpacity
                  key={code}
                  style={styles.recentChip}
                  onPress={() => onSelect(code)}
                >
                  <Text style={styles.recentFlag}>{info.flag}</Text>
                  <Text style={styles.recentCode}>{code}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </View>
    );
  },
);

RecentCurrencyBar.displayName = "RecentCurrencyBar";

// ─────────────────────────────────────────────────────────────
// CUSTOM HOOK
// ─────────────────────────────────────────────────────────────

function useCurrencyConverter() {
  const [amount, setAmount] = useState("1000");
  const [fromCurrency, setFromCurrency] = useState("INR");
  const [toCurrency, setToCurrency] = useState("USD");
  const [result, setResult] = useState<ConversionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentCurrencies, setRecentCurrencies] = useState<string[]>([
    "USD",
    "EUR",
    "GBP",
    "THB",
  ]);
  const [activePreset, setActivePreset] = useState<number | null>(null);

  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Computed values
  const fromInfo = useMemo(() => getCurrencyInfo(fromCurrency), [fromCurrency]);
  const toInfo = useMemo(() => getCurrencyInfo(toCurrency), [toCurrency]);

  // Calculate strength info
  const strengthInfo = useMemo((): StrengthInfo | null => {
    const fromStrength = CURRENCY_STRENGTH[fromCurrency];
    const toStrength = CURRENCY_STRENGTH[toCurrency];

    if (!fromStrength || !toStrength) return null;

    const ratio = toStrength / fromStrength;

    if (Math.abs(ratio - 1) < 0.05) {
      return {
        stronger: fromCurrency,
        weaker: toCurrency,
        ratio: 1,
        direction: "equal",
      };
    }

    if (fromStrength > toStrength) {
      return {
        stronger: fromCurrency,
        weaker: toCurrency,
        ratio: fromStrength / toStrength,
        direction: "stronger",
      };
    }

    return {
      stronger: toCurrency,
      weaker: fromCurrency,
      ratio: toStrength / fromStrength,
      direction: "weaker",
    };
  }, [fromCurrency, toCurrency]);

  // Calculate travel insight
  const insight = useMemo((): TravelInsight | null => {
    if (!result || result.converted <= 0) return null;

    const costs = COST_REFERENCES[result.to];
    if (!costs) return null;

    const meals = result.converted / costs.meal;
    const transport = result.converted / costs.transport;
    const hotelNights = result.converted / costs.hotel;

    const tips: string[] = [];
    if (result.to === "USD") tips.push("USA is expensive - budget accordingly");
    if (result.to === "THB")
      tips.push("Thailand offers great value for Indian travelers");
    if (result.to === "EUR")
      tips.push("Europe varies - Eastern Europe is cheaper");
    if (result.to === "JPY") tips.push("Japan can be affordable with planning");
    if (result.to === "AED")
      tips.push("UAE is moderately expensive for tourists");
    if (result.to === "INR")
      tips.push("Great value destination for international travelers");

    return {
      meals,
      transport,
      hotelNights,
      tip: tips[0] || "Plan your budget based on local costs",
    };
  }, [result]);

  // Convert function
  const convert = useCallback(async (amt: string, from: string, to: string) => {
    const numAmount = parseFloat(amt);

    if (!amt || isNaN(numAmount) || numAmount <= 0) {
      setError(null);
      setResult(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await currencyService.convert(numAmount, from, to);
      setResult(res);
    } catch (e: any) {
      setError(e.message || "Conversion failed. Please try again.");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced auto-convert
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    debounceTimer.current = setTimeout(() => {
      convert(amount, fromCurrency, toCurrency);
    }, 500);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [amount, fromCurrency, toCurrency, convert]);

  // Swap currencies
  const swap = useCallback(() => {
    setFromCurrency(toCurrency);
    setToCurrency(fromCurrency);
    setActivePreset(null);
  }, [fromCurrency, toCurrency]);

  // Update amount with preset
  const setAmountPreset = useCallback((preset: number) => {
    setAmount(String(preset));
    setActivePreset(preset);
  }, []);

  // Update amount manually
  const updateAmount = useCallback((val: string) => {
    setAmount(val);
    setActivePreset(null);
  }, []);

  // Select currency (for quick swap in To currency)
  const selectToCurrency = useCallback((code: string) => {
    setToCurrency(code);
    setRecentCurrencies((prev) => {
      const filtered = prev.filter((c) => c !== code);
      return [code, ...filtered].slice(0, 6);
    });
  }, []);

  // Retry
  const retry = useCallback(() => {
    convert(amount, fromCurrency, toCurrency);
  }, [amount, fromCurrency, toCurrency, convert]);

  return {
    amount,
    updateAmount,
    fromCurrency,
    setFromCurrency,
    toCurrency,
    setToCurrency,
    selectToCurrency,
    result,
    loading,
    error,
    recentCurrencies,
    activePreset,
    setAmountPreset,
    swap,
    retry,
    fromInfo,
    toInfo,
    insight,
    strengthInfo,
  };
}

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────

export default function CurrencyScreen() {
  const {
    amount,
    updateAmount,
    fromCurrency,
    setFromCurrency,
    toCurrency,
    setToCurrency,
    selectToCurrency,
    result,
    loading,
    error,
    recentCurrencies,
    activePreset,
    setAmountPreset,
    swap,
    retry,
    fromInfo,
    toInfo,
    insight,
    strengthInfo,
  } = useCurrencyConverter();

  const renderFromCurrency = useCallback(
    ({ item }: { item: CurrencyInfo }) => (
      <CurrencyChip
        currency={item}
        isSelected={fromCurrency === item.code}
        onPress={() => setFromCurrency(item.code)}
      />
    ),
    [fromCurrency, setFromCurrency],
  );

  const renderToCurrency = useCallback(
    ({ item }: { item: CurrencyInfo }) => (
      <CurrencyChip
        currency={item}
        isSelected={toCurrency === item.code}
        onPress={() => {
          setToCurrency(item.code);
        }}
      />
    ),
    [toCurrency, setToCurrency],
  );

  const keyExtractor = useCallback((item: CurrencyInfo) => item.code, []);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Travel Money</Text>
          <Text style={styles.subtitle}>
            Smart currency conversion for travelers
          </Text>
        </View>

        {/* Amount Input */}
        <View style={styles.amountSection}>
          <View style={styles.amountInputWrapper}>
            <Text style={styles.amountSymbol}>{fromInfo.symbol}</Text>
            <TextInput
              style={styles.amountInput}
              value={amount}
              onChangeText={updateAmount}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={colors.gray}
              selectionColor={colors.primary}
            />
          </View>

          {/* Quick Presets */}
          <View style={styles.presetsRow}>
            {QUICK_PRESETS.map((preset) => (
              <QuickPresetButton
                key={preset}
                amount={preset}
                currency={fromCurrency}
                onPress={() => setAmountPreset(preset)}
                isActive={activePreset === preset}
              />
            ))}
          </View>
        </View>

        {/* From Currency */}
        <View style={styles.currencySection}>
          <Text style={styles.sectionLabel}>From</Text>
          <FlatList
            data={CURRENCIES}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={keyExtractor}
            renderItem={renderFromCurrency}
            contentContainerStyle={styles.currencyList}
            initialNumToRender={8}
            maxToRenderPerBatch={8}
            windowSize={3}
          />
        </View>

        {/* Swap Button */}
        <View style={styles.swapContainer}>
          <SwapButton onPress={swap} />
        </View>

        {/* To Currency */}
        <View style={styles.currencySection}>
          <Text style={styles.sectionLabel}>To</Text>
          <FlatList
            data={CURRENCIES}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={keyExtractor}
            renderItem={renderToCurrency}
            contentContainerStyle={styles.currencyList}
            initialNumToRender={8}
            maxToRenderPerBatch={8}
            windowSize={3}
          />
        </View>

        {/* Recent Currencies */}
        <RecentCurrencyBar
          recents={recentCurrencies}
          onSelect={selectToCurrency}
          currentFrom={fromCurrency}
          currentTo={toCurrency}
        />

        {/* Error State */}
        {error && (
          <View style={styles.errorCard}>
            <MaterialCommunityIcons
              name="alert-circle-outline"
              size={20}
              color={colors.error}
            />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={retry}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Result Hero Card */}
        {result && !error && (
          <ResultHeroCard
            result={result}
            fromInfo={fromInfo}
            toInfo={toInfo}
            insight={insight}
            strengthInfo={strengthInfo}
          />
        )}

        {/* Loading Indicator */}
        {loading && !result && (
          <View style={styles.loadingCard}>
            <MaterialCommunityIcons
              name="sync"
              size={32}
              color={colors.primary}
            />
            <Text style={styles.loadingText}>Converting...</Text>
          </View>
        )}

        {/* Empty State */}
        {!loading && !result && !error && (
          <View style={styles.emptyCard}>
            <MaterialCommunityIcons
              name="currency-usd"
              size={48}
              color={colors.gray}
            />
            <Text style={styles.emptyText}>Enter an amount to convert</Text>
          </View>
        )}

        {/* Travel Tips */}
        <View style={styles.tipsSection}>
          <Text style={styles.tipsTitle}>💡 Travel Tip</Text>
          <Text style={styles.tipsText}>
            {fromCurrency === "INR" &&
              toCurrency === "USD" &&
              "USD is one of the strongest currencies. Budget 3-4x more for USA trips."}
            {fromCurrency === "INR" &&
              toCurrency === "THB" &&
              "Thailand offers excellent value! Your money goes 3-4x further than in India."}
            {fromCurrency === "INR" &&
              toCurrency === "AED" &&
              "UAE is moderately expensive. Expect to spend similar to metro cities in India."}
            {fromCurrency === "INR" &&
              toCurrency === "EUR" &&
              "Europe varies - Eastern Europe is budget-friendly, Western Europe is expensive."}
            {fromCurrency === "INR" &&
              toCurrency === "JPY" &&
              "Japan seems expensive but can be affordable with local food and hostels."}
            {!["INR-USD", "INR-THB", "INR-AED", "INR-EUR", "INR-JPY"].includes(
              `${fromCurrency}-${toCurrency}`,
            ) &&
              "Always compare exchange rates before your trip for the best value."}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { padding: spacing.md, paddingBottom: 120 },

  // Header
  header: { marginBottom: spacing.lg },
  title: { fontSize: 28, fontWeight: "800", color: colors.text },
  subtitle: { fontSize: 14, color: colors.gray, marginTop: 2 },

  // Amount Section
  amountSection: { marginBottom: spacing.md },
  amountInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  amountSymbol: {
    fontSize: 32,
    fontWeight: "700",
    color: colors.primary,
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 36,
    fontWeight: "800",
    color: colors.text,
    padding: 0,
  },

  // Presets
  presetsRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  presetBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  presetBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  presetText: { fontSize: 13, fontWeight: "600", color: colors.text },
  presetTextActive: { color: "#FFF" },

  // Section
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.gray,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  currencySection: { marginBottom: spacing.sm },
  currencyList: { gap: 8 },
  currencyChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  currencyChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  currencyChipCompact: { paddingHorizontal: 10, paddingVertical: 6 },
  currencyFlag: { fontSize: 18 },
  currencyCode: { fontSize: 13, fontWeight: "600", color: colors.text },
  currencyCodeActive: { color: "#FFF" },

  // Swap
  swapContainer: { alignItems: "center", marginVertical: 8 },
  swapBtnOuter: { padding: 8 },
  swapBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.primary,
    ...swapBtnShadow,
  },

  // Recent Bar
  recentBar: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
    gap: 8,
  },
  recentLabel: { fontSize: 11, color: colors.gray, fontWeight: "500" },
  recentRow: { flexDirection: "row", gap: 6 },
  recentChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: colors.surface,
    gap: 4,
  },
  recentFlag: { fontSize: 14 },
  recentCode: { fontSize: 11, fontWeight: "600", color: colors.text },

  // Error
  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    padding: 14,
    borderRadius: 16,
    marginBottom: spacing.md,
    gap: 10,
  },
  errorText: { flex: 1, fontSize: 14, color: colors.error },
  retryText: { fontSize: 14, fontWeight: "600", color: colors.primary },

  // Loading
  loadingCard: {
    alignItems: "center",
    padding: 40,
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  loadingText: { fontSize: 14, color: colors.gray, marginTop: 8 },

  // Empty
  emptyCard: {
    alignItems: "center",
    padding: 40,
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyText: { fontSize: 14, color: colors.gray, marginTop: 12 },

  // Result Hero Card
  resultHeroCard: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
    ...resultHeroCardShadow,
  },
  resultFromRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  resultFlag: { fontSize: 24 },
  resultFlagLarge: { fontSize: 32 },
  resultFromAmount: { fontSize: 20, fontWeight: "600", color: colors.gray },
  resultFromCode: { fontSize: 16, color: colors.gray },
  resultDivider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 12,
  },
  resultDividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  resultEqualsBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 12,
  },
  resultToRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  resultToAmount: { fontSize: 40, fontWeight: "900", color: colors.primary },
  resultToCode: { fontSize: 20, fontWeight: "700", color: colors.text },
  resultRateRow: {
    alignItems: "center",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  resultRateText: { fontSize: 13, color: colors.gray },

  // Strength
  strengthRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 6,
  },
  strengthRowPositive: { backgroundColor: "#F0FDF4" },
  strengthRowNegative: { backgroundColor: "#FEF2F2" },
  strengthText: { fontSize: 12, fontWeight: "600" },
  strengthTextPositive: { color: "#10B981" },
  strengthTextNegative: { color: "#EF4444" },

  // Insight
  insightCard: {
    marginTop: 16,
    padding: 16,
    backgroundColor: colors.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  insightHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  insightTitle: { fontSize: 13, fontWeight: "700", color: colors.text },
  insightItems: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 12,
  },
  insightItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  insightItemText: { fontSize: 13, fontWeight: "600", color: colors.text },
  insightTip: { fontSize: 12, color: colors.gray, fontStyle: "italic" },

  // Tips
  tipsSection: {
    marginTop: spacing.lg,
    padding: 16,
    backgroundColor: "#FEF3C7",
    borderRadius: 16,
  },
  tipsTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#92400E",
    marginBottom: 4,
  },
  tipsText: { fontSize: 13, color: "#92400E", lineHeight: 18 },
});
