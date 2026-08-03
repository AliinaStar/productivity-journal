import { ReactNode } from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';

// Constrains content to a comfortable reading width and centres it, so screens
// don't stretch edge-to-edge on tablets. On phones this is a no-op: maxWidth is
// wider than any phone, so the phone layout is byte-for-byte unchanged.
export function Bounded({
  maxWidth = 820,
  style,
  children,
}: {
  maxWidth?: number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  return <View style={[s.bounded, { maxWidth }, style]}>{children}</View>;
}

const s = StyleSheet.create({
  bounded: { flex: 1, width: '100%', alignSelf: 'center' },
});
