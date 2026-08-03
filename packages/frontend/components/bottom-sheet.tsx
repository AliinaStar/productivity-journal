import { ReactNode } from 'react';
import { Modal, Pressable, View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useResponsive } from '@/hooks/useResponsive';

// Shared shell for the app's modals (record entry, new goal, ...): dimmed
// backdrop that closes on tap, content that doesn't. On phones it's a
// bottom sheet that slides up; on tablets a centred dialog that fades in —
// a full-width sheet reads as awkward on a wide screen.
export function BottomSheet({
  visible,
  onClose,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const { isTablet } = useResponsive();

  if (isTablet) {
    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <KeyboardAvoidingView style={s.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={s.centerBackdrop} onPress={onClose}>
            <Pressable style={s.dialog} onPress={() => {}}>
              {children}
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={s.fill} behavior="padding">
        <Pressable style={s.backdrop} onPress={onClose}>
          <Pressable style={s.sheet} onPress={() => {}}>
            <View style={s.handle} />
            {children}
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(38,33,92,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#F8F7F3', borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 22, paddingTop: 8, paddingBottom: 22 },
  handle: { width: 38, height: 4, borderRadius: 3, backgroundColor: '#D9D6CE', alignSelf: 'center', marginBottom: 16 },

  centerBackdrop: { flex: 1, backgroundColor: 'rgba(38,33,92,0.42)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  dialog: { width: '100%', maxWidth: 460, backgroundColor: '#F8F7F3', borderRadius: 26, paddingHorizontal: 26, paddingTop: 24, paddingBottom: 26 },
});
