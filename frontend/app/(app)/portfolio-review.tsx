import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '@/context/AuthContext';
import { colors, typography, spacing, radius } from '@/constants/theme';
import { batchCreateItems } from '@/services/portfolio';
import { getExtractedItems, clearExtractedItems } from '@/services/extraction-state';
import { type ExtractedItem } from '@/types/portfolio';

const ITEM_TYPES = ['PROJECT', 'CERTIFICATION', 'PUBLICATION', 'AWARD', 'OTHER'];

function EditItemModal({
  visible,
  item,
  onClose,
  onSave,
}: {
  visible: boolean;
  item: ExtractedItem | null;
  onClose: () => void;
  onSave: (title: string, description: string, url: string, itemType: string) => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [itemType, setItemType] = useState('PROJECT');

  function handleOpen() {
    if (item) {
      setTitle(item.title);
      setDescription(item.description ?? '');
      setUrl(item.externalUrl ?? '');
      setItemType(item.itemType);
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      onShow={handleOpen}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit Item</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.onSurface} />
            </TouchableOpacity>
          </View>

          <Text style={styles.fieldLabel}>Type</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeRow}>
            {ITEM_TYPES.map(t => (
              <TouchableOpacity
                key={t}
                style={[styles.typeChip, itemType === t && styles.typeChipActive]}
                onPress={() => setItemType(t)}
              >
                <Text style={[styles.typeChipText, itemType === t && styles.typeChipTextActive]}>
                  {t}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.fieldLabel}>Title *</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Item title"
            placeholderTextColor={colors.outline}
          />

          <Text style={styles.fieldLabel}>Description</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            value={description}
            onChangeText={setDescription}
            placeholder="Brief description"
            placeholderTextColor={colors.outline}
            multiline
            numberOfLines={3}
          />

          <Text style={styles.fieldLabel}>External URL</Text>
          <TextInput
            style={styles.input}
            value={url}
            onChangeText={setUrl}
            placeholder="https://..."
            placeholderTextColor={colors.outline}
            autoCapitalize="none"
            keyboardType="url"
          />

          <TouchableOpacity
            style={styles.saveButton}
            onPress={() => {
              if (!title.trim()) {
                Alert.alert('Validation', 'Title is required.');
                return;
              }
              onSave(title.trim(), description.trim(), url.trim(), itemType);
            }}
          >
            <Text style={styles.saveButtonText}>Save Changes</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function ReviewItemCard({
  item,
  checked,
  onToggle,
  onEdit,
}: {
  item: ExtractedItem;
  checked: boolean;
  onToggle: () => void;
  onEdit: () => void;
}) {
  const lowConfidence = item.confidence < 0.7;

  return (
    <View style={[styles.card, !checked && styles.cardUnchecked]}>
      <View style={styles.cardHeader}>
        <TouchableOpacity onPress={onToggle} style={styles.checkbox}>
          <Ionicons
            name={checked ? 'checkbox' : 'square-outline'}
            size={22}
            color={checked ? colors.secondary : colors.outline}
          />
        </TouchableOpacity>
        <View style={styles.cardBody}>
          <View style={styles.cardMeta}>
            <Text style={styles.cardType}>{item.itemType}</Text>
            {lowConfidence && (
              <View style={styles.confidenceBadge}>
                <Ionicons name="alert-circle-outline" size={12} color="#D97706" />
                <Text style={styles.confidenceText}>Review</Text>
              </View>
            )}
          </View>
          <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
          {item.description ? (
            <Text style={styles.cardDescription} numberOfLines={2}>{item.description}</Text>
          ) : null}
          {item.externalUrl ? (
            <Text style={styles.cardUrl} numberOfLines={1}>{item.externalUrl}</Text>
          ) : null}
        </View>
        <TouchableOpacity onPress={onEdit} style={styles.editButton}>
          <Ionicons name="create-outline" size={18} color={colors.secondary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function PortfolioReviewScreen() {
  const { state } = useAuth();
  const [items, setItems] = useState<ExtractedItem[]>(getExtractedItems());
  const [checkedIndices, setCheckedIndices] = useState<Set<number>>(
    new Set(getExtractedItems().map((_, i) => i))
  );
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const selectedCount = checkedIndices.size;

  function handleToggle(index: number) {
    setCheckedIndices(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function handleEditSave(title: string, description: string, url: string, itemType: string) {
    if (editingIndex !== null) {
      setItems(prev => prev.map((item, i) =>
        i === editingIndex
          ? { ...item, title, description: description || null, externalUrl: url || null, itemType }
          : item
      ));
      setEditingIndex(null);
    }
  }

  async function handleBatchSave() {
    if (!state.accessToken) return;
    const selectedItems = items.filter((_, i) => checkedIndices.has(i));
    if (selectedItems.length === 0) {
      Alert.alert('No items', 'Select at least one item to add.');
      return;
    }
    setSaving(true);
    try {
      await batchCreateItems(state.accessToken, {
        items: selectedItems.map(item => ({
          itemType: item.itemType,
          title: item.title,
          description: item.description ?? undefined,
          externalUrl: item.externalUrl ?? undefined,
        })),
      });
      clearExtractedItems();
      router.replace('/(app)/portfolio');
    } catch {
      Alert.alert('Error', 'Failed to save items. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={22} color={colors.onSurface} />
          </TouchableOpacity>
          <Text style={styles.title}>Review Items</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={styles.empty}>
          <Ionicons name="documents-outline" size={48} color={colors.outline} />
          <Text style={styles.emptyTitle}>No items found</Text>
          <Text style={styles.emptySubtitle}>
            We couldn't extract any portfolio items. Try adding them manually.
          </Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => router.replace('/(app)/portfolio')}
          >
            <Text style={styles.emptyButtonText}>Back to Portfolio</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.title}>Review Items</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        <Text style={styles.subtitle}>
          {items.length} item{items.length === 1 ? '' : 's'} extracted · {selectedCount} selected
        </Text>
        {items.map((item, index) => (
          <ReviewItemCard
            key={index}
            item={item}
            checked={checkedIndices.has(index)}
            onToggle={() => handleToggle(index)}
            onEdit={() => setEditingIndex(index)}
          />
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveFab, saving && styles.saveFabDisabled]}
          onPress={handleBatchSave}
          disabled={saving || selectedCount === 0}
        >
          {saving ? (
            <ActivityIndicator size="small" color={colors.onPrimary} />
          ) : (
            <>
              <Ionicons name="add-circle-outline" size={20} color={colors.onPrimary} />
              <Text style={styles.saveFabText}>
                Add {selectedCount} item{selectedCount === 1 ? '' : 's'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <EditItemModal
        visible={editingIndex !== null}
        item={editingIndex !== null ? items[editingIndex] : null}
        onClose={() => setEditingIndex(null)}
        onSave={handleEditSave}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md ?? 16,
    paddingVertical: spacing.md ?? 16,
    backgroundColor: colors.surfaceCard,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  backButton: { padding: 4 },
  title: { ...typography.headlineMd, color: colors.onSurface },
  subtitle: {
    ...typography.bodyMd,
    color: colors.onSurfaceVariant,
    marginBottom: spacing.md ?? 16,
  },
  list: { padding: spacing.md ?? 16, gap: spacing.sm ?? 8 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm ?? 8, padding: spacing.xl ?? 48 },
  emptyTitle: { ...typography.headlineSm, color: colors.onSurface, marginTop: spacing.md ?? 16 },
  emptySubtitle: {
    ...typography.bodyMd,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    paddingHorizontal: spacing.xl ?? 48,
  },
  emptyButton: {
    marginTop: spacing.md ?? 16,
    backgroundColor: colors.secondary,
    borderRadius: radius.md ?? 8,
    paddingHorizontal: spacing.lg ?? 24,
    paddingVertical: spacing.sm ?? 8,
  },
  emptyButtonText: { ...typography.labelMd, color: colors.onPrimary },

  card: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg ?? 12,
    padding: spacing.md ?? 16,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  cardUnchecked: { opacity: 0.5 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm ?? 8 },
  checkbox: { paddingTop: 2 },
  cardBody: { flex: 1, gap: 4 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs ?? 4 },
  cardType: {
    ...typography.labelSm,
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
  },
  confidenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#D977061A',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.full ?? 999,
  },
  confidenceText: { ...typography.labelSm, color: '#D97706' },
  cardTitle: { ...typography.headlineSm, color: colors.onSurface },
  cardDescription: { ...typography.bodyMd, color: colors.onSurfaceVariant },
  cardUrl: { ...typography.labelMd, color: colors.tertiary },
  editButton: { padding: 4 },

  footer: {
    padding: spacing.md ?? 16,
    backgroundColor: colors.surfaceCard,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
  },
  saveFab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs ?? 4,
    backgroundColor: colors.secondary,
    borderRadius: radius.md ?? 8,
    padding: spacing.md ?? 16,
  },
  saveFabDisabled: { backgroundColor: colors.surfaceContainerHigh },
  saveFabText: { ...typography.labelMd, color: colors.onPrimary },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.surfaceCard,
    borderTopLeftRadius: radius.xl ?? 16,
    borderTopRightRadius: radius.xl ?? 16,
    padding: spacing.lg ?? 24,
    paddingBottom: spacing.xl ?? 48,
    gap: spacing.sm ?? 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md ?? 16,
  },
  modalTitle: { ...typography.headlineSm, color: colors.onSurface },
  fieldLabel: { ...typography.labelMd, color: colors.onSurfaceVariant, marginTop: spacing.sm ?? 8 },
  typeRow: { flexDirection: 'row', marginBottom: spacing.sm ?? 8 },
  typeChip: {
    paddingHorizontal: spacing.md ?? 16,
    paddingVertical: spacing.xs ?? 4,
    borderRadius: radius.full ?? 999,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    marginRight: spacing.xs ?? 4,
  },
  typeChipActive: { backgroundColor: colors.secondary, borderColor: colors.secondary },
  typeChipText: { ...typography.labelMd, color: colors.onSurfaceVariant },
  typeChipTextActive: { color: colors.onPrimary },
  input: {
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.md ?? 8,
    padding: spacing.sm ?? 12,
    ...typography.bodyMd,
    color: colors.onSurface,
  },
  inputMultiline: { height: 80, textAlignVertical: 'top' },
  saveButton: {
    backgroundColor: colors.secondary,
    borderRadius: radius.md ?? 8,
    padding: spacing.md ?? 16,
    alignItems: 'center',
    marginTop: spacing.md ?? 16,
  },
  saveButtonText: { ...typography.labelMd, color: colors.onPrimary },
});
