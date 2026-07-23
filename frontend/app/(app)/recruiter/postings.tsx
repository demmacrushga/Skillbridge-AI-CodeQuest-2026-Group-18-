import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Linking,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '@/context/AuthContext';
import { colors, typography, spacing, radius } from '@/constants/theme';
import { getMyPostings, deactivate } from '@/services/matching';
import { type Opportunity } from '@/types/matching';
import { AnimatedFadeIn } from '@/components/ui/AnimatedView';

function PostingCard({
  opportunity,
  onDeactivate,
}: {
  opportunity: Opportunity;
  onDeactivate: () => void;
}) {
  const [showDetailModal, setShowDetailModal] = useState(false);

  return (
    <View style={styles.card}>
      {/* Tap header to open detail Modal */}
      <TouchableOpacity
        onPress={() => setShowDetailModal(true)}
        activeOpacity={0.8}
        style={styles.cardHeaderTouchable}
      >
        <View style={styles.cardHeader}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={1}>
              {opportunity.title}
            </Text>
            <View
              style={[
                styles.statusBadge,
                opportunity.active ? styles.statusActive : styles.statusInactive,
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  opportunity.active ? styles.statusActiveText : styles.statusInactiveText,
                ]}
              >
                {opportunity.active ? 'Active' : 'Closed'}
              </Text>
            </View>
          </View>
          <View style={styles.companyRow}>
            <Text style={styles.company}>{opportunity.companyName}</Text>
            <View style={styles.typeBadge}>
              <Text style={styles.typeBadgeText}>
                {opportunity.opportunityType === 'INTERNSHIP' ? 'Internship' : 'Entry Level'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Ionicons name="people-outline" size={16} color={colors.secondary} />
            <Text style={styles.statText}>
              {opportunity.applicantCount ?? 0} Applicants
            </Text>
          </View>
          <View style={styles.statBox}>
            <Ionicons name="calendar-outline" size={16} color={colors.onSurfaceVariant} />
            <Text style={styles.statText}>
              {new Date(opportunity.createdAt).toLocaleDateString()}
            </Text>
          </View>
          <View style={styles.detailsTag}>
            <Text style={styles.detailsTagText}>Details</Text>
            <Ionicons name="open-outline" size={14} color={colors.tertiary} />
          </View>
        </View>
      </TouchableOpacity>

      {/* Action Buttons: View Applicants (GREEN), Close Posting (RED) */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={styles.actionBtnGreen}
          onPress={() =>
            router.push(
              `/(app)/recruiter/applicants?opportunityId=${opportunity.id}&title=${encodeURIComponent(opportunity.title)}`
            )
          }
        >
          <Ionicons name="people-outline" size={16} color={colors.onPrimary} style={{ marginRight: 6 }} />
          <Text style={styles.actionBtnGreenText}>View Applicants</Text>
        </TouchableOpacity>

        {opportunity.active && (
          <TouchableOpacity
            style={styles.actionBtnRed}
            onPress={onDeactivate}
          >
            <Ionicons name="close-circle-outline" size={16} color={colors.error} style={{ marginRight: 4 }} />
            <Text style={styles.actionBtnRedText}>Close Posting</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Detail Modal Popup */}
      <Modal
        visible={showDetailModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDetailModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>{opportunity.title}</Text>
                <Text style={styles.modalSubtitle}>{opportunity.companyName}</Text>
              </View>
              <TouchableOpacity onPress={() => setShowDetailModal(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color={colors.onSurface} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalScrollContent} showsVerticalScrollIndicator={false}>
              {/* Status & Type */}
              <View style={styles.modalTagRow}>
                <View style={[styles.statusBadge, opportunity.active ? styles.statusActive : styles.statusInactive]}>
                  <Text style={[styles.statusText, opportunity.active ? styles.statusActiveText : styles.statusInactiveText]}>
                    {opportunity.active ? 'Active Opportunity' : 'Closed Opportunity'}
                  </Text>
                </View>
                <View style={styles.typeBadge}>
                  <Text style={styles.typeBadgeText}>
                    {opportunity.opportunityType === 'INTERNSHIP' ? 'Internship' : 'Entry Level'}
                  </Text>
                </View>
              </View>

              {/* Job Description */}
              <Text style={styles.detailLabel}>Job Description</Text>
              <Text style={styles.descriptionText}>{opportunity.description}</Text>

              {/* Location & Deadline */}
              <View style={styles.metaRow}>
                {opportunity.location ? (
                  <View style={styles.metaItem}>
                    <Ionicons name="location-outline" size={16} color={colors.tertiary} />
                    <Text style={styles.metaItemText}>{opportunity.location}</Text>
                  </View>
                ) : null}
                {opportunity.deadline ? (
                  <View style={styles.metaItem}>
                    <Ionicons name="time-outline" size={16} color={colors.secondary} />
                    <Text style={styles.metaItemText}>Deadline: {new Date(opportunity.deadline).toLocaleDateString()}</Text>
                  </View>
                ) : null}
              </View>

              {/* External Link */}
              {opportunity.externalUrl ? (
                <TouchableOpacity
                  style={styles.linkBtn}
                  onPress={() => Linking.openURL(opportunity.externalUrl!)}
                >
                  <Ionicons name="open-outline" size={16} color={colors.tertiary} />
                  <Text style={styles.linkBtnText} numberOfLines={1}>{opportunity.externalUrl}</Text>
                </TouchableOpacity>
              ) : null}

              {/* Required Skills */}
              {opportunity.requiredSkills && opportunity.requiredSkills.length > 0 ? (
                <View style={styles.skillsSection}>
                  <Text style={styles.detailLabel}>Required Skills</Text>
                  <View style={styles.skillsWrap}>
                    {opportunity.requiredSkills.map((s, i) => (
                      <View
                        key={i}
                        style={[
                          styles.skillPill,
                          s.required ? styles.skillPillRequired : styles.skillPillOptional,
                        ]}
                      >
                        <Text
                          style={[
                            styles.skillPillText,
                            s.required ? styles.skillPillTextRequired : styles.skillPillTextOptional,
                          ]}
                        >
                          {s.skillName} {s.required ? '• Required' : '• Preferred'}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
            </ScrollView>

            <TouchableOpacity style={styles.modalDoneBtn} onPress={() => setShowDetailModal(false)}>
              <Text style={styles.modalDoneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

export default function RecruiterPostingsScreen() {
  const { state } = useAuth();
  const token = state.accessToken;

  const [postings, setPostings] = useState<Opportunity[]>([]);
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'CLOSED'>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPostings = useCallback(
    async (refreshing = false) => {
      if (!token) return;
      if (refreshing) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);
      try {
        const data = await getMyPostings(token);
        setPostings(data);
      } catch (e: any) {
        setError(e.message ?? 'Failed to load postings');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [token]
  );

  useFocusEffect(
    useCallback(() => {
      loadPostings();
    }, [loadPostings])
  );

  const handleDeactivate = (opportunity: Opportunity) => {
    Alert.alert(
      'Close Posting',
      `Are you sure you want to close "${opportunity.title}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Close Posting',
          style: 'destructive',
          onPress: async () => {
            if (!token) return;
            try {
              await deactivate(token, opportunity.id);
              loadPostings();
            } catch (e: any) {
              Alert.alert('Error', e.message ?? 'Failed to deactivate posting');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header — Blended with App Homepage Header styling */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerLogoMark}>
            <Ionicons name="compass" size={20} color={colors.onPrimary} />
          </View>
        </View>
        <TouchableOpacity
          style={styles.postBtnHeader}
          onPress={() => router.push('/(app)/recruiter/post')}
          accessibilityLabel="Post New Job"
        >
          <Ionicons name="add" size={20} color={colors.onPrimary} />
          <Text style={styles.postBtnText}>Post Job</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => loadPostings(true)}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.pageTitleRow}>
          <Text style={styles.pageTitle}>Job Postings</Text>
          <Text style={styles.pageSubtitle}>Tap any posting to open full specifications popup</Text>
        </View>

        {postings.length > 0 && (
          <View style={{ flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.md }}>
            {[
              { id: 'ALL', label: `All (${postings.length})` },
              { id: 'ACTIVE', label: `Active (${postings.filter(p => p.active).length})` },
              { id: 'CLOSED', label: `Closed (${postings.filter(p => !p.active).length})` },
            ].map(pill => {
              const isSelected = filter === pill.id;
              return (
                <TouchableOpacity
                  key={pill.id}
                  style={[
                    styles.filterChip,
                    isSelected && styles.filterChipSelected
                  ]}
                  onPress={() => setFilter(pill.id as any)}
                >
                  <Text style={[styles.filterChipText, isSelected && styles.filterChipTextSelected]}>
                    {pill.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {isLoading ? (
          <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
        ) : error ? (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle-outline" size={24} color={colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : postings.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="briefcase-outline" size={32} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>No Job Postings Yet</Text>
            <Text style={styles.emptyDesc}>Create your first job posting to start finding top talent.</Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => router.push('/(app)/recruiter/post')}
            >
              <Text style={styles.emptyBtnText}>Post a Job Opportunity</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.list}>
            {postings.filter(p => filter === 'ACTIVE' ? p.active : filter === 'CLOSED' ? !p.active : true).map((opp, index) => (
              <AnimatedFadeIn key={opp.id} delay={index * 50} duration={350}>
                <PostingCard
                  opportunity={opp}
                  onDeactivate={() => handleDeactivate(opp)}
                />
              </AnimatedFadeIn>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerLogoMark: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBrandTitle: {
    ...typography.headlineSm,
    color: colors.onSurface,
  },
  postBtnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.secondary,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.full,
    gap: 4,
  },
  postBtnText: {
    ...typography.labelSm,
    color: colors.onPrimary,
  },

  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  pageTitleRow: {
    marginBottom: spacing.md,
  },
  pageTitle: {
    ...typography.headlineSm,
    color: colors.onSurface,
  },
  pageSubtitle: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
    marginTop: 2,
  },
  loader: {
    marginTop: spacing.xxl,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.errorContainer,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  errorText: {
    ...typography.bodyMd,
    color: colors.error,
    flex: 1,
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: colors.surfaceCard,
    padding: spacing.xl,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    marginTop: spacing.lg,
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
  emptyTitle: {
    ...typography.headlineSm,
    color: colors.onSurface,
    marginBottom: spacing.xs,
  },
  emptyDesc: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  emptyBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
  },
  emptyBtnText: {
    ...typography.labelMd,
    color: colors.onPrimary,
  },

  list: {
    gap: spacing.md,
  },
  card: {
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
  cardHeaderTouchable: {
    gap: spacing.xs,
  },
  cardHeader: {
    gap: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  title: {
    ...typography.headlineSm,
    fontSize: 18,
    color: colors.onSurface,
    flex: 1,
  },
  companyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  company: {
    ...typography.bodyMd,
    color: colors.onSurfaceVariant,
    fontFamily: 'Inter_500Medium',
  },
  typeBadge: {
    backgroundColor: `${colors.tertiary}15`,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  typeBadgeText: {
    ...typography.labelSm,
    color: colors.tertiary,
    fontSize: 11,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  statusActive: {
    backgroundColor: colors.successContainer,
    borderWidth: 1,
    borderColor: `${colors.secondary}35`,
  },
  statusInactive: {
    backgroundColor: colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  statusText: {
    ...typography.labelSm,
    fontSize: 12,
  },
  statusActiveText: {
    color: colors.secondary,
  },
  statusInactiveText: {
    color: colors.onSurfaceVariant,
  },

  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.sm,
    paddingTop: spacing.xs,
  },
  statBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
  },
  detailsTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
    backgroundColor: `${colors.tertiary}10`,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  detailsTagText: {
    ...typography.labelSm,
    color: colors.tertiary,
    fontSize: 12,
  },

  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  actionBtnGreen: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.secondary,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
  },
  actionBtnGreenText: {
    ...typography.labelMd,
    color: colors.onPrimary,
  },
  actionBtnRed: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.error,
    backgroundColor: '#FFF5F5',
  },
  actionBtnRedText: {
    ...typography.labelMd,
    color: colors.error,
  },

  /* Modal Popup Styles */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surfaceCard,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  modalTitle: { ...typography.headlineSm, color: colors.onSurface, fontSize: 20 },
  modalSubtitle: { ...typography.bodyMd, color: colors.onSurfaceVariant, marginTop: 2 },
  closeBtn: { padding: spacing.xs },
  modalScrollContent: { gap: spacing.md, paddingBottom: spacing.lg },
  modalTagRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },

  detailLabel: { ...typography.labelMd, color: colors.onSurface, fontSize: 15 },
  descriptionText: { ...typography.bodyMd, color: colors.onSurfaceVariant, lineHeight: 22 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaItemText: { ...typography.bodySm, color: colors.onSurfaceVariant },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: spacing.sm,
    backgroundColor: `${colors.tertiary}10`,
    borderRadius: radius.md,
    alignSelf: 'flex-start',
  },
  linkBtnText: { ...typography.labelSm, color: colors.tertiary },
  skillsSection: { marginTop: spacing.xs },
  skillsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  skillPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full },
  skillPillRequired: { backgroundColor: `${colors.primary}15` },
  skillPillOptional: { backgroundColor: colors.surfaceContainerLow },
  skillPillText: { ...typography.labelSm, fontSize: 12 },
  skillPillTextRequired: { color: colors.primary },
  skillPillTextOptional: { color: colors.onSurfaceVariant },

  modalDoneBtn: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  modalDoneBtnText: { ...typography.labelMd, color: colors.onPrimary },

  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  filterChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    ...typography.labelSm,
    fontSize: 12,
    color: colors.onSurfaceVariant,
  },
  filterChipTextSelected: {
    color: colors.onPrimary,
  },
});
