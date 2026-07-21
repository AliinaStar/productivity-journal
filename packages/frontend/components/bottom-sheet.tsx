import { ReactNode } from 'react';
import { Modal, Pressable, View, StyleSheet } from 'react-native';

// Shared shell for the app's bottom-sheet modals (record entry, new goal, ...):
// dimmed backdrop that closes on tap, sheet content that doesn't.
export function BottomSheet({
  visible,
  onClose,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={s.sheet} onPress={() => {}}>
          <View style={s.handle} />
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(38,33,92,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#F8F7F3', borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 22, paddingTop: 8, paddingBottom: 22 },
  handle: { width: 38, height: 4, borderRadius: 3, backgroundColor: '#D9D6CE', alignSelf: 'center', marginBottom: 16 },
});
