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
  DeviceEventEmitter,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as Clipboard from 'expo-clipboard';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/context/AuthContext';
import { colors, typography, spacing, radius } from '@/constants/theme';
import {
  createPortfolioItem,
  deletePortfolioItem,
  generateShareLink,
  getMyPortfolio,
  requestVerification,
} from '@/services/portfolio';
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

const ITEM_TYPE_CONFIG: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string }> = {
  PROJECT: { icon: 'code-slash-outline', color: colors.primary, bg: `${colors.primary}1A` },
  CERTIFICATION: { icon: 'ribbon-outline', color: '#B45309', bg: '#FEF3C7' },
  PUBLICATION: { icon: 'document-text-outline', color: colors.tertiary, bg: `${colors.tertiary}1A` },
  AWARD: { icon: 'trophy-outline', color: '#F59E0B', bg: '#FEF3C7' },
  OTHER: { icon: 'briefcase-outline', color: colors.secondary, bg: `${colors.secondary}1A` },
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
  const [expanded, setExpanded] = useState(false);
  const statusColor = STATUS_COLOR[item.verificationStatus] ?? colors.outline;
  const statusLabel = STATUS_LABEL[item.verificationStatus] ?? item.verificationStatus;
  const typeCfg = ITEM_TYPE_CONFIG[item.itemType] ?? ITEM_TYPE_CONFIG.OTHER;

  return (
    <View style={styles.timelineItemWrap}>
      <View style={styles.timelineLine} />
      <View style={[styles.timelineNode, { backgroundColor: typeCfg.bg }]}>
        <Ionicons name={typeCfg.icon} size={20} color={typeCfg.color} />
      </View>
      
      <TouchableOpacity 
        style={[styles.card, expanded && styles.cardExpanded]} 
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.9}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardMeta}>
            <View style={[styles.statusBadge, { backgroundColor: statusColor + '1A' }]}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation?.();
                onDelete();
              }}
              disabled={isDeleting}
              style={styles.deleteButton}
              accessibilityLabel="Delete item"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              {isDeleting ? (
                <ActivityIndicator size="small" color={colors.error} />
              ) : (
                <Ionicons name="trash-outline" size={18} color={colors.error} />
              )}
            </TouchableOpacity>
            <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={20} color={colors.outline} />
          </View>
        </View>

        <Text style={styles.cardTitle} numberOfLines={expanded ? undefined : 2}>{item.title}</Text>
        
        {item.description ? (
          <Text style={styles.cardDescription} numberOfLines={expanded ? undefined : 2}>{item.description}</Text>
        ) : null}
        
        {expanded && item.externalUrl ? (
          <Text style={styles.cardUrl}>{item.externalUrl}</Text>
        ) : null}

        {expanded && (
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
            {item.verificationStatus === 'NONE' && (
              <TouchableOpacity
                style={[styles.verifyButton, { flex: 1 }]}
                onPress={(e) => {
                  e.stopPropagation?.();
                  onRequestVerification();
                }}
                disabled={isRequesting}
              >
                {isRequesting ? (
                  <ActivityIndicator size="small" color={colors.secondary} />
                ) : (
                  <>
                    <Ionicons name="shield-checkmark-outline" size={16} color={colors.secondary} />
                    <Text style={styles.verifyButtonText}>Request Verification</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.deleteExpandedBtn}
              onPress={(e) => {
                e.stopPropagation?.();
                onDelete();
              }}
              disabled={isDeleting}
              activeOpacity={0.8}
            >
              <Ionicons name="trash-outline" size={16} color={colors.error} />
              <Text style={styles.deleteExpandedText}>Delete</Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
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
          <View style={styles.typeGrid}>
            {ITEM_TYPES.map(t => (
              <TouchableOpacity
                key={t}
                style={[styles.typeChip, itemType === t && styles.typeChipActive]}
                onPress={() => setItemType(t)}
                activeOpacity={0.7}
              >
                <Text style={[styles.typeChipText, itemType === t && styles.typeChipTextActive]}>
                  {t}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

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

          <View style={styles.buttonGroup}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.addButton} onPress={handleSubmit}>
              <Text style={styles.addButtonText}>Save Item</Text>
            </TouchableOpacity>
          </View>
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
  const [shareUrl, setShareUrl] = useState('');

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
      setShareUrl(resp.shareUrl);
    } catch {
      Alert.alert('Error', 'Failed to generate share link.');
    } finally {
      setShareLoading(false);
    }
  }

  async function handleCopy() {
    await Clipboard.setStringAsync(shareUrl);
    setShareUrl('');
    Alert.alert('Copied!', 'Link copied to clipboard.');
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
            onPress={() => DeviceEventEmitter.emit('openChatbot')}
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
        <ScrollView contentContainerStyle={styles.list}>
          <View style={{ marginBottom: spacing.md }}>
            <Skeleton width={120} height={20} />
          </View>
          <View style={styles.timelineWrap}>
            {[1, 2, 3, 4].map((key) => (
              <View key={key} style={styles.timelineItemContainer}>
                <View style={styles.timelineItemWrap}>
                  <View style={styles.timelineLine} />
                  <View style={[styles.timelineNode, { backgroundColor: colors.surfaceContainerHigh }]}>
                    <Skeleton width={12} height={12} borderRadius={6} />
                  </View>
                  <View style={styles.card}>
                    <View style={styles.cardHeader}>
                      <Skeleton width={80} height={20} borderRadius={10} />
                      <Skeleton width={20} height={20} borderRadius={10} />
                    </View>
                    <Skeleton width="90%" height={16} style={{ marginTop: 8, marginBottom: 4 }} />
                    <Skeleton width="60%" height={14} style={{ marginBottom: 4 }} />
                  </View>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
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
              <View style={styles.emptyHeaderWrap}>
                <Ionicons name="briefcase" size={64} color={colors.primary} style={{ opacity: 0.15 }} />
                <Text style={styles.emptyTitle}>Your Portfolio is Empty</Text>
                <Text style={styles.emptySubtitle}>
                  Showcase your skills, projects, and certifications to stand out to recruiters.
                </Text>
              </View>

              <View style={styles.emptyCardsRow}>
                <TouchableOpacity style={styles.emptyActionCard} onPress={() => DeviceEventEmitter.emit('openChatbot')} activeOpacity={0.8}>
                  <View style={[styles.emptyActionIcon, { backgroundColor: `${colors.tertiary}15` }]}>
                    <Ionicons name="sparkles" size={24} color={colors.tertiary} />
                  </View>
                  <Text style={styles.emptyActionTitle}>Build with AI</Text>
                  <Text style={styles.emptyActionDesc}>Upload your CV and let AI extract your achievements automatically.</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.emptyActionCard} onPress={() => setShowModal(true)} activeOpacity={0.8}>
                  <View style={[styles.emptyActionIcon, { backgroundColor: `${colors.secondary}15` }]}>
                    <Ionicons name="create" size={24} color={colors.secondary} />
                  </View>
                  <Text style={styles.emptyActionTitle}>Add Manually</Text>
                  <Text style={styles.emptyActionDesc}>Create a portfolio item from scratch by filling in the details.</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            ITEM_TYPES.map(type => {
              const typeItems = items.filter(i => i.itemType === type);
              if (typeItems.length === 0) return null;
              return (
                <View key={type} style={styles.groupContainer}>
                  <Text style={styles.groupHeader}>
                    {type === 'OTHER' ? 'Other' : type.charAt(0) + type.slice(1).toLowerCase() + 's'}
                  </Text>
                  <View style={styles.timelineWrap}>
                    {typeItems.map((item, index) => (
                      <View key={item.id} style={styles.timelineItemContainer}>
                        <ItemCard
                          item={item}
                          onDelete={() => handleDelete(item.id)}
                          onRequestVerification={() => handleRequestVerification(item.id)}
                          isDeleting={deletingId === item.id}
                          isRequesting={requestingId === item.id}
                        />
                      </View>
                    ))}
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      {/* Share link modal */}
      <Modal visible={!!shareUrl} animationType="fade" transparent onRequestClose={() => setShareUrl('')}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Share Portfolio</Text>
              <TouchableOpacity onPress={() => setShareUrl('')}>
                <Ionicons name="close" size={24} color={colors.onSurface} />
              </TouchableOpacity>
            </View>
            <Text style={styles.fieldLabel}>Portfolio Link</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
              <TextInput style={[styles.input, { flex: 1 }]} value={shareUrl} editable={false} />
              <TouchableOpacity style={{ backgroundColor: colors.secondary, borderRadius: 8, paddingHorizontal: 16, justifyContent: 'center' }} onPress={handleCopy}>
                <Ionicons name="copy-outline" size={20} color={colors.onPrimary} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <AddItemModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        onAdd={handleAdd}
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
    paddingHorizontal: spacing.lg ?? 24,
    paddingVertical: spacing.md ?? 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 0,
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
  list: { padding: spacing.md ?? 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Grouped Layout
  groupContainer: { marginBottom: spacing.xl },
  groupHeader: { ...typography.headlineSm, color: colors.primary, marginBottom: spacing.md, marginLeft: 2 },
  
  // Timeline Styles
  timelineWrap: {
    paddingLeft: spacing.md,
  },
  timelineItemContainer: {
    marginBottom: spacing.md,
  },
  timelineItemWrap: {
    position: 'relative',
    paddingLeft: spacing.xl + 4, // Space for the line and node
  },
  timelineLine: {
    position: 'absolute',
    left: 11, // align with node center (24/2)
    top: 24, // starts slightly below top of node
    bottom: -spacing.md, // extends to next item
    width: 2,
    backgroundColor: `${colors.primary}15`,
    zIndex: 1,
  },
  timelineNode: {
    position: 'absolute',
    left: 0,
    top: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
    borderWidth: 2,
    borderColor: colors.surface,
  },

  // Card
  card: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg ?? 12,
    padding: spacing.md ?? 16,
    gap: spacing.sm ?? 8,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  cardExpanded: {
    borderColor: `${colors.primary}40`,
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs ?? 4,
  },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  typeIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.xs ?? 6,
    paddingVertical: 2,
    borderRadius: radius.full ?? 999,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { ...typography.labelSm, fontSize: 9 },
  deleteButton: { padding: 4, alignSelf: 'flex-start' },
  cardTitle: { ...typography.headlineSm, fontSize: 13, color: colors.onSurface, lineHeight: 18 },
  cardDescription: { ...typography.bodyMd, fontSize: 12, color: colors.onSurfaceVariant },
  cardUrl: { ...typography.labelMd, fontSize: 11, color: colors.tertiary },
  verifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: spacing.sm ?? 8,
    backgroundColor: `${colors.secondary}15`,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.md,
  },
  verifyButtonText: { ...typography.labelMd, color: colors.secondary },
  deleteExpandedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: spacing.sm ?? 8,
    backgroundColor: `${colors.error}15`,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.md,
  },
  deleteExpandedText: { ...typography.labelMd, color: colors.error },

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
  fieldLabel: { ...typography.labelSm, color: colors.outline, textTransform: 'uppercase', marginBottom: 4, marginTop: spacing.md },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  typeChip: {
    paddingHorizontal: spacing.md ?? 16,
    paddingVertical: spacing.xs ?? 6,
    borderRadius: radius.md ?? 8,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainerLow,
  },
  typeChipActive: { backgroundColor: colors.secondary, borderColor: colors.secondary },
  typeChipText: { ...typography.labelMd, color: colors.onSurfaceVariant },
  typeChipTextActive: { color: colors.onPrimary, fontWeight: '700' },
  input: {
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.md ?? 8,
    padding: spacing.sm ?? 12,
    ...typography.bodyMd,
    color: colors.onSurface,
  },
  inputMultiline: { height: 80, textAlignVertical: 'top' },
  buttonGroup: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  cancelButton: {
    flex: 1,
    padding: spacing.md ?? 16,
    alignItems: 'center',
    borderRadius: radius.md ?? 8,
    backgroundColor: colors.surfaceContainerHigh,
  },
  cancelButtonText: { ...typography.labelMd, color: colors.onSurface },
  addButton: {
    flex: 2,
    backgroundColor: colors.secondary,
    borderRadius: radius.md ?? 8,
    padding: spacing.md ?? 16,
    alignItems: 'center',
  },
  addButtonText: { ...typography.labelMd, color: colors.onPrimary, fontWeight: '700' },

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

  // Empty state
  empty: { flex: 1, padding: spacing.md ?? 16, justifyContent: 'center' },
  emptyHeaderWrap: { alignItems: 'center', marginBottom: spacing.xl, paddingHorizontal: spacing.md },
  emptyTitle: { ...typography.headlineSm, color: colors.onSurface, marginTop: spacing.md ?? 16 },
  emptySubtitle: { ...typography.bodyMd, color: colors.onSurfaceVariant, textAlign: 'center', marginTop: spacing.sm ?? 8 },
  emptyCardsRow: { flexDirection: 'column', gap: spacing.md },
  emptyActionCard: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  emptyActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  emptyActionTitle: { ...typography.labelMd, color: colors.primary, fontSize: 18, marginBottom: 4 },
  emptyActionDesc: { ...typography.bodyMd, color: colors.onSurfaceVariant, fontSize: 14 },

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
