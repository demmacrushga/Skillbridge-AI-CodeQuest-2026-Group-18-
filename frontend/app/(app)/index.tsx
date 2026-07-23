import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ActivityIndicator,
  Image,
  Dimensions,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, Redirect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { getUnreadCount } from '@/services/notification';
import { useAuth } from '@/context/AuthContext';
import { colors, typography, spacing, radius } from '@/constants/theme';
import { getRoadmap } from '@/services/career';
import { type Milestone, type Roadmap } from '@/types/career';
import { Skeleton } from '@/components/ui/Skeleton';
import { AnimatedFadeIn, AnimatedPressable } from '@/components/ui/AnimatedView';

const TYPE_CONFIG: Record<Milestone['type'], { icon: keyof typeof Ionicons.glyphMap; color: string; label: string }> = {
  SKILL: { icon: 'book-outline', color: colors.tertiary, label: 'Skill' },
  PROJECT: { icon: 'code-slash-outline', color: colors.secondary, label: 'Project' },
  CERT: { icon: 'trophy-outline', color: '#B45309', label: 'Cert' },
  EXPERIENCE: { icon: 'briefcase-outline', color: colors.onSurfaceVariant, label: 'Experience' },
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

const SCREEN_WIDTH = Dimensions.get('window').width;
const GRID_PADDING = spacing.lg * 2; // left + right padding
const GRID_GAP = spacing.sm + 4; // 12px gap between items
const COLUMNS = 4;
const QUICK_LINK_SIZE = (SCREEN_WIDTH - GRID_PADDING - GRID_GAP * (COLUMNS - 1)) / COLUMNS;

interface QuickLinkProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  onPress: () => void;
  index: number;
}

