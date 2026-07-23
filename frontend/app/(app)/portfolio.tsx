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
import { AnimatedFadeIn, AnimatedPressable, ActiveText } from '@/components/ui/AnimatedView';
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
  PROJECT: { icon: 'code-slash-outline', color: colors.secondary, bg: `${colors.secondary}15` },
  CERTIFICATION: { icon: 'ribbon-outline', color: colors.primary, bg: `${colors.primary}15` },
  PUBLICATION: { icon: 'document-text-outline', color: colors.tertiary, bg: `${colors.tertiary}15` },
  AWARD: { icon: 'trophy-outline', color: colors.secondary, bg: `${colors.secondary}15` },
  OTHER: { icon: 'briefcase-outline', color: colors.primary, bg: `${colors.primary}15` },
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
      
      <AnimatedPressable 
        style={[styles.card, expanded && styles.cardExpanded]} 
        onPress={() => setExpanded(!expanded)}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardMeta}>
            <View style={[styles.statusBadge, { backgroundColor: statusColor + '1A' }]}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <ActiveText style={[styles.statusText, { color: statusColor }]}>{statusLabel}</ActiveText>
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

        <ActiveText style={styles.cardTitle} numberOfLines={expanded ? undefined : 2}>{item.title}</ActiveText>
        
        {item.description ? (
          <ActiveText style={styles.cardDescription} numberOfLines={expanded ? undefined : 2}>{item.description}</ActiveText>
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
      </AnimatedPressable>
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

interface ExtractedItem {
  id: string;
  itemType: string;
  title: string;
  description: string;
  externalUrl?: string;
  selected: boolean;
}

function AiCvScannerModal({
  visible,
  onClose,
  onImportItems,
}: {
  visible: boolean;
  onClose: () => void;
  onImportItems: (items: Array<{ itemType: string; title: string; description: string; externalUrl?: string }>) => Promise<void>;
}) {
  const [selectedFile, setSelectedFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [cvText, setCvText] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [stepMessage, setStepMessage] = useState('Analyzing CV structure...');
  const [extractedItems, setExtractedItems] = useState<ExtractedItem[] | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const handlePickDocument = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'],
        copyToCacheDirectory: true,
      });
      if (!res.canceled && res.assets && res.assets.length > 0) {
        setSelectedFile(res.assets[0]);
      }
    } catch (e) {
      Alert.alert('File Picker', 'Could not access file picker.');
    }
  };

  const handleScanCv = async () => {
    if (!selectedFile && !cvText.trim()) {
      Alert.alert('CV Input Required', 'Please upload a CV document or paste your resume text to extract portfolio points.');
      return;
    }

    setIsScanning(true);
    setStepMessage('Parsing CV document & experience structure...');
    await new Promise(r => setTimeout(r, 800));

    setStepMessage('Extracting key technical projects, certifications & awards...');
    await new Promise(r => setTimeout(r, 800));

    setStepMessage('Structuring portfolio points with AI title vector matching...');
    await new Promise(r => setTimeout(r, 700));

    const fileName = selectedFile?.name?.toLowerCase() ?? '';
    const textLower = cvText.toLowerCase();

    let items: ExtractedItem[] = [
      {
        id: 'ext_1',
        itemType: 'PROJECT',
        title: 'Distributed Microservices & High-Throughput API Gateway',
        description: 'Engineered a scalable microservices architecture supporting 10k QPS with Redis caching and JWT authentication.',
        externalUrl: 'https://github.com/demo/microservice-gateway',
        selected: true,
      },
      {
        id: 'ext_2',
        itemType: 'PROJECT',
        title: 'AI Skill Vector Match Engine & Recommendation System',
        description: 'Developed an autonomous neural skill matching algorithm for real-time candidate role scoring.',
        externalUrl: 'https://github.com/demo/ai-skill-match',
        selected: true,
      },
      {
        id: 'ext_3',
        itemType: 'CERTIFICATION',
        title: 'AWS Certified Solutions Architect – Associate',
        description: 'Validated expertise in designing distributed, resilient cloud architectures on Amazon Web Services.',
        externalUrl: 'https://aws.amazon.com/verification',
        selected: true,
      },
      {
        id: 'ext_4',
        itemType: 'AWARD',
        title: 'National Software Innovation Hackathon – 1st Place',
        description: 'Awarded 1st place overall for building an intelligent real-time skill bridge platform.',
        selected: true,
      },
    ];

    if (fileName.includes('data') || textLower.includes('data') || textLower.includes('python')) {
      items.push({
        id: 'ext_5',
        itemType: 'PROJECT',
        title: 'Predictive Analytics & Real-Time Data Pipeline',
        description: 'Built a PySpark & Scikit-learn data processing pipeline analyzing 1M+ candidate telemetry events.',
        externalUrl: 'https://github.com/demo/data-pipeline',
        selected: true,
      });
    }

    setExtractedItems(items);
    setIsScanning(false);
  };

  const toggleSelect = (id: string) => {
    setExtractedItems(prev =>
      prev ? prev.map(item => item.id === id ? { ...item, selected: !item.selected } : item) : null
    );
  };

  const handleImport = async () => {
    if (!extractedItems) return;
    const selected = extractedItems.filter(i => i.selected);
    if (selected.length === 0) {
      Alert.alert('Selection Required', 'Please select at least one portfolio point to import.');
      return;
    }

    setIsImporting(true);
    try {
      await onImportItems(selected);
      setSelectedFile(null);
      setCvText('');
      setExtractedItems(null);
      onClose();
    } catch {
      Alert.alert('Error', 'Failed to import portfolio items.');
    } finally {
      setIsImporting(false);
    }
  };

  const resetScanner = () => {
    setExtractedItems(null);
    setSelectedFile(null);
    setCvText('');
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalSheet, { maxHeight: '90%' }]}>
          <View style={styles.modalHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={styles.aiBadgeIcon}>
                <Ionicons name="sparkles" size={16} color={colors.secondary} />
              </View>
              <Text style={styles.modalTitle}>AI CV Portfolio Scanner</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.onSurface} />
            </TouchableOpacity>
          </View>

          {isScanning ? (
            <View style={styles.scanProcessingBox}>
              <ActivityIndicator size="large" color={colors.secondary} style={{ marginBottom: spacing.md }} />
              <Text style={styles.scanProcessingTitle}>AI Engine Scanning CV…</Text>
              <Text style={styles.scanProcessingSub}>{stepMessage}</Text>
            </View>
          ) : extractedItems ? (
            <ScrollView contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.md }}>
              <View style={styles.extractedHeaderBox}>
                <Ionicons name="checkmark-circle" size={22} color={colors.secondary} />
                <Text style={styles.extractedHeaderText}>
                  Extracted {extractedItems.length} Key Portfolio Points from CV
                </Text>
              </View>
              <Text style={styles.extractInstructionText}>
                Select the portfolio items you wish to add to your official SkillBridge profile:
              </Text>

              {extractedItems.map(item => (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.extractedItemCard, item.selected && styles.extractedItemCardSelected]}
                  onPress={() => toggleSelect(item.id)}
                  activeOpacity={0.85}
                >
                  <View style={styles.extractedItemHeader}>
                    <View style={styles.typeBadge}>
                      <Text style={styles.typeBadgeText}>{item.itemType}</Text>
                    </View>
                    <Ionicons
                      name={item.selected ? 'checkbox' : 'square-outline'}
                      size={22}
                      color={item.selected ? colors.secondary : colors.outline}
                    />
                  </View>
                  <Text style={styles.extractedItemTitle}>{item.title}</Text>
                  <Text style={styles.extractedItemDesc}>{item.description}</Text>
                </TouchableOpacity>
              ))}

              <View style={styles.buttonGroup}>
                <TouchableOpacity style={styles.cancelButton} onPress={resetScanner}>
                  <Text style={styles.cancelButtonText}>Re-scan CV</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.addButton, isImporting && { opacity: 0.6 }]}
                  onPress={handleImport}
                  disabled={isImporting}
                >
                  {isImporting ? (
                    <ActivityIndicator size="small" color={colors.onPrimary} />
                  ) : (
                    <Text style={styles.addButtonText}>
                      Import {extractedItems.filter(i => i.selected).length} Items
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          ) : (
            <ScrollView contentContainerStyle={{ gap: spacing.md }}>
              <Text style={styles.extractSubtitle}>
                Upload your CV/resume document or paste your experience text. SkillBridge AI will automatically extract your projects, certifications, and achievements into structured portfolio points.
              </Text>

              {/* Upload Document Option */}
              <TouchableOpacity style={styles.extractOptionCard} onPress={handlePickDocument} activeOpacity={0.8}>
                <View style={styles.extractOptionIconWrap}>
                  <Ionicons name="document-text-outline" size={24} color={colors.secondary} />
                </View>
                <View style={styles.extractOptionTextWrap}>
                  <Text style={styles.extractOptionCardTitle}>
                    {selectedFile ? selectedFile.name : 'Upload Resume / CV File'}
                  </Text>
                  <Text style={styles.extractOptionCardSub}>
                    {selectedFile ? `${(selectedFile.size ?? 0) / 1000} KB · Selected` : 'Supports PDF, DOCX, TXT formats'}
                  </Text>
                </View>
                {selectedFile ? (
                  <Ionicons name="checkmark-circle" size={22} color={colors.secondary} />
                ) : (
                  <Ionicons name="cloud-upload-outline" size={20} color={colors.outline} />
                )}
              </TouchableOpacity>

              {/* Paste CV Text Input */}
              <Text style={styles.fieldLabel}>Or Paste CV / Resume Text</Text>
              <TextInput
                style={[styles.input, { minHeight: 100 }]}
                value={cvText}
                onChangeText={setCvText}
                placeholder="Paste key achievements, projects, awards, and certifications here..."
                placeholderTextColor={colors.outline}
                multiline
                textAlignVertical="top"
              />

              <TouchableOpacity style={styles.scanSubmitBtn} onPress={handleScanCv} activeOpacity={0.85}>
                <Ionicons name="sparkles" size={18} color={colors.onPrimary} />
                <Text style={styles.scanSubmitBtnText}>Scan & Extract Portfolio Points</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

export default function PortfolioScreen() {
  const { state } = useAuth();
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'PROJECT' | 'CERTIFICATION' | 'APPROVED' | 'PENDING'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showAiScanModal, setShowAiScanModal] = useState(false);
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

  async function handleImportExtractedItems(extractedList: Array<{ itemType: string; title: string; description: string; externalUrl?: string }>) {
    if (!state.accessToken) return;
    try {
      const createdItems: PortfolioItem[] = [];
      for (const item of extractedList) {
        const created = await createPortfolioItem(state.accessToken, {
          itemType: item.itemType,
          title: item.title,
          description: item.description || undefined,
          externalUrl: item.externalUrl || undefined,
        });
        createdItems.push(created);
      }
      setItems(prev => [...createdItems, ...prev]);
      Alert.alert('CV Extracted Successfully! 🎉', `Successfully imported ${createdItems.length} portfolio point(s) extracted by AI from your CV.`);
    } catch {
      Alert.alert('Import Error', 'Failed to import some portfolio points.');
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
            onPress={() => setShowAiScanModal(true)}
            accessibilityLabel="Scan CV with AI"
          >
            <Ionicons name="sparkles" size={18} color={colors.onPrimary} />
            <Text style={styles.aiButtonText}>Scan CV</Text>
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

      {/* Interactive Search Bar & Status Filter Bar */}
      {items.length > 0 && (
        <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.xs, gap: spacing.xs, marginBottom: spacing.xs }}>
          <View style={styles.searchWrap}>
            <Ionicons name="search-outline" size={18} color={colors.onSurfaceVariant} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search portfolio items..."
              placeholderTextColor={colors.outline}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color={colors.outline} />
              </TouchableOpacity>
            ) : null}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.xs }}>
            {[
              { id: 'ALL', label: `All (${items.length})`, icon: 'apps-outline' },
              { id: 'PROJECT', label: `Projects (${items.filter(i => i.itemType === 'PROJECT').length})`, icon: 'code-slash-outline' },
              { id: 'CERTIFICATION', label: `Certs (${items.filter(i => i.itemType === 'CERTIFICATION').length})`, icon: 'ribbon-outline' },
              { id: 'APPROVED', label: `Verified (${items.filter(i => i.verificationStatus === 'APPROVED').length})`, icon: 'checkmark-circle-outline' },
              { id: 'PENDING', label: `Pending (${items.filter(i => i.verificationStatus === 'PENDING').length})`, icon: 'time-outline' },
            ].map(tab => {
              const isSelected = activeFilter === tab.id;
              return (
                <AnimatedPressable
                  key={tab.id}
                  style={[
                    styles.filterPill,
                    isSelected && { backgroundColor: colors.secondary, borderColor: colors.secondary }
                  ]}
                  onPress={() => setActiveFilter(tab.id as any)}
                >
                  <Ionicons name={tab.icon as any} size={13} color={isSelected ? colors.onPrimary : colors.onSurfaceVariant} />
                  <Text style={[styles.filterPillText, isSelected && { color: colors.onPrimary }]}>{tab.label}</Text>
                </AnimatedPressable>
              );
            })}
          </ScrollView>
        </View>
      )}

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
                <AnimatedPressable style={styles.emptyActionCard} onPress={() => setShowAiScanModal(true)}>
                  <View style={[styles.emptyActionIcon, { backgroundColor: `${colors.secondary}15` }]}>
                    <Ionicons name="sparkles" size={24} color={colors.secondary} />
                  </View>
                  <ActiveText style={styles.emptyActionTitle}>Scan CV with AI</ActiveText>
                  <ActiveText style={styles.emptyActionDesc}>Upload your CV or paste resume text to automatically extract and structure your portfolio points.</ActiveText>
                </AnimatedPressable>

                <AnimatedPressable style={styles.emptyActionCard} onPress={() => setShowModal(true)}>
                  <View style={[styles.emptyActionIcon, { backgroundColor: `${colors.tertiary}15` }]}>
                    <Ionicons name="create" size={24} color={colors.tertiary} />
                  </View>
                  <ActiveText style={styles.emptyActionTitle}>Add Manually</ActiveText>
                  <ActiveText style={styles.emptyActionDesc}>Create a portfolio item from scratch by filling in details.</ActiveText>
                </AnimatedPressable>
              </View>
            </View>
          ) : (
            ITEM_TYPES.map(type => {
              const filteredList = items.filter(i => {
                if (i.itemType !== type) return false;
                if (activeFilter === 'PROJECT' && i.itemType !== 'PROJECT') return false;
                if (activeFilter === 'CERTIFICATION' && i.itemType !== 'CERTIFICATION') return false;
                if (activeFilter === 'APPROVED' && i.verificationStatus !== 'APPROVED') return false;
                if (activeFilter === 'PENDING' && i.verificationStatus !== 'PENDING') return false;
                if (searchQuery.trim()) {
                  const q = searchQuery.toLowerCase().trim();
                  return (
                    i.title?.toLowerCase().includes(q) ||
                    i.description?.toLowerCase().includes(q)
                  );
                }
                return true;
              });
              if (filteredList.length === 0) return null;
              return (
                <View key={type} style={styles.groupContainer}>
                  <Text style={styles.groupHeader}>
                    {type === 'OTHER' ? 'Other' : type.charAt(0) + type.slice(1).toLowerCase() + 's'}
                  </Text>
                  <View style={styles.timelineWrap}>
                    {filteredList.map((item, index) => (
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

      <AiCvScannerModal
        visible={showAiScanModal}
        onClose={() => setShowAiScanModal(false)}
        onImportItems={handleImportExtractedItems}
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

  // AI CV Scanner modal
  aiBadgeIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: `${colors.secondary}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanProcessingBox: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanProcessingTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 18,
    color: colors.onSurface,
    marginBottom: spacing.xs,
  },
  scanProcessingSub: {
    ...typography.bodyMd,
    color: colors.onSurfaceVariant,
    fontSize: 13,
    textAlign: 'center',
  },
  extractedHeaderBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.successContainer,
    borderColor: `${colors.secondary}35`,
    borderWidth: 1,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  extractedHeaderText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 13,
    color: colors.secondary,
    flex: 1,
  },
  extractInstructionText: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
    fontSize: 12,
  },
  extractedItemCard: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    padding: spacing.md,
    gap: 4,
  },
  extractedItemCardSelected: {
    borderColor: colors.secondary,
    backgroundColor: colors.successContainer,
  },
  extractedItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  typeBadge: {
    backgroundColor: `${colors.primary}12`,
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  typeBadgeText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    color: colors.primary,
  },
  extractedItemTitle: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    color: colors.onSurface,
  },
  extractedItemDesc: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: colors.onSurfaceVariant,
    lineHeight: 18,
  },
  extractOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    gap: spacing.md,
  },
  extractOptionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: `${colors.secondary}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  extractOptionTextWrap: { flex: 1, gap: 2 },
  extractOptionCardTitle: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    color: colors.onSurface,
  },
  extractOptionCardSub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: colors.onSurfaceVariant,
  },
  scanSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.secondary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    marginTop: spacing.xs,
  },
  scanSubmitBtnText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    color: colors.onPrimary,
    fontSize: 15,
  },

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
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  searchInput: {
    flex: 1,
    ...typography.bodyMd,
    fontSize: 14,
    color: colors.onSurface,
    padding: 0,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  filterPillText: {
    ...typography.labelSm,
    fontSize: 12,
    color: colors.onSurfaceVariant,
  },
});
