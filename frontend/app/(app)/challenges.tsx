import { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TextInput,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '@/context/AuthContext';
import { colors, typography, spacing, radius } from '@/constants/theme';
import {
  getChallenges,
  submit,
  getMySubmissions,
  getLeaderboard,
} from '@/services/challenge';
import {
  type ChallengeListEntry,
  type LeaderboardEntry,
  type MySubmission,
} from '@/types/challenge';

function anonLabel(studentId: string) {
  return `Student ${studentId.replace(/-/g, '').slice(0, 4)}…`;
}

function deadlineStr(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function LeaderboardList({ challengeId, token }: { challengeId: string; token: string }) {
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const load = async () => {
    setIsLoading(true);
    try {
      const data = await getLeaderboard(token, challengeId);
      setEntries(data.entries);
    } catch {
      setEntries([]);
    } finally {
      setIsLoading(false);
    }
  };

  if (entries === null && !isLoading) {
    return (
      <TouchableOpacity onPress={load} activeOpacity={0.7}>
        <Text style={styles.leaderboardLink}>View leaderboard</Text>
      </TouchableOpacity>
    );
  }

  if (isLoading) {
    return <ActivityIndicator size="small" color={colors.primary} />;
  }

  if (!entries || entries.length === 0) {
    return <Text style={styles.noEntriesText}>No scored submissions yet</Text>;
  }

  return (
    <View style={styles.leaderboardList}>
      {entries.map(e => (
        <View key={e.studentId} style={styles.leaderboardRow}>
          <Text style={styles.leaderboardRank}>#{e.rank}</Text>
          <Text style={styles.leaderboardName}>{anonLabel(e.studentId)}</Text>
          <Text style={styles.leaderboardScore}>{e.score.toFixed(2)}</Text>
        </View>
      ))}
    </View>
  );
}

function ChallengeCard({
  challenge,
  expanded,
  onToggle,
  onSubmit,
  isSubmitting,
  url,
  onUrlChange,
  token,
}: {
  challenge: ChallengeListEntry;
  expanded: boolean;
  onToggle: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  url: string;
  onUrlChange: (v: string) => void;
  token: string;
}) {
  return (
    <View style={styles.card}>
      <TouchableOpacity onPress={onToggle} activeOpacity={0.8} style={styles.cardHead}>
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle} numberOfLines={expanded ? undefined : 1}>
            {challenge.title}
          </Text>
          <Text style={styles.cardMeta} numberOfLines={1}>
            due {deadlineStr(challenge.deadline)}
          </Text>
        </View>
        {challenge.submitted ? (
          <View style={styles.submittedBadge}>
            <Ionicons name="checkmark-circle" size={14} color={colors.secondary} />
            <Text style={styles.submittedBadgeText}>Submitted</Text>
          </View>
        ) : (
          <Ionicons name="chevron-down" size={16} color={colors.onSurfaceVariant} />
        )}
      </TouchableOpacity>

      {expanded ? (
        <View style={styles.cardDetail}>
          <Text style={styles.cardDescription}>{challenge.description}</Text>
          <View style={styles.formatBox}>
            <Text style={styles.formatLabel}>How to submit</Text>
            <Text style={styles.formatText}>{challenge.submissionFormat}</Text>
          </View>

          {challenge.submitted ? (
            <View style={styles.submittedRow}>
              <Ionicons name="checkmark-circle" size={16} color={colors.secondary} />
              <Text style={styles.submittedText}>Solution submitted — good luck!</Text>
            </View>
          ) : (
            <View style={styles.submitRow}>
              <TextInput
                style={styles.submitInput}
                placeholder="https://github.com/you/solution"
                placeholderTextColor={colors.outline}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                value={url}
                onChangeText={onUrlChange}
              />
              <TouchableOpacity
                style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
                onPress={onSubmit}
                disabled={isSubmitting}
                activeOpacity={0.85}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color={colors.onPrimary} />
                ) : (
                  <Text style={styles.submitBtnText}>Submit</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          <LeaderboardList challengeId={challenge.id} token={token} />
        </View>
      ) : null}
    </View>
  );
}

export default function ChallengesScreen() {
  const { state } = useAuth();
  const token = state.accessToken ?? '';

  const [challenges, setChallenges] = useState<ChallengeListEntry[]>([]);
  const [mySubmissions, setMySubmissions] = useState<MySubmission[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const load = useCallback(
    async (refreshing = false) => {
      if (!token) return;
      if (refreshing) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);
      try {
        const [challengeData, submissionData] = await Promise.all([
          getChallenges(token),
          getMySubmissions(token),
        ]);
        setChallenges(challengeData.challenges);
        setMySubmissions(submissionData);
      } catch (e: any) {
        setError(e.message ?? 'Failed to load challenges');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [token]
  );

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleSubmit = async (challenge: ChallengeListEntry) => {
    const id = challenge.id;
    const url = (urls[id] ?? '').trim();
    if (!url) {
      Alert.alert('Add your link', 'Paste the link to your solution first');
      return;
    }
    setSubmittingId(id);
    // Optimistic: flip to submitted immediately
    setChallenges(prev => prev.map(c => (c.id === id ? { ...c, submitted: true } : c)));
    try {
      await submit(token, id, { submissionUrl: url });
      setUrls(prev => ({ ...prev, [id]: '' }));
      // Refresh my submissions in the background
      getMySubmissions(token).then(setMySubmissions).catch(() => {});
    } catch (e: any) {
      setChallenges(prev => prev.map(c => (c.id === id ? { ...c, submitted: false } : c)));
      if (e.status === 409) {
        setChallenges(prev => prev.map(c => (c.id === id ? { ...c, submitted: true } : c)));
      } else {
        Alert.alert('Submit failed', e.message ?? 'Please try again');
      }
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerIconWrap}>
          <Ionicons name="trophy" size={18} color={colors.primary} />
        </View>
        <View>
          <Text style={styles.headerTitle}>Challenges</Text>
          <Text style={styles.headerSubtitle}>Industry challenges from recruiters</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => load(true)}
            tintColor={colors.primary}
          />
        }
      >
        <Text style={styles.sectionLabel}>Open Challenges</Text>

        {isLoading ? (
          <ActivityIndicator size="small" color={colors.primary} style={styles.loader} />
        ) : error ? (
          <View style={styles.errorRow}>
            <Ionicons name="alert-circle-outline" size={14} color={colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : challenges.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="trophy-outline" size={28} color={colors.onSurfaceVariant} />
            </View>
            <Text style={styles.emptyTitle}>No open challenges</Text>
            <Text style={styles.emptySubtitle}>
              New industry challenges posted by recruiters will appear here
            </Text>
          </View>
        ) : (
          <View style={styles.cardList}>
            {challenges.map(c => (
              <ChallengeCard
                key={c.id}
                challenge={c}
                token={token}
                expanded={expandedId === c.id}
                onToggle={() => setExpandedId(prev => (prev === c.id ? null : c.id))}
                onSubmit={() => handleSubmit(c)}
                isSubmitting={submittingId === c.id}
                url={urls[c.id] ?? ''}
                onUrlChange={v => setUrls(prev => ({ ...prev, [c.id]: v }))}
              />
            ))}
          </View>
        )}

        {/* My Submissions */}
        <View style={styles.submissionsHeader}>
          <Text style={styles.sectionLabel}>My Submissions</Text>
          {mySubmissions.length > 0 && (
            <Text style={styles.countBadge}>{mySubmissions.length}</Text>
          )}
        </View>

        {mySubmissions.length === 0 ? (
          <Text style={styles.noSubmissionsText}>
            Challenges you submit to will appear here
          </Text>
        ) : (
          <View style={styles.cardList}>
            {mySubmissions.map(s => (
              <View key={s.id} style={styles.submissionRow}>
                <View style={[styles.submissionIcon, { backgroundColor: `${colors.secondary}12` }]}>
                  <Ionicons name="code-slash" size={16} color={colors.secondary} />
                </View>
                <View style={styles.submissionBody}>
                  <Text style={styles.submissionTitle} numberOfLines={1}>
                    {s.challenge.title}
                  </Text>
                  <Text style={styles.submissionMeta}>
                    {new Date(s.submittedAt).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                    })}
                    {' · '}
                    {s.score !== null ? `Score: ${s.score.toFixed(2)}` : 'Score pending'}
                  </Text>
                </View>
                {s.score !== null ? (
                  <View style={styles.scoreChip}>
                    <Text style={styles.scoreChipText}>{s.score.toFixed(0)}</Text>
                  </View>
                ) : null}
              </View>
            ))}
          </View>
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
    backgroundColor: `${colors.primary}15`,
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
  loader: { marginVertical: spacing.lg },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  errorText: { ...typography.labelMd, color: colors.error, flex: 1 },

  cardList: { gap: spacing.sm },
  card: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    overflow: 'hidden',
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardBody: { flex: 1, gap: 3 },
  cardTitle: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    color: colors.onSurface,
  },
  cardMeta: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: colors.onSurfaceVariant,
  },
  submittedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: `${colors.secondary}12`,
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  submittedBadgeText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    color: colors.secondary,
  },
  cardDetail: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
    paddingTop: spacing.sm,
  },
  cardDescription: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: colors.onSurface,
    lineHeight: 19,
  },
  formatBox: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: 2,
  },
  formatLabel: {
    ...typography.labelSm,
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontSize: 9,
  },
  formatText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: colors.onSurface,
    lineHeight: 17,
  },
  submitRow: { flexDirection: 'row', gap: spacing.xs },
  submitInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.bodyMd,
    color: colors.onSurface,
    fontSize: 13,
  },
  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { ...typography.labelMd, color: colors.onPrimary },
  submittedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  submittedText: { ...typography.labelMd, color: colors.secondary },

  leaderboardLink: { ...typography.labelMd, color: colors.primary },
  noEntriesText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: colors.onSurfaceVariant,
  },
  leaderboardList: { gap: spacing.xs },
  leaderboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  leaderboardRank: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
    color: colors.primary,
    width: 28,
  },
  leaderboardName: {
    flex: 1,
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: colors.onSurface,
  },
  leaderboardScore: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
    color: colors.onSurface,
  },

  submissionsHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  countBadge: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    color: colors.onPrimary,
    backgroundColor: colors.secondary,
    borderRadius: radius.full,
    paddingHorizontal: 7,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  noSubmissionsText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: colors.onSurfaceVariant,
  },
  submissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  submissionIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submissionBody: { flex: 1, gap: 2 },
  submissionTitle: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
    color: colors.onSurface,
  },
  submissionMeta: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: colors.onSurfaceVariant,
  },
  scoreChip: {
    backgroundColor: `${colors.secondary}15`,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  scoreChipText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
    color: colors.secondary,
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
});