function QuickLink({ icon, label, color, onPress, index }: QuickLinkProps) {
  return (
    <AnimatedFadeIn delay={400 + index * 60} duration={400}>
      <AnimatedPressable
        style={[styles.quickLink, { width: QUICK_LINK_SIZE }]}
        onPress={onPress}
        activeOpacity={0.75}
      >
        <View style={[styles.quickLinkIcon, { backgroundColor: `${color}15` }]}>
          <Ionicons name={icon} size={22} color={color} />
        </View>
        <Text style={styles.quickLinkLabel} numberOfLines={1}>{label}</Text>
      </AnimatedPressable>
    </AnimatedFadeIn>
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

  if (user?.role === 'RECRUITER') {
    // @ts-ignore: expo-router typing bug for index routes
    return <Redirect href="/(app)/recruiter" />;
  }

  if (user?.role === 'ALUMNI') {
    // @ts-ignore: expo-router typing bug for index routes
    return <Redirect href="/(app)/alumni" />;
  }

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
  const remainingMilestones = roadmap?.milestones.filter(m => !m.completed) || [];
  const SCREEN_WIDTH = Dimensions.get('window').width;

  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: Math.min(progress, 100),
      duration: 900,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  const animatedWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

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

      <View style={styles.scrollContent}>

        {/* Greeting */}
        <AnimatedFadeIn delay={100} duration={400}>
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
        </AnimatedFadeIn>

        {/* Quick actions */}
        <AnimatedFadeIn delay={150} duration={400}>
          <Text style={styles.sectionLabel}>Quick Access</Text>
        </AnimatedFadeIn>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickLinkGrid}>
          {[
            {
              icon: 'compass-outline' as const,
              label: 'Explore',
              color: colors.secondary,
              roles: ['STUDENT', 'ALUMNI'],
              onPress: () => router.push('./career'),
            },
            {
              icon: 'person-outline' as const,
              label: 'Profile',
              color: colors.tertiary,
              roles: ['STUDENT', 'RECRUITER', 'ALUMNI', 'ADMIN'],
              onPress: () => router.push('./profile'),
            },
            {
              icon: 'analytics-outline' as const,
              label: 'Skills',
              color: colors.secondary,
              roles: ['STUDENT', 'RECRUITER', 'ALUMNI', 'ADMIN'],
              onPress: () => router.push('./skill-gap'),
            },
            {
              icon: 'folder-open-outline' as const,
              label: 'Portfolio',
              color: colors.primary,
              roles: ['STUDENT', 'RECRUITER', 'ALUMNI', 'ADMIN'],
              onPress: () => router.push('./portfolio'),
            },
            {
              icon: 'mic-outline' as const,
              label: 'Interview',
              color: colors.tertiary,
              roles: ['STUDENT', 'RECRUITER', 'ALUMNI', 'ADMIN'],
              onPress: () => router.push('./mock-interview'),
            },
            {
              icon: 'briefcase-outline' as const,
              label: 'Opportunities',
              color: colors.primary,
              roles: ['STUDENT', 'RECRUITER'],
              onPress: () =>
                router.push(
                  user?.role === 'RECRUITER'
                    ? './opportunities-manage'
                    : './opportunities'
                ),
            },
            {
              icon: 'trophy-outline' as const,
              label: 'Challenges',
              color: colors.secondary,
              roles: ['STUDENT', 'RECRUITER'],
              onPress: () =>
                router.push(
                  user?.role === 'RECRUITER'
                    ? './challenges-manage'
                    : './challenges'
                ),
            },
            {
              icon: 'people-outline' as const,
              label: 'Mentorship',
              color: colors.tertiary,
              roles: ['STUDENT', 'ALUMNI'],
              onPress: () =>
                router.push(
                  user?.role === 'ALUMNI'
                    ? './mentorship-manage'
                    : './mentorship'
                ),
            },
          ]
            .filter(link => !user?.role || link.roles.includes(user.role))
            .map((link, idx) => (
              <QuickLink
                key={link.label}
                icon={link.icon}
                label={link.label}
                color={link.color}
                onPress={link.onPress}
                index={idx}
              />
            ))}
        </ScrollView>

        {/* Hero progress card */}
        <AnimatedFadeIn delay={200} duration={450}>
          <View style={styles.heroCard}>
            {/* Top row */}
            <View style={styles.heroTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.heroEyebrow}>CAREER READINESS</Text>
                {loadingRoadmap ? (
                  <Skeleton width="60%" height={22} style={{ marginTop: spacing.xs }} />
                ) : roadmap ? (
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

            {/* Animated Progress bar */}
            <View style={styles.heroProgressTrack}>
              <Animated.View style={[styles.heroProgressFill, { width: animatedWidth }]} />
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
        </AnimatedFadeIn>

        {/* Up Next card */}
        {loadingRoadmap ? (
          <AnimatedFadeIn delay={300} duration={400}>
            <View style={styles.upNextCard}>
              <Skeleton width={120} height={14} style={{ marginBottom: spacing.sm }} />
              <Skeleton width="75%" height={22} style={{ marginBottom: spacing.xs }} />
              <Skeleton width="90%" height={14} />
            </View>
          </AnimatedFadeIn>
        ) : remainingMilestones.length > 0 ? (
          <AnimatedFadeIn delay={300} duration={450}>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              snapToInterval={SCREEN_WIDTH - spacing.md * 2}
              decelerationRate="fast"
              style={{ marginHorizontal: -spacing.md }}
              contentContainerStyle={{ paddingHorizontal: spacing.md }}
            >
              {remainingMilestones.map((milestone, idx) => {
                const cfg = TYPE_CONFIG[milestone.type] ?? TYPE_CONFIG.SKILL;
                return (
                  <TouchableOpacity
                    key={milestone.id}
                    style={[
                      styles.upNextCard,
                      {
                        width: SCREEN_WIDTH - spacing.md * 2 - spacing.sm,
                        marginRight: idx === remainingMilestones.length - 1 ? 0 : spacing.sm
                      }
                    ]}
                    onPress={() => router.push('./career')}
                    activeOpacity={0.82}
                  >
                    <View style={styles.upNextHeader}>
                      <View style={styles.upNextLive}>
                        {idx === 0 && <Animated.View style={[styles.upNextDot, { opacity: pulseOpacity }]} />}
                        <Text style={styles.upNextEyebrow}>
                          {idx === 0 ? 'UP NEXT · ' : 'UPCOMING · '}
                          {user?.role === 'ALUMNI' ? `PHASE ${milestone.semester}` : `SEMESTER ${milestone.semester}`}
                        </Text>
                      </View>
                      <Ionicons name="arrow-forward" size={16} color={colors.tertiary} />
                    </View>

                    <Text style={styles.upNextTitle}>{milestone.title}</Text>
                    {milestone.description ? (
                      <Text style={styles.upNextDesc} numberOfLines={2}>{milestone.description}</Text>
                    ) : null}

                    <View style={styles.upNextFooter}>
                      <View style={[styles.upNextTypeBadge, { backgroundColor: `${cfg.color}15`, borderColor: `${cfg.color}35` }]}>
                        <Ionicons name={cfg.icon} size={11} color={cfg.color} />
                        <Text style={[styles.upNextTypeText, { color: cfg.color }]}>{cfg.label}</Text>
                      </View>
                      <Text style={styles.upNextCta}>Tap to open roadmap →</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </AnimatedFadeIn>
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



      </View>
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
    paddingVertical: spacing.md,
    backgroundColor: colors.surface, // Blend with background
    borderBottomWidth: 0,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerLogoMark: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerBrandTitle: {
    ...typography.headlineSm,
    color: colors.primary,
    fontSize: 20,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
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

  scrollContent: { padding: spacing.lg, paddingBottom: spacing.xxl + 130 },

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
    backgroundColor: '#000000',
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: '#262626',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 5,
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
    height: 8,
    backgroundColor: '#262626',
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
    backgroundColor: '#171717',
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
    padding: spacing.md,
    marginBottom: spacing.xs,
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
    gap: spacing.sm,
    marginBottom: spacing.sm,
    paddingHorizontal: 4, // for shadow clipping
  },
  quickLink: {
    width: 80,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    minHeight: 76,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  quickLinkIcon: {
    width: 40,
    height: 40,
    borderRadius: 16,
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
