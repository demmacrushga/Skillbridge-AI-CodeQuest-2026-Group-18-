import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Linking,
  BackHandler,
  Alert,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '@/context/AuthContext';
import { colors, typography, spacing, radius } from '@/constants/theme';
import { getReport, deleteReport } from '@/services/skillGap';
import { type GapReport, type SkillGapItem, type RecommendationResponse } from '@/types/skillGap';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

const RESOURCE_TYPE_CONFIG: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  COURSE:   { icon: 'school-outline',      color: colors.tertiary },
  BOOK:     { icon: 'book-outline',        color: colors.secondary },
  PROJECT:  { icon: 'code-slash-outline',  color: colors.primary },
};

function getTypeConfig(type: string) {
  return RESOURCE_TYPE_CONFIG[type] ?? { icon: 'link-outline' as const, color: colors.onSurfaceVariant };
}

function getPriorityConfig(rank: number) {
  if (rank === 1) return { color: '#DC2626', label: 'Critical' };
  if (rank === 2) return { color: '#EA580C', label: 'High' };
  if (rank === 3) return { color: '#CA8A04', label: 'Medium' };
  return { color: colors.secondary, label: 'Low' };
}

function RecommendationRow({ rec }: { rec: RecommendationResponse }) {
  const cfg = getTypeConfig(rec.type);
  return (
    <TouchableOpacity
      style={styles.recRow}
      onPress={() => rec.url && Linking.openURL(rec.url)}
      activeOpacity={rec.url ? 0.7 : 1}
      disabled={!rec.url}
    >
      <View style={[styles.recIconWrap, { backgroundColor: `${cfg.color}12` }]}>
        <Ionicons name={cfg.icon} size={14} color={cfg.color} />
      </View>
      <Text style={styles.recTitle} numberOfLines={2}>{rec.title}</Text>
      {rec.url ? (
        <View style={styles.recLinkBadge}>
          <Ionicons name="open-outline" size={12} color={colors.tertiary} />
          <Text style={styles.recLinkText}>Open</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

function GapCard({ gap, defaultExpanded }: { gap: SkillGapItem; defaultExpanded: boolean }) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const priority = getPriorityConfig(gap.importanceRank);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsExpanded(e => !e);
  };

  return (
    <View style={[styles.gapCard, { borderLeftColor: priority.color }]}>
      <TouchableOpacity style={styles.gapHeader} onPress={toggle} activeOpacity={0.75}>
        <View style={[styles.rankBadge, { backgroundColor: `${priority.color}15` }]}>
          <Text style={[styles.rankText, { color: priority.color }]}>#{gap.importanceRank}</Text>
        </View>
        <View style={styles.gapHeaderText}>
          <Text style={styles.skillName} numberOfLines={isExpanded ? undefined : 1}>
            {gap.skillName}
          </Text>
          <View style={[styles.priorityPill, { backgroundColor: `${priority.color}12` }]}>
            <Text style={[styles.priorityText, { color: priority.color }]}>{priority.label}</Text>
          </View>
        </View>
        <Ionicons
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={colors.onSurfaceVariant}
        />
      </TouchableOpacity>

      {isExpanded && (
        <View style={styles.gapBody}>
          <Text style={styles.gapDescription}>{gap.description}</Text>
          {gap.recommendations.length > 0 && (
            <>
              <View style={styles.divider} />
              <View style={styles.recsHeader}>
                <Text style={styles.recsLabel}>Resources</Text>
                <Text style={styles.recsCount}>{gap.recommendations.length}</Text>
              </View>
              {gap.recommendations.map(rec => (
                <RecommendationRow key={rec.id} rec={rec} />
              ))}
            </>
          )}
        </View>
      )}
    </View>
  );
}

export default function GapReportScreen() {
  const { reportId } = useLocalSearchParams<{ reportId: string }>();
  const { state } = useAuth();
  const token = state.accessToken;

  const [report, setReport] = useState<GapReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchReport = useCallback(async () => {
    if (!token || !reportId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await getReport(token, reportId);
      setReport(data);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load report');
    } finally {
      setIsLoading(false);
    }
  }, [token, reportId]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        router.navigate('/(app)/skill-gap');
        return true;
      });
      return () => sub.remove();
    }, [])
  );

  const handleDelete = useCallback(() => {
    if (!token || !reportId) return;
    Alert.alert(
      'Delete Analysis',
      `This will permanently remove the gap analysis for "${report?.targetRole ?? 'this report'}". This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            try {
              await deleteReport(token, reportId);
              router.navigate('/(app)/skill-gap');
            } catch (e: any) {
              setError(e.message ?? 'Failed to delete report');
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  }, [token, reportId, report?.targetRole]);

  const sortedGaps = report
    ? [...report.gaps].sort((a, b) => a.importanceRank - b.importanceRank)
    : [];

  const criticalCount = sortedGaps.filter(g => g.importanceRank === 1).length;
  const resourceCount = sortedGaps.reduce((sum, g) => sum + g.recommendations.length, 0);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.navigate('/(app)/skill-gap')} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={colors.primary} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {report?.targetRole ?? 'Gap Report'}
          </Text>
          {report && (
            <Text style={styles.headerSubtitle}>Tap a skill to expand details</Text>
          )}
        </View>
        <TouchableOpacity
          onPress={handleDelete}
          disabled={isDeleting || isLoading}
          style={styles.deleteBtn}
          activeOpacity={0.7}
        >
          <Ionicons
            name="trash-outline"
            size={20}
            color={isDeleting || isLoading ? colors.outline : colors.error}
          />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.secondary} />
          <Text style={styles.loadingText}>Loading report…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={40} color={colors.error} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchReport} activeOpacity={0.8}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Stats hero */}
          {report && (
            <View style={styles.heroCard}>
              <Text style={styles.heroEyebrow}>SKILL GAP ANALYSIS</Text>
              <Text style={styles.heroRole}>{report.targetRole}</Text>
              <View style={styles.heroStats}>
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatValue}>{sortedGaps.length}</Text>
                  <Text style={styles.heroStatLabel}>Gaps</Text>
                </View>
                <View style={styles.heroStatDivider} />
                <View style={styles.heroStat}>
                  <Text style={[styles.heroStatValue, criticalCount > 0 && styles.heroStatCritical]}>
                    {criticalCount}
                  </Text>
                  <Text style={styles.heroStatLabel}>Critical</Text>
                </View>
                <View style={styles.heroStatDivider} />
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatValue}>{resourceCount}</Text>
                  <Text style={styles.heroStatLabel}>Resources</Text>
                </View>
              </View>
            </View>
          )}

          {/* Priority legend */}
          {sortedGaps.length > 0 && (
            <View style={styles.legendRow}>
              {[
                { color: '#DC2626', label: 'Critical' },
                { color: '#EA580C', label: 'High' },
                { color: '#CA8A04', label: 'Medium' },
                { color: colors.secondary, label: 'Low' },
              ].map(p => (
                <View key={p.label} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: p.color }]} />
                  <Text style={styles.legendText}>{p.label}</Text>
                </View>
              ))}
            </View>
          )}

          {sortedGaps.map((gap, index) => (
            <GapCard key={gap.id} gap={gap} defaultExpanded={index === 0} />
          ))}
        </ScrollView>
      )}
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
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.surfaceCard,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
    gap: spacing.sm,
  },
  backBtn: {
    padding: spacing.xs,
  },
  deleteBtn: {
    padding: spacing.xs,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    ...typography.headlineSm,
    color: colors.onSurface,
  },
  headerSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: colors.onSurfaceVariant,
    marginTop: 2,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  loadingText: {
    ...typography.bodyMd,
    color: colors.onSurfaceVariant,
  },
  errorText: {
    ...typography.bodyMd,
    color: colors.error,
    textAlign: 'center',
  },
  retryBtn: {
    backgroundColor: colors.secondary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  retryText: {
    ...typography.labelMd,
    color: colors.onPrimary,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.sm,
  },

  // ── Hero card ──
  heroCard: {
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.xs,
  },
  heroEyebrow: {
    ...typography.labelSm,
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 1.2,
    marginBottom: spacing.xs,
  },
  heroRole: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 22,
    lineHeight: 28,
    color: colors.onPrimary,
    marginBottom: spacing.md,
  },
  heroStats: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
  },
  heroStat: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  heroStatDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  heroStatValue: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 22,
    lineHeight: 26,
    color: colors.onPrimary,
  },
  heroStatCritical: {
    color: '#FCA5A5',
  },
  heroStatLabel: {
    ...typography.labelSm,
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
  },

  // ── Legend ──
  legendRow: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.xs,
    marginBottom: spacing.xs,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
  },
  legendText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: colors.onSurfaceVariant,
  },

  // ── Gap card ──
  gapCard: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderLeftWidth: 3,
    overflow: 'hidden',
  },
  gapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
  rankBadge: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rankText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 12,
    lineHeight: 14,
  },
  gapHeaderText: {
    flex: 1,
    gap: 4,
  },
  skillName: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 15,
    lineHeight: 20,
    color: colors.onSurface,
  },
  priorityPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  priorityText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 0.3,
  },
  gapBody: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  gapDescription: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 22,
    color: colors.onSurfaceVariant,
  },
  divider: {
    height: 1,
    backgroundColor: colors.outlineVariant,
    marginVertical: spacing.sm,
  },
  recsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  recsLabel: {
    ...typography.labelSm,
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  recsCount: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    color: colors.onPrimary,
    backgroundColor: colors.secondary,
    borderRadius: radius.full,
    paddingHorizontal: 6,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  recRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs + 2,
  },
  recIconWrap: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  recTitle: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    lineHeight: 18,
    color: colors.onSurface,
    flex: 1,
  },
  recLinkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: `${colors.tertiary}12`,
    borderRadius: radius.sm,
    paddingHorizontal: 7,
    paddingVertical: 3,
    flexShrink: 0,
  },
  recLinkText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    color: colors.tertiary,
  },
});
