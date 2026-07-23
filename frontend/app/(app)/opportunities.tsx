import { useCallback, useState, useRef, useEffect } from 'react';
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
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '@/context/AuthContext';
import { colors, typography, spacing, radius } from '@/constants/theme';
import { SkeletonJobCard } from '@/components/ui/SkeletonCard';
import { AnimatedFadeIn, AnimatedPressable, ActiveText } from '@/components/ui/AnimatedView';
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

/* ── Helpers ─────────────────────────────────────── */

function scoreColor(score: number) {
  if (score >= 70) return colors.secondary;
  if (score >= 40) return colors.tertiary;
  return colors.onSurfaceVariant;
}

const FILTER_TABS = [
  { key: 'ALL', label: 'All' },
  { key: 'INTERNSHIP', label: 'Internship' },
  { key: 'FULL_TIME', label: 'Full-time' },
  { key: 'PART_TIME', label: 'Part-time' },
  { key: 'CONTRACT', label: 'Contract' },
];

/* ── Apply Modal ─────────────────────────────────── */

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
          {/* Blue accent bar at top */}
          <View style={styles.modalAccentBar} />

          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>Apply</Text>
              <Text style={styles.modalSubtitle} numberOfLines={1}>{opportunityTitle}</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.modalCloseBtn}
            >
              <Ionicons name="close" size={20} color={colors.onSurfaceVariant} />
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
              <Ionicons name="paper-plane" size={16} color={colors.onPrimary} />
              <Text style={styles.submitButtonText}>Submit Application</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/* ── Match Card ──────────────────────────────────── */

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

  const matchedCount = o.requiredSkills.filter(s =>
    studentSkills.some(sk => sk.toLowerCase() === s.skillName.toLowerCase())
  ).length;

  return (
    <View style={styles.matchCard}>
      <AnimatedPressable onPress={onToggle} style={styles.matchCardHead}>
        <View style={[styles.matchAccent, { backgroundColor: accent }]} />
        <View style={styles.matchCardBody}>
          <View style={styles.matchTitleRow}>
            <ActiveText style={styles.matchTitle} numberOfLines={expanded ? undefined : 1}>
              {o.title}
            </ActiveText>
            {o.externalUrl ? (
              <View style={styles.externalBadge}>
                <Ionicons name="open-outline" size={10} color={colors.tertiary} />
                <ActiveText style={styles.externalBadgeText}>External</ActiveText>
              </View>
            ) : null}
          </View>
          <ActiveText style={styles.matchMeta} numberOfLines={1}>
            {o.companyName}
            {o.opportunityType ? ` · ${o.opportunityType.replace('_', ' ')}` : ''}
            {o.location ? ` · ${o.location}` : ''}
          </ActiveText>
          {deadlineStr && (
            <View style={styles.matchDeadlineRow}>
              <Ionicons name="calendar-outline" size={11} color={colors.onSurfaceVariant} />
              <ActiveText style={styles.matchDeadlineText}>Due {deadlineStr}</ActiveText>
            </View>
          )}
        </View>
        <View style={styles.scoreWrap}>
          <View style={[styles.scoreBadge, { backgroundColor: `${accent}15`, borderColor: `${accent}30` }]}>
            <ActiveText style={[styles.scoreBadgeText, { color: accent }]}>
              {match.matchScore.toFixed(0)}
            </ActiveText>
          </View>
          <Text style={styles.scoreLabel}>match</Text>
        </View>
      </AnimatedPressable>

      {/* Skill match summary strip */}
      <View style={styles.matchSkillStrip}>
        <View style={styles.matchSkillStripInner}>
          <Ionicons name="checkmark-circle" size={12} color={colors.secondary} />
          <Text style={styles.matchSkillStripText}>
            {matchedCount}/{o.requiredSkills.length} skills matched
          </Text>
        </View>
        {match.applied && (
          <View style={styles.appliedPill}>
            <Ionicons name="checkmark-circle" size={12} color={colors.secondary} />
            <Text style={styles.appliedPillText}>Applied</Text>
          </View>
        )}
      </View>

      {expanded ? (
        <View style={styles.matchDetail}>
          <Text style={styles.matchDescription}>{o.description}</Text>
          <Text style={[styles.fieldLabel, { fontSize: 13, marginBottom: 6, marginTop: 0 }]}>Skills Comparison & Requirements:</Text>
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
          {match.applied ? null : (
            <AnimatedPressable
              style={[styles.applyBtn, isApplying && styles.applyBtnDisabled]}
              onPress={onApply}
              disabled={isApplying}
            >
              {isApplying ? (
                <ActivityIndicator size="small" color={colors.onPrimary} />
              ) : (
                <>
                  <Ionicons name={o.externalUrl ? 'open-outline' : 'paper-plane-outline'} size={15} color={colors.onPrimary} />
                  <ActiveText style={styles.applyBtnText}>
                    {o.externalUrl ? 'Apply Externally' : 'Apply Now'}
                  </ActiveText>
                </>
              )}
            </AnimatedPressable>
          )}
        </View>
      ) : null}
    </View>
  );
}

