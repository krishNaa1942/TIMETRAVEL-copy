/**
 * RootNavigator
 * Shows Auth screen if not logged in, MainTabs if logged in.
 * Includes all stack screens for detailed views.
 */

import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuthStore } from "@/stores/authStore";
import { RootStackParamList } from "@/types";

import AuthScreen from "@/screens/AuthScreen";
import BottomTabNavigator from "./BottomTabNavigator";
import DestinationDetailScreen from "@/screens/DestinationDetailScreen";
import BudgetScreen from "@/screens/BudgetScreen";
import ItineraryScreen from "@/screens/ItineraryScreen";
import PackingScreen from "@/screens/PackingScreen";
import FavoritesScreen from "@/screens/FavoritesScreen";
import CurrencyScreen from "@/screens/CurrencyScreen";
import CompareScreen from "@/screens/CompareScreen";
import PlacesScreen from "@/screens/PlacesScreen";
import RoutePlannerScreen from "@/screens/RoutePlannerScreen";
import TripWorkspaceScreen from "@/screens/TripWorkspaceScreen";
import ExpenseTrackerScreen from "@/screens/ExpenseTrackerScreen";
import TravelJournalScreen from "@/screens/TravelJournalScreen";
import ReservationsScreen from "@/screens/ReservationsScreen";
import TripSharingScreen from "@/screens/TripSharingScreen";
import NewsFeedScreen from "@/screens/NewsFeedScreen";
import TravelStatsScreen from "@/screens/TravelStatsScreen";
import PhrasebookScreen from "@/screens/PhrasebookScreen";

const Stack = createNativeStackNavigator<RootStackParamList>();

const darkHeader = {
  headerShown: true as const,
  headerTintColor: "#fff",
  headerStyle: { backgroundColor: "#0F172A" },
};

export default function RootNavigator() {
  const { token } = useAuthStore();

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {token ? (
        <>
          <Stack.Screen name="MainTabs" component={BottomTabNavigator} />
          <Stack.Screen
            name="DestinationDetail"
            component={DestinationDetailScreen}
            options={{
              headerShown: true,
              headerTitle: "",
              headerTransparent: true,
              headerTintColor: "#fff",
            }}
          />
          <Stack.Screen name="Budget" component={BudgetScreen}
            options={{ ...darkHeader, headerTitle: "💰 Trip Budget" }} />
          <Stack.Screen name="Itinerary" component={ItineraryScreen}
            options={{ ...darkHeader, headerTitle: "📋 AI Itinerary" }} />
          <Stack.Screen name="Packing" component={PackingScreen}
            options={{ ...darkHeader, headerTitle: "🧳 Packing List" }} />
          <Stack.Screen name="Favorites" component={FavoritesScreen}
            options={{ ...darkHeader, headerTitle: "❤️ Wishlist" }} />
          <Stack.Screen name="Currency" component={CurrencyScreen}
            options={{ ...darkHeader, headerTitle: "💱 Currency" }} />
          <Stack.Screen name="Compare" component={CompareScreen}
            options={{ ...darkHeader, headerTitle: "⚖️ Compare" }} />
          <Stack.Screen name="Places" component={PlacesScreen}
            options={{ ...darkHeader, headerTitle: "📍 Discover" }} />
          <Stack.Screen name="RoutePlanner" component={RoutePlannerScreen}
            options={{ ...darkHeader, headerTitle: "🗺️ Route Planner" }} />
          {/* Phase 1 */}
          <Stack.Screen name="TripWorkspace" component={TripWorkspaceScreen}
            options={{ ...darkHeader, headerTitle: "🗂️ Trip Workspace" }} />
          <Stack.Screen name="Expenses" component={ExpenseTrackerScreen}
            options={{ ...darkHeader, headerTitle: "💰 Expenses" }} />
          <Stack.Screen name="TravelJournal" component={TravelJournalScreen}
            options={{ ...darkHeader, headerTitle: "📔 Journal" }} />
          {/* Phase 2 */}
          <Stack.Screen name="Reservations" component={ReservationsScreen}
            options={{ ...darkHeader, headerTitle: "🎫 Reservations" }} />
          <Stack.Screen name="TripSharing" component={TripSharingScreen}
            options={{ ...darkHeader, headerTitle: "🔗 Share Trip" }} />
          <Stack.Screen name="NewsFeed" component={NewsFeedScreen}
            options={{ ...darkHeader, headerTitle: "📰 News" }} />
          <Stack.Screen name="TravelStats" component={TravelStatsScreen}
            options={{ ...darkHeader, headerTitle: "📊 My Stats" }} />
          {/* Phase 3 */}
          <Stack.Screen name="Phrasebook" component={PhrasebookScreen}
            options={{ ...darkHeader, headerTitle: "🗣️ Phrasebook" }} />
        </>
      ) : (
        <Stack.Screen name="Auth" component={AuthScreen} />
      )}
    </Stack.Navigator>
  );
}
