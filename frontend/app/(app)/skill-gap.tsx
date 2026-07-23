import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
  ActivityIndicator,
  TextInput,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { DocumentPickerAsset } from 'expo-document-picker';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '@/context/AuthContext';
import { colors, typography, spacing, radius } from '@/constants/theme';
import { analyseCV, getReports, deleteReport } from '@/services/skillGap';
import { type GapReport } from '@/types/skillGap';
import { AnimatedFadeIn, AnimatedPressable, ActiveText } from '@/components/ui/AnimatedView';

function usePulse() {
  const anim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 0.25, duration: 900, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, [anim]);
  return anim;
}

function getPriorityColor(gapCount: number) {
  if (gapCount >= 5) return '#DC2626';
  if (gapCount >= 3) return '#EA580C';
  if (gapCount >= 1) return '#CA8A04';
  return colors.secondary;
}

function ReportRow({
  report,
  onPress,
  onDelete,
  isDeleting,
}: {
  report: GapReport;
  onPress: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  const dateStr = report.createdAt
    ? new Date(report.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';
  const gapColor = getPriorityColor(report.gaps.length);

  return (
    <AnimatedPressable style={styles.reportRow} onPress={onPress}>
      <View style={[styles.reportRowIcon, { backgroundColor: `${gapColor}12` }]}>
        <Ionicons name="analytics-outline" size={18} color={gapColor} />
      </View>
      <View style={styles.reportRowBody}>
        <ActiveText style={styles.reportRowTitle} numberOfLines={1}>{report.targetRole}</ActiveText>
        <ActiveText style={styles.reportRowMeta}>{dateStr}</ActiveText>
      </View>
      <View style={[styles.gapBadge, { backgroundColor: `${gapColor}15` }]}>
        <ActiveText style={[styles.gapBadgeText, { color: gapColor }]}>
          {report.gaps.length} {report.gaps.length === 1 ? 'gap' : 'gaps'}
        </ActiveText>
      </View>
      <TouchableOpacity
        onPress={onDelete}
        disabled={isDeleting}
        style={styles.deleteBtn}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons
          name="trash-outline"
          size={16}
          color={isDeleting ? colors.outline : colors.error}
        />
      </TouchableOpacity>
    </AnimatedPressable>
  );
}

export default function SkillGapScreen() {
  const { state } = useAuth();
  const token = state.accessToken;
  const pulseOpacity = usePulse();

  // Upload section state
  const [pickedFile, setPickedFile] = useState<DocumentPickerAsset | null>(null);
  const [targetRole, setTargetRole] = useState('');
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [analyseError, setAnalyseError] = useState<string | null>(null);

  // History section state
  const [reports, setReports] = useState<GapReport[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadReports = useCallback(async (refreshing = false) => {
    if (!token) return;
    refreshing ? setIsRefreshing(true) : setIsLoadingHistory(true);
    setHistoryError(null);
    try {
      const data = await getReports(token);
      setReports(data);
    } catch (e: any) {
      setHistoryError(e.message ?? 'Failed to load history');
    } finally {
      setIsLoadingHistory(false);
      setIsRefreshing(false);
    }
  }, [token]);

  useFocusEffect(useCallback(() => { loadReports(); }, [loadReports]));

  const handleDelete = useCallback((report: GapReport) => {
    Alert.alert(
      'Delete Analysis',
      `This will permanently remove the gap analysis for "${report.targetRole}". This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!token) return;
            setDeletingId(report.reportId);
            setReports(prev => prev.filter(r => r.reportId !== report.reportId));
            try {
              await deleteReport(token, report.reportId);
            } catch (e: any) {
              setReports(prev => {
                const restored = [...prev, report];
                restored.sort((a, b) =>
                  (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
                return restored;
              });
              setHistoryError(e.message ?? 'Failed to delete report');
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  }, [token]);

  const handleBrowse = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ],
        copyToCacheDirectory: true,
      });
      if (!result.canceled) {
        setPickedFile(result.assets[0]);
        setAnalyseError(null);
      }
    } catch {
      setAnalyseError('Could not open file picker. Check storage permissions.');
    }
  };

  const handleAnalyse = async () => {
    if (!token || !pickedFile || !targetRole.trim()) return;
    setIsAnalysing(true);
    setAnalyseError(null);
    try {
      const report = await analyseCV(token, pickedFile, targetRole.trim());
      setPickedFile(null);
      setTargetRole('');
      router.push(`/gap-report/${report.reportId}`);
    } catch (e: any) {
      setAnalyseError(e.message ?? 'Analysis failed. Please try again.');
    } finally {
      setIsAnalysing(false);
    }
  };

  const canAnalyse = !!pickedFile && targetRole.trim().length > 0 && !isAnalysing;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerIconWrap}>
          <Ionicons name="analytics" size={18} color={colors.secondary} />
        </View>
        <View>
          <Text style={styles.headerTitle}>Skills</Text>
          <Text style={styles.headerSubtitle}>Identify & close your skill gaps</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => loadReports(true)}
            tintColor={colors.secondary}
          />
        }
      >
        {/* ── Upload section ── */}
        {isAnalysing ? (
          <Animated.View style={[styles.analysingCard, { opacity: pulseOpacity }]}>
            <View style={styles.analysingIconWrap}>
              <Ionicons name="sparkles" size={26} color={colors.secondary} />
            </View>
            <Text style={styles.analysingTitle}>Analysing your CV…</Text>
            <Text style={styles.analysingSubtitle}>Claude AI is identifying skill gaps</Text>
            <Text style={styles.analysingHint}>This may take 15–30 seconds</Text>
          </Animated.View>
        ) : (
          <View style={styles.uploadSection}>
            <Text style={styles.sectionLabel}>New Analysis</Text>

            {/* File picker card */}
            <TouchableOpacity
              style={[styles.fileCard, pickedFile && styles.fileCardPicked]}
              onPress={handleBrowse}
              activeOpacity={0.8}
            >
              <View style={[styles.fileCardIcon, pickedFile && styles.fileCardIconPicked]}>
                <Ionicons
                  name={pickedFile ? 'document-text' : 'cloud-upload-outline'}
                  size={22}
                  color={pickedFile ? colors.secondary : colors.onSurfaceVariant}
                />
              </View>
              <View style={styles.fileCardBody}>
                <Text
                  style={[styles.fileCardText, pickedFile && styles.fileCardTextPicked]}
                  numberOfLines={1}
                >
                  {pickedFile ? pickedFile.name : 'Upload your CV'}
                </Text>
                <Text style={styles.fileCardHint}>PDF or DOCX · max 5 MB</Text>
              </View>
              <View style={[styles.browseBtn, pickedFile && styles.browseBtnPicked]}>
                <Text style={[styles.browseBtnText, pickedFile && styles.browseBtnTextPicked]}>
                  {pickedFile ? 'Change' : 'Browse'}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Target role input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Target Role</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Backend Developer"
                placeholderTextColor={colors.outline}
                value={targetRole}
                onChangeText={setTargetRole}
                autoCapitalize="words"
                returnKeyType="done"
              />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {['Software Engineer', 'Data Analyst', 'UI/UX Designer', 'Cybersecurity', 'Product Manager'].map(role => {
                  const isSelected = targetRole === role;
                  return (
                    <AnimatedPressable
                      key={role}
                      style={[
                        styles.roleChip,
                        isSelected && { backgroundColor: colors.secondary, borderColor: colors.secondary }
                      ]}
                      onPress={() => setTargetRole(role)}
                    >
                      <ActiveText style={[styles.roleChipText, isSelected && { color: colors.onPrimary }]}>{role}</ActiveText>
                    </AnimatedPressable>
                  );
                })}
              </View>
            </View>

            {/* Analyse button */}
            <TouchableOpacity
              style={[styles.analyseBtn, !canAnalyse && styles.analyseBtnDisabled]}
              onPress={handleAnalyse}
              disabled={!canAnalyse}
              activeOpacity={0.85}
            >
              <Ionicons
                name="sparkles-outline"
                size={16}
                color={canAnalyse ? colors.onPrimary : colors.outline}
                style={{ marginRight: spacing.xs }}
              />
              <Text style={[styles.analyseBtnText, !canAnalyse && styles.analyseBtnTextDisabled]}>
                Analyse CV
              </Text>
            </TouchableOpacity>

            {/* Error message */}
            {analyseError ? (
              <View style={styles.errorRow}>
                <Ionicons name="alert-circle-outline" size={14} color={colors.error} />
                <Text style={styles.errorText}>{analyseError}</Text>
              </View>
            ) : null}
          </View>
        )}

        {/* ── History section ── */}
        <View style={styles.historySectionHeader}>
          <Text style={styles.sectionLabel}>Past Analyses</Text>
          {reports.length > 0 && (
            <Text style={styles.historyCount}>{reports.length}</Text>
          )}
        </View>

        {isLoadingHistory ? (
          <ActivityIndicator size="small" color={colors.secondary} style={styles.historyLoader} />
        ) : historyError ? (
          <View style={styles.errorRow}>
            <Ionicons name="alert-circle-outline" size={14} color={colors.error} />
            <Text style={styles.errorText}>{historyError}</Text>
          </View>
        ) : reports.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="document-text-outline" size={28} color={colors.onSurfaceVariant} />
            </View>
            <Text style={styles.emptyTitle}>No analyses yet</Text>
            <Text style={styles.emptySubtitle}>Upload your CV above to identify skill gaps for your target role</Text>
          </View>
        ) : (
          <View style={styles.reportsList}>
            {reports.map(report => (
              <ReportRow
                key={report.reportId}
                report={report}
                onPress={() => router.push(`/gap-report/${report.reportId}`)}
                onDelete={() => handleDelete(report)}
                isDeleting={deletingId === report.reportId}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.surfaceCard,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  headerIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: `${colors.secondary}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...typography.headlineSm,
    color: colors.onSurface,
  },
  headerSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: colors.onSurfaceVariant,
    marginTop: 1,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  sectionLabel: {
    ...typography.labelSm,
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  // ── Analysing state ──
  analysingCard: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1.5,
    borderColor: `${colors.secondary}30`,
  },
  analysingIconWrap: {
    width: 52,
    height: 52,
    borderRadius: radius.full,
    backgroundColor: `${colors.secondary}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  analysingTitle: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 18,
    lineHeight: 24,
    color: colors.onSurface,
  },
  analysingSubtitle: {
    ...typography.bodyMd,
    color: colors.onSurfaceVariant,
    fontSize: 14,
  },
  analysingHint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: colors.outline,
    marginTop: 2,
  },

  // ── Upload section ──
  uploadSection: {
    gap: spacing.sm,
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  fileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.outlineVariant,
    borderStyle: 'dashed',
    padding: spacing.md,
    gap: spacing.sm,
  },
  fileCardPicked: {
    borderStyle: 'solid',
    borderColor: `${colors.secondary}50`,
    backgroundColor: `${colors.secondary}06`,
  },
  fileCardIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileCardIconPicked: {
    backgroundColor: `${colors.secondary}15`,
  },
  fileCardBody: {
    flex: 1,
    gap: 2,
  },
  fileCardText: {
    ...typography.labelMd,
    color: colors.onSurfaceVariant,
  },
  fileCardTextPicked: {
    color: colors.onSurface,
    fontFamily: 'Inter_500Medium',
  },
  fileCardHint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: colors.outline,
  },
  browseBtn: {
    backgroundColor: colors.surfaceContainerLow,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
  },
  browseBtnPicked: {
    backgroundColor: `${colors.secondary}15`,
  },
  browseBtnText: {
    ...typography.labelMd,
    color: colors.onSurface,
    fontSize: 13,
  },
  browseBtnTextPicked: {
    color: colors.secondary,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    ...typography.labelMd,
    color: colors.onSurface,
    fontSize: 13,
  },
  textInput: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    padding: spacing.md,
    ...typography.bodyMd,
    color: colors.onSurface,
    fontSize: 15,
  },
  analyseBtn: {
    backgroundColor: colors.secondary,
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  analyseBtnDisabled: {
    backgroundColor: colors.surfaceContainerHigh,
  },
  analyseBtnText: {
    ...typography.labelMd,
    color: colors.onPrimary,
  },
  analyseBtnTextDisabled: {
    color: colors.outline,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  errorText: {
    ...typography.labelMd,
    color: colors.error,
    flex: 1,
  },

  // ── History section ──
  historySectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  historyCount: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    color: colors.onPrimary,
    backgroundColor: colors.secondary,
    borderRadius: radius.full,
    paddingHorizontal: 7,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  historyLoader: {
    marginVertical: spacing.lg,
  },
  emptyCard: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  emptyIconWrap: {
    width: 52,
    height: 52,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  emptyTitle: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 15,
    color: colors.onSurface,
  },
  emptySubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 20,
  },
  reportsList: {
    gap: spacing.sm,
  },
  deleteBtn: {
    padding: spacing.xs,
  },
  reportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  reportRowIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  reportRowBody: {
    flex: 1,
    gap: 3,
  },
  reportRowTitle: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    color: colors.onSurface,
  },
  reportRowMeta: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: colors.onSurfaceVariant,
  },
  gapBadge: {
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
    flexShrink: 0,
  },
  gapBadgeText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
  },
  roleChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  roleChipText: {
    ...typography.labelSm,
    fontSize: 12,
    color: colors.onSurfaceVariant,
  },
});
