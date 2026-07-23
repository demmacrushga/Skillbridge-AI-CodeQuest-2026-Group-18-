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
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '@/context/AuthContext';
import { colors, typography, spacing, radius } from '@/constants/theme';
import { SkeletonJobCard } from '@/components/ui/SkeletonCard';
import { AnimatedFadeIn, AnimatedPressable } from '@/components/ui/AnimatedView';
import {
  getMatches,
  apply,
  getApplications,
  getSkills,
  updateSkills,
} from '@/services/matching';
import {
  type Match,
  type ApplicationWithOpportunity,
} from '@/types/matching';

function scoreColor(score: number) {
  if (score >= 70) return colors.secondary;
  if (score >= 40) return colors.tertiary;
  return colors.onSurfaceVariant;
}

function ApplyModal({
  visible,
  opportunityTitle,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  opportunityTitle: string;
  onClose: () => void;
  onSubmit: (pitch: string) => void;
}) {
  const [pitch, setPitch] = useState('');

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Apply: {opportunityTitle}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.onSurface} />
            </TouchableOpacity>
          </View>

          <Text style={styles.fieldLabel}>Pitch / Cover Letter</Text>
          <Text style={styles.fieldHint}>Explain why you are a great fit for this role based on the required skills.</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            value={pitch}
            onChangeText={setPitch}
            placeholder="I believe I am a strong candidate because..."
            placeholderTextColor={colors.outline}
            multiline
            numberOfLines={5}
          />

          <View style={styles.buttonGroup}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.submitButton} onPress={() => { onSubmit(pitch); setPitch(''); }}>
              <Text style={styles.submitButtonText}>Submit Application</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function MatchCard({
  match,
  expanded,
  studentSkills,
  onToggle,
  onApply,
  isApplying,
}: {
  match: Match;
  expanded: boolean;
  studentSkills: string[];
  onToggle: () => void;
  onApply: () => void;
  isApplying: boolean;
}) {
  const o = match.opportunity;
  const accent = scoreColor(match.matchScore);
  const deadlineStr = o.deadline
    ? new Date(o.deadline).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null;

  return (
    <View style={styles.matchCard}>
      <TouchableOpacity onPress={onToggle} activeOpacity={0.8} style={styles.matchCardHead}>
        <View style={styles.matchCardBody}>
          <View style={styles.matchTitleRow}>
            <Text style={styles.matchTitle} numberOfLines={expanded ? undefined : 1}>
              {o.title}
            </Text>
            {o.externalUrl ? (
              <View style={styles.externalBadge}>
                <Ionicons name="open-outline" size={10} color={colors.tertiary} />
                <Text style={styles.externalBadgeText}>External</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.matchMeta} numberOfLines={1}>
            {o.companyName}
            {o.opportunityType ? ` · ${o.opportunityType.replace('_', ' ')}` : ''}
            {o.location ? ` · ${o.location}` : ''}
            {deadlineStr ? ` · due ${deadlineStr}` : ''}
          </Text>
        </View>
        <View style={[styles.scoreBadge, { backgroundColor: `${accent}15` }]}>
          <Text style={[styles.scoreBadgeText, { color: accent }]}>
            {match.matchScore.toFixed(0)}
          </Text>
        </View>
      </TouchableOpacity>

      {expanded ? (
        <View style={styles.matchDetail}>
          <Text style={styles.matchDescription}>{o.description}</Text>
          <Text style={[styles.fieldLabel, { fontSize: 13, marginBottom: 6 }]}>Skills Comparison & Requirements:</Text>
          <View style={styles.skillsRow}>
            {o.requiredSkills.map(s => {
              const hasSkill = studentSkills.some(sk => sk.toLowerCase() === s.skillName.toLowerCase());
              return (
                <View
                  key={s.skillName}
                  style={[
                    styles.skillChip,
                    hasSkill ? styles.skillChipMatched : styles.skillChipMissing,
                  ]}
                >
                  <Ionicons
                    name={hasSkill ? "checkmark-circle" : "alert-circle-outline"}
                    size={12}
                    color={hasSkill ? colors.secondary : colors.error}
                    style={{ marginRight: 4 }}
                  />
                  <Text
                    style={[
                      styles.skillChipText,
                      hasSkill ? styles.skillChipMatchedText : styles.skillChipMissingText,
                    ]}
                  >
                    {s.skillName} {hasSkill ? '(Matched)' : '(Missing)'}
                  </Text>
                </View>
              );
            })}
          </View>
          {match.applied ? (
            <View style={styles.appliedRow}>
              <Ionicons name="checkmark-circle" size={16} color={colors.secondary} />
              <Text style={styles.appliedText}>Applied</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.applyBtn, isApplying && styles.applyBtnDisabled]}
              onPress={onApply}
              disabled={isApplying}
              activeOpacity={0.85}
            >
              {isApplying ? (
                <ActivityIndicator size="small" color={colors.onPrimary} />
              ) : (
                <Text style={styles.applyBtnText}>
                  {o.externalUrl ? 'Apply (opens external site)' : 'Apply'}
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      ) : null}
    </View>
  );
}

export default function OpportunitiesScreen() {
  const { state } = useAuth();
  const token = state.accessToken;

  const [matches, setMatches] = useState<Match[]>([]);
  const [applications, setApplications] = useState<ApplicationWithOpportunity[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [applyingId, setApplyingId] = useState<string | null>(null);

  const [isEditingSkills, setIsEditingSkills] = useState(false);
  const [editedSkills, setEditedSkills] = useState<string[]>([]);
  const [newSkill, setNewSkill] = useState('');
  const [isSavingSkills, setIsSavingSkills] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [applyModalMatch, setApplyModalMatch] = useState<Match | null>(null);

  const filteredMatches = matches.filter(m => 
    m.opportunity.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.opportunity.companyName.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
        const [matchData, appData, skillData] = await Promise.all([
          getMatches(token),
          getApplications(token),
          getSkills(token),
        ]);
        setMatches(matchData.matches);
        setApplications(appData);
        setSkills(skillData);
      } catch (e: any) {
        setError(e.message ?? 'Failed to load opportunities');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [token]
  );

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const initiateApply = (match: Match) => {
    if (match.opportunity.externalUrl) {
      handleApply(match, '');
    } else {
      setApplyModalMatch(match);
    }
  };

  const handleApply = async (match: Match, pitch: string) => {
    if (!token) return;
    setApplyModalMatch(null);
    const id = match.opportunity.id;
    setApplyingId(id);
    // Optimistic: flip to applied immediately
    setMatches(prev =>
      prev.map(m => (m.opportunity.id === id ? { ...m, applied: true } : m))
    );
    try {
      const result = await apply(token, id);
      if (result.externalUrl) {
        Linking.openURL(result.externalUrl).catch(() =>
          Alert.alert('Could not open link', result.externalUrl ?? '')
        );
      }
      // Refresh applications section in the background
      getApplications(token).then(setApplications).catch(() => {});
    } catch (e: any) {
      // Roll back optimistic apply
      setMatches(prev =>
        prev.map(m => (m.opportunity.id === id ? { ...m, applied: false } : m))
      );
      if (e.status === 409) {
        setMatches(prev =>
          prev.map(m => (m.opportunity.id === id ? { ...m, applied: true } : m))
        );
      } else {
        Alert.alert('Apply failed', e.message ?? 'Please try again');
      }
    } finally {
      setApplyingId(null);
    }
  };

  const startEditSkills = () => {
    setEditedSkills(skills);
    setNewSkill('');
    setIsEditingSkills(true);
  };

  const addSkill = () => {
    const s = newSkill.trim();
    if (!s) return;
    if (!editedSkills.some(x => x.toLowerCase() === s.toLowerCase())) {
      setEditedSkills(prev => [...prev, s]);
    }
    setNewSkill('');
  };

  const saveSkills = async () => {
    if (!token) return;
    setIsSavingSkills(true);
    try {
      const saved = await updateSkills(token, editedSkills);
      setSkills(saved);
      setIsEditingSkills(false);
      // Rescore against the new profile
      const matchData = await getMatches(token);
      setMatches(matchData.matches);
    } catch (e: any) {
      Alert.alert('Could not save skills', e.message ?? 'Please try again');
    } finally {
      setIsSavingSkills(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerIconWrap}>
          <Ionicons name="briefcase" size={18} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Opportunities</Text>
          <Text style={styles.headerSubtitle}>Internships matched to your skills</Text>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={colors.outline} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by title or company..."
          placeholderTextColor={colors.outline}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
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
        {/* Skill profile */}
        <View style={styles.skillsCard}>
          <View style={styles.skillsCardHeader}>
            <Text style={styles.sectionLabel}>My Skills</Text>
            {!isEditingSkills ? (
              <TouchableOpacity onPress={startEditSkills} activeOpacity={0.7}>
                <Text style={styles.editSkillsLink}>Edit</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {isEditingSkills ? (
            <View style={styles.skillEditor}>
              <View style={styles.skillsRow}>
                {editedSkills.map(s => (
                  <TouchableOpacity
                    key={s}
                    style={styles.skillChipEditable}
                    onPress={() => setEditedSkills(prev => prev.filter(x => x !== s))}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.skillChipEditableText}>{s}</Text>
                    <Ionicons name="close" size={12} color={colors.primary} />
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.addSkillRow}>
                <TextInput
                  style={styles.addSkillInput}
                  placeholder="Add a skill…"
                  placeholderTextColor={colors.outline}
                  value={newSkill}
                  onChangeText={setNewSkill}
                  onSubmitEditing={addSkill}
                  returnKeyType="done"
                />
                <TouchableOpacity style={styles.addSkillBtn} onPress={addSkill}>
                  <Ionicons name="add" size={18} color={colors.onPrimary} />
                </TouchableOpacity>
              </View>
              <View style={styles.skillEditorActions}>
                <TouchableOpacity onPress={() => setIsEditingSkills(false)}>
                  <Text style={styles.cancelLink}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveSkillsBtn, isSavingSkills && styles.applyBtnDisabled]}
                  onPress={saveSkills}
                  disabled={isSavingSkills}
                >
                  {isSavingSkills ? (
                    <ActivityIndicator size="small" color={colors.onPrimary} />
                  ) : (
                    <Text style={styles.saveSkillsBtnText}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.skillsRow}>
              {skills.length === 0 ? (
                <Text style={styles.noSkillsText}>
                  No skills yet — tap Edit to add skills and improve your matches
                </Text>
              ) : (
                skills.map(s => (
                  <View key={s} style={styles.skillChip}>
                    <Text style={styles.skillChipText}>{s}</Text>
                  </View>
                ))
              )}
            </View>
          )}
        </View>

        {/* Matches */}
        <Text style={styles.sectionLabel}>Ranked Matches</Text>

        {isLoading ? (
          <View style={{ gap: spacing.sm }}>
            <SkeletonJobCard />
            <SkeletonJobCard />
            <SkeletonJobCard />
          </View>
        ) : error ? (
          <View style={styles.errorRow}>
            <Ionicons name="alert-circle-outline" size={14} color={colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : filteredMatches.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="briefcase-outline" size={28} color={colors.onSurfaceVariant} />
            </View>
            <Text style={styles.emptyTitle}>No matching opportunities found</Text>
            <Text style={styles.emptySubtitle}>
              Try adjusting your search query or updating your skills.
            </Text>
          </View>
        ) : (
          <View style={styles.matchList}>
              {filteredMatches.map((m, idx) => (
                <AnimatedFadeIn key={m.opportunity.id} delay={idx * 30} duration={350}>
                  <MatchCard
                    match={m}
                    expanded={expandedId === m.opportunity.id}
                    studentSkills={skills}
                    onToggle={() =>
                      setExpandedId(prev => (prev === m.opportunity.id ? null : m.opportunity.id))
                    }
                    onApply={() => initiateApply(m)}
                    isApplying={applyingId === m.opportunity.id}
                  />
                </AnimatedFadeIn>
              ))}
          </View>
        )}

        {/* My Applications */}
        <View style={styles.applicationsHeader}>
          <Text style={styles.sectionLabel}>My Applications</Text>
          {applications.length > 0 && (
            <Text style={styles.countBadge}>{applications.length}</Text>
          )}
        </View>

        {applications.length === 0 ? (
          <Text style={styles.noApplicationsText}>
            Opportunities you apply to will appear here
          </Text>
        ) : (
          <View style={styles.matchList}>
            {applications.map(a => (
              <View key={a.id} style={styles.applicationRow}>
                <View style={[styles.applicationIcon, { backgroundColor: `${colors.secondary}12` }]}>
                  <Ionicons name="checkmark" size={16} color={colors.secondary} />
                </View>
                <View style={styles.applicationBody}>
                  <Text style={styles.applicationTitle} numberOfLines={1}>
                    {a.opportunity.title}
                  </Text>
                  <Text style={styles.applicationMeta}>
                    {a.opportunity.companyName} ·{' '}
                    {new Date(a.appliedAt).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                    })}
                    {a.opportunity.externalUrl ? ' · External' : ''}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {applyModalMatch && (
        <ApplyModal
          visible={!!applyModalMatch}
          opportunityTitle={applyModalMatch.opportunity.title}
          onClose={() => setApplyModalMatch(null)}
          onSubmit={(pitch) => handleApply(applyModalMatch, pitch)}
        />
      )}
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

  skillsCard: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  skillsCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  editSkillsLink: { ...typography.labelMd, color: colors.primary },
  skillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  noSkillsText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: colors.onSurfaceVariant,
  },
  skillEditor: { gap: spacing.sm },
  addSkillRow: { flexDirection: 'row', gap: spacing.xs },
  addSkillInput: {
    flex: 1,
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
  addSkillBtn: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skillEditorActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: spacing.md },
  cancelLink: { ...typography.labelMd, color: colors.onSurfaceVariant },
  saveSkillsBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  saveSkillsBtnText: { ...typography.labelMd, color: colors.onPrimary },

  matchList: { gap: spacing.md },
  matchCard: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: spacing.sm,
  },
  matchCardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.sm,
  },
  matchCardBody: { flex: 1, gap: 3 },
  matchTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  matchTitle: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    color: colors.onSurface,
    flexShrink: 1,
  },
  externalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: `${colors.tertiary}12`,
    borderRadius: radius.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  externalBadgeText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 9,
    color: colors.tertiary,
  },
  matchMeta: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: colors.onSurfaceVariant,
  },
  scoreBadge: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreBadgeText: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  matchDetail: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
    paddingTop: spacing.sm,
  },
  matchDescription: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: colors.onSurface,
    lineHeight: 19,
  },
  skillChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  skillChipText: { fontFamily: 'Inter_500Medium', fontSize: 11 },
  skillChipMatched: { backgroundColor: `${colors.secondary}15`, borderWidth: 1, borderColor: `${colors.secondary}30` },
  skillChipMatchedText: { color: colors.secondary },
  skillChipMissing: { backgroundColor: '#FFF5F5', borderWidth: 1, borderColor: '#FFCDD2' },
  skillChipMissingText: { color: colors.error },
  skillChipOptional: { backgroundColor: colors.surfaceContainerLow },
  skillChipOptionalText: { color: colors.onSurfaceVariant },
  skillChipEditable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: `${colors.primary}15`,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  skillChipEditableText: { fontFamily: 'Inter_500Medium', fontSize: 12, color: colors.primary },
  applyBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.sm + 2,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  applyBtnDisabled: { opacity: 0.6 },
  applyBtnText: { ...typography.labelMd, color: colors.onPrimary },
  appliedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs },
  appliedText: { ...typography.labelMd, color: colors.secondary },

  applicationsHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
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
  noApplicationsText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: colors.onSurfaceVariant,
  },
  applicationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  applicationIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applicationBody: { flex: 1, gap: 2 },
  applicationTitle: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
    color: colors.onSurface,
  },
  applicationMeta: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: colors.onSurfaceVariant,
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceCard,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  searchIcon: { marginRight: spacing.xs },
  searchInput: {
    flex: 1,
    height: 40,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: colors.onSurface,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.surfaceCard,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  modalTitle: { ...typography.headlineSm, color: colors.onSurface },
  fieldLabel: { ...typography.labelMd, color: colors.onSurfaceVariant, marginTop: spacing.sm },
  fieldHint: { fontFamily: 'Inter_400Regular', fontSize: 12, color: colors.outline, marginBottom: spacing.xs },
  input: {
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.md,
    padding: spacing.sm,
    ...typography.bodyMd,
    color: colors.onSurface,
  },
  inputMultiline: { height: 100, textAlignVertical: 'top' },
  buttonGroup: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  cancelButton: {
    flex: 1,
    padding: spacing.md,
    alignItems: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.surfaceContainerHigh,
  },
  cancelButtonText: { ...typography.labelMd, color: colors.onSurface },
  submitButton: {
    flex: 2,
    backgroundColor: colors.secondary,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  submitButtonText: { ...typography.labelMd, color: colors.onPrimary, fontWeight: '700' },
});
