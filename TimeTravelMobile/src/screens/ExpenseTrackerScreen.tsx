/**
 * ExpenseTrackerScreen - AI-Powered Travel Finance Assistant
 * World-class expense tracking with smart insights
 * Splitwise + Google Pay + Travel Intelligence combined
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
  FlatList,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Animated,
  Dimensions,
  Modal,
  Alert,
  Platform,
} from "react-native";
import { Text } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { expenseService, Expense, ExpenseSummary } from "@/services/expenses";
import { colors, spacing } from "@/theme/colors";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ─────────────────────────────────────────────────────────────
// TYPES & INTERFACES
// ─────────────────────────────────────────────────────────────

interface CategoryConfig {
  key: string;
  icon: string;
  label: string;
  color: string;
  budget?: number;
}

interface GroupedExpenses {
  label: string;
  data: Expense[];
}

interface SpendingInsight {
  type: "warning" | "info" | "success" | "alert";
  title: string;
  message: string;
  icon: string;
}

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────

const CATEGORIES: CategoryConfig[] = [
  { key: "food", icon: "food", label: "Food", color: "#F59E0B", budget: 5000 },
  {
    key: "transport",
    icon: "bus",
    label: "Transport",
    color: "#3B82F6",
    budget: 3000,
  },
  { key: "stay", icon: "bed", label: "Stay", color: "#8B5CF6", budget: 8000 },
  {
    key: "activities",
    icon: "run",
    label: "Activities",
    color: "#10B981",
    budget: 4000,
  },
  {
    key: "shopping",
    icon: "shopping",
    label: "Shopping",
    color: "#EC4899",
    budget: 3000,
  },
  {
    key: "other",
    icon: "package-variant",
    label: "Other",
    color: "#6B7280",
    budget: 2000,
  },
];

const TRIP_BUDGET_DEFAULT = 50000;

const getCategoryConfig = (key: string): CategoryConfig =>
  CATEGORIES.find((c) => c.key === key) || CATEGORIES[5];

// ─────────────────────────────────────────────────────────────
// UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────────

const formatCurrency = (n: number): string => {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n.toLocaleString("en-IN")}`;
};

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};

const groupExpensesByDate = (expenses: Expense[]): GroupedExpenses[] => {
  const groups: Record<string, Expense[]> = {};

  expenses.forEach((exp) => {
    const label = formatDate(
      exp.date || exp.created_at || new Date().toISOString(),
    );
    if (!groups[label]) groups[label] = [];
    groups[label].push(exp);
  });

  return Object.entries(groups).map(([label, data]) => ({ label, data }));
};

const triggerHaptic = (_style: "light" | "medium" | "heavy" = "light") => {
  // Haptic feedback - requires expo-haptics package
  // For now, this is a no-op placeholder
};

// ─────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  prefix?: string;
}

const AnimatedNumber = memo(
  ({ value, duration = 800, prefix = "₹" }: AnimatedNumberProps) => {
    const animatedValue = useRef(new Animated.Value(0)).current;
    const stringRef = useRef("0");

    useEffect(() => {
      Animated.timing(animatedValue, {
        toValue: value,
        duration,
        useNativeDriver: false,
      }).start();
    }, [value]);

    useEffect(() => {
      const listener = animatedValue.addListener(({ value: v }) => {
        stringRef.current = Math.round(v).toLocaleString("en-IN");
      });
      return () => animatedValue.removeListener(listener);
    }, []);

    return (
      <Animated.Text style={{ fontSize: 32, fontWeight: "900", color: "#FFF" }}>
        {prefix}
        {stringRef.current}
      </Animated.Text>
    );
  },
);

AnimatedNumber.displayName = "AnimatedNumber";

// ─────────────────────────────────────────────────────────────

interface BudgetProgressRingProps {
  spent: number;
  budget: number;
  size?: number;
}

const BudgetProgressRing = memo(
  ({ spent, budget, size = 120 }: BudgetProgressRingProps) => {
    const progress = Math.min(spent / budget, 1);
    const strokeWidth = 10;
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const strokeDashoffset = circumference - progress * circumference;

    const color =
      progress > 0.9 ? "#EF4444" : progress > 0.7 ? "#F59E0B" : "#10B981";

    return (
      <View style={[styles.progressRing, { width: size, height: size }]}>
        <View style={styles.progressRingInner}>
          <Text style={styles.progressPercent}>
            {Math.round(progress * 100)}%
          </Text>
          <Text style={styles.progressLabel}>used</Text>
        </View>
        <Animated.View style={{ transform: [{ rotate: "-90deg" }] }}>
          <Animated.View
            style={{
              width: size,
              height: size,
              borderRadius: size / 2,
              borderWidth: strokeWidth,
              borderColor: "rgba(255,255,255,0.15)",
            }}
          />
        </Animated.View>
        <Animated.View
          style={{
            position: "absolute",
            width: size,
            height: size,
            transform: [{ rotate: "-90deg" }],
          }}
        >
          <Animated.View
            style={{
              width: size,
              height: size,
              borderRadius: size / 2,
              borderWidth: strokeWidth,
              borderColor: color,
              borderTopColor: color,
              borderRightColor: color,
              borderBottomColor: "transparent",
              borderLeftColor: "transparent",
            }}
          />
        </Animated.View>
      </View>
    );
  },
);

BudgetProgressRing.displayName = "BudgetProgressRing";

// ─────────────────────────────────────────────────────────────

interface SummaryCardProps {
  summary: ExpenseSummary | null;
  budget: number;
  onBudgetEdit: () => void;
}

const SummaryCard = memo(
  ({ summary, budget, onBudgetEdit }: SummaryCardProps) => {
    const total = summary?.total || 0;
    const count = summary?.count || 0;
    const categoryData = summary?.by_category || [];

    const insights = useMemo((): SpendingInsight[] => {
      const result: SpendingInsight[] = [];
      const percentUsed = (total / budget) * 100;

      if (percentUsed > 90) {
        result.push({
          type: "alert",
          title: "Budget Alert!",
          message: `You've used ${Math.round(percentUsed)}% of your trip budget`,
          icon: "alert-circle",
        });
      } else if (percentUsed > 70) {
        result.push({
          type: "warning",
          title: "Budget Warning",
          message: `You've used ${Math.round(percentUsed)}% of your budget. Slow down!`,
          icon: "alert",
        });
      }

      // Category insights
      categoryData.forEach((cat) => {
        const config = getCategoryConfig(cat.category);
        if (config.budget && cat.total > config.budget) {
          result.push({
            type: "warning",
            title: `${config.label} Overspent`,
            message: `${config.label} budget exceeded by ${formatCurrency(cat.total - config.budget)}`,
            icon: "trending-up",
          });
        }
      });

      if (total > 0 && result.length === 0) {
        result.push({
          type: "success",
          title: "On Track!",
          message: "Your spending is within budget. Keep it up!",
          icon: "check-circle",
        });
      }

      return result;
    }, [total, budget, categoryData]);

    const dailyAverage = count > 0 ? total / Math.max(count, 1) : 0;

    return (
      <View style={styles.summaryCard}>
        {/* Hero Section */}
        <View style={styles.summaryHero}>
          <View style={styles.summaryLeft}>
            <AnimatedNumber value={total} />
            <Text style={styles.summaryLabel}>
              {count} expense{count !== 1 ? "s" : ""} this trip
            </Text>
            <TouchableOpacity onPress={onBudgetEdit} style={styles.budgetBadge}>
              <Text style={styles.budgetText}>
                Budget: {formatCurrency(budget)}
              </Text>
              <MaterialCommunityIcons name="pencil" size={12} color="#FFF" />
            </TouchableOpacity>
          </View>
          <BudgetProgressRing spent={total} budget={budget} />
        </View>

        {/* Category Bars */}
        <View style={styles.categoryBars}>
          {CATEGORIES.slice(0, 4).map((cat) => {
            const catData = categoryData.find((c) => c.category === cat.key);
            const spent = catData?.total || 0;
            const percent = cat.budget ? (spent / cat.budget) * 100 : 0;

            return (
              <View key={cat.key} style={styles.categoryBarRow}>
                <View style={styles.categoryBarHeader}>
                  <MaterialCommunityIcons
                    name={cat.icon as any}
                    size={14}
                    color={cat.color}
                  />
                  <Text style={styles.categoryBarLabel}>{cat.label}</Text>
                  <Text style={styles.categoryBarAmount}>
                    {formatCurrency(spent)}
                  </Text>
                </View>
                <View style={styles.categoryBarTrack}>
                  <View
                    style={[
                      styles.categoryBarFill,
                      {
                        width: `${Math.min(percent, 100)}%`,
                        backgroundColor: percent > 100 ? "#EF4444" : cat.color,
                      },
                    ]}
                  />
                </View>
              </View>
            );
          })}
        </View>

        {/* Insights */}
        {insights.length > 0 && (
          <View style={styles.insightsContainer}>
            {insights.slice(0, 2).map((insight, i) => (
              <View
                key={i}
                style={[
                  styles.insightCard,
                  insight.type === "alert" && styles.insightCardAlert,
                  insight.type === "warning" && styles.insightCardWarning,
                  insight.type === "success" && styles.insightCardSuccess,
                ]}
              >
                <MaterialCommunityIcons
                  name={insight.icon as any}
                  size={16}
                  color={
                    insight.type === "alert"
                      ? "#EF4444"
                      : insight.type === "warning"
                        ? "#F59E0B"
                        : "#10B981"
                  }
                />
                <View style={styles.insightText}>
                  <Text style={styles.insightTitle}>{insight.title}</Text>
                  <Text style={styles.insightMessage}>{insight.message}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  },
);

SummaryCard.displayName = "SummaryCard";

// ─────────────────────────────────────────────────────────────

interface ExpenseCardProps {
  expense: Expense;
  onDelete: () => void;
}

const ExpenseCard = memo(({ expense, onDelete }: ExpenseCardProps) => {
  const config = getCategoryConfig(expense.category);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
      tension: 300,
      friction: 20,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 300,
      friction: 20,
    }).start();
  };

  const handleLongPress = () => {
    triggerHaptic("medium");
    Alert.alert("Delete Expense", `Remove "${expense.description}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => onDelete() },
    ]);
  };

  return (
    <Animated.View
      style={[styles.expenseCard, { transform: [{ scale: scaleAnim }] }]}
    >
      <TouchableOpacity
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onLongPress={handleLongPress}
        activeOpacity={0.9}
        style={styles.expenseCardInner}
      >
        <View
          style={[styles.expenseIcon, { backgroundColor: `${config.color}20` }]}
        >
          <MaterialCommunityIcons
            name={config.icon as any}
            size={22}
            color={config.color}
          />
        </View>
        <View style={styles.expenseContent}>
          <Text style={styles.expenseDesc} numberOfLines={1}>
            {expense.description}
          </Text>
          <View style={styles.expenseMetaRow}>
            <Text style={styles.expenseDestination}>{expense.destination}</Text>
            <View style={styles.expenseDot} />
            <Text style={styles.expenseCategory}>{config.label}</Text>
          </View>
        </View>
        <View style={styles.expenseRight}>
          <Text style={styles.expenseAmount}>
            -{formatCurrency(expense.amount)}
          </Text>
          <Text style={styles.expenseTime}>
            {new Date(
              expense.date || expense.created_at || Date.now(),
            ).toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});

ExpenseCard.displayName = "ExpenseCard";

// ─────────────────────────────────────────────────────────────

interface DateSectionHeaderProps {
  label: string;
  total: number;
}

const DateSectionHeader = memo(({ label, total }: DateSectionHeaderProps) => (
  <View style={styles.dateSectionHeader}>
    <Text style={styles.dateSectionLabel}>{label}</Text>
    <Text style={styles.dateSectionTotal}>{formatCurrency(total)}</Text>
  </View>
));

DateSectionHeader.displayName = "DateSectionHeader";

// ─────────────────────────────────────────────────────────────

interface CategoryChipProps {
  category: CategoryConfig;
  isSelected: boolean;
  onPress: () => void;
}

const CategoryChip = memo(
  ({ category, isSelected, onPress }: CategoryChipProps) => (
    <TouchableOpacity
      style={[
        styles.categoryChip,
        isSelected && {
          backgroundColor: category.color,
          borderColor: category.color,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <MaterialCommunityIcons
        name={category.icon as any}
        size={16}
        color={isSelected ? "#FFF" : category.color}
      />
      <Text style={[styles.categoryChipText, isSelected && { color: "#FFF" }]}>
        {category.label}
      </Text>
    </TouchableOpacity>
  ),
);

CategoryChip.displayName = "CategoryChip";

// ─────────────────────────────────────────────────────────────

interface AddExpenseModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: {
    destination: string;
    category: string;
    description: string;
    amount: number;
  }) => void;
  loading: boolean;
}

const AddExpenseModal = memo(
  ({ visible, onClose, onSubmit, loading }: AddExpenseModalProps) => {
    const [destination, setDestination] = useState("");
    const [category, setCategory] = useState("food");
    const [description, setDescription] = useState("");
    const [amount, setAmount] = useState("");
    const slideAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
      if (visible) {
        Animated.timing(slideAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      }
    }, [visible]);

    const handleSubmit = () => {
      if (!destination.trim() || !description.trim() || !amount.trim()) {
        Alert.alert("Missing Fields", "Please fill all required fields");
        return;
      }
      const numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        Alert.alert("Invalid Amount", "Please enter a valid amount");
        return;
      }
      triggerHaptic("medium");
      onSubmit({
        destination: destination.trim(),
        category,
        description: description.trim(),
        amount: numAmount,
      });
    };

    const handleClose = () => {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
      setTimeout(() => {
        onClose();
        setDestination("");
        setDescription("");
        setAmount("");
        setCategory("food");
      }, 200);
    };

    const translateY = slideAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [300, 0],
    });

    return (
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={handleClose}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            onPress={handleClose}
            activeOpacity={1}
          />
          <Animated.View
            style={[styles.modalContent, { transform: [{ translateY }] }]}
          >
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Add Expense</Text>

            <TextInput
              style={styles.modalInput}
              placeholder="Where are you?"
              placeholderTextColor={colors.gray}
              value={destination}
              onChangeText={setDestination}
            />

            <Text style={styles.modalLabel}>Category</Text>
            <View style={styles.categoryGrid}>
              {CATEGORIES.map((cat) => (
                <CategoryChip
                  key={cat.key}
                  category={cat}
                  isSelected={category === cat.key}
                  onPress={() => {
                    setCategory(cat.key);
                    triggerHaptic("light");
                  }}
                />
              ))}
            </View>

            <TextInput
              style={styles.modalInput}
              placeholder="What did you spend on?"
              placeholderTextColor={colors.gray}
              value={description}
              onChangeText={setDescription}
            />

            <View style={styles.amountInputRow}>
              <Text style={styles.amountPrefix}>₹</Text>
              <TextInput
                style={styles.amountInput}
                placeholder="0"
                placeholderTextColor={colors.gray}
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={handleClose}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalSubmitBtn,
                  loading && styles.modalSubmitBtnLoading,
                ]}
                onPress={handleSubmit}
                disabled={loading}
              >
                <MaterialCommunityIcons name="check" size={20} color="#FFF" />
                <Text style={styles.modalSubmitText}>
                  {loading ? "Saving..." : "Save Expense"}
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>
    );
  },
);

AddExpenseModal.displayName = "AddExpenseModal";

// ─────────────────────────────────────────────────────────────

interface EmptyStateProps {
  onAddPress: () => void;
}

const EmptyState = memo(({ onAddPress }: EmptyStateProps) => (
  <View style={styles.emptyContainer}>
    <View style={styles.emptyIconContainer}>
      <MaterialCommunityIcons
        name="wallet-outline"
        size={64}
        color={colors.gray}
      />
    </View>
    <Text style={styles.emptyTitle}>No expenses yet</Text>
    <Text style={styles.emptySubtitle}>
      Start tracking your travel spending to stay on budget
    </Text>
    <TouchableOpacity style={styles.emptyCTA} onPress={onAddPress}>
      <MaterialCommunityIcons name="plus" size={20} color="#FFF" />
      <Text style={styles.emptyCTAText}>Add Your First Expense</Text>
    </TouchableOpacity>
  </View>
));

EmptyState.displayName = "EmptyState";

// ─────────────────────────────────────────────────────────────
// CUSTOM HOOK
// ─────────────────────────────────────────────────────────────

function useExpenseTracker() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [summary, setSummary] = useState<ExpenseSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [budget, setBudget] = useState(TRIP_BUDGET_DEFAULT);
  const [modalVisible, setModalVisible] = useState(false);
  const [adding, setAdding] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  // Grouped expenses for FlatList
  const groupedExpenses = useMemo(
    () => groupExpensesByDate(expenses),
    [expenses],
  );

  // FlatList data with section headers
  const listData = useMemo(() => {
    const result: Array<
      | { type: "header"; label: string; total: number }
      | { type: "expense"; item: Expense }
    > = [];
    groupedExpenses.forEach((group) => {
      const total = group.data.reduce((sum, e) => sum + e.amount, 0);
      result.push({ type: "header", label: group.label, total });
      group.data.forEach((item) => result.push({ type: "expense", item }));
    });
    return result;
  }, [groupedExpenses]);

  // Load data
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [expRes, sumRes] = await Promise.all([
        expenseService.listExpenses(),
        expenseService.getSummary(),
      ]);
      setExpenses(expRes.expenses || []);
      setSummary(sumRes);
    } catch (e: any) {
      setError(e.message || "Failed to load expenses");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Add expense
  const addExpense = useCallback(
    async (data: {
      destination: string;
      category: string;
      description: string;
      amount: number;
    }) => {
      setAdding(true);
      try {
        await expenseService.addExpense(data);
        triggerHaptic("heavy");
        setModalVisible(false);
        await load();
      } catch (e: any) {
        Alert.alert("Error", e.message || "Failed to add expense");
      } finally {
        setAdding(false);
      }
    },
    [load],
  );

  // Delete expense
  const deleteExpense = useCallback(
    async (id: number) => {
      try {
        await expenseService.deleteExpense(id);
        triggerHaptic("heavy");
        await load();
      } catch (e: any) {
        Alert.alert("Error", e.message || "Failed to delete expense");
      }
    },
    [load],
  );

  // Edit budget - simple prompt for iOS, Alert for Android
  const editBudget = useCallback(() => {
    if (Platform.OS === "ios") {
      Alert.prompt(
        "Set Trip Budget",
        "Enter your total trip budget",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Save",
            onPress: (value?: string) => {
              const num = parseInt(value || "0", 10);
              if (num > 0) setBudget(num);
            },
          },
        ],
        "plain-text",
        String(budget),
      );
    } else {
      // For Android, use a simple alert with default budget options
      Alert.alert(
        "Set Trip Budget",
        `Current budget: ${formatCurrency(budget)}`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "₹25,000", onPress: () => setBudget(25000) },
          { text: "₹50,000", onPress: () => setBudget(50000) },
          { text: "₹1,00,000", onPress: () => setBudget(100000) },
        ],
      );
    }
  }, [budget]);

  return {
    expenses,
    summary,
    loading,
    error,
    budget,
    modalVisible,
    setModalVisible,
    adding,
    addExpense,
    deleteExpense,
    editBudget,
    listData,
    activeFilter,
    setActiveFilter,
    retry: load,
  };
}

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────

export default function ExpenseTrackerScreen() {
  const {
    expenses,
    summary,
    loading,
    error,
    budget,
    modalVisible,
    setModalVisible,
    adding,
    addExpense,
    deleteExpense,
    editBudget,
    listData,
    retry,
  } = useExpenseTracker();

  const renderItem = useCallback(
    ({ item }: { item: any }) => {
      if (item.type === "header") {
        return <DateSectionHeader label={item.label} total={item.total} />;
      }
      return (
        <ExpenseCard
          expense={item.item}
          onDelete={() => deleteExpense(item.item.id)}
        />
      );
    },
    [deleteExpense],
  );

  const keyExtractor = useCallback(
    (item: any, index: number) =>
      item.type === "header"
        ? `header-${item.label}`
        : `expense-${item.item.id}`,
    [],
  );

  const getItemType = useCallback((item: any) => item.type, []);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Travel Expenses</Text>
          <Text style={styles.subtitle}>
            Smart expense tracking for your journey
          </Text>
        </View>
        <TouchableOpacity
          style={styles.addFab}
          onPress={() => {
            triggerHaptic("medium");
            setModalVisible(true);
          }}
        >
          <MaterialCommunityIcons name="plus" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <MaterialCommunityIcons
            name="alert-circle"
            size={18}
            color="#EF4444"
          />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={retry}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Summary Card */}
      <SummaryCard
        summary={summary}
        budget={budget}
        onBudgetEdit={editBudget}
      />

      {/* Expense List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <MaterialCommunityIcons
            name="loading"
            size={32}
            color={colors.primary}
          />
          <Text style={styles.loadingText}>Loading expenses...</Text>
        </View>
      ) : expenses.length === 0 ? (
        <EmptyState onAddPress={() => setModalVisible(true)} />
      ) : (
        <FlatList
          data={listData}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          initialNumToRender={15}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={true}
        />
      )}

      {/* Add Expense Modal */}
      <AddExpenseModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSubmit={addExpense}
        loading={adding}
      />
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: spacing.md,
    paddingBottom: spacing.sm,
  },
  title: { fontSize: 26, fontWeight: "900", color: colors.text },
  subtitle: { fontSize: 13, color: colors.gray, marginTop: 2 },
  addFab: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  addFab: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      web: { boxShadow: "0px 4px 12px rgba(59, 130, 246, 0.28)" } as any,
      default: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
      },
    }),
  },

  // Error Banner
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: spacing.md,
    padding: 12,
    backgroundColor: "#FEF2F2",
    borderRadius: 12,
    gap: 8,
    marginBottom: spacing.sm,
  },
  errorText: { flex: 1, fontSize: 13, color: "#EF4444" },
  retryText: { fontSize: 13, fontWeight: "600", color: colors.primary },

  // Summary Card
  summaryCard: {
    backgroundColor: "#1E293B",
    borderRadius: 24,
    padding: spacing.lg,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  summaryHero: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  summaryLeft: { flex: 1 },
  summaryLabel: { fontSize: 13, color: "rgba(255,255,255,0.6)", marginTop: 4 },
  budgetBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  budgetText: {
    fontSize: 11,
    color: "rgba(255,255,255,0.8)",
    fontWeight: "500",
  },

  // Progress Ring
  progressRing: { alignItems: "center", justifyContent: "center" },
  progressRingInner: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  progressPercent: { fontSize: 24, fontWeight: "900", color: "#FFF" },
  progressLabel: {
    fontSize: 10,
    color: "rgba(255,255,255,0.5)",
    marginTop: -2,
  },

  // Category Bars
  categoryBars: { gap: 10 },
  categoryBarRow: {},
  categoryBarHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
    gap: 6,
  },
  categoryBarLabel: { fontSize: 11, color: "rgba(255,255,255,0.7)", flex: 1 },
  categoryBarAmount: { fontSize: 12, fontWeight: "700", color: "#FFF" },
  categoryBarTrack: {
    height: 4,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 2,
  },
  categoryBarFill: { height: "100%", borderRadius: 2 },

  // Insights
  insightsContainer: { marginTop: spacing.md, gap: 8 },
  insightCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  insightCardAlert: { backgroundColor: "rgba(239,68,68,0.15)" },
  insightCardWarning: { backgroundColor: "rgba(245,158,11,0.15)" },
  insightCardSuccess: { backgroundColor: "rgba(16,185,129,0.15)" },
  insightText: { flex: 1 },
  insightTitle: { fontSize: 12, fontWeight: "700", color: "#FFF" },
  insightMessage: {
    fontSize: 11,
    color: "rgba(255,255,255,0.6)",
    marginTop: 2,
  },

  // Expense Card
  expenseCard: { marginHorizontal: spacing.md, marginBottom: 8 },
  expenseCardInner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  expenseIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  expenseContent: { flex: 1 },
  expenseDesc: { fontSize: 15, fontWeight: "600", color: colors.text },
  expenseMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 3,
    gap: 4,
  },
  expenseDestination: { fontSize: 12, color: colors.gray },
  expenseDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.gray,
  },
  expenseCategory: { fontSize: 12, color: colors.gray },
  expenseRight: { alignItems: "flex-end" },
  expenseAmount: { fontSize: 16, fontWeight: "800", color: "#EF4444" },
  expenseTime: { fontSize: 10, color: colors.gray, marginTop: 2 },

  // Date Section Header
  dateSectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    backgroundColor: colors.background,
  },
  dateSectionLabel: { fontSize: 13, fontWeight: "700", color: colors.text },
  dateSectionTotal: { fontSize: 12, fontWeight: "600", color: colors.gray },

  // List
  listContent: { paddingBottom: 150 },

  // Loading
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xxl,
  },
  loadingText: { fontSize: 14, color: colors.gray, marginTop: 12 },

  // Empty State
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xxl,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.gray,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  emptyCTA: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 16,
  },
  emptyCTAText: { fontSize: 15, fontWeight: "700", color: "#FFF" },

  // Modal
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: spacing.lg,
    paddingBottom: 40,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.text,
    marginBottom: spacing.lg,
  },
  modalInput: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.gray,
    marginBottom: 8,
    marginTop: spacing.xs,
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: spacing.sm,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryChipText: { fontSize: 12, fontWeight: "600", color: colors.text },
  amountInputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  amountPrefix: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.primary,
    paddingLeft: 16,
  },
  amountInput: {
    flex: 1,
    padding: 14,
    fontSize: 28,
    fontWeight: "800",
    color: colors.text,
  },
  modalActions: { flexDirection: "row", gap: 12 },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalCancelText: { fontSize: 15, fontWeight: "600", color: colors.text },
  modalSubmitBtn: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#10B981",
  },
  modalSubmitBtnLoading: { opacity: 0.7 },
  modalSubmitText: { fontSize: 15, fontWeight: "700", color: "#FFF" },
});
