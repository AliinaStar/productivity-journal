import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { NavIcon, NavShape } from './nav-icon';

export const NAV_RAIL_WIDTH = 92;

interface RailItem {
  href: '/' | '/summaryList' | '/profile';
  label: string;
  shape: NavShape;
}

// Vertical navigation rail shown on tablets in place of the bottom tab bar.
// Navigation goes through expo-router (not the tab navigator) so the rail is
// decoupled from React Navigation internals — it just reads the active route
// from usePathname() and navigates by href.
export function NavRail() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();

  const items: RailItem[] = [
    { href: '/', label: t('tabs.today'), shape: 'home' },
    { href: '/summaryList', label: t('tabs.overview'), shape: 'bars' },
    { href: '/profile', label: t('tabs.profile'), shape: 'person' },
  ];

  return (
    <View style={[s.rail, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 16 }]}>
      <View style={s.logo}>
        <Text style={s.logoText}>L</Text>
      </View>
      <View style={s.items}>
        {items.map(item => {
          const active = pathname === item.href;
          const color = active ? '#7F77DD' : '#B4B2A9';
          return (
            <Pressable
              key={item.href}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={[s.item, active && s.itemActive]}
              onPress={() => { if (!active) router.navigate(item.href); }}
            >
              <NavIcon shape={item.shape} color={color} />
              <Text style={[s.itemLabel, { color }]} numberOfLines={1}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  rail: { width: NAV_RAIL_WIDTH, backgroundColor: '#fff', borderRightWidth: 1, borderRightColor: '#EFEDE7', alignItems: 'center' },
  logo: { width: 46, height: 46, borderRadius: 14, backgroundColor: '#534AB7', alignItems: 'center', justifyContent: 'center' },
  logoText: { color: '#fff', fontSize: 22, fontWeight: '800' },
  items: { marginTop: 34, gap: 12 },
  item: { width: 64, paddingVertical: 10, borderRadius: 18, alignItems: 'center', justifyContent: 'center', gap: 5 },
  itemActive: { backgroundColor: '#EEEDFE' },
  itemLabel: { fontSize: 9.5, fontWeight: '700' },
});
