import { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { typography, spacing, radius, type ThemeColors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useTheme, useThemeStyles } from '@/context/ThemeContext';
import { getUserAchievements, getUserExp } from '@/services/achievements';
import { Achievement, UserExp } from '@/types/achievements';
import { AnimatedFadeIn } from '@/components/ui/AnimatedView';
import { LinearGradient } from 'expo-linear-gradient';

export default function AchievementsScreen() {
  const { state } = useAuth();
  const { colors } = useTheme();
  const styles = useThemeStyles(createStyles);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [expState, setExpState] = useState<UserExp | null>(null);
  const [loading, setLoading] = useState(true);

  const expAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    async function loadData() {
      if (!state.accessToken || !state.user) return;
      try {
        const [achData, expData] = await Promise.all([
          getUserAchievements(state.accessToken, state.user.id),
          getUserExp(state.accessToken, state.user.id)
        ]);
        setAchievements(achData);
        setExpState(expData);
      } catch (e) {
        console.error('Failed to load achievements', e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [state.accessToken, state.user]);

  const currentExp = expState?.currentExp ?? 0;
  const nextLevelExp = expState?.nextLevelExp ?? 100;
  const expPercentage = Math.min(100, Math.max(0, (currentExp / nextLevelExp) * 100));

  useEffect(() => {
    if (!loading && expState) {
      Animated.timing(expAnim, {
        toValue: expPercentage,
        duration: 1000,
        useNativeDriver: false,
      }).start();
    }
  }, [loading, expState, expPercentage, expAnim]);

  const animatedExpWidth = expAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  if (loading || !expState) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={colors.secondary} />
      </SafeAreaView>
    );
  }

  const unlockedCount = achievements.filter(a => !!a.unlockedAt).length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={24} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Achievements</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Hero Level Card */}
        <AnimatedFadeIn delay={100} duration={400}>
          <LinearGradient
            colors={[colors.surfaceCard, colors.surfaceCard]}
            style={styles.heroCard}
          >
            <View style={styles.heroContent}>
              <View style={styles.levelBadge}>
                <Ionicons name="star" size={24} color={colors.onPrimary} />
                <Text style={styles.levelNumber}>{expState.currentLevel}</Text>
              </View>
              <View style={styles.heroInfo}>
                <Text style={styles.heroTitle}>Level {expState.currentLevel}</Text>
                <Text style={styles.heroSubtitle}>{expState.currentExp} / {expState.nextLevelExp} XP</Text>
              </View>
            </View>

            <View style={styles.progressTrack}>
              <Animated.View style={[styles.progressFill, { width: animatedExpWidth }]} />
            </View>
            <Text style={styles.progressHint}>{expState.nextLevelExp - expState.currentExp} XP to next level</Text>
          </LinearGradient>
        </AnimatedFadeIn>

        {/* Stats Summary */}
        <AnimatedFadeIn delay={200} duration={400} style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{unlockedCount}</Text>
            <Text style={styles.statLabel}>Unlocked</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{achievements.length}</Text>
            <Text style={styles.statLabel}>Total Badges</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{expState.totalEarnedExp}</Text>
            <Text style={styles.statLabel}>Total XP</Text>
          </View>
        </AnimatedFadeIn>

        {/* Achievements List */}
        <AnimatedFadeIn delay={300} duration={400}>
          <Text style={styles.sectionTitle}>Your Badges</Text>
          <View style={styles.badgeGrid}>
            {achievements.map((ach) => {
              const isUnlocked = !!ach.unlockedAt;
              return (
                <View key={ach.id} style={[styles.badgeCard, !isUnlocked && styles.badgeCardLocked]}>
                  <View style={[styles.iconWrap, isUnlocked ? styles.iconWrapUnlocked : styles.iconWrapLocked]}>
                    <Ionicons 
                      name={ach.icon} 
                      size={28} 
                      color={isUnlocked ? colors.secondary : colors.outline} 
                    />
                  </View>
                  <View style={styles.badgeInfo}>
                    <Text style={styles.badgeTitle}>{ach.title}</Text>
                    <Text style={styles.badgeDesc}>{ach.description}</Text>
                    
                    {isUnlocked ? (
                      <View style={styles.unlockedRow}>
                        <Ionicons name="checkmark-circle" size={14} color={colors.secondary} />
                        <Text style={styles.unlockedText}>
                          Unlocked • +{ach.expReward} XP
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.lockedRow}>
                        {ach.progress !== undefined ? (
                          <View style={styles.miniProgressTrack}>
                            <View style={[styles.miniProgressFill, { width: `${ach.progress}%` }]} />
                          </View>
                        ) : null}
                        <Text style={styles.lockedText}>+{ach.expReward} XP</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </AnimatedFadeIn>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surface },
  
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
  },
  backBtn: { padding: 4 },
  headerTitle: { ...typography.headlineSm, fontSize: 18, color: colors.onSurface },
  
  scrollContent: { padding: spacing.lg, paddingBottom: spacing.xxl },

  /* Hero */
  heroCard: {
    padding: spacing.xl,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    marginBottom: spacing.lg,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 2
  },
  heroContent: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
  levelBadge: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: colors.tertiary,
    justifyContent: 'center', alignItems: 'center'
  },
  levelNumber: { position: 'absolute', fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: colors.onPrimary, marginTop: 2 },
  heroInfo: { flex: 1 },
  heroTitle: { ...typography.headlineSm, color: colors.onSurface },
  heroSubtitle: { ...typography.labelMd, color: colors.tertiary },
  progressTrack: { height: 8, backgroundColor: colors.surfaceContainerHigh, borderRadius: 4, overflow: 'hidden', marginBottom: spacing.xs },
  progressFill: { height: '100%', backgroundColor: colors.secondary, borderRadius: 4 },
  progressHint: { ...typography.bodyMd, fontSize: 13, color: colors.onSurfaceVariant, textAlign: 'right' },

  /* Stats */
  statsRow: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1, borderColor: colors.outlineVariant,
    marginBottom: spacing.xl,
    alignItems: 'center',
  },
  statBox: { flex: 1, alignItems: 'center' },
  statValue: { ...typography.headlineSm, fontSize: 20, color: colors.primary },
  statLabel: { ...typography.labelSm, color: colors.onSurfaceVariant },
  statDivider: { width: 1, height: 24, backgroundColor: colors.outlineVariant },

  /* Badges */
  sectionTitle: { ...typography.headlineSm, fontSize: 18, color: colors.onSurface, marginBottom: spacing.md },
  badgeGrid: { gap: spacing.md },
  badgeCard: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceCard,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    gap: spacing.md,
    alignItems: 'center',
  },
  badgeCardLocked: { backgroundColor: colors.surface, opacity: 0.8 },
  iconWrap: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
  iconWrapUnlocked: { backgroundColor: `${colors.secondary}15` },
  iconWrapLocked: { backgroundColor: colors.surfaceContainerHigh },
  badgeInfo: { flex: 1 },
  badgeTitle: { ...typography.labelMd, color: colors.onSurface, marginBottom: 2 },
  badgeDesc: { ...typography.bodyMd, fontSize: 13, color: colors.onSurfaceVariant, marginBottom: spacing.sm },
  
  unlockedRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  unlockedText: { ...typography.labelSm, color: colors.secondary },
  
  lockedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  miniProgressTrack: { flex: 1, height: 4, backgroundColor: colors.surfaceContainerHigh, borderRadius: 2, overflow: 'hidden' },
  miniProgressFill: { height: '100%', backgroundColor: colors.tertiary, borderRadius: 2 },
  lockedText: { ...typography.labelSm, color: colors.outline },
});
