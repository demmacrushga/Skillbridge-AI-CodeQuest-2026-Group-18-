import { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '@/context/AuthContext';
import { colors, typography, spacing, radius } from '@/constants/theme';
import {
  createPortfolioItem,
  deletePortfolioItem,
  generateShareLink,
  getMyPortfolio,
  requestVerification,
  extractFromCV,
  extractFromUrl,
} from '@/services/portfolio';
import { setExtractedItems } from '@/services/extraction-state';
import { type PortfolioItem } from '@/types/portfolio';

const ITEM_TYPES = ['PROJECT', 'CERTIFICATION', 'PUBLICATION', 'AWARD', 'OTHER'];

const STATUS_COLOR: Record<string, string> = {
  NONE: colors.outline,
  PENDING: '#D97706',
  APPROVED: colors.success,
  REJECTED: colors.error,
};

const STATUS_LABEL: Record<string, string> = {
  NONE: 'Unverified',
  PENDING: 'Pending',
  APPROVED: 'Verified',
  REJECTED: 'Rejected',
};

function ItemCard({
  item,
  onDelete,
  onRequestVerification,
  isDeleting,
  isRequesting,
}: {
  item: PortfolioItem;
  onDelete: () => void;
  onRequestVerification: () => void;
  isDeleting: boolean;
  isRequesting: boolean;
}) {
  const statusColor = STATUS_COLOR[item.verificationStatus] ?? colors.outline;
  const statusLabel = STATUS_LABEL[item.verificationStatus] ?? item.verificationStatus;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardMeta}>
          <Text style={styles.cardType}>{item.itemType}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '1A' }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={onDelete}
          disabled={isDeleting}
          style={styles.deleteButton}
          accessibilityLabel="Delete item"
        >
          {isDeleting ? (
            <ActivityIndicator size="small" color={colors.error} />
          ) : (
            <Ionicons name="trash-outline" size={18} color={colors.error} />
          )}
        </TouchableOpacity>
      </View>

      <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
      {item.description ? (
        <Text style={styles.cardDescription} numberOfLines={2}>{item.description}</Text>
      ) : null}
      {item.externalUrl ? (
        <Text style={styles.cardUrl} numberOfLines={1}>{item.externalUrl}</Text>
      ) : null}

      {item.verificationStatus === 'NONE' && (
        <TouchableOpacity
          style={styles.verifyButton}
          onPress={onRequestVerification}
          disabled={isRequesting}
        >
          {isRequesting ? (
            <ActivityIndicator size="small" color={colors.secondary} />
          ) : (
            <>
              <Ionicons name="shield-checkmark-outline" size={14} color={colors.secondary} />
              <Text style={styles.verifyButtonText}>Request Verification</Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

function AddItemModal({
  visible,
  onClose,
  onAdd,
}: {
  visible: boolean;
  onClose: () => void;
  onAdd: (itemType: string, title: string, description: string, url: string) => void;
}) {
  const [itemType, setItemType] = useState('PROJECT');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');

  function handleSubmit() {
    if (!title.trim()) {
      Alert.alert('Validation', 'Title is required.');
      return;
    }
    onAdd(itemType, title.trim(), description.trim(), url.trim());
    setTitle('');
    setDescription('');
    setUrl('');
    setItemType('PROJECT');
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Portfolio Item</Text>
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
            placeholder="e.g. Open-source contributions"
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
            placeholder="https://github.com/..."
            placeholderTextColor={colors.outline}
            autoCapitalize="none"
            keyboardType="url"
          />

          <TouchableOpacity style={styles.addButton} onPress={handleSubmit}>
            <Text style={styles.addButtonText}>Add Item</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function PortfolioScreen() {
  const { state } = useAuth();
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [requestingId, setRequestingId] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [showExtractModal, setShowExtractModal] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [urlInput, setUrlInput] = useState('');

  const loadItems = useCallback(async (showRefresh = false) => {
    if (!state.accessToken) return;
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await getMyPortfolio(state.accessToken);
      setItems(data);
    } catch {
      Alert.alert('Error', 'Failed to load portfolio items.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [state.accessToken]);

  useFocusEffect(useCallback(() => { loadItems(); }, [loadItems]));

  async function handleAdd(itemType: string, title: string, description: string, url: string) {
    if (!state.accessToken) return;
    try {
      const newItem = await createPortfolioItem(state.accessToken, {
        itemType,
        title,
        description: description || undefined,
        externalUrl: url || undefined,
      });
      setItems(prev => [newItem, ...prev]);
      setShowModal(false);
    } catch {
      Alert.alert('Error', 'Failed to add portfolio item.');
    }
  }

  async function handleDelete(itemId: string) {
    if (!state.accessToken) return;
    const token = state.accessToken;
    Alert.alert('Delete Item', 'Are you sure you want to delete this item?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeletingId(itemId);
          try {
            await deletePortfolioItem(token, itemId);
            setItems(prev => prev.filter(i => i.id !== itemId));
          } catch {
            Alert.alert('Error', 'Failed to delete item.');
          } finally {
            setDeletingId(null);
          }
        },
      },
    ]);
  }

  async function handleRequestVerification(itemId: string) {
    if (!state.accessToken) return;
    setRequestingId(itemId);
    try {
      await requestVerification(state.accessToken, itemId);
      setItems(prev =>
        prev.map(i => i.id === itemId ? { ...i, verificationStatus: 'PENDING' } : i)
      );
      Alert.alert('Success', 'Verification request submitted.');
    } catch (err: any) {
      const msg = err?.status === 409 ? 'A verification request is already pending.' : 'Failed to submit request.';
      Alert.alert('Error', msg);
    } finally {
      setRequestingId(null);
    }
  }

  async function handleShareLink() {
    if (!state.accessToken) return;
    setShareLoading(true);
    try {
      const resp = await generateShareLink(state.accessToken);
      Alert.alert('Share Link', resp.shareUrl, [{ text: 'OK' }]);
    } catch {
      Alert.alert('Error', 'Failed to generate share link.');
    } finally {
      setShareLoading(false);
    }
  }

  async function handleCVUpload() {
    if (!state.accessToken) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;

      setShowExtractModal(false);
      setExtracting(true);
      const extracted = await extractFromCV(state.accessToken, result.assets[0]);
      setExtractedItems(extracted);
      setExtracting(false);
      router.push('/(app)/portfolio-review');
    } catch (err: any) {
      setExtracting(false);
      const msg = err?.status === 503
        ? 'AI service unavailable. Please try again or add items manually.'
        : err?.message ?? 'Failed to extract items from CV.';
      Alert.alert('Error', msg);
    }
  }

  async function handleUrlExtract() {
    if (!state.accessToken || !urlInput.trim()) return;
    setShowExtractModal(false);
    setExtracting(true);
    setUrlInput('');
    try {
      const extracted = await extractFromUrl(state.accessToken, urlInput.trim());
      setExtractedItems(extracted);
      setExtracting(false);
      router.push('/(app)/portfolio-review');
    } catch (err: any) {
      setExtracting(false);
      const msg = err?.status === 503
        ? 'AI service unavailable. Please try again or add items manually.'
        : err?.status === 502
        ? 'Could not fetch content from the provided URL.'
        : err?.message ?? 'Failed to extract items from URL.';
      Alert.alert('Error', msg);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Portfolio</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.shareButton}
            onPress={handleShareLink}
            disabled={shareLoading}
          >
            {shareLoading ? (
              <ActivityIndicator size="small" color={colors.secondary} />
            ) : (
              <Ionicons name="share-outline" size={20} color={colors.secondary} />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.aiButton}
            onPress={() => setShowExtractModal(true)}
            accessibilityLabel="Build portfolio with AI"
          >
            <Ionicons name="sparkles" size={18} color={colors.onPrimary} />
            <Text style={styles.aiButtonText}>AI</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addFab}
            onPress={() => setShowModal(true)}
            accessibilityLabel="Add portfolio item"
          >
            <Ionicons name="add" size={20} color={colors.onPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.secondary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => loadItems(true)}
              colors={[colors.secondary]} />
          }
        >
          {items.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="briefcase-outline" size={48} color={colors.outline} />
              <Text style={styles.emptyTitle}>No portfolio items yet</Text>
              <Text style={styles.emptySubtitle}>
                Add your projects, certifications, and achievements to build your profile.
              </Text>
              <TouchableOpacity style={styles.emptyAiButton} onPress={() => setShowExtractModal(true)}>
                <Ionicons name="sparkles" size={16} color={colors.onPrimary} />
                <Text style={styles.emptyButtonText}>Build with AI</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.emptyButtonManual} onPress={() => setShowModal(true)}>
                <Text style={styles.emptyButtonManualText}>Add Item Manually</Text>
              </TouchableOpacity>
            </View>
          ) : (
            items.map(item => (
              <ItemCard
                key={item.id}
                item={item}
                onDelete={() => handleDelete(item.id)}
                onRequestVerification={() => handleRequestVerification(item.id)}
                isDeleting={deletingId === item.id}
                isRequesting={requestingId === item.id}
              />
            ))
          )}
        </ScrollView>
      )}

      <AddItemModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        onAdd={handleAdd}
      />

      {/* Extraction method modal */}
      <Modal visible={showExtractModal} animationType="slide" transparent onRequestClose={() => setShowExtractModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Build with AI</Text>
              <TouchableOpacity onPress={() => setShowExtractModal(false)}>
                <Ionicons name="close" size={24} color={colors.onSurface} />
              </TouchableOpacity>
            </View>
            <Text style={styles.extractSubtitle}>
              Upload your CV or paste a website link. AI will extract your achievements automatically.
            </Text>

            <TouchableOpacity style={styles.extractOption} onPress={handleCVUpload}>
              <View style={styles.extractOptionIcon}>
                <Ionicons name="document-text-outline" size={24} color={colors.secondary} />
              </View>
              <View style={styles.extractOptionBody}>
                <Text style={styles.extractOptionTitle}>Upload CV</Text>
                <Text style={styles.extractOptionHint}>PDF or DOCX, max 5 MB</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.outline} />
            </TouchableOpacity>

            <Text style={styles.fieldLabel}>Or paste a website link</Text>
            <TextInput
              style={styles.input}
              value={urlInput}
              onChangeText={setUrlInput}
              placeholder="https://github.com/username"
              placeholderTextColor={colors.outline}
              autoCapitalize="none"
              keyboardType="url"
            />
            <TouchableOpacity
              style={[styles.extractUrlButton, !urlInput.trim() && styles.extractUrlButtonDisabled]}
              onPress={handleUrlExtract}
              disabled={!urlInput.trim()}
            >
              <Text style={styles.extractUrlButtonText}>Extract from URL</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Processing overlay */}
      <Modal visible={extracting} transparent animationType="fade">
        <View style={styles.processingOverlay}>
          <View style={styles.processingCard}>
            <ActivityIndicator size="large" color={colors.secondary} />
            <Text style={styles.processingTitle}>Extracting items…</Text>
            <Text style={styles.processingSubtitle}>This may take 5–15 seconds</Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg ?? 24,
    paddingVertical: spacing.md ?? 16,
    backgroundColor: colors.surfaceCard,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  title: { ...typography.headlineMd, color: colors.onSurface },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm ?? 8 },
  shareButton: {
    padding: spacing.sm ?? 8,
    borderRadius: radius.full ?? 999,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  addFab: {
    backgroundColor: colors.secondary,
    borderRadius: radius.full ?? 999,
    padding: spacing.sm ?? 8,
  },
  list: { padding: spacing.md ?? 16, gap: spacing.md ?? 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingTop: spacing.xl ?? 48, gap: spacing.sm ?? 8 },
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

  // Card
  card: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg ?? 12,
    padding: spacing.md ?? 16,
    gap: spacing.xs ?? 4,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs ?? 4,
  },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm ?? 8 },
  cardType: { ...typography.labelSm, color: colors.onSurfaceVariant, textTransform: 'uppercase' },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm ?? 8,
    paddingVertical: 2,
    borderRadius: radius.full ?? 999,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { ...typography.labelSm },
  deleteButton: { padding: 4 },
  cardTitle: { ...typography.headlineSm, color: colors.onSurface },
  cardDescription: { ...typography.bodyMd, color: colors.onSurfaceVariant },
  cardUrl: { ...typography.labelMd, color: colors.tertiary },
  verifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.sm ?? 8,
    alignSelf: 'flex-start',
  },
  verifyButtonText: { ...typography.labelMd, color: colors.secondary },

  // Modal
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
  addButton: {
    backgroundColor: colors.secondary,
    borderRadius: radius.md ?? 8,
    padding: spacing.md ?? 16,
    alignItems: 'center',
    marginTop: spacing.md ?? 16,
  },
  addButtonText: { ...typography.labelMd, color: colors.onPrimary },

  // AI Build button
  aiButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: colors.secondary,
    borderRadius: radius.full ?? 999,
    paddingHorizontal: spacing.sm ?? 8,
    paddingVertical: spacing.xs ?? 4,
  },
  aiButtonText: { ...typography.labelSm, color: colors.onPrimary, fontWeight: '700' },

  // Empty state AI button
  emptyAiButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.md ?? 16,
    backgroundColor: colors.secondary,
    borderRadius: radius.md ?? 8,
    paddingHorizontal: spacing.lg ?? 24,
    paddingVertical: spacing.sm ?? 8,
  },
  emptyButtonManual: {
    marginTop: spacing.sm ?? 8,
    borderRadius: radius.md ?? 8,
    paddingHorizontal: spacing.lg ?? 24,
    paddingVertical: spacing.sm ?? 8,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  emptyButtonManualText: { ...typography.labelMd, color: colors.onSurfaceVariant },

  // Extraction modal
  extractSubtitle: {
    ...typography.bodyMd,
    color: colors.onSurfaceVariant,
    marginBottom: spacing.md ?? 16,
  },
  extractOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radius.md ?? 8,
    padding: spacing.md ?? 16,
    gap: spacing.sm ?? 8,
    marginBottom: spacing.md ?? 16,
  },
  extractOptionIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md ?? 8,
    backgroundColor: `${colors.secondary}12`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  extractOptionBody: { flex: 1, gap: 2 },
  extractOptionTitle: { ...typography.labelMd, color: colors.onSurface },
  extractOptionHint: { ...typography.labelSm, color: colors.outline },
  extractUrlButton: {
    backgroundColor: colors.secondary,
    borderRadius: radius.md ?? 8,
    padding: spacing.md ?? 16,
    alignItems: 'center',
    marginTop: spacing.xs ?? 4,
  },
  extractUrlButtonDisabled: { backgroundColor: colors.surfaceContainerHigh },
  extractUrlButtonText: { ...typography.labelMd, color: colors.onPrimary },

  // Processing overlay
  processingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  processingCard: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg ?? 12,
    padding: spacing.xl ?? 48,
    alignItems: 'center',
    gap: spacing.sm ?? 8,
  },
  processingTitle: { ...typography.headlineSm, color: colors.onSurface },
  processingSubtitle: { ...typography.bodyMd, color: colors.onSurfaceVariant },
});
