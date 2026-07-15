import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '@/context/AuthContext';
import { colors, typography, spacing, radius } from '@/constants/theme';
import { getSession } from '@/services/mockInterview';
import { type InterviewSession, type InterviewQuestion } from '@/types/mockInterview';

const CATEGORY_LABEL: Record<string, string> = {
  TECHNICAL: 'Technical',
  BEHAVIORAL: 'Behavioral',
  SITUATIONAL: 'Situational',
  OTHER: 'General',
};

function scoreColor(score: number, max: number) {
  const ratio = score / max;
  if (ratio >= 0.8) return colors.secondary;
  if (ratio >= 0.5) return '#CA8A04';
  return colors.error;
}

function QuestionCard({ question }: { question: InterviewQuestion }) {
  const accent = scoreColor(question.score ?? 0, 10);
  return (
    <View style={[styles.questionCard, { borderLeftColor: accent }]}>
      <View style={styles.questionHeader}>
        <View style={[styles.orderBadge, { backgroundColor: `${accent}15` }]}>
          <Text style={[styles.orderText, { color: accent }]}>Q{question.orderIndex}</Text>
        </View>
        <View style={styles.questionHeaderText}>
          <Text style={styles.questionText} numberOfLines={2}>{question.questionText}</Text>
          <Text style={styles.categoryText}>{CATEGORY_LABEL[question.category] ?? 'General'}</Text>
        </View>
        <View style={[styles.scoreBadge, { backgroundColor: `${accent}15` }]}>
          <Text style={[styles.scoreBadgeText, { color: accent }]}>{question.score ?? '—'}/10</Text>
        </View>
      </View>

      <View style={styles.divider} />
      <Text style={styles.answerLabel}>Your answer</Text>
      <Text style={styles.answerText}>{question.userAnswer ?? '—'}</Text>

      {question.feedback ? (
        <>
          <Text style={styles.feedbackLabel}>Feedback</Text>
          <Text style={styles.feedbackText}>{question.feedback}</Text>
        </>
      ) : null}
    </View>
  );
}

export default function MockInterviewReportScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { state } = useAuth();
  const token = state.accessToken;

  const [session, setSession] = useState<InterviewSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSession = useCallback(async () => {
    if (!token || !sessionId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await getSession(token, sessionId);
      setSession(data);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load report');
    } finally {
      setIsLoading(false);
    }
  }, [token, sessionId]);

  useEffect(() => { fetchSession(); }, [fetchSession]);

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        router.replace('/(app)/mock-interview');
        return true;
      });
      return () => sub.remove();
    }, [])
  );

  const sortedQuestions: InterviewQuestion[] = session
    ? [...session.questions].sort((a, b) => a.orderIndex - b.orderIndex)
    : [];

  const goHome = () => router.replace('/(app)/mock-interview');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={goHome} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={colors.primary} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {session?.targetRole ?? 'Interview Report'}
          </Text>
          {session && (
            <Text style={styles.headerSubtitle}>
              {session.difficulty.charAt(0) + session.difficulty.slice(1).toLowerCase()} ·{' '}
              {sortedQuestions.length} questions
            </Text>
          )}
        </View>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.tertiary} />
          <Text style={styles.loadingText}>Loading report…</Text>
        </View>
      ) : error || !session ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={40} color={colors.error} />
          <Text style={styles.errorText}>{error ?? 'Report not found'}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchSession} activeOpacity={0.8}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.heroCard}>
            <Text style={styles.heroEyebrow}>OVERALL SCORE</Text>
            <View style={styles.heroScoreRow}>
              <Text style={styles.heroScoreNum}>{session.overallScore ?? '—'}</Text>
              <Text style={styles.heroScorePct}>/100</Text>
            </View>
            {session.overallFeedback ? (
              <Text style={styles.heroFeedback}>{session.overallFeedback}</Text>
            ) : null}
          </View>

          <Text style={styles.sectionLabel}>Question Breakdown</Text>
          {sortedQuestions.map(q => (
            <QuestionCard key={q.id} question={q} />
          ))}

          <TouchableOpacity style={styles.doneBtn} onPress={goHome} activeOpacity={0.85}>
            <Text style={styles.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
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
  loadingText: { ...typography.bodyMd, color: colors.onSurfaceVariant },
  errorText: { ...typography.bodyMd, color: colors.error, textAlign: 'center' },
  retryBtn: {
    backgroundColor: colors.tertiary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  retryText: { ...typography.labelMd, color: colors.onPrimary },
  scrollContent: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.sm },

  heroCard: {
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  heroEyebrow: {
    ...typography.labelSm,
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 1.2,
    marginBottom: spacing.xs,
  },
  heroScoreRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: spacing.sm },
  heroScoreNum: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 48,
    lineHeight: 52,
    color: colors.onPrimary,
  },
  heroScorePct: {
    ...typography.labelMd,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 8,
    marginLeft: 4,
  },
  heroFeedback: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.85)',
  },

  sectionLabel: {
    ...typography.labelSm,
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
  },

  questionCard: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderLeftWidth: 3,
    padding: spacing.md,
    gap: spacing.xs,
  },
  questionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  orderBadge: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  orderText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12 },
  questionHeaderText: { flex: 1, gap: 2 },
  questionText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    lineHeight: 19,
    color: colors.onSurface,
  },
  categoryText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: colors.onSurfaceVariant,
  },
  scoreBadge: {
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
    flexShrink: 0,
  },
  scoreBadgeText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  divider: { height: 1, backgroundColor: colors.outlineVariant, marginVertical: spacing.xs },
  answerLabel: { ...typography.labelSm, color: colors.onSurfaceVariant, letterSpacing: 0.6 },
  answerText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 20,
    color: colors.onSurface,
  },
  feedbackLabel: {
    ...typography.labelSm,
    color: colors.onSurfaceVariant,
    letterSpacing: 0.6,
    marginTop: spacing.xs,
  },
  feedbackText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 20,
    color: colors.onSurfaceVariant,
  },

  doneBtn: {
    backgroundColor: colors.secondary,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  doneBtnText: { ...typography.labelMd, color: colors.onPrimary },
});
