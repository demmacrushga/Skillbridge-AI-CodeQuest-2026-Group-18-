import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Animated,
  ActivityIndicator,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '@/context/AuthContext';
import { colors, typography, spacing, radius } from '@/constants/theme';
import { getSession, submitAnswer, completeSession, transcribeAnswer } from '@/services/mockInterview';
import { useInterviewRecorder } from '@/hooks/useInterviewRecorder';
import { type InterviewSession, type InterviewQuestion } from '@/types/mockInterview';

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

const CATEGORY_LABEL: Record<string, string> = {
  TECHNICAL: 'Technical',
  BEHAVIORAL: 'Behavioral',
  SITUATIONAL: 'Situational',
  OTHER: 'General',
};

function scoreColor(score: number) {
  if (score >= 8) return colors.secondary;
  if (score >= 5) return '#CA8A04';
  return colors.error;
}

export default function MockInterviewSessionScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { state } = useAuth();
  const token = state.accessToken;
  const pulseOpacity = usePulse();
  const recorder = useInterviewRecorder();

  const [session, setSession] = useState<InterviewSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchSession = useCallback(async () => {
    if (!token || !sessionId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await getSession(token, sessionId);
      setSession(data);
      const firstUnanswered = data.questions
        .slice()
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .find(q => q.userAnswer == null);
      const startIdx = firstUnanswered
        ? data.questions.findIndex(q => q.id === firstUnanswered.id)
        : 0;
      setCurrentIndex(startIdx);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load interview');
    } finally {
      setIsLoading(false);
    }
  }, [token, sessionId]);

  useEffect(() => { fetchSession(); }, [fetchSession]);

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        router.navigate('/(app)/mock-interview');
        return true;
      });
      return () => sub.remove();
    }, [])
  );

  const sortedQuestions: InterviewQuestion[] = session
    ? [...session.questions].sort((a, b) => a.orderIndex - b.orderIndex)
    : [];
  const currentQuestion = sortedQuestions[currentIndex] ?? null;
  const answeredCount = sortedQuestions.filter(q => q.userAnswer != null).length;
  const allAnswered = sortedQuestions.length > 0 && answeredCount === sortedQuestions.length;

  const handleSubmit = async () => {
    if (!token || !session || !currentQuestion || !answer.trim()) return;
    setIsSubmitting(true);
    setActionError(null);
    try {
      const updated = await submitAnswer(token, session.id, currentQuestion.id, {
        answer: answer.trim(),
      });
      setSession(prev =>
        prev
          ? {
              ...prev,
              questions: prev.questions.map(q => (q.id === updated.id ? { ...q, ...updated } : q)),
            }
          : prev
      );
      setAnswer('');
    } catch (e: any) {
      setActionError(e.message ?? 'Could not submit answer. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNext = async () => {
    if (!session) return;
    const nextUnanswered = sortedQuestions
      .slice(currentIndex + 1)
      .find(q => q.userAnswer == null);

    if (nextUnanswered) {
      const nextIdx = sortedQuestions.findIndex(q => q.id === nextUnanswered.id);
      setCurrentIndex(nextIdx);
      setAnswer('');
      setActionError(null);
      return;
    }

    if (allAnswered) {
      setIsCompleting(true);
      setActionError(null);
      try {
        await completeSession(token!, session.id);
        router.replace(`/mock-interview-report/${session.id}`);
      } catch (e: any) {
        setActionError(e.message ?? 'Could not complete interview. Please try again.');
      } finally {
        setIsCompleting(false);
      }
    }
  };

  const handleRecordToggle = async () => {
    if (!token || !session || !currentQuestion) return;
    if (isTranscribing) return;

    if (recorder.isRecording) {
      setActionError(null);
      const { uri, contentType } = await recorder.stop();
      if (!uri) {
        setActionError('No recording captured. Please try again.');
        return;
      }

      setIsTranscribing(true);
      try {
        const transcript = await transcribeAnswer(token, session.id, currentQuestion.id, uri, contentType);
        setAnswer(transcript);
      } catch (e: any) {
        if (e?.status === 422) {
          setActionError('No speech was detected — please try again.');
        } else if (e?.status === 503) {
          setActionError('Voice unavailable, please type your answer.');
        } else if (e?.status === 400) {
          setActionError('Recording too long or wrong format — try again.');
        } else {
          setActionError(e?.message ?? 'Could not transcribe. Please type your answer.');
        }
      } finally {
        setIsTranscribing(false);
      }
    } else {
      setActionError(null);
      await recorder.start();
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.navigate('/(app)/mock-interview')}
            style={styles.backBtn}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={22} color={colors.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Loading interview…</Text>
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.tertiary} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !session) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.navigate('/(app)/mock-interview')}
            style={styles.backBtn}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={22} color={colors.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Interview</Text>
        </View>
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={40} color={colors.error} />
          <Text style={styles.errorText}>{error ?? 'Interview not found'}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchSession} activeOpacity={0.8}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const wasAnswered = currentQuestion?.userAnswer != null;
  const accent = scoreColor(currentQuestion?.score ?? 0);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.navigate('/(app)/mock-interview')}
          style={styles.backBtn}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={22} color={colors.primary} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle} numberOfLines={1}>{session.targetRole}</Text>
          <Text style={styles.headerSubtitle}>
            Question {currentIndex + 1} of {sortedQuestions.length} ·{' '}
            {CATEGORY_LABEL[currentQuestion?.category ?? 'OTHER'] ?? 'General'}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {currentQuestion ? (
          <View style={styles.questionCard}>
            <View style={styles.categoryPill}>
              <Text style={styles.categoryPillText}>
                {CATEGORY_LABEL[currentQuestion.category] ?? 'General'}
              </Text>
            </View>
            <Text style={styles.questionText}>{currentQuestion.questionText}</Text>

            {wasAnswered ? (
              <View style={styles.evaluationBox}>
                <View style={styles.scoreRow}>
                  <Text style={styles.scoreLabel}>Your score</Text>
                  <Text style={[styles.scoreValue, { color: accent }]}>
                    {currentQuestion.score}/10
                  </Text>
                </View>
                <View style={styles.divider} />
                <Text style={styles.feedbackLabel}>Feedback</Text>
                <Text style={styles.feedbackText}>{currentQuestion.feedback}</Text>
                <Text style={styles.yourAnswerLabel}>Your answer</Text>
                <Text style={styles.yourAnswerText}>{currentQuestion.userAnswer}</Text>
              </View>
            ) : (
              <View style={styles.answerSection}>
                <Text style={styles.inputLabel}>Your answer</Text>
                <TextInput
                  style={styles.answerInput}
                  placeholder="Type your answer here…"
                  placeholderTextColor={colors.outline}
                  value={answer}
                  onChangeText={setAnswer}
                  multiline
                  textAlignVertical="top"
                />

                {recorder.permission === 'granted' && (
                  <View style={styles.recorderRow}>
                    <TouchableOpacity
                      style={[
                        styles.recordBtn,
                        recorder.isRecording && styles.recordBtnActive,
                        isTranscribing && styles.recordBtnDisabled,
                      ]}
                      onPress={handleRecordToggle}
                      disabled={isTranscribing}
                      activeOpacity={0.8}
                    >
                      {isTranscribing ? (
                        <ActivityIndicator size="small" color={colors.onPrimary} />
                      ) : (
                        <Ionicons
                          name={recorder.isRecording ? 'stop-circle' : 'mic'}
                          size={18}
                          color={colors.onPrimary}
                        />
                      )}
                      <Text style={styles.recordBtnText}>
                        {isTranscribing
                          ? 'Transcribing…'
                          : recorder.isRecording
                            ? `Stop (${recorder.recordingSeconds}s) · max 5 min`
                            : 'Record instead'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.submitBtn, (!answer.trim() || isSubmitting) && styles.submitBtnDisabled]}
                  onPress={handleSubmit}
                  disabled={!answer.trim() || isSubmitting}
                  activeOpacity={0.85}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color={colors.onPrimary} />
                  ) : (
                    <Text style={styles.submitBtnText}>Submit Answer</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {actionError ? (
              <View style={styles.errorRow}>
                <Ionicons name="alert-circle-outline" size={14} color={colors.error} />
                <Text style={styles.errorText}>{actionError}</Text>
              </View>
            ) : null}

            {wasAnswered && (
              <Animated.View style={[isCompleting && { opacity: pulseOpacity }]}>
                <TouchableOpacity
                  style={[styles.nextBtn, isCompleting && styles.nextBtnDisabled]}
                  onPress={handleNext}
                  disabled={isCompleting}
                  activeOpacity={0.85}
                >
                  {isCompleting ? (
                    <View style={styles.completingRow}>
                      <ActivityIndicator size="small" color={colors.onPrimary} />
                      <Text style={styles.nextBtnText}>Generating summary…</Text>
                    </View>
                  ) : (
                    <>
                      <Text style={styles.nextBtnText}>
                        {allAnswered ? 'Finish & see results' : 'Next question'}
                      </Text>
                      <Ionicons name="arrow-forward" size={16} color={colors.onPrimary} />
                    </>
                  )}
                </TouchableOpacity>
              </Animated.View>
            )}
          </View>
        ) : (
          <View style={styles.center}>
            <Text style={styles.errorText}>No question available.</Text>
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
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.surfaceCard,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
    gap: spacing.sm,
  },
  backBtn: { padding: spacing.xs },
  headerText: { flex: 1 },
  headerTitle: { ...typography.headlineSm, color: colors.onSurface },
  headerSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: colors.onSurfaceVariant,
    marginTop: 2,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingHorizontal: spacing.lg },
  errorText: { ...typography.bodyMd, color: colors.error, textAlign: 'center' },
  retryBtn: {
    backgroundColor: colors.tertiary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  retryText: { ...typography.labelMd, color: colors.onPrimary },
  scrollContent: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },

  questionCard: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    gap: spacing.md,
  },
  categoryPill: {
    alignSelf: 'flex-start',
    backgroundColor: `${colors.tertiary}12`,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  categoryPillText: {
    ...typography.labelSm,
    color: colors.tertiary,
    fontSize: 11,
  },
  questionText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 18,
    lineHeight: 26,
    color: colors.onSurface,
  },

  answerSection: { gap: spacing.sm },
  inputLabel: { ...typography.labelMd, color: colors.onSurface, fontSize: 13 },
  answerInput: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    padding: spacing.md,
    ...typography.bodyMd,
    color: colors.onSurface,
    fontSize: 15,
    minHeight: 120,
  },
  recorderRow: { flexDirection: 'row', alignItems: 'center' },
  recordBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    flex: 1,
  },
  recordBtnActive: {
    backgroundColor: colors.error,
  },
  recordBtnDisabled: {
    backgroundColor: colors.surfaceContainerHigh,
    opacity: 0.6,
  },
  recordBtnText: {
    ...typography.labelMd,
    color: colors.onPrimary,
    fontSize: 13,
  },
  submitBtn: {
    backgroundColor: colors.tertiary,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDisabled: { backgroundColor: colors.surfaceContainerHigh },
  submitBtnText: { ...typography.labelMd, color: colors.onPrimary },

  evaluationBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    gap: spacing.xs,
  },
  scoreRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  scoreLabel: { ...typography.labelMd, color: colors.onSurfaceVariant, fontSize: 13 },
  scoreValue: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 22,
  },
  divider: { height: 1, backgroundColor: colors.outlineVariant, marginVertical: spacing.xs },
  feedbackLabel: { ...typography.labelSm, color: colors.onSurfaceVariant, letterSpacing: 0.6 },
  feedbackText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 22,
    color: colors.onSurface,
  },
  yourAnswerLabel: {
    ...typography.labelSm,
    color: colors.onSurfaceVariant,
    letterSpacing: 0.6,
    marginTop: spacing.xs,
  },
  yourAnswerText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 20,
    color: colors.onSurfaceVariant,
  },

  errorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  nextBtn: {
    backgroundColor: colors.secondary,
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  nextBtnDisabled: { backgroundColor: colors.surfaceContainerHigh },
  nextBtnText: { ...typography.labelMd, color: colors.onPrimary },
  completingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
