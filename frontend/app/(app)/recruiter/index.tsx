import { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '@/context/AuthContext';
import { colors, typography, spacing, radius } from '@/constants/theme';
import { getMyPostings } from '@/services/matching';
import { type Opportunity } from '@/types/matching';
import { AnimatedFadeIn, AnimatedPressable } from '@/components/ui/AnimatedView';

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function RecruiterDashboardScreen() {
  const { state } = useAuth();
  const token = state.accessToken;
  const user = state.user;

  const [postings, setPostings] = useState<Opportunity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboardData = async () => {
    if (!token) return;
    try {
      const data = await getMyPostings(token);
      setPostings(data);
    } catch (e) {
      console.error('Failed to load dashboard data:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchDashboardData();
    }, [token])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardData();
    setRefreshing(false);
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  // Calculate summaries
  const totalPostings = postings.length;
  const activePostings = postings.filter(p => p.active).length;
  const totalApplicants = postings.reduce((sum, p) => sum + (p.applicantCount || 0), 0);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerLogoMark}>
            <Ionicons name="compass" size={20} color={colors.onPrimary} />
          </View>
          <Text style={styles.headerBrandTitle}>SkillBridge</Text>
        </View>
        <TouchableOpacity
          style={styles.headerBtn}
          accessibilityLabel="Notifications"
          onPress={() => router.push('/(app)/notifications')}
        >
          <Ionicons name="notifications-outline" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <AnimatedFadeIn delay={100} duration={400}>
          <View style={styles.greetingRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.greetingHello}>{greeting}</Text>
              <Text style={styles.greetingName}>{user?.firstName ?? 'Recruiter'} 👋</Text>
            </View>
            <View style={styles.roleBadge}>
              <Ionicons name="briefcase-outline" size={12} color={colors.secondary} />
              <Text style={styles.roleBadgeText}>Recruiter</Text>
            </View>
          </View>
        </AnimatedFadeIn>

        {isLoading && !refreshing ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xxl }} />
        ) : (
          <>
            <AnimatedFadeIn delay={200}>
              <Text style={styles.sectionTitle}>Overview</Text>
              <View style={styles.statsGrid}>
                <TouchableOpacity
                  style={styles.statCard}
                  onPress={() => router.push('/(app)/recruiter/postings')}
                  activeOpacity={0.75}
                >
                  <View style={[styles.statIconWrap, { backgroundColor: `${colors.tertiary}15` }]}>
                    <Ionicons name="briefcase" size={24} color={colors.tertiary} />
                  </View>
                  <Text style={styles.statValue}>{activePostings}</Text>
                  <Text style={styles.statLabel}>Active Jobs</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.statCard}
                  onPress={() => router.push('/(app)/recruiter/all-applicants')}
                  activeOpacity={0.75}
                >
                  <View style={[styles.statIconWrap, { backgroundColor: `${colors.secondary}15` }]}>
                    <Ionicons name="people" size={24} color={colors.secondary} />
                  </View>
                  <Text style={styles.statValue}>{totalApplicants}</Text>
                  <Text style={styles.statLabel}>Total Applicants</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.statCard}
                  onPress={() => router.push('/(app)/recruiter/postings')}
                  activeOpacity={0.75}
                >
                  <View style={[styles.statIconWrap, { backgroundColor: `${colors.primary}15` }]}>
                    <Ionicons name="document-text" size={24} color={colors.primary} />
                  </View>
                  <Text style={styles.statValue}>{totalPostings}</Text>
                  <Text style={styles.statLabel}>Total Posted</Text>
                </TouchableOpacity>
              </View>
            </AnimatedFadeIn>

            {/* Analytics & Donut Chart Section */}
            <AnimatedFadeIn delay={250}>
              <Text style={styles.sectionTitle}>Hiring Analytics & AI Insights</Text>
              <TouchableOpacity
                style={styles.chartCard}
                onPress={() => router.push('/(app)/recruiter/all-applicants')}
                activeOpacity={0.85}
              >
                <View style={styles.chartHeader}>
                  <View style={styles.donutContainer}>
                    <View style={styles.donutOuterRing}>
                      <View style={styles.donutInnerCircle}>
                        <Text style={styles.donutTotalNum}>{totalApplicants}</Text>
                        <Text style={styles.donutTotalLabel}>Candidates</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.legendContainer}>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: colors.secondary }]} />
                      <Text style={styles.legendText}>Matched Skills (60%)</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: colors.tertiary }]} />
                      <Text style={styles.legendText}>Under Review (25%)</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
                      <Text style={styles.legendText}>Verified Portfolio (15%)</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.aiInsightBox}>
                  <View style={styles.aiIconWrap}>
                    <Ionicons name="sparkles" size={18} color={colors.tertiary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.aiInsightTitle}>AI Talent Matching Active</Text>
                    <Text style={styles.aiInsightDesc}>
                      Applicants are ranked by skill verifications. Tap to view candidate profiles.
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.tertiary} style={{ alignSelf: 'center' }} />
                </View>
              </TouchableOpacity>
            </AnimatedFadeIn>

            <AnimatedFadeIn delay={300}>
              <Text style={styles.sectionTitle}>Quick Actions</Text>
              <View style={styles.actionsGrid}>
                <AnimatedPressable
                  style={styles.actionCard}
                  onPress={() => router.push('/(app)/recruiter/post')}
                >
                  <View style={[styles.actionIconWrap, { backgroundColor: `${colors.secondary}20` }]}>
                    <Ionicons name="add" size={28} color={colors.secondary} />
                  </View>
                  <Text style={styles.actionCardTitle}>Post a Job</Text>
                  <Text style={styles.actionCardDesc}>Create a new opportunity</Text>
                </AnimatedPressable>

                <AnimatedPressable
                  style={styles.actionCard}
                  onPress={() => router.push('/(app)/recruiter/postings')}
                >
                  <View style={[styles.actionIconWrap, { backgroundColor: `${colors.primary}20` }]}>
                    <Ionicons name="list" size={28} color={colors.primary} />
                  </View>
                  <Text style={styles.actionCardTitle}>View Postings</Text>
                  <Text style={styles.actionCardDesc}>Manage active jobs</Text>
                </AnimatedPressable>
              </View>
            </AnimatedFadeIn>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerLogoMark: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBrandTitle: { ...typography.headlineSm, color: colors.onSurface },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: { padding: spacing.md, paddingBottom: spacing.xxl },
  
  greetingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xl },
  greetingHello: { fontFamily: 'Inter_500Medium', fontSize: 15, color: colors.onSurfaceVariant },
  greetingName: { ...typography.headlineLg, color: colors.onSurface, marginTop: 2, fontSize: 32 },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${colors.secondary}15`,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    gap: 4,
  },
  roleBadgeText: { ...typography.labelSm, color: colors.secondary },
  
  sectionTitle: { ...typography.headlineSm, color: colors.onSurface, marginBottom: spacing.md },
  
  statsGrid: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xxl,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    alignItems: 'center',
  },
  statIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  statValue: { ...typography.headlineLg, color: colors.onSurface, fontSize: 24, marginBottom: 2 },
  statLabel: { ...typography.labelSm, color: colors.onSurfaceVariant, textAlign: 'center' },
  
  actionsGrid: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  actionCard: {
    flex: 1,
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    alignItems: 'flex-start',
  },
  actionIconWrap: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  actionCardTitle: { ...typography.labelMd, color: colors.onSurface, marginBottom: 4, fontSize: 16 },
  actionCardDesc: { fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.onSurfaceVariant },

  chartCard: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    marginBottom: spacing.xxl,
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginBottom: spacing.md,
  },
  donutContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutOuterRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 10,
    borderColor: colors.secondary,
    borderTopColor: colors.tertiary,
    borderRightColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutInnerCircle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutTotalNum: { ...typography.headlineLg, fontSize: 20, color: colors.onSurface },
  donutTotalLabel: { ...typography.labelSm, fontSize: 10, color: colors.onSurfaceVariant },
  
  legendContainer: { flex: 1, gap: spacing.xs },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { ...typography.bodySm, color: colors.onSurface, fontSize: 12 },

  aiInsightBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: `${colors.tertiary}10`,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: `${colors.tertiary}20`,
  },
  aiIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: `${colors.tertiary}20`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiInsightTitle: { ...typography.labelMd, color: colors.tertiary, marginBottom: 2 },
  aiInsightDesc: { ...typography.bodySm, color: colors.onSurfaceVariant, fontSize: 12, lineHeight: 17 },
});
