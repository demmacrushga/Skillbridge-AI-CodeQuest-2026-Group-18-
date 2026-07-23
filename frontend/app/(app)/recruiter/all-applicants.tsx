import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '@/context/AuthContext';
import { colors, typography, spacing, radius } from '@/constants/theme';
import { getMyPostings, getApplicants } from '@/services/matching';
import { type Applicant, type Opportunity } from '@/types/matching';
import { AnimatedFadeIn, AnimatedPressable, ActiveText } from '@/components/ui/AnimatedView';

interface ExtendedApplicant extends Applicant {
  opportunityTitle: string;
  opportunityId: string;
  active: boolean;
}

export default function AllApplicantsScreen() {
  const { state } = useAuth();
  const token = state.accessToken;

  const [applicants, setApplicants] = useState<ExtendedApplicant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'ACTIVE' | 'CLOSED'>('ALL');

  const fetchAllApplicants = useCallback(async () => {
    if (!token) return;
    try {
      const postings = await getMyPostings(token);
      const allList: ExtendedApplicant[] = [];

      await Promise.all(
        postings.map(async (posting: Opportunity) => {
          try {
            const list = await getApplicants(token, posting.id);
            list.forEach(a => {
              allList.push({
                ...a,
                opportunityTitle: posting.title,
                opportunityId: posting.id,
                active: posting.active,
              });
            });
          } catch {
            // Ignore single failures
          }
        })
      );

      // Sort by newest application date
      allList.sort((a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime());
      setApplicants(allList);
    } catch (e) {
      console.error('Failed to load all applicants:', e);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      fetchAllApplicants();
    }, [fetchAllApplicants])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAllApplicants();
    setRefreshing(false);
  };

  const filteredApplicants = applicants.filter(a => {
    const matchesSearch =
      a.studentId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.opportunityTitle.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (activeFilter === 'ACTIVE') return matchesSearch && a.active;
    if (activeFilter === 'CLOSED') return matchesSearch && !a.active;
    return matchesSearch;
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerLogoMark}>
            <Ionicons name="people" size={20} color={colors.onPrimary} />
          </View>
          <Text style={styles.headerBrandTitle}>All Applicants</Text>
        </View>
      </View>

      {/* Search & Filter Bar */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={20} color={colors.outline} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by student ID or job title..."
            placeholderTextColor={colors.outline}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={colors.outline} />
            </TouchableOpacity>
          ) : null}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={{ gap: spacing.xs }}>
          {(['ALL', 'ACTIVE', 'CLOSED'] as const).map(filter => (
            <TouchableOpacity
              key={filter}
              style={[styles.filterPill, activeFilter === filter && styles.filterPillActive]}
              onPress={() => setActiveFilter(filter)}
            >
              <Text style={[styles.filterText, activeFilter === filter && styles.filterTextActive]}>
                {filter === 'ALL' ? 'All Applicants' : filter === 'ACTIVE' ? 'Active Jobs' : 'Closed Jobs'}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Main List */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {isLoading && !refreshing ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xxl }} />
        ) : filteredApplicants.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="people-outline" size={32} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>No Applicants Found</Text>
            <Text style={styles.emptyDesc}>
              {searchQuery ? 'No applicants match your search criteria.' : 'When candidates apply to your job postings, they will appear here.'}
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {filteredApplicants.map((item, idx) => (
              <AnimatedFadeIn key={`${item.opportunityId}-${item.studentId}-${idx}`} delay={idx * 40} duration={350}>
                <AnimatedPressable
                  style={styles.applicantCard}
                  onPress={() => router.push(`/(app)/recruiter/applicant-portfolio?studentId=${item.studentId}`)}
                  activeOpacity={0.85}
                >
                  <View style={styles.cardTopRow}>
                    <View style={styles.avatarWrap}>
                      <Ionicons name="person" size={20} color={colors.primary} />
                    </View>
                    <View style={styles.studentInfo}>
                      <ActiveText style={styles.studentName}>Student Candidate</ActiveText>
                      <ActiveText style={styles.studentId}>ID: {item.studentId.substring(0, 8)}...</ActiveText>
                    </View>
                    <View style={[styles.statusBadge, item.active ? styles.statusActive : styles.statusClosed]}>
                      <ActiveText style={[styles.statusText, item.active ? styles.statusActiveText : styles.statusClosedText]}>
                        {item.active ? 'Active Job' : 'Closed Job'}
                      </ActiveText>
                    </View>
                  </View>

                  <View style={styles.divider} />

                  <View style={styles.cardBottomRow}>
                    <View style={styles.jobTag}>
                      <Ionicons name="briefcase-outline" size={14} color={colors.tertiary} />
                      <ActiveText style={styles.jobTitle} numberOfLines={1}>{item.opportunityTitle}</ActiveText>
                    </View>
                    <View style={styles.dateTag}>
                      <Ionicons name="time-outline" size={14} color={colors.onSurfaceVariant} />
                      <ActiveText style={styles.dateText}>{new Date(item.appliedAt).toLocaleDateString()}</ActiveText>
                    </View>
                  </View>
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
  
  searchSection: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 44,
    gap: spacing.sm,
  },
  searchInput: { flex: 1, ...typography.bodyMd, color: colors.onSurface },
  filterRow: { marginTop: spacing.sm, flexDirection: 'row' },
  filterPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceContainerLow,
    marginRight: spacing.xs,
  },
  filterPillActive: { backgroundColor: colors.primary },
  filterText: { ...typography.labelSm, color: colors.onSurfaceVariant },
  filterTextActive: { color: colors.onPrimary },
  
  scrollContent: { padding: spacing.md, paddingBottom: spacing.xxl },
  list: { gap: spacing.md },
  
  applicantCard: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: `${colors.secondary}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  studentInfo: { flex: 1 },
  studentName: { ...typography.labelMd, color: colors.onSurface, fontSize: 16 },
  studentId: { ...typography.bodySm, color: colors.onSurfaceVariant, fontSize: 12 },
  
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  statusActive: { backgroundColor: colors.successContainer, borderWidth: 1, borderColor: `${colors.secondary}35` },
  statusClosed: { backgroundColor: colors.surfaceContainerLow, borderWidth: 1, borderColor: colors.outlineVariant },
  statusText: { ...typography.labelSm, fontSize: 11 },
  statusActiveText: { color: colors.secondary },
  statusClosedText: { color: colors.onSurfaceVariant },

  divider: { height: 1, backgroundColor: colors.outlineVariant, marginVertical: spacing.md },
  
  cardBottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  jobTag: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  jobTitle: { ...typography.bodySm, color: colors.tertiary, fontFamily: 'Inter_500Medium' },
  dateTag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dateText: { ...typography.bodySm, color: colors.onSurfaceVariant, fontSize: 12 },

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
    borderRadius: 32,
    backgroundColor: `${colors.primary}10`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: { ...typography.headlineSm, color: colors.onSurface, marginBottom: spacing.xs },
  emptyDesc: { fontFamily: 'Inter_400Regular', fontSize: 14, color: colors.onSurfaceVariant, textAlign: 'center' },
});
