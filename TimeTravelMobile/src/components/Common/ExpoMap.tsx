import React from "react";
import { Platform } from "react-native";
import MapView, {
  Marker,
  Polyline,
  PROVIDER_DEFAULT,
  PROVIDER_GOOGLE,
} from "react-native-maps";

export const MapComponent = MapView;
export const MarkerComponent = Marker;
export const PolylineComponent = Polyline;
export const MAP_PROVIDER =
  Platform.OS === "android" ? PROVIDER_GOOGLE : PROVIDER_DEFAULT;
