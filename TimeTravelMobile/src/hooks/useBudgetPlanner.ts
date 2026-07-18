/**
 * useBudgetPlanner Hook
 * Manages budget calculation state, validation, persistence, and API calls.
 */

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { InteractionManager } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNetInfo } from "@react-native-community/netinfo";

import { ApiError } from "@/services/api";
import { budgetService } from "@/services/budget";
import { destinationsService } from "@/services/destinations";
import { BudgetEstimate, Destination } from "@/types";
import { useDebouncedCallback } from "@/hooks/useDebounce";

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export type TravelClass = "economy" | "comfort" | "premium";

export interface BudgetFormData {
  destination: string;
  days: string;
  familySize: string;
  travelClass: TravelClass;
}

export interface FieldErrors {
  destination?: string;
  days?: string;
  familySize?: string;
}

interface UseBudgetPlannerProps {
  preselectedDestination?: string;
}

interface UseBudgetPlannerReturn {
  // Form State
  formData: BudgetFormData;
  setFormData: React.Dispatch<React.SetStateAction<BudgetFormData>>;
  updateField: <K extends keyof BudgetFormData>(
    field: K,
    value: BudgetFormData[K],
  ) => void;

  // Validation
  fieldErrors: FieldErrors;
  validateForm: () => boolean;

  // Destinations
  destinations: Destination[];
  isLoadingDestinations: boolean;
  destinationError: string | null;
  retryDestinations: () => Promise<void>;

  // Budget Calculation
  estimate: BudgetEstimate | null;
  isCalculating: boolean;
  calculationError: string | null;
  calculateBudget: () => Promise<BudgetEstimate | null>;
  clearEstimate: () => void;

  // Insights
  insights: BudgetInsights | null;

  // State
  isRestoring: boolean;
  isOffline: boolean;

  // Reset
  reset: () => void;
}

export interface BudgetInsights {
  mostExpensiveCategory: string;
  mostExpensiveAmount: number;
  cheapestCategory: string;
  cheapestAmount: number;
  dailyAverage: number;
  perPersonCost: number;
  tips: string[];
}

// ─────────────────────────────────────────────────────────────
// VALIDATION
// ─────────────────────────────────────────────────────────────

const CACHE_KEY = "@budget_planner_state_v1";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface BudgetPlannerSnapshot {
  version: 1;
  savedAt: number;
  formData: BudgetFormData;
  estimate: BudgetEstimate | null;
  insights: BudgetInsights | null;
}

const sanitizeNumericInput = (value: string): string =>
  value.replace(/[^0-9]/g, "");

const normalizeText = (value: string): string => value.trim().toLowerCase();

const areFormsEqual = (left: BudgetFormData, right: BudgetFormData): boolean =>
  left.destination === right.destination &&
  left.days === right.days &&
  left.familySize === right.familySize &&
  left.travelClass === right.travelClass;

const buildInsights = (
  estimate: BudgetEstimate | null,
): BudgetInsights | null => {
  if (!estimate) {
    return null;
  }

  const categories = [
    { name: "Accommodation", amount: estimate.accommodation },
    { name: "Food & Dining", amount: estimate.food },
    { name: "Transport", amount: estimate.transport },
    { name: "Activities", amount: estimate.activities },
    { name: "Miscellaneous", amount: estimate.miscellaneous },
  ];

  const sorted = [...categories].sort((a, b) => b.amount - a.amount);
  const mostExpensive = sorted[0];
  const cheapest = sorted[sorted.length - 1];

  const tips: string[] = [];

  if (mostExpensive.name === "Accommodation") {
    tips.push("Consider booking in advance for better rates");
    tips.push("Look for homestays or guesthouses to save up to 40%");
  }
  if (mostExpensive.name === "Transport") {
    tips.push("Book flights early and use local transport");
    tips.push("Consider off-season travel for better deals");
  }
  if (mostExpensive.name === "Food & Dining") {
    tips.push("Try local eateries instead of tourist restaurants");
    tips.push("Street food can save you 60% on meals");
  }
  if (estimate.family_size > 2) {
    tips.push("Group discounts available for activities");
  }
  if (estimate.num_days > 7) {
    tips.push("Weekly stay discounts may be available");
  }

  return {
    mostExpensiveCategory: mostExpensive.name,
    mostExpensiveAmount: mostExpensive.amount,
    cheapestCategory: cheapest.name,
    cheapestAmount: cheapest.amount,
    dailyAverage: Math.round(estimate.total / Math.max(estimate.num_days, 1)),
    perPersonCost: Math.round(
      estimate.total / Math.max(estimate.family_size, 1),
    ),
    tips,
  };
};

