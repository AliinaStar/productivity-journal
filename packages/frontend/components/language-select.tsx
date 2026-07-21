import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, FlatList, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';

interface ModalProps {
  visible: boolean;
  value: string;
  options: readonly string[];
  onSelect: (value: string) => void;
  onClose: () => void;
}

/** The searchable picker sheet on its own, so callers can trigger it from any UI. */
export function LanguagePickerModal({ visible, value, options, onSelect, onClose }: ModalProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(o => o.toLowerCase().includes(q));
  }, [query, options]);

  function close() {
    setQuery('');
    onClose();
  }

  function select(option: string) {
    setQuery('');
    onSelect(option);
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
      <Pressable style={s.backdrop} onPress={close}>
        <Pressable style={s.sheet} onPress={() => {}}>
          <View style={s.handle} />
          <TextInput
            style={s.search}
            placeholder={t('languageSelect.searchPlaceholder')}
            placeholderTextColor="#B4B2A9"
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            autoFocus
          />
          <FlatList
            data={filtered}
            keyExtractor={item => item}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<Text style={s.empty}>{t('languageSelect.empty')}</Text>}
            renderItem={({ item }) => {
              const selected = item === value;
              return (
                <TouchableOpacity style={s.row} onPress={() => select(item)} activeOpacity={0.7}>
                  <Text style={[s.rowText, selected && s.rowTextSelected]}>{item}</Text>
                  {selected && <Text style={s.check}>✓</Text>}
                </TouchableOpacity>
              );
            }}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

interface Props {
  /** Currently selected value (one of the provided options). */
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}

/** A searchable dropdown field for picking one value from a long list. */
export function LanguageSelect({ value, options, onChange }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <TouchableOpacity style={s.field} onPress={() => setOpen(true)} activeOpacity={0.7}>
        <Text style={s.fieldText}>{value}</Text>
        <Text style={s.chevron}>▾</Text>
      </TouchableOpacity>

      <LanguagePickerModal
        visible={open}
        value={value}
        options={options}
        onSelect={v => { onChange(v); setOpen(false); }}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

const s = StyleSheet.create({
  field: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, marginBottom: 24, borderWidth: 1.5, borderColor: '#E5E4DF' },
  fieldText: { fontSize: 15, color: '#2C2C2A', fontWeight: '500' },
  chevron: { fontSize: 14, color: '#888780' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#F5F4F0', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 20, maxHeight: '75%' },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#DEDBD5', marginBottom: 12 },
  search: { backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#2C2C2A', marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E4DF' },
  rowText: { fontSize: 15, color: '#2C2C2A' },
  rowTextSelected: { color: '#7F77DD', fontWeight: '600' },
  check: { fontSize: 16, color: '#7F77DD', fontWeight: '700' },
  empty: { textAlign: 'center', color: '#B4B2A9', fontSize: 14, paddingVertical: 30 },
});