/* ── Main Screen ─────────────────────────────────── */

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
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [applyModalMatch, setApplyModalMatch] = useState<Match | null>(null);
  const [searchFocused, setSearchFocused] = useState(false);

  // Animated search border
  const searchBorderAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(searchBorderAnim, {
      toValue: searchFocused ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [searchFocused, searchBorderAnim]);

  const searchBorderColor = searchBorderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.outlineVariant, colors.secondary],
  });

  // Filter logic
  const filteredMatches = matches.filter(m => {
    const matchesSearch =
      m.opportunity.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.opportunity.companyName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType =
      activeFilter === 'ALL' ||
      (m.opportunity.opportunityType ?? '').toUpperCase().replace(/\s/g, '_') === activeFilter;
    return matchesSearch && matchesType;
  });

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
    // Optimistically show the skills immediately so user sees feedback
    const snapshot = [...editedSkills];
    setSkills(snapshot);
    setIsEditingSkills(false);
    try {
      const saved = await updateSkills(token, snapshot);
      // If the API returned an array, use it; otherwise keep snapshot
      if (Array.isArray(saved) && saved.length > 0) {
        setSkills(saved);
      }
      // Rescore against the new profile
      try {
        const matchData = await getMatches(token);
        setMatches(matchData.matches);
      } catch {
        // Non-critical — matches will refresh on next focus
      }
    } catch (e: any) {
      // Roll back to what we had before
      setSkills(skills);
      setIsEditingSkills(true);
      setEditedSkills(snapshot);
      Alert.alert('Could not save skills', e.message ?? 'Please try again');
    } finally {
      setIsSavingSkills(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* ── Header ───────────────────────── */}
      <View style={styles.header}>
        <View style={styles.headerIconWrap}>
          <Ionicons name="briefcase" size={18} color={colors.onPrimary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Opportunities</Text>
          <Text style={styles.headerSubtitle}>
            {skills.length > 0
              ? `${filteredMatches.length} match${filteredMatches.length !== 1 ? 'es' : ''} for your profile`
              : 'Internships matched to your skills'}
          </Text>
        </View>
        {applications.length > 0 && (
          <View style={styles.headerAppsBadge}>
            <Ionicons name="document-text" size={13} color={colors.onPrimary} />
            <Text style={styles.headerAppsBadgeText}>{applications.length}</Text>
          </View>
        )}
      </View>

      {/* ── Search Bar ───────────────────── */}
      <AnimatedFadeIn delay={50} duration={300}>
        <Animated.View style={[styles.searchContainer, { borderColor: searchBorderColor }]}>
          <Ionicons name="search" size={18} color={searchFocused ? colors.secondary : colors.outline} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by title or company..."
            placeholderTextColor={colors.outline}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={colors.outline} />
            </TouchableOpacity>
          )}
        </Animated.View>
      </AnimatedFadeIn>

      {/* ── Filter Tabs ──────────────────── */}
      <AnimatedFadeIn delay={100} duration={300}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {FILTER_TABS.map(tab => {
            const active = activeFilter === tab.key;
            return (
              <AnimatedPressable
                key={tab.key}
                style={[styles.filterTab, active && styles.filterTabActive]}
                isActive={active}
                onPress={() => setActiveFilter(tab.key)}
                scaleTo={0.96}
              >
                <ActiveText style={[styles.filterTabText, active && styles.filterTabTextActive]}>
                  {tab.label}
                </ActiveText>
              </AnimatedPressable>
            );
          })}
        </ScrollView>
      </AnimatedFadeIn>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => load(true)}
            tintColor={colors.secondary}
          />
        }
      >
        {/* ── Skills Profile Card ─────────── */}
        <AnimatedFadeIn delay={150} duration={400}>
          <View style={styles.skillsCard}>
            <View style={styles.skillsCardHeader}>
              <View style={styles.skillsCardTitleRow}>
                <Ionicons name="sparkles" size={16} color={colors.secondary} />
                <Text style={styles.skillsCardTitle}>My Skills Profile</Text>
                {skills.length > 0 && (
                  <View style={styles.skillCountBadge}>
                    <Text style={styles.skillCountText}>{skills.length}</Text>
                  </View>
                )}
              </View>
              {!isEditingSkills ? (
                <TouchableOpacity onPress={startEditSkills} style={styles.editSkillsBtn} activeOpacity={0.7}>
                  <Ionicons name="create-outline" size={14} color={colors.secondary} />
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
                      <Ionicons name="close-circle" size={14} color={colors.error} />
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={styles.addSkillRow}>
                  <View style={styles.addSkillInputWrap}>
                    <Ionicons name="add-circle-outline" size={16} color={colors.secondary} />
                    <TextInput
                      style={styles.addSkillInput}
                      placeholder="Type a skill and press Add..."
                      placeholderTextColor={colors.outline}
                      value={newSkill}
                      onChangeText={setNewSkill}
                      onSubmitEditing={addSkill}
                      returnKeyType="done"
                    />
                  </View>
                  <TouchableOpacity style={styles.addSkillBtn} onPress={addSkill}>
                    <Ionicons name="add" size={18} color={colors.onPrimary} />
                  </TouchableOpacity>
                </View>
                <View style={styles.skillEditorActions}>
                  <TouchableOpacity onPress={() => setIsEditingSkills(false)} style={styles.cancelSkillBtn}>
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
                      <>
                        <Ionicons name="checkmark" size={16} color={colors.onPrimary} />
                        <Text style={styles.saveSkillsBtnText}>Save Skills</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.skillsRow}>
                {skills.length === 0 ? (
                  <View style={styles.noSkillsWrap}>
                    <Ionicons name="bulb-outline" size={20} color={colors.onSurfaceVariant} />
                    <Text style={styles.noSkillsText}>
                      No skills yet — tap Edit to add your skills and improve match accuracy
                    </Text>
                  </View>
                ) : (
                  skills.map(s => (
                    <View key={s} style={styles.skillChipDisplay}>
                      <Ionicons name="checkmark-circle" size={12} color={colors.secondary} />
                      <Text style={styles.skillChipDisplayText}>{s}</Text>
                    </View>
                  ))
                )}
              </View>
            )}
          </View>
        </AnimatedFadeIn>

        {/* ── Ranked Matches ─────────────── */}
        <AnimatedFadeIn delay={200} duration={400}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="trophy-outline" size={16} color={colors.secondary} />
            <Text style={styles.sectionLabel}>Ranked Matches</Text>
          </View>
        </AnimatedFadeIn>

        {isLoading ? (
          <View style={{ gap: spacing.sm }}>
            <SkeletonJobCard />
            <SkeletonJobCard />
            <SkeletonJobCard />
          </View>
        ) : error ? (
          <AnimatedFadeIn delay={200} duration={300}>
            <View style={styles.errorRow}>
              <View style={styles.errorIconWrap}>
                <Ionicons name="alert-circle-outline" size={20} color={colors.error} />
              </View>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity onPress={() => load()} style={styles.retryBtn}>
                <Ionicons name="refresh" size={14} color={colors.secondary} />
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          </AnimatedFadeIn>
        ) : filteredMatches.length === 0 ? (
          <AnimatedFadeIn delay={200} duration={300}>
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="briefcase-outline" size={28} color={colors.secondary} />
              </View>
              <Text style={styles.emptyTitle}>No matching opportunities</Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery || activeFilter !== 'ALL'
                  ? 'Try adjusting your search or filter.'
                  : 'Check back later or update your skills.'}
              </Text>
            </View>
          </AnimatedFadeIn>
        ) : (
          <View style={styles.matchList}>
            {filteredMatches.map((m, idx) => (
              <AnimatedFadeIn key={m.opportunity.id} delay={250 + idx * 40} duration={350}>
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

        {/* ── My Applications ────────────── */}
        <AnimatedFadeIn delay={300} duration={400}>
          <View style={styles.applicationsHeader}>
            <Ionicons name="document-text-outline" size={16} color={colors.secondary} />
            <Text style={styles.sectionLabel}>My Applications</Text>
            {applications.length > 0 && (
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{applications.length}</Text>
              </View>
            )}
          </View>
        </AnimatedFadeIn>

        {applications.length === 0 ? (
          <AnimatedFadeIn delay={350} duration={300}>
            <View style={styles.noAppsCard}>
              <Ionicons name="layers-outline" size={20} color={colors.onSurfaceVariant} />
              <Text style={styles.noApplicationsText}>
                Opportunities you apply to will appear here
              </Text>
            </View>
          </AnimatedFadeIn>
        ) : (
          <View style={styles.matchList}>
            {applications.map((a, idx) => (
              <AnimatedFadeIn key={a.id} delay={350 + idx * 30} duration={350}>
                <AnimatedPressable style={styles.applicationRow}>
                  <View style={styles.applicationIcon}>
                    <Ionicons name="checkmark-circle" size={18} color={colors.secondary} />
                  </View>
                  <View style={styles.applicationBody}>
                    <ActiveText style={styles.applicationTitle} numberOfLines={1}>
                      {a.opportunity.title}
                    </ActiveText>
                    <ActiveText style={styles.applicationMeta}>
                      {a.opportunity.companyName} ·{' '}
                      {new Date(a.appliedAt).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                      })}
                      {a.opportunity.externalUrl ? ' · External' : ''}
                    </ActiveText>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.outline} />
                </AnimatedPressable>
              </AnimatedFadeIn>
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

/* ── Styles ────────────────────────────────────────── */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surfaceCard,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  headerIconWrap: {
    width: 38,
    height: 38,
    borderRadius: radius.lg,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  headerTitle: { ...typography.headlineSm, color: colors.onSurface },
  headerSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: colors.onSurfaceVariant,
    marginTop: 1,
  },
  headerAppsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.secondary,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  headerAppsBadgeText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    color: colors.onPrimary,
  },

  /* Search */
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceCard,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  searchIcon: { marginRight: spacing.xs },
  searchInput: {
    flex: 1,
    height: 44,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: colors.onSurface,
  },

  /* Filter Tabs */
  filterRow: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    gap: spacing.xs,
    flexDirection: 'row',
  },
  filterTab: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  filterTabActive: {
    backgroundColor: colors.secondary,
    borderColor: colors.secondary,
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  filterTabText: {
    ...typography.labelSm,
    fontSize: 12,
    color: colors.onSurfaceVariant,
  },
  filterTabTextActive: {
    color: colors.onPrimary,
  },

  scrollContent: { padding: spacing.lg, paddingTop: 0, paddingBottom: spacing.xxl + 80, gap: spacing.md },

  /* Section headers */
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  sectionLabel: {
    ...typography.labelSm,
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  /* Skills Card */
  skillsCard: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: `${colors.secondary}20`,
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  skillsCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  skillsCardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  skillsCardTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15,
    color: colors.onSurface,
  },
  skillCountBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  skillCountText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    color: colors.onPrimary,
  },
  editSkillsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: `${colors.secondary}10`,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: `${colors.secondary}25`,
  },
  editSkillsLink: { ...typography.labelSm, color: colors.secondary, fontSize: 12 },
  skillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  noSkillsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radius.lg,
    padding: spacing.md,
    flex: 1,
  },
  noSkillsText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: colors.onSurfaceVariant,
    flex: 1,
    lineHeight: 19,
  },
  skillChipDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: `${colors.secondary}10`,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: `${colors.secondary}20`,
  },
  skillChipDisplayText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: colors.secondary,
  },
  skillEditor: { gap: spacing.sm },
  addSkillRow: { flexDirection: 'row', gap: spacing.xs, alignItems: 'center' },
  addSkillInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    paddingHorizontal: spacing.md,
  },
  addSkillInput: {
    flex: 1,
    paddingVertical: 10,
    ...typography.bodyMd,
    color: colors.onSurface,
    fontSize: 14,
  },
  addSkillBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  skillEditorActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: spacing.md },
  cancelSkillBtn: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  cancelLink: { ...typography.labelMd, color: colors.onSurfaceVariant },
  saveSkillsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.secondary,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  saveSkillsBtnText: { ...typography.labelMd, color: colors.onPrimary },
  skillChipEditable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: `${colors.secondary}12`,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: `${colors.secondary}25`,
  },
  skillChipEditableText: { fontFamily: 'Inter_500Medium', fontSize: 12, color: colors.secondary },

  /* Match cards */
  matchList: { gap: spacing.sm },
  matchCard: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  matchCardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.sm,
  },
  matchAccent: {
    width: 4,
    borderRadius: 2,
    alignSelf: 'stretch',
    marginRight: 2,
  },
  matchCardBody: { flex: 1, gap: 3 },
  matchTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  matchTitle: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 15,
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
  matchDeadlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  matchDeadlineText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: colors.onSurfaceVariant,
  },
  scoreWrap: { alignItems: 'center', gap: 2 },
  scoreBadge: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  scoreBadgeText: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  scoreLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 9,
    color: colors.onSurfaceVariant,
  },

  /* Skill match strip */
  matchSkillStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    backgroundColor: `${colors.secondary}06`,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
  },
  matchSkillStripInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  matchSkillStripText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    color: colors.onSurfaceVariant,
  },
  appliedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: `${colors.secondary}12`,
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  appliedPillText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    color: colors.secondary,
  },

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
  applyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.secondary,
    borderRadius: radius.xl,
    padding: spacing.sm + 4,
    marginTop: spacing.xs,
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  applyBtnDisabled: { opacity: 0.6 },
  applyBtnText: { ...typography.labelMd, color: colors.onPrimary },

  /* Applications */
  applicationsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  countBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  countBadgeText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    color: colors.onPrimary,
  },
  noAppsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  noApplicationsText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: colors.onSurfaceVariant,
    flex: 1,
  },
  applicationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.xl,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  applicationIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.lg,
    backgroundColor: `${colors.secondary}12`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applicationBody: { flex: 1, gap: 2 },
  applicationTitle: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    color: colors.onSurface,
  },
  applicationMeta: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: colors.onSurfaceVariant,
  },

  /* Empty state */
  emptyCard: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: `${colors.secondary}10`,
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

  /* Error state */
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.errorContainer,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: `${colors.error}20`,
  },
  errorIconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: `${colors.error}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: { ...typography.labelMd, color: colors.error, flex: 1 },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  retryText: { ...typography.labelSm, color: colors.secondary, fontSize: 11 },

  loader: { marginVertical: spacing.lg },

  /* Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.surfaceCard,
    borderTopLeftRadius: radius.xl + 4,
    borderTopRightRadius: radius.xl + 4,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  modalAccentBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.secondary,
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  modalTitle: { ...typography.headlineSm, color: colors.onSurface },
  modalSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: colors.onSurfaceVariant,
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldLabel: { ...typography.labelMd, color: colors.onSurfaceVariant, marginTop: spacing.sm },
  fieldHint: { fontFamily: 'Inter_400Regular', fontSize: 12, color: colors.outline, marginBottom: spacing.xs },
  input: {
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...typography.bodyMd,
    color: colors.onSurface,
    backgroundColor: colors.surfaceContainerLow,
  },
  inputMultiline: { height: 110, textAlignVertical: 'top' },
  buttonGroup: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  cancelButton: {
    flex: 1,
    padding: spacing.md,
    alignItems: 'center',
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  cancelButtonText: { ...typography.labelMd, color: colors.onSurface },
  submitButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.secondary,
    borderRadius: radius.xl,
    padding: spacing.md,
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  submitButtonText: { ...typography.labelMd, color: colors.onPrimary, fontWeight: '700' },
});