const getFieldError = <K extends keyof BudgetFormData>(
  field: K,
  value: BudgetFormData[K],
): string | undefined => {
  switch (field) {
    case "days":
      return validateDays(value as string);
    case "familySize":
      return validateFamilySize(value as string);
    case "destination":
      return validateDestination(value as string);
    default:
      return undefined;
  }
};

const getFriendlyErrorMessage = (
  error: unknown,
  isOffline: boolean,
): string => {
  if (isOffline) {
    return "You appear to be offline. Reconnect to calculate a fresh budget or restore the last saved estimate.";
  }

  if (error instanceof ApiError) {
    return error.message || "Failed to calculate budget";
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Failed to calculate budget";
};

const validateDays = (value: string): string | undefined => {
  const num = parseInt(value, 10);
  if (isNaN(num) || value.trim() === "") return "Enter number of days";
  if (num <= 0) return "Days must be at least 1";
  if (num > 365) return "Maximum 365 days allowed";
  return undefined;
};

const validateFamilySize = (value: string): string | undefined => {
  const num = parseInt(value, 10);
  if (isNaN(num) || value.trim() === "") return "Enter group size";
  if (num <= 0) return "Group size must be at least 1";
  if (num > 50) return "Maximum 50 people allowed";
  return undefined;
};

const validateDestination = (value: string): string | undefined => {
  if (!value || value.trim() === "") return "Select a destination";
  return undefined;
};

// ─────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────

export function useBudgetPlanner({
  preselectedDestination,
}: UseBudgetPlannerProps = {}): UseBudgetPlannerReturn {
  // Form State
  const [formData, setFormData] = useState<BudgetFormData>({
    destination: preselectedDestination || "",
    days: "3",
    familySize: "2",
    travelClass: "economy",
  });

  // Destinations State
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [isLoadingDestinations, setIsLoadingDestinations] = useState(
    !preselectedDestination,
  );

  // Calculation State
  const [estimate, setEstimate] = useState<BudgetEstimate | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [calculationError, setCalculationError] = useState<string | null>(null);
  const [destinationError, setDestinationError] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);

  // Field Errors
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const persistedSnapshotRef = useRef<BudgetPlannerSnapshot | null>(null);

  const netInfo = useNetInfo();
  const isOffline =
    netInfo.isConnected === false || netInfo.isInternetReachable === false;

  const persistSnapshot = useDebouncedCallback(
    async (snapshot: BudgetPlannerSnapshot) => {
      try {
        persistedSnapshotRef.current = snapshot;
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(snapshot));
      } catch (error) {
        console.warn("[BudgetPlanner] Failed to persist state:", error);
      }
    },
    250,
  );

  const hydratePersistedState = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEY);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw) as Partial<BudgetPlannerSnapshot>;
      if (
        parsed.version !== 1 ||
        typeof parsed.savedAt !== "number" ||
        Date.now() - parsed.savedAt > CACHE_TTL_MS ||
        !parsed.formData
      ) {
        return;
      }

      const restoredForm: BudgetFormData = {
        destination:
          preselectedDestination || parsed.formData.destination || "",
        days: parsed.formData.days || "3",
        familySize: parsed.formData.familySize || "2",
        travelClass: parsed.formData.travelClass || "economy",
      };

      persistedSnapshotRef.current = {
        version: 1,
        savedAt: parsed.savedAt,
        formData: restoredForm,
        estimate: parsed.estimate ?? null,
        insights: parsed.insights ?? null,
      };

      setFormData(restoredForm);

      const canRestoreEstimate =
        parsed.estimate &&
        (!preselectedDestination ||
          normalizeText(parsed.formData.destination) ===
            normalizeText(preselectedDestination));

      if (canRestoreEstimate) {
        setEstimate(parsed.estimate ?? null);
      }

      if (parsed.estimate) {
        setCalculationError(null);
      }
    } catch (error) {
      console.warn("[BudgetPlanner] Failed to restore cached state:", error);
    }
  }, [preselectedDestination]);

  // Load destinations if not preselected
  const loadDestinations = useCallback(async () => {
    try {
      setDestinationError(null);
      setIsLoadingDestinations(true);
      const data = await destinationsService.getDestinations();
      setDestinations(data);
    } catch (error) {
      console.error("Failed to load destinations:", error);
      setDestinationError(
        error instanceof Error && error.message.trim()
          ? error.message
          : "Unable to load destinations right now.",
      );
    } finally {
      setIsLoadingDestinations(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    const initialize = async () => {
      await hydratePersistedState();

      if (active && !preselectedDestination) {
        await loadDestinations();
      } else if (active && preselectedDestination) {
        setIsLoadingDestinations(false);
      }

      if (active) {
        setIsRestoring(false);
      }
    };

    void initialize();

    return () => {
      active = false;
    };
  }, [hydratePersistedState, loadDestinations, preselectedDestination]);

  useEffect(() => {
    if (isRestoring) {
      return;
    }

    const snapshot: BudgetPlannerSnapshot = {
      version: 1,
      savedAt: Date.now(),
      formData,
      estimate,
      insights: buildInsights(estimate),
    };

    void persistSnapshot(snapshot);

    return persistSnapshot.cancel;
  }, [estimate, formData, isRestoring, persistSnapshot]);

  // Update single field
  const updateField = useCallback(
    <K extends keyof BudgetFormData>(field: K, value: BudgetFormData[K]) => {
      const nextValue =
        field === "days" || field === "familySize"
          ? (sanitizeNumericInput(String(value)) as BudgetFormData[K])
          : value;

      setFormData((prev) => ({ ...prev, [field]: nextValue }));
      setTouched((prev) => new Set(prev).add(field));

      // Validate field on change
      setFieldErrors((prev) => ({
        ...prev,
        [field]: getFieldError(field, nextValue),
      }));
    },
    [],
  );

  // Validate entire form
  const validateForm = useCallback((): boolean => {
    const errors: FieldErrors = {
      destination: validateDestination(formData.destination),
      days: validateDays(formData.days),
      familySize: validateFamilySize(formData.familySize),
    };

    setFieldErrors(errors);

    // Mark all as touched
    setTouched(new Set(["destination", "days", "familySize"]));

    return !errors.destination && !errors.days && !errors.familySize;
  }, [formData]);

  const restoreCachedEstimate = useCallback((): BudgetEstimate | null => {
    const snapshot = persistedSnapshotRef.current;

    if (!snapshot?.estimate || !areFormsEqual(snapshot.formData, formData)) {
      return null;
    }

    setEstimate(snapshot.estimate);
    setCalculationError(null);
    return snapshot.estimate;
  }, [formData]);

  // Calculate budget
  const calculateBudget =
    useCallback(async (): Promise<BudgetEstimate | null> => {
      if (!validateForm()) {
        return null;
      }

      if (isOffline) {
        const cached = restoreCachedEstimate();
        if (cached) {
          return cached;
        }

        setCalculationError(
          "You're offline. Reconnect to calculate a fresh budget or restore a saved estimate.",
        );
        return null;
      }

      setIsCalculating(true);
      setCalculationError(null);
      setEstimate(null);

      try {
        await new Promise<void>((resolve) => {
          InteractionManager.runAfterInteractions(() => resolve());
        });

        const result = await budgetService.getEstimate(
          formData.destination,
          parseInt(formData.days, 10),
          parseInt(formData.familySize, 10),
          formData.travelClass,
        );
        setEstimate(result);
        persistedSnapshotRef.current = {
          version: 1,
          savedAt: Date.now(),
          formData,
          estimate: result,
          insights: buildInsights(result),
        };
        return result;
      } catch (error) {
        const message = getFriendlyErrorMessage(error, isOffline);
        setCalculationError(message);
        return null;
      } finally {
        setIsCalculating(false);
      }
    }, [formData, isOffline, restoreCachedEstimate, validateForm]);

  // Clear estimate
  const clearEstimate = useCallback(() => {
    setEstimate(null);
    setCalculationError(null);
  }, []);

  // Reset form
  const reset = useCallback(() => {
    setFormData({
      destination: preselectedDestination || "",
      days: "3",
      familySize: "2",
      travelClass: "economy",
    });
    setFieldErrors({});
    setTouched(new Set());
    setEstimate(null);
    setCalculationError(null);
    setDestinationError(null);
  }, [preselectedDestination]);

  // Calculate insights from estimate
  const insights = useMemo(() => buildInsights(estimate), [estimate]);

  return {
    formData,
    setFormData,
    updateField,
    fieldErrors,
    validateForm,
    destinations,
    isLoadingDestinations,
    destinationError,
    retryDestinations: loadDestinations,
    estimate,
    isCalculating,
    calculationError,
    calculateBudget,
    clearEstimate,
    insights,
    isRestoring,
    isOffline,
    reset,
  };
}

export default useBudgetPlanner;
