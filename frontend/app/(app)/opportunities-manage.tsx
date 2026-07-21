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
  postOpportunity,
  getMyPostings,
  deactivate,
  getApplicants,
} from '@/services/matching';
import {
  type Opportunity,
  type OpportunityType,
  type SkillRequirement,
  type Applicant,
} from '@/types/matching';

const TYPES: { value: OpportunityType; label: string }[] = [
  { value: 'INTERNSHIP', label: 'Internship' },
  { value: 'ENTRY_LEVEL', label: 'Entry Level' },
];

export default function OpportunitiesManageScreen() {
  const { state } = useAuth();
  const token = state.accessToken;

  // Post form state
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [opportunityType, setOpportunityType] = useState<OpportunityType>('INTERNSHIP');
  const [deadline, setDeadline] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
  const [skills, setSkills] = useState<SkillRequirement[]>([]);
  const [newSkill, setNewSkill] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Postings state
  const [postings, setPostings] = useState<Opportunity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  // Applicants state (per posting)
  const [applicantsFor, setApplicantsFor] = useState<string | null>(null);
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [isLoadingApplicants, setIsLoadingApplicants] = useState(false);

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
        setPostings(await getMyPostings(token));
      } catch (e: any) {
        setListError(e.message ?? 'Failed to load postings');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [token]
  );

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const addSkill = (required: boolean) => {
    const s = newSkill.trim();
    if (!s) return;
    if (!skills.some(x => x.skillName.toLowerCase() === s.toLowerCase())) {
      setSkills(prev => [...prev, { skillName: s, required }]);
    }
    setNewSkill('');
  };

  const resetForm = () => {
    setTitle(''); setCompanyName(''); setDescription(''); setLocation('');
    setOpportunityType('INTERNSHIP'); setDeadline(''); setExternalUrl('');
    setSkills([]); setNewSkill(''); setFormError(null);
  };

  const handlePost = async () => {
    if (!token) return;
    setFormError(null);
    if (!title.trim() || !companyName.trim() || !description.trim()) {
      setFormError('Title, company name and description are required');
      return;
    }
    if (skills.length === 0) {
      setFormError('Add at least one required skill');
      return;
    }
    if (deadline.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(deadline.trim())) {
      setFormError('Deadline must be YYYY-MM-DD');
      return;
    }
    setIsPosting(true);
    try {
      await postOpportunity(token, {
        title: title.trim(),
        companyName: companyName.trim(),
        description: description.trim(),
        ...(location.trim() ? { location: location.trim() } : {}),
        opportunityType,
        ...(deadline.trim() ? { deadline: deadline.trim() } : {}),
        ...(externalUrl.trim() ? { externalUrl: externalUrl.trim() } : {}),
        requiredSkills: skills,
      });
      resetForm();
      setShowForm(false);
      load();
    } catch (e: any) {
      setFormError(e.message ?? 'Could not post opportunity');
    } finally {
      setIsPosting(false);
    }
  };

  const handleDeactivate = (opp: Opportunity) => {
    Alert.alert(
      'Deactivate Posting',
      `"${opp.title}" will no longer appear in student matches.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deactivate',
          style: 'destructive',
          onPress: async () => {
            if (!token) return;
            // Optimistic
            setPostings(prev =>
              prev.map(p => (p.id === opp.id ? { ...p, active: false } : p))
            );
            try {
              await deactivate(token, opp.id);
            } catch (e: any) {
              setPostings(prev =>
                prev.map(p => (p.id === opp.id ? { ...p, active: true } : p))
              );
              Alert.alert('Could not deactivate', e.message ?? 'Please try again');
            }
          },
        },
      ]
    );
  };

  const toggleApplicants = async (oppId: string) => {
    if (applicantsFor === oppId) {
      setApplicantsFor(null);
      return;
    }
    if (!token) return;
    setApplicantsFor(oppId);
    setIsLoadingApplicants(true);
    try {
      setApplicants(await getApplicants(token, oppId));
    } catch {
      setApplicants([]);
    } finally {
      setIsLoadingApplicants(false);
    }
  };

  const canPost = !isPosting;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerIconWrap}>
          <Ionicons name="briefcase" size={18} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>My Postings</Text>
          <Text style={styles.headerSubtitle}>Manage opportunities and applicants</Text>
        </View>
        <TouchableOpacity
          style={styles.newBtn}
          onPress={() => setShowForm(v => !v)}
          activeOpacity={0.8}
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
            <Text style={styles.sectionLabel}>New Opportunity</Text>

            <TextInput style={styles.input} placeholder="Job title *" placeholderTextColor={colors.outline}
              value={title} onChangeText={setTitle} />
            <TextInput style={styles.input} placeholder="Company name *" placeholderTextColor={colors.outline}
              value={companyName} onChangeText={setCompanyName} />
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              placeholder="Description *"
              placeholderTextColor={colors.outline}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
            />
            <TextInput style={styles.input} placeholder="Location (optional)" placeholderTextColor={colors.outline}
              value={location} onChangeText={setLocation} />

            <View style={styles.typeRow}>
              {TYPES.map(t => {
                const selected = opportunityType === t.value;
                return (
                  <TouchableOpacity
                    key={t.value}
                    style={[styles.typeChip, selected && styles.typeChipSelected]}
                    onPress={() => setOpportunityType(t.value)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.typeChipText, selected && styles.typeChipTextSelected]}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TextInput style={styles.input} placeholder="Deadline YYYY-MM-DD (optional)"
              placeholderTextColor={colors.outline} value={deadline} onChangeText={setDeadline}
              autoCapitalize="none" />
            <TextInput style={styles.input} placeholder="External application URL (optional)"
              placeholderTextColor={colors.outline} value={externalUrl} onChangeText={setExternalUrl}
              autoCapitalize="none" keyboardType="url" />

            <Text style={styles.inputLabel}>Required skills * (tap a skill to toggle must-have)</Text>
            <View style={styles.skillsRow}>
              {skills.map((s, i) => (
                <TouchableOpacity
                  key={s.skillName}
                  style={[styles.skillChip, !s.required && styles.skillChipOptional]}
                  onPress={() =>
                    setSkills(prev =>
                      prev.map((x, j) => (j === i ? { ...x, required: !x.required } : x))
                    )
                  }
                  onLongPress={() => setSkills(prev => prev.filter((_, j) => j !== i))}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.skillChipText, !s.required && styles.skillChipOptionalText]}>
                    {s.skillName}
                    {s.required ? '' : ' (nice)'}
                  </Text>
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
                onSubmitEditing={() => addSkill(true)}
                returnKeyType="done"
              />
              <TouchableOpacity style={styles.addSkillBtn} onPress={() => addSkill(true)}>
                <Text style={styles.addSkillBtnText}>+ Must</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.addSkillBtn, styles.addSkillBtnOptional]}
                onPress={() => addSkill(false)}
              >
                <Text style={styles.addSkillBtnOptionalText}>+ Nice</Text>
              </TouchableOpacity>
            </View>

            {formError ? (
              <View style={styles.errorRow}>
                <Ionicons name="alert-circle-outline" size={14} color={colors.error} />
                <Text style={styles.errorText}>{formError}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.postBtn, !canPost && styles.postBtnDisabled]}
              onPress={handlePost}
              disabled={!canPost}
              activeOpacity={0.85}
            >
              {isPosting ? (
                <ActivityIndicator size="small" color={colors.onPrimary} />
              ) : (
                <Text style={styles.postBtnText}>Post Opportunity</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : null}

        <Text style={styles.sectionLabel}>Posted Opportunities</Text>

        {isLoading ? (
          <ActivityIndicator size="small" color={colors.primary} style={styles.loader} />
        ) : listError ? (
          <View style={styles.errorRow}>
            <Ionicons name="alert-circle-outline" size={14} color={colors.error} />
            <Text style={styles.errorText}>{listError}</Text>
          </View>
        ) : postings.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="briefcase-outline" size={28} color={colors.onSurfaceVariant} />
            </View>
            <Text style={styles.emptyTitle}>No postings yet</Text>
            <Text style={styles.emptySubtitle}>
              Tap New above to post your first opportunity for students
            </Text>
          </View>
        ) : (
          <View style={styles.postingsList}>
            {postings.map(opp => (
              <View key={opp.id} style={[styles.postingCard, !opp.active && styles.postingCardInactive]}>
                <View style={styles.postingHead}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.postingTitle} numberOfLines={1}>{opp.title}</Text>
                    <Text style={styles.postingMeta}>
                      {opp.opportunityType === 'INTERNSHIP' ? 'Internship' : 'Entry Level'}
                      {opp.location ? ` · ${opp.location}` : ''}
                      {opp.deadline ? ` · due ${opp.deadline}` : ''}
                      {opp.externalUrl ? ' · External' : ''}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, !opp.active && styles.statusBadgeInactive]}>
                    <Text style={[styles.statusBadgeText, !opp.active && styles.statusBadgeTextInactive]}>
                      {opp.active ? 'Active' : 'Inactive'}
                    </Text>
                  </View>
                </View>

                <View style={styles.postingStats}>
                  <TouchableOpacity
                    style={styles.applicantsBtn}
                    onPress={() => toggleApplicants(opp.id)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="people-outline" size={14} color={colors.primary} />
                    <Text style={styles.applicantsBtnText}>
                      {opp.applicantCount ?? 0} applicant{(opp.applicantCount ?? 0) === 1 ? '' : 's'}
                    </Text>
                    <Ionicons
                      name={applicantsFor === opp.id ? 'chevron-up' : 'chevron-down'}
                      size={12}
                      color={colors.primary}
                    />
                  </TouchableOpacity>
                  {opp.active ? (
                    <TouchableOpacity onPress={() => handleDeactivate(opp)} activeOpacity={0.7}>
                      <Text style={styles.deactivateLink}>Deactivate</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>

                {applicantsFor === opp.id ? (
                  <View style={styles.applicantsPanel}>
                    {isLoadingApplicants ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : applicants.length === 0 ? (
                      <Text style={styles.noApplicantsText}>No applicants yet</Text>
                    ) : (
                      applicants.map((a, i) => (
                        <View key={a.studentId} style={styles.applicantRow}>
                          <Text style={styles.applicantId} numberOfLines={1}>
                            Applicant {i + 1} · {a.studentId.slice(0, 8)}…
                          </Text>
                          <Text style={styles.applicantDate}>
                            {new Date(a.appliedAt).toLocaleDateString('en-GB', {
                              day: 'numeric',
                              month: 'short',
                            })}
                          </Text>
                        </View>
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
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 2,
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
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    padding: spacing.md,
    ...typography.bodyMd,
    color: colors.onSurface,
    fontSize: 14,
  },
  inputMultiline: { minHeight: 90, textAlignVertical: 'top' },
  inputLabel: { ...typography.labelMd, color: colors.onSurface, fontSize: 13 },
  typeRow: { flexDirection: 'row', gap: spacing.sm },
  typeChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surface,
  },
  typeChipSelected: { borderColor: colors.primary, backgroundColor: `${colors.primary}10` },
  typeChipText: { ...typography.labelMd, color: colors.onSurfaceVariant, fontSize: 13 },
  typeChipTextSelected: { color: colors.primary },
  skillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  skillChip: {
    backgroundColor: `${colors.primary}10`,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  skillChipText: { fontFamily: 'Inter_500Medium', fontSize: 11, color: colors.primary },
  skillChipOptional: { backgroundColor: colors.surfaceContainerLow },
  skillChipOptionalText: { color: colors.onSurfaceVariant },
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
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    justifyContent: 'center',
  },
  addSkillBtnText: { ...typography.labelMd, color: colors.onPrimary, fontSize: 12 },
  addSkillBtnOptional: { backgroundColor: colors.surfaceContainerHigh },
  addSkillBtnOptionalText: { ...typography.labelMd, color: colors.onSurfaceVariant, fontSize: 12 },
  postBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  postBtnDisabled: { opacity: 0.6 },
  postBtnText: { ...typography.labelMd, color: colors.onPrimary },

  postingsList: { gap: spacing.sm },
  postingCard: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  postingCardInactive: { opacity: 0.55 },
  postingHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  postingTitle: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    color: colors.onSurface,
  },
  postingMeta: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: colors.onSurfaceVariant,
    marginTop: 2,
  },
  statusBadge: {
    backgroundColor: `${colors.secondary}15`,
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusBadgeInactive: { backgroundColor: colors.surfaceContainerHigh },
  statusBadgeText: { fontFamily: 'Inter_600SemiBold', fontSize: 10, color: colors.secondary },
  statusBadgeTextInactive: { color: colors.onSurfaceVariant },
  postingStats: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  applicantsBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  applicantsBtnText: { ...typography.labelMd, color: colors.primary, fontSize: 13 },
  deactivateLink: { ...typography.labelMd, color: colors.error, fontSize: 13 },
  applicantsPanel: {
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
    paddingTop: spacing.sm,
    gap: spacing.xs,
  },
  noApplicantsText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: colors.onSurfaceVariant,
  },
  applicantRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  applicantId: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: colors.onSurface,
    flex: 1,
    marginRight: spacing.sm,
  },
  applicantDate: {
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
});
