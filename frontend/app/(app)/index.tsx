import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { getUnreadCount } from '@/services/notification';
import { useAuth } from '@/context/AuthContext';
import { colors, typography, spacing, radius } from '@/constants/theme';
import { getRoadmap } from '@/services/career';
import { type Milestone, type Roadmap } from '@/types/career';

const TYPE_CONFIG: Record<Milestone['type'], { icon: keyof typeof Ionicons.glyphMap; color: string; label: string }> = {
  SKILL:      { icon: 'book-outline',      color: colors.tertiary,         label: 'Skill' },
  PROJECT:    { icon: 'code-slash-outline', color: colors.secondary,        label: 'Project' },
  CERT:       { icon: 'trophy-outline',     color: '#B45309',               label: 'Cert' },
  EXPERIENCE: { icon: 'briefcase-outline',  color: colors.onSurfaceVariant, label: 'Experience' },
};

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

interface QuickLinkProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  onPress: () => void;
}

function QuickLink({ icon, label, color, onPress }: QuickLinkProps) {
  return (
    <TouchableOpacity style={styles.quickLink} onPress={onPress} activeOpacity={0.75}>
      <View style={[styles.quickLinkIcon, { backgroundColor: `${color}15` }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <Text style={styles.quickLinkLabel} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function DashboardScreen() {
  const { state } = useAuth();
  const user = state.user;
  const pulseOpacity = usePulse();

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const roleLabel = user?.role
    ? user.role.charAt(0) + user.role.slice(1).toLowerCase()
    : 'Student';

  const [roadmap, setRoadmap] = useState<Roadmap | null>(null);
  const [loadingRoadmap, setLoadingRoadmap] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnreadCount = useCallback(async () => {
    if (!state.accessToken) return;
    try {
      const data = await getUnreadCount(state.accessToken);
      setUnreadCount(data.unread);
    } catch {
      setUnreadCount(0);
    }
  }, [state.accessToken]);

  useFocusEffect(
    useCallback(() => {
      fetchUnreadCount();
    }, [fetchUnreadCount])
  );

  const fetchRoadmap = useCallback(async () => {
    if (!state.accessToken || !state.user) { setLoadingRoadmap(false); return; }
    try {
      const data = await getRoadmap(state.accessToken, state.user.id);
      setRoadmap(data);
    } catch {
      setRoadmap(null);
    } finally {
      setLoadingRoadmap(false);
    }
  }, [state.accessToken, state.user]);

  useEffect(() => { fetchRoadmap(); }, [fetchRoadmap]);

  const doneCount = roadmap?.milestones.filter(m => m.completed).length ?? 0;
  const totalCount = roadmap?.milestones.length ?? 0;
  const progress = roadmap?.progressPercent ?? 0;

  const nextMilestone = roadmap?.milestones
    .slice()
    .sort((a, b) => a.semester - b.semester || a.order - b.order)
    .find(m => !m.completed) ?? null;

  const nextCfg = nextMilestone ? (TYPE_CONFIG[nextMilestone.type] ?? TYPE_CONFIG.SKILL) : null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerBrand}>
          <View style={styles.logoMark}>
            <Ionicons name="compass" size={18} color={colors.onPrimary} />
          </View>
          <Text style={styles.brandName}>SkillBridge</Text>
        </View>
        <TouchableOpacity
          style={styles.headerBtn}
          accessibilityLabel="Notifications"
          onPress={() => router.push('./notifications')}
        >
          <Ionicons name="notifications-outline" size={22} color={colors.primary} />
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Greeting */}
        <View style={styles.greetingRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greetingHello}>{greeting}</Text>
            <Text style={styles.greetingName}>{user?.firstName ?? 'Student'} 👋</Text>
          </View>
          <View style={styles.roleBadge}>
            <Ionicons name="school-outline" size={12} color={colors.secondary} />
            <Text style={styles.roleBadgeText}>{roleLabel}</Text>
          </View>
        </View>

        {/* Hero progress card */}
        <View style={styles.heroCard}>
          {/* Top row */}
          <View style={styles.heroTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroEyebrow}>CAREER READINESS</Text>
              {roadmap ? (
                <Text style={styles.heroCareerPath} numberOfLines={1}>{roadmap.careerPath}</Text>
              ) : (
                <Text style={styles.heroCareerPathMuted}>No roadmap yet</Text>
              )}
            </View>
            <View style={styles.heroScoreBadge}>
              <Text style={styles.heroScoreNum}>{progress}</Text>
              <Text style={styles.heroScorePct}>%</Text>
            </View>
          </View>

          {/* Progress bar */}
          <View style={styles.heroProgressTrack}>
            <Animated.View style={[styles.heroProgressFill, { width: `${Math.min(progress, 100)}%` }]} />
          </View>

          {/* Stats strip */}
          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{loadingRoadmap ? '—' : doneCount}</Text>
              <Text style={styles.heroStatLabel}>Completed</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{loadingRoadmap ? '—' : totalCount}</Text>
              <Text style={styles.heroStatLabel}>Milestones</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{loadingRoadmap ? '—' : (totalCount - doneCount)}</Text>
              <Text style={styles.heroStatLabel}>Remaining</Text>
            </View>
          </View>
        </View>

        {/* Up Next card */}
        {loadingRoadmap ? (
          <View style={styles.upNextLoading}>
            <ActivityIndicator size="small" color={colors.tertiary} />
            <Text style={styles.upNextLoadingText}>Loading your roadmap…</Text>
          </View>
        ) : nextMilestone && nextCfg ? (
          <TouchableOpacity
            style={styles.upNextCard}
            onPress={() => router.push('./career')}
            activeOpacity={0.82}
          >
            <View style={styles.upNextHeader}>
              <View style={styles.upNextLive}>
                <Animated.View style={[styles.upNextDot, { opacity: pulseOpacity }]} />
                <Text style={styles.upNextEyebrow}>UP NEXT · SEMESTER {nextMilestone.semester}</Text>
              </View>
              <Ionicons name="arrow-forward" size={16} color={colors.tertiary} />
            </View>

            <Text style={styles.upNextTitle}>{nextMilestone.title}</Text>
            {nextMilestone.description ? (
              <Text style={styles.upNextDesc} numberOfLines={2}>{nextMilestone.description}</Text>
            ) : null}

            <View style={styles.upNextFooter}>
              <View style={[styles.upNextTypeBadge, { backgroundColor: `${nextCfg.color}15`, borderColor: `${nextCfg.color}35` }]}>
                <Ionicons name={nextCfg.icon} size={11} color={nextCfg.color} />
                <Text style={[styles.upNextTypeText, { color: nextCfg.color }]}>{nextCfg.label}</Text>
              </View>
              <Text style={styles.upNextCta}>Tap to open roadmap →</Text>
            </View>
          </TouchableOpacity>
        ) : !roadmap ? (
          <TouchableOpacity style={styles.noRoadmapCard} onPress={() => router.push('./career')} activeOpacity={0.82}>
            <View style={styles.noRoadmapIconWrap}>
              <Ionicons name="compass-outline" size={28} color={colors.tertiary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.noRoadmapTitle}>Build your roadmap</Text>
              <Text style={styles.noRoadmapSub}>Choose a career path to get your AI-powered plan</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.tertiary} />
          </TouchableOpacity>
        ) : (
          <View style={styles.allDoneCard}>
            <Ionicons name="trophy" size={24} color="#F59E0B" />
            <View style={{ flex: 1 }}>
              <Text style={styles.allDoneTitle}>All milestones complete! 🎉</Text>
              <Text style={styles.allDoneSub}>Ready for the next step in your career.</Text>
            </View>
          </View>
        )}

        {/* Quick actions */}
        <Text style={styles.sectionLabel}>Quick Access</Text>
        <View style={styles.quickLinkGrid}>
          <QuickLink
            icon="compass-outline"
            label="Career"
            color={colors.secondary}
            onPress={() => router.push('./career')}
          />
          <QuickLink
            icon="person-outline"
            label="Profile"
            color={colors.tertiary}
            onPress={() => router.push('./profile')}
          />
          <QuickLink
            icon="analytics-outline"
            label="Skills"
            color={colors.secondary}
            onPress={() => router.push('./skill-gap')}
          />
          <QuickLink
            icon="folder-open-outline"
            label="Portfolio"
            color={colors.primary}
            onPress={() => router.push('./portfolio')}
          />
          <QuickLink
            icon="mic-outline"
            label="Interview"
            color={colors.tertiary}
            onPress={() => router.push('./mock-interview')}
          />
          <QuickLink
            icon="briefcase-outline"
            label="Opportunities"
            color={colors.primary}
            onPress={() =>
              router.push(
                user?.role === 'RECRUITER'
                  ? './opportunities-manage'
                  : './opportunities'
              )
            }
          />
          <QuickLink
            icon="trophy-outline"
            label="Challenges"
            color={colors.secondary}
            onPress={() =>
              router.push(
                user?.role === 'RECRUITER'
                  ? './challenges-manage'
                  : './challenges'
              )
            }
          />
          <QuickLink
            icon="people-outline"
            label="Mentorship"
            color={colors.tertiary}
            onPress={() =>
              router.push(
                user?.role === 'ALUMNI'
                  ? './mentorship-manage'
                  : './mentorship'
              )
            }
          />
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },

  /* Header */
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    backgroundColor: colors.surfaceCard,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  headerBrand: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  logoMark: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandName: { ...typography.headlineSm, color: colors.primary },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceContainerLow,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.error,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    ...typography.labelSm,
    color: colors.onPrimary,
    fontSize: 10,
  },

  scrollContent: { padding: spacing.lg, paddingBottom: spacing.xxl + 24 },

  /* Greeting */
  greetingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
  },
  greetingHello: { ...typography.bodyMd, color: colors.onSurfaceVariant },
  greetingName: { ...typography.headlineMd, color: colors.primary, marginTop: 2 },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  roleBadgeText: { ...typography.labelSm, color: colors.secondary },

  /* Hero card */
  heroCard: {
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  heroEyebrow: {
    ...typography.labelSm,
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  heroCareerPath: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 22,
    lineHeight: 28,
    color: colors.onPrimary,
  },
  heroCareerPathMuted: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 18,
    lineHeight: 24,
    color: 'rgba(255,255,255,0.4)',
  },
  heroScoreBadge: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: colors.secondary,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignSelf: 'flex-start',
    flexShrink: 0,
  },
  heroScoreNum: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 28,
    lineHeight: 32,
    color: colors.onPrimary,
  },
  heroScorePct: {
    ...typography.labelMd,
    color: 'rgba(255,255,255,0.75)',
    marginBottom: 4,
    marginLeft: 2,
  },
  heroProgressTrack: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: radius.full,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  heroProgressFill: {
    height: '100%',
    backgroundColor: colors.secondary,
    borderRadius: radius.full,
  },
  heroStats: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
  },
  heroStat: { flex: 1, alignItems: 'center', gap: 3 },
  heroStatDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.12)' },
  heroStatValue: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 22,
    lineHeight: 26,
    color: colors.onPrimary,
  },
  heroStatLabel: { ...typography.labelSm, color: 'rgba(255,255,255,0.5)', fontSize: 11 },

  /* Up Next card */
  upNextCard: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1.5,
    borderColor: `${colors.tertiary}40`,
    shadowColor: colors.tertiary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
  },
  upNextHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  upNextLive: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  upNextDot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.tertiary,
  },
  upNextEyebrow: {
    ...typography.labelSm,
    color: colors.tertiary,
    letterSpacing: 0.8,
    fontSize: 10,
  },
  upNextTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 18,
    lineHeight: 24,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  upNextDesc: {
    ...typography.bodyMd,
    color: colors.onSurfaceVariant,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: spacing.md,
  },
  upNextFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  upNextTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
  },
  upNextTypeText: { ...typography.labelSm, fontSize: 10 },
  upNextCta: { ...typography.labelSm, color: colors.tertiary, fontSize: 11 },

  upNextLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  upNextLoadingText: { ...typography.labelMd, color: colors.onSurfaceVariant },

  /* No roadmap / all done states */
  noRoadmapCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: `${colors.tertiary}0A`,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1.5,
    borderColor: `${colors.tertiary}30`,
    borderStyle: 'dashed',
  },
  noRoadmapIconWrap: {
    width: 52,
    height: 52,
    borderRadius: radius.full,
    backgroundColor: `${colors.tertiary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  noRoadmapTitle: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 15, color: colors.primary, marginBottom: 3 },
  noRoadmapSub: { ...typography.bodyMd, color: colors.onSurfaceVariant, fontSize: 13 },

  allDoneCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: '#FFFBEB',
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  allDoneTitle: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 15, color: colors.primary, marginBottom: 3 },
  allDoneSub: { ...typography.bodyMd, color: colors.onSurfaceVariant, fontSize: 13 },

  /* Quick link grid */
  sectionLabel: {
    ...typography.labelSm,
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.md,
  },
  quickLinkGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  quickLink: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  quickLinkIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickLinkLabel: {
    ...typography.labelSm,
    color: colors.onSurface,
    textAlign: 'center',
    fontSize: 11,
  },
});
