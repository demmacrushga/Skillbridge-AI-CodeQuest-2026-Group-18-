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
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '@/context/AuthContext';
import { colors, typography, spacing, radius } from '@/constants/theme';
import {
  postChallenge,
  getMyChallenges,
  deactivate,
  getSubmissions,
  scoreSubmission,
} from '@/services/challenge';
import {
  type Challenge,
  type SubmissionReview,
} from '@/types/challenge';

function anonLabel(studentId: string) {
  return `Student ${studentId.replace(/-/g, '').slice(0, 4)}…`;
}

function SubmissionRow({
  submission,
  challengeId,
  token,
  onScored,
}: {
  submission: SubmissionReview;
  challengeId: string;
  token: string;
  onScored: (updated: SubmissionReview) => void;
}) {
  const [scoreText, setScoreText] = useState(
    submission.score !== null ? submission.score.toFixed(2) : ''
  );
  const [isSaving, setIsSaving] = useState(false);

  const save = async () => {
    const parsed = Number(scoreText);
    if (scoreText.trim() === '' || Number.isNaN(parsed) || parsed < 0 || parsed > 100) {
      Alert.alert('Invalid score', 'Score must be a number between 0.00 and 100.00');
      return;
    }
    setIsSaving(true);
    try {
      const updated = await scoreSubmission(token, challengeId, submission.id, {
        score: Number(parsed.toFixed(2)),
      });
      onScored(updated);
    } catch (e: any) {
      Alert.alert('Could not save score', e.message ?? 'Please try again');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.submissionRow}>
      <View style={styles.submissionTop}>
        <TouchableOpacity
          onPress={() =>
            Linking.openURL(submission.submissionUrl).catch(() =>
              Alert.alert('Could not open link', submission.submissionUrl)
            )
          }
          activeOpacity={0.7}
          style={styles.submissionLinkRow}
        >
          <Ionicons name="open-outline" size={13} color={colors.primary} />
          <Text style={styles.submissionLink} numberOfLines={1}>
            {anonLabel(submission.studentId)} — view work
          </Text>
        </TouchableOpacity>
        <Text style={styles.submissionDate}>
          {new Date(submission.submittedAt).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
          })}
        </Text>
      </View>
      <View style={styles.scoreRow}>
        <TextInput
          style={styles.scoreInput}
          placeholder="0.00–100.00"
          placeholderTextColor={colors.outline}
          keyboardType="decimal-pad"
          value={scoreText}
          onChangeText={setScoreText}
        />
        <TouchableOpacity
          style={[styles.scoreSaveBtn, isSaving && styles.scoreSaveBtnDisabled]}
          onPress={save}
          disabled={isSaving}
          activeOpacity={0.85}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color={colors.onPrimary} />
          ) : (
            <Text style={styles.scoreSaveBtnText}>
              {submission.score !== null ? 'Update' : 'Score'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function ChallengesManageScreen() {
  const { state } = useAuth();
  const token = state.accessToken ?? '';

  // Post form state
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submissionFormat, setSubmissionFormat] = useState('');
  const [deadline, setDeadline] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Challenges state
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  // Submissions review state (per challenge)
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionReview[]>([]);
  const [isLoadingSubs, setIsLoadingSubs] = useState(false);

  const load = useCallback(
    async (refreshing = false) => {
      if (!token) return;
      if (refreshing) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setListError(null);
      try {
        setChallenges(await getMyChallenges(token));
      } catch (e: any) {
        setListError(e.message ?? 'Failed to load challenges');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [token]
  );

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const resetForm = () => {
    setTitle(''); setDescription(''); setSubmissionFormat(''); setDeadline('');
    setFormError(null);
  };

  const handlePost = async () => {
    if (!token) return;
    setFormError(null);
    if (!title.trim() || !description.trim() || !submissionFormat.trim()) {
      setFormError('Title, description and submission instructions are required');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline.trim())) {
      setFormError('Deadline is required (YYYY-MM-DD)');
      return;
    }
    setIsPosting(true);
    try {
      await postChallenge(token, {
        title: title.trim(),
        description: description.trim(),
        submissionFormat: submissionFormat.trim(),
        deadline: `${deadline.trim()}T23:59:00Z`,
      });
      resetForm();
      setShowForm(false);
      load();
    } catch (e: any) {
      setFormError(e.message ?? 'Could not post challenge');
    } finally {
      setIsPosting(false);
    }
  };

  const handleDeactivate = (challenge: Challenge) => {
    Alert.alert(
      'Deactivate challenge?',
      `"${challenge.title}" will disappear from the student board. Existing submissions and scores are kept.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deactivate',
          style: 'destructive',
          onPress: async () => {
            try {
              await deactivate(token, challenge.id);
              load();
            } catch (e: any) {
              Alert.alert('Could not deactivate', e.message ?? 'Please try again');
            }
          },
        },
      ]
    );
  };

  const toggleReview = async (challengeId: string) => {
    if (reviewingId === challengeId) {
      setReviewingId(null);
      setSubmissions([]);
      return;
    }
    setReviewingId(challengeId);
    setIsLoadingSubs(true);
    try {
      setSubmissions(await getSubmissions(token, challengeId));
    } catch {
      setSubmissions([]);
    } finally {
      setIsLoadingSubs(false);
    }
  };

  const handleScored = (updated: SubmissionReview) => {
    setSubmissions(prev => prev.map(s => (s.id === updated.id ? updated : s)));
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerIconWrap}>
          <Ionicons name="trophy" size={18} color={colors.primary} />
        </View>
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerTitle}>Manage Challenges</Text>
          <Text style={styles.headerSubtitle}>Post challenges and score submissions</Text>
        </View>
        <TouchableOpacity
          style={styles.newBtn}
          onPress={() => setShowForm(prev => !prev)}
          activeOpacity={0.85}
        >
          <Ionicons name={showForm ? 'close' : 'add'} size={18} color={colors.onPrimary} />
          <Text style={styles.newBtnText}>{showForm ? 'Close' : 'New'}</Text>
        </TouchableOpacity>
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
        {showForm ? (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Post a Challenge</Text>
            <TextInput
              style={styles.input}
              placeholder="Title (e.g. Build a Fraud Detection API)"
              placeholderTextColor={colors.outline}
              value={title}
              onChangeText={setTitle}
            />
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              placeholder="Description — what should students build?"
              placeholderTextColor={colors.outline}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              placeholder="Submission instructions (e.g. GitHub repo link with README)"
              placeholderTextColor={colors.outline}
              value={submissionFormat}
              onChangeText={setSubmissionFormat}
              multiline
              numberOfLines={2}
              textAlignVertical="top"
            />
            <TextInput
              style={styles.input}
              placeholder="Deadline (YYYY-MM-DD)"
              placeholderTextColor={colors.outline}
              value={deadline}
              onChangeText={setDeadline}
              autoCapitalize="none"
            />
            {formError ? (
              <View style={styles.errorRow}>
                <Ionicons name="alert-circle-outline" size={14} color={colors.error} />
                <Text style={styles.errorText}>{formError}</Text>
              </View>
            ) : null}
            <TouchableOpacity
              style={[styles.postBtn, isPosting && styles.postBtnDisabled]}
              onPress={handlePost}
              disabled={isPosting}
              activeOpacity={0.85}
            >
              {isPosting ? (
                <ActivityIndicator size="small" color={colors.onPrimary} />
              ) : (
                <Text style={styles.postBtnText}>Post Challenge</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : null}

        <Text style={styles.sectionLabel}>My Challenges</Text>

        {isLoading ? (
          <ActivityIndicator size="small" color={colors.primary} style={styles.loader} />
        ) : listError ? (
          <View style={styles.errorRow}>
            <Ionicons name="alert-circle-outline" size={14} color={colors.error} />
            <Text style={styles.errorText}>{listError}</Text>
          </View>
        ) : challenges.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="trophy-outline" size={28} color={colors.onSurfaceVariant} />
            </View>
            <Text style={styles.emptyTitle}>No challenges yet</Text>
            <Text style={styles.emptySubtitle}>
              Tap New to post your first industry challenge
            </Text>
          </View>
        ) : (
          <View style={styles.cardList}>
            {challenges.map(c => (
              <View key={c.id} style={styles.card}>
                <View style={styles.cardHead}>
                  <View style={styles.cardBody}>
                    <View style={styles.cardTitleRow}>
                      <Text style={styles.cardTitle} numberOfLines={1}>
                        {c.title}
                      </Text>
                      {!c.active ? (
                        <View style={styles.inactiveBadge}>
                          <Text style={styles.inactiveBadgeText}>Inactive</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.cardMeta} numberOfLines={1}>
                      due {new Date(c.deadline).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                      {' · '}
                      {c.submissionCount ?? 0} submission{(c.submissionCount ?? 0) === 1 ? '' : 's'}
                    </Text>
                  </View>
                </View>
                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => toggleReview(c.id)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={reviewingId === c.id ? 'chevron-up' : 'people-outline'}
                      size={14}
                      color={colors.primary}
                    />
                    <Text style={styles.actionBtnText}>
                      {reviewingId === c.id ? 'Hide' : 'Submissions'}
                    </Text>
                  </TouchableOpacity>
                  {c.active ? (
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => handleDeactivate(c)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="close-circle-outline" size={14} color={colors.error} />
                      <Text style={[styles.actionBtnText, { color: colors.error }]}>
                        Deactivate
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>

                {reviewingId === c.id ? (
                  <View style={styles.reviewSection}>
                    {isLoadingSubs ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : submissions.length === 0 ? (
                      <Text style={styles.noSubmissionsText}>No submissions yet</Text>
                    ) : (
                      submissions.map(s => (
                        <SubmissionRow
                          key={s.id}
                          submission={s}
                          challengeId={c.id}
                          token={token}
                          onScored={handleScored}
                        />
                      ))
                    )}
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
  headerTextWrap: { flex: 1 },
  headerTitle: { ...typography.headlineSm, color: colors.onSurface },
  headerSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: colors.onSurfaceVariant,
    marginTop: 1,
  },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  newBtnText: { ...typography.labelMd, color: colors.onPrimary },
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

  formCard: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  formTitle: { ...typography.headlineSm, color: colors.onSurface, fontSize: 15 },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.bodyMd,
    color: colors.onSurface,
    fontSize: 14,
  },
  inputMultiline: { minHeight: 72 },
  postBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.sm + 2,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  postBtnDisabled: { opacity: 0.6 },
  postBtnText: { ...typography.labelMd, color: colors.onPrimary },

  cardList: { gap: spacing.sm },
  card: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    overflow: 'hidden',
  },
  cardHead: { padding: spacing.md, paddingBottom: spacing.xs },
  cardBody: { gap: 3 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  cardTitle: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    color: colors.onSurface,
    flexShrink: 1,
  },
  inactiveBadge: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  inactiveBadgeText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 9,
    color: colors.onSurfaceVariant,
  },
  cardMeta: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: colors.onSurfaceVariant,
  },
  cardActions: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionBtnText: { ...typography.labelMd, color: colors.primary },

  reviewSection: {
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
    padding: spacing.md,
    gap: spacing.sm,
  },
  noSubmissionsText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: colors.onSurfaceVariant,
  },
  submissionRow: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  submissionTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  submissionLinkRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
  submissionLink: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: colors.primary,
    flexShrink: 1,
  },
  submissionDate: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: colors.onSurfaceVariant,
  },
  scoreRow: { flexDirection: 'row', gap: spacing.xs },
  scoreInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    ...typography.bodyMd,
    color: colors.onSurface,
    fontSize: 13,
  },
  scoreSaveBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreSaveBtnDisabled: { opacity: 0.6 },
  scoreSaveBtnText: { ...typography.labelMd, color: colors.onPrimary },

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
