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
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '@/context/AuthContext';
import { useTheme, useThemeStyles } from '@/context/ThemeContext';
import { typography, spacing, radius, type ThemeColors } from '@/constants/theme';
import { startSession, getSessions, deleteSession } from '@/services/mockInterview';
import { type Difficulty, type SessionSummary } from '@/types/mockInterview';

const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: 'ENTRY', label: 'Entry' },
  { value: 'MID', label: 'Mid' },
  { value: 'SENIOR', label: 'Senior' },
];

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

function SessionRow({
  session,
  onPress,
  onLongPress,
  isDeleting,
}: {
  session: SessionSummary;
  onPress: () => void;
  onLongPress: () => void;
  isDeleting: boolean;
}) {
  const { colors } = useTheme();
  const styles = useThemeStyles(createStyles);
  const dateStr = session.createdAt
    ? new Date(session.createdAt).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '';
  const accent = session.status === 'COMPLETED' ? colors.secondary : colors.tertiary;

  return (
    <TouchableOpacity
      style={[styles.sessionRow, isDeleting && styles.sessionRowDeleting]}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.75}
    >
      <View style={[styles.sessionRowIcon, { backgroundColor: `${accent}12` }]}>
        <Ionicons name="mic-outline" size={18} color={accent} />
      </View>
      <View style={styles.sessionRowBody}>
        <Text style={styles.sessionRowTitle} numberOfLines={1}>{session.targetRole}</Text>
        <Text style={styles.sessionRowMeta}>
          {session.difficulty.charAt(0) + session.difficulty.slice(1).toLowerCase()} · {dateStr}
        </Text>
      </View>
      {session.status === 'COMPLETED' ? (
        <View style={[styles.scoreBadge, { backgroundColor: `${colors.secondary}15` }]}>
          <Text style={[styles.scoreBadgeText, { color: colors.secondary }]}>
            {session.overallScore ?? '—'}/100
          </Text>
        </View>
      ) : (
        <View style={[styles.scoreBadge, { backgroundColor: `${colors.tertiary}15` }]}>
          <Text style={[styles.scoreBadgeText, { color: colors.tertiary }]}>In progress</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function MockInterviewScreen() {
  const { state } = useAuth();
  const { colors } = useTheme();
  const styles = useThemeStyles(createStyles);
  const token = state.accessToken;
  const pulseOpacity = usePulse();

  const [targetRole, setTargetRole] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('ENTRY');
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadSessions = useCallback(
    async (refreshing = false) => {
      if (!token) return;
      refreshing ? setIsRefreshing(true) : setIsLoadingHistory(true);
      setHistoryError(null);
      try {
        const data = await getSessions(token);
        setSessions(data);
      } catch (e: any) {
        setHistoryError(e.message ?? 'Failed to load history');
      } finally {
        setIsLoadingHistory(false);
        setIsRefreshing(false);
      }
    },
    [token]
  );

  useFocusEffect(useCallback(() => { loadSessions(); }, [loadSessions]));

  const handleDelete = useCallback(
    (session: SessionSummary) => {
      Alert.alert(
        'Delete Session',
        `This will permanently remove the interview for "${session.targetRole}". This cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              if (!token) return;
              setDeletingId(session.id);
              setSessions(prev => prev.filter(s => s.id !== session.id));
              try {
                await deleteSession(token, session.id);
              } catch (e: any) {
                setSessions(prev => {
                  const restored = [...prev, session];
                  restored.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
                  return restored;
                });
                setHistoryError(e.message ?? 'Failed to delete session');
              } finally {
                setDeletingId(null);
              }
            },
          },
        ]
      );
    },
    [token]
  );

  const handleStart = async () => {
    if (!token || !targetRole.trim()) return;
    setIsStarting(true);
    setStartError(null);
    try {
      const session = await startSession(token, {
        targetRole: targetRole.trim(),
        difficulty,
      });
      setTargetRole('');
      router.push({ pathname: '/mock-interview-session', params: { sessionId: session.id } });
    } catch (e: any) {
      setStartError(e.message ?? 'Could not start interview. Please try again.');
    } finally {
      setIsStarting(false);
    }
  };

  const canStart = !!targetRole.trim() && !isStarting;

  const openSession = (session: SessionSummary) => {
    if (session.status === 'COMPLETED') {
      router.push(`/mock-interview-report/${session.id}`);
    } else {
      router.push({ pathname: '/mock-interview-session', params: { sessionId: session.id } });
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerIconWrap}>
          <Ionicons name="mic" size={18} color={colors.tertiary} />
        </View>
        <View>
          <Text style={styles.headerTitle}>Interview</Text>
          <Text style={styles.headerSubtitle}>Practice with AI, get instant feedback</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => loadSessions(true)}
            tintColor={colors.tertiary}
          />
        }
      >
        {isStarting ? (
          <Animated.View style={[styles.startingCard, { opacity: pulseOpacity }]}>
            <View style={styles.startingIconWrap}>
              <Ionicons name="sparkles" size={26} color={colors.tertiary} />
            </View>
            <Text style={styles.startingTitle}>Generating your questions…</Text>
            <Text style={styles.startingSubtitle}>Claude AI is preparing your interview</Text>
            <Text style={styles.startingHint}>This may take 15–30 seconds</Text>
          </Animated.View>
        ) : (
          <View style={styles.startSection}>
            <Text style={styles.sectionLabel}>New Interview</Text>

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
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Difficulty</Text>
              <View style={styles.difficultyRow}>
                {DIFFICULTIES.map(d => {
                  const selected = difficulty === d.value;
                  return (
                    <TouchableOpacity
                      key={d.value}
                      style={[styles.difficultyChip, selected && styles.difficultyChipSelected]}
                      onPress={() => setDifficulty(d.value)}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.difficultyChipText,
                          selected && styles.difficultyChipTextSelected,
                        ]}
                      >
                        {d.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <TouchableOpacity
              style={[styles.startBtn, !canStart && styles.startBtnDisabled]}
              onPress={handleStart}
              disabled={!canStart}
              activeOpacity={0.85}
            >
              <Ionicons
                name="mic-outline"
                size={16}
                color={canStart ? colors.onPrimary : colors.outline}
                style={{ marginRight: spacing.xs }}
              />
              <Text style={[styles.startBtnText, !canStart && styles.startBtnTextDisabled]}>
                Start Interview
              </Text>
            </TouchableOpacity>

            {startError ? (
              <View style={styles.errorRow}>
                <Ionicons name="alert-circle-outline" size={14} color={colors.error} />
                <Text style={styles.errorText}>{startError}</Text>
              </View>
            ) : null}
          </View>
        )}

        <View style={styles.historySectionHeader}>
          <Text style={styles.sectionLabel}>Past Interviews</Text>
          {sessions.length > 0 && <Text style={styles.historyCount}>{sessions.length}</Text>}
        </View>

        {isLoadingHistory ? (
          <ActivityIndicator size="small" color={colors.tertiary} style={styles.historyLoader} />
        ) : historyError ? (
          <View style={styles.errorRow}>
            <Ionicons name="alert-circle-outline" size={14} color={colors.error} />
            <Text style={styles.errorText}>{historyError}</Text>
          </View>
        ) : sessions.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="mic-outline" size={28} color={colors.onSurfaceVariant} />
            </View>
            <Text style={styles.emptyTitle}>No interviews yet</Text>
            <Text style={styles.emptySubtitle}>
              Pick a role and difficulty above to start practising with instant AI feedback
            </Text>
          </View>
        ) : (
          <View style={styles.sessionsList}>
            {sessions.map(session => (
              <SessionRow
                key={session.id}
                session={session}
                onPress={() => openSession(session)}
                onLongPress={() => handleDelete(session)}
                isDeleting={deletingId === session.id}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
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
    backgroundColor: `${colors.tertiary}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { ...typography.headlineSm, color: colors.onSurface },
  headerSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: colors.onSurfaceVariant,
    marginTop: 1,
  },
  scrollContent: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  sectionLabel: {
    ...typography.labelSm,
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  startingCard: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1.5,
    borderColor: `${colors.tertiary}30`,
  },
  startingIconWrap: {
    width: 52,
    height: 52,
    borderRadius: radius.full,
    backgroundColor: `${colors.tertiary}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  startingTitle: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 18,
    lineHeight: 24,
    color: colors.onSurface,
  },
  startingSubtitle: { ...typography.bodyMd, color: colors.onSurfaceVariant, fontSize: 14 },
  startingHint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: colors.outline,
    marginTop: 2,
  },

  startSection: {
    gap: spacing.sm,
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  inputGroup: { gap: 6 },
  inputLabel: { ...typography.labelMd, color: colors.onSurface, fontSize: 13 },
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
  difficultyRow: { flexDirection: 'row', gap: spacing.sm },
  difficultyChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surface,
  },
  difficultyChipSelected: {
    borderColor: colors.tertiary,
    backgroundColor: `${colors.tertiary}10`,
  },
  difficultyChipText: {
    ...typography.labelMd,
    color: colors.onSurfaceVariant,
    fontSize: 13,
  },
  difficultyChipTextSelected: { color: colors.tertiary },
  startBtn: {
    backgroundColor: colors.tertiary,
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  startBtnDisabled: { backgroundColor: colors.surfaceContainerHigh },
  startBtnText: { ...typography.labelMd, color: colors.onPrimary },
  startBtnTextDisabled: { color: colors.outline },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  errorText: { ...typography.labelMd, color: colors.error, flex: 1 },

  historySectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  historyCount: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    color: colors.onPrimary,
    backgroundColor: colors.tertiary,
    borderRadius: radius.full,
    paddingHorizontal: 7,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  historyLoader: { marginVertical: spacing.lg },
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
  sessionsList: { gap: spacing.sm },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  sessionRowDeleting: { opacity: 0.4 },
  sessionRowIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sessionRowBody: { flex: 1, gap: 3 },
  sessionRowTitle: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    color: colors.onSurface,
  },
  sessionRowMeta: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: colors.onSurfaceVariant,
  },
  scoreBadge: {
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
    flexShrink: 0,
  },
  scoreBadgeText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
});
