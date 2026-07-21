import { View, StyleSheet } from 'react-native';

export type NavShape = 'home' | 'bars' | 'person';

// Icons drawn purely from Views (borders + background), so they render in any
// environment without depending on an icon font or emoji support — both of
// which failed to render on the target device.
export function NavIcon({ shape, color }: { shape: NavShape; color: string }) {
  if (shape === 'bars') {
    return (
      <View style={s.barsRow}>
        <View style={[s.bar, { height: 8, backgroundColor: color }]} />
        <View style={[s.bar, { height: 14, backgroundColor: color }]} />
        <View style={[s.bar, { height: 20, backgroundColor: color }]} />
      </View>
    );
  }
  if (shape === 'person') {
    return (
      <View style={s.box}>
        <View style={[s.head, { backgroundColor: color }]} />
        <View style={[s.body, { backgroundColor: color }]} />
      </View>
    );
  }
  return (
    <View style={s.box}>
      <View style={[s.roof, { borderBottomColor: color }]} />
      <View style={[s.house, { backgroundColor: color }]} />
    </View>
  );
}

const s = StyleSheet.create({
  box: { width: 24, height: 22, alignItems: 'center', justifyContent: 'center' },

  barsRow: { width: 24, height: 22, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 3 },
  bar: { width: 4, borderRadius: 2 },

  head: { width: 8, height: 8, borderRadius: 4 },
  body: { width: 15, height: 9, borderTopLeftRadius: 8, borderTopRightRadius: 8, marginTop: 2 },

  roof: {
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderBottomWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  house: { width: 13, height: 10, borderBottomLeftRadius: 2, borderBottomRightRadius: 2 },
});
