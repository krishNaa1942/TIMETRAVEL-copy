import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import TripsScreen from "@/screens/TripsScreen";

const Stack = createNativeStackNavigator();

export default function TripStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="TripsMain" component={TripsScreen} />
    </Stack.Navigator>
  );
}
