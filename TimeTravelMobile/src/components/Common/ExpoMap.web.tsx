import React from 'react';
import { View, Text } from 'react-native';

export const MapComponent = ({ children, style }: any) => (
  <View style={[{ backgroundColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' }, style]}>
    <Text style={{ fontSize: 18, color: '#64748B', fontWeight: '800' }}>🗺️ Native Map Preview (View on Mobile)</Text>
  </View>
);

export const MarkerComponent = () => null;
export const PolylineComponent = () => null;
export const MAP_PROVIDER = null;
