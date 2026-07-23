import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '@/context/AuthContext';
import { colors, typography, spacing, radius } from '@/constants/theme';
import { getApplicants } from '@/services/matching';
import { type Applicant } from '@/types/matching';
import { AnimatedFadeIn, AnimatedPressable, ActiveText } from '@/components/ui/AnimatedView';

export default function ApplicantsScreen() {
  const { opportunityId, title } = useLocalSearchParams<{ opportunityId: string; title: string }>();
  const { state } = useAuth();
  const token = state.accessToken;

  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!token || !opportunityId) return;

      const fetchApplicants = async () => {
        setIsLoading(true);
        setError(null);
        try {
          const data = await getApplicants(token, opportunityId);
          setApplicants(data);
        } catch (e: any) {
          setError(e.message ?? 'Failed to load applicants');
        } finally {
          setIsLoading(false);
        }
      };

      fetchApplicants();
    }, [token, opportunityId])
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </TouchableOpacity>
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerTitle} numberOfLines={1}>Applicants</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>{decodeURIComponent(title ?? 'Opportunity')}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {isLoading ? (
          <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
        ) : error ? (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle-outline" size={24} color={colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : applicants.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="people-outline" size={32} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>No Applicants Yet</Text>
            <Text style={styles.emptyDesc}>When students apply to this opportunity, they will appear here.</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {applicants.map((a, idx) => (
              <AnimatedFadeIn key={a.studentId} delay={idx * 50} duration={350}>
                <AnimatedPressable 
                  style={styles.applicantCard}
                  onPress={() => router.push(`/(app)/recruiter/applicant-portfolio?studentId=${a.studentId}`)}
                  activeOpacity={0.85}
                >
                  <View style={styles.avatarWrap}>
                    <Ionicons name="person" size={20} color={colors.primary} />
                  </View>
                  <View style={styles.applicantInfo}>
                    <ActiveText style={styles.studentIdLabel}>Student ID</ActiveText>
                    <ActiveText style={styles.studentIdText}>{a.studentId}</ActiveText>
                  </View>
                  <View style={styles.dateInfo}>
                    <ActiveText style={styles.dateLabel}>Applied</ActiveText>
                    <ActiveText style={styles.dateText}>{new Date(a.appliedAt).toLocaleDateString()}</ActiveText>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.outline} style={{ marginLeft: spacing.xs }} />
                </AnimatedPressable>
              </AnimatedFadeIn>
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
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
    backgroundColor: colors.surfaceCard,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  backBtn: { padding: spacing.sm },
  headerTextWrap: { flex: 1, marginLeft: spacing.xs },
  headerTitle: { ...typography.headlineSm, color: colors.onSurface },
  headerSubtitle: { fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.onSurfaceVariant },
  scrollContent: { padding: spacing.md, paddingBottom: spacing.xxl },
  loader: { marginTop: spacing.xl },
  errorCard: {
    backgroundColor: colors.errorContainer,
    padding: spacing.md,
    borderRadius: radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  errorText: { ...typography.bodyMd, color: colors.error, flex: 1 },
  emptyCard: {
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    marginTop: spacing.xl,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    backgroundColor: `${colors.primary}10`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: { ...typography.headlineSm, color: colors.onSurface, marginBottom: spacing.xs },
  emptyDesc: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
  },
  list: { gap: spacing.md },
  applicantCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceCard,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    gap: spacing.md,
  },
  avatarWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: `${colors.secondary}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applicantInfo: { flex: 1 },
  studentIdLabel: { ...typography.labelSm, color: colors.onSurfaceVariant },
  studentIdText: { ...typography.bodyMd, color: colors.onSurface, fontFamily: 'Inter_500Medium' },
  dateInfo: { alignItems: 'flex-end' },
  dateLabel: { ...typography.labelSm, color: colors.onSurfaceVariant },
  dateText: { ...typography.bodySm, color: colors.onSurface },
});
