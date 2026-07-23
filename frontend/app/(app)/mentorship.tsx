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
import { AnimatedFadeIn, AnimatedPressable, ActiveText } from '@/components/ui/AnimatedView';
import MessageThread from '@/components/mentorship/MessageThread';
import {
  searchAlumni,
  sendRequest,
  cancelRequest,
  getMyRequests,
  getMyPairs,
  endPair,
} from '@/services/mentorship';
import {
  type AlumniSearchEntry,
  type MentorshipPair,
  type MentorshipRequest,
} from '@/types/mentorship';

function anonLabel(userId: string) {
  return `Alumni ${userId.replace(/-/g, '').slice(0, 4)}…`;
}

function dateStr(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

const REQUEST_STATUS_COLORS: Record<MentorshipRequest['status'], string> = {
  PENDING: colors.tertiary,
  ACCEPTED: colors.secondary,
  DECLINED: colors.error,
  CANCELLED: colors.onSurfaceVariant,
};

function StatusChip({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.statusChip, { backgroundColor: `${color}15` }]}>
      <Text style={[styles.statusChipText, { color }]}>{label}</Text>
    </View>
  );
}

function AlumniCard({
  entry,
  expanded,
  onToggle,
  onSend,
  isSending,
  note,
  onNoteChange,
}: {
  entry: AlumniSearchEntry;
  expanded: boolean;
  onToggle: () => void;
  onSend: () => void;
  isSending: boolean;
  note: string;
  onNoteChange: (v: string) => void;
}) {
  return (
    <AnimatedPressable style={styles.card} onPress={onToggle}>
      <View style={styles.cardHead}>
        <View style={styles.cardBody}>
          <ActiveText style={styles.cardTitle} numberOfLines={expanded ? undefined : 1}>
            {entry.currentRole ?? anonLabel(entry.alumniId)}
          </ActiveText>
          <ActiveText style={styles.cardMeta} numberOfLines={1}>
            {[entry.company, entry.industry].filter(Boolean).join(' · ') || 'Alumni mentor'}
          </ActiveText>
        </View>
        {entry.matchingTags > 0 ? (
          <View style={styles.matchBadge}>
            <Ionicons name="sparkles" size={12} color={colors.secondary} />
            <ActiveText style={styles.matchBadgeText}>
              {entry.matchingTags} match{entry.matchingTags === 1 ? '' : 'es'}
            </ActiveText>
          </View>
        ) : (
          <Ionicons name="chevron-down" size={16} color={colors.onSurfaceVariant} />
        )}
      </View>

      {expanded ? (
        <View style={styles.cardDetail}>
          {entry.bio ? <Text style={styles.cardDescription}>{entry.bio}</Text> : null}
          <View style={styles.tagRow}>
            {entry.careerInterests.map(tag => (
              <View key={tag} style={styles.tagChip}>
                <Text style={styles.tagChipText}>{tag}</Text>
              </View>
            ))}
          </View>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            placeholder="Add a note (optional, max 1000 chars)"
            placeholderTextColor={colors.outline}
            value={note}
            onChangeText={onNoteChange}
            maxLength={1000}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
          <TouchableOpacity
            style={[styles.primaryBtn, isSending && styles.primaryBtnDisabled]}
            onPress={onSend}
            disabled={isSending}
            activeOpacity={0.85}
          >
            {isSending ? (
              <ActivityIndicator size="small" color={colors.onPrimary} />
            ) : (
              <Text style={styles.primaryBtnText}>Request mentorship</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : null}
    </AnimatedPressable>
  );
}

export default function MentorshipScreen() {
  const { state } = useAuth();
  const token = state.accessToken ?? '';
  const userId = state.user?.id;

  // Search state
  const [interestsText, setInterestsText] = useState('');
  const [industryText, setIndustryText] = useState('');
  const [results, setResults] = useState<AlumniSearchEntry[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [expandedAlumniId, setExpandedAlumniId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [sendingToId, setSendingToId] = useState<string | null>(null);

  // Requests + pairs state
  const [requests, setRequests] = useState<MentorshipRequest[]>([]);
  const [pairs, setPairs] = useState<MentorshipPair[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedPairId, setExpandedPairId] = useState<string | null>(null);

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
        const [requestData, pairData] = await Promise.all([
          getMyRequests(token),
          getMyPairs(token),
        ]);
        setRequests(requestData);
        setPairs(pairData);
      } catch (e: any) {
        setError(e.message ?? 'Failed to load mentorships');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [token]
  );

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleSearch = async () => {
    if (!token) return;
    setIsSearching(true);
    setSearchError(null);
    try {
      const interests = interestsText
        .split(',')
        .map(t => t.trim())
        .filter(Boolean);
      const data = await searchAlumni(token, {
        interests: interests.length > 0 ? interests : undefined,
        industry: industryText.trim() || undefined,
      });
      setResults(data.alumni);
      setExpandedAlumniId(null);
    } catch (e: any) {
      setSearchError(e.message ?? 'Search failed');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSendRequest = async (entry: AlumniSearchEntry) => {
    const note = (notes[entry.alumniId] ?? '').trim();
    setSendingToId(entry.alumniId);
    try {
      await sendRequest(token, {
        alumniId: entry.alumniId,
        ...(note ? { message: note } : {}),
      });
      setNotes(prev => ({ ...prev, [entry.alumniId]: '' }));
      setExpandedAlumniId(null);
      load();
    } catch (e: any) {
      Alert.alert('Could not send request', e.message ?? 'Please try again');
    } finally {
      setSendingToId(null);
    }
  };

  const handleCancel = (request: MentorshipRequest) => {
    Alert.alert(
      'Cancel request?',
      `Your pending request to ${anonLabel(request.alumniId)} will be cancelled. You can send a new one afterwards.`,
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Cancel request',
          style: 'destructive',
          onPress: async () => {
            try {
              await cancelRequest(token, request.id);
              load();
            } catch (e: any) {
              Alert.alert('Could not cancel', e.message ?? 'Please try again');
            }
          },
        },
      ]
    );
  };

  const handleEndPair = (pair: MentorshipPair) => {
    Alert.alert(
      'End mentorship?',
      `Your mentorship with ${anonLabel(pair.alumniId)} will end. Messages stay readable.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End mentorship',
          style: 'destructive',
          onPress: async () => {
            try {
              await endPair(token, pair.id);
              load();
            } catch (e: any) {
              Alert.alert('Could not end mentorship', e.message ?? 'Please try again');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerIconWrap}>
          <Ionicons name="people" size={18} color={colors.primary} />
        </View>
        <View>
          <Text style={styles.headerTitle}>Mentorship</Text>
          <Text style={styles.headerSubtitle}>Find alumni mentors in your field</Text>
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
        {/* Hero Banner */}
        <AnimatedFadeIn delay={0}>
          <View style={styles.heroBanner}>
            <View style={styles.heroIconCircle}>
              <Ionicons name="school" size={32} color={colors.onPrimary} />
            </View>
            <Text style={styles.heroBannerTitle}>Alumni Mentorship Network</Text>
            <Text style={styles.heroBannerSub}>
              Connect with verified alumni in your industry for 1-on-1 career guidance and mock practice.
            </Text>
          </View>
        </AnimatedFadeIn>

        {/* Search */}
        <Text style={styles.sectionLabel}>Find a Mentor</Text>
        <View style={styles.searchCard}>
          <TextInput
            style={styles.input}
            placeholder="Interests (comma-separated, e.g. fintech, backend)"
            placeholderTextColor={colors.outline}
            autoCapitalize="none"
            value={interestsText}
            onChangeText={setInterestsText}
          />
          <TextInput
            style={styles.input}
            placeholder="Industry (optional)"
            placeholderTextColor={colors.outline}
            value={industryText}
            onChangeText={setIndustryText}
          />
          <TouchableOpacity
            style={[styles.primaryBtn, isSearching && styles.primaryBtnDisabled]}
            onPress={handleSearch}
            disabled={isSearching}
            activeOpacity={0.85}
          >
            {isSearching ? (
              <ActivityIndicator size="small" color={colors.onPrimary} />
            ) : (
              <Text style={styles.primaryBtnText}>Search alumni</Text>
            )}
          </TouchableOpacity>
          {searchError ? (
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle-outline" size={14} color={colors.error} />
              <Text style={styles.errorText}>{searchError}</Text>
            </View>
          ) : null}
        </View>

        {results !== null ? (
          results.length === 0 ? (
            <Text style={styles.emptyText}>No available mentors matched your search</Text>
          ) : (
            <View style={styles.cardList}>
              {results.map(entry => (
                <AlumniCard
                  key={entry.alumniId}
                  entry={entry}
                  expanded={expandedAlumniId === entry.alumniId}
                  onToggle={() =>
                    setExpandedAlumniId(prev => (prev === entry.alumniId ? null : entry.alumniId))
                  }
                  onSend={() => handleSendRequest(entry)}
                  isSending={sendingToId === entry.alumniId}
                  note={notes[entry.alumniId] ?? ''}
                  onNoteChange={v => setNotes(prev => ({ ...prev, [entry.alumniId]: v }))}
                />
              ))}
            </View>
          )
        ) : null}

        {/* My requests */}
        <Text style={[styles.sectionLabel, styles.sectionSpacer]}>My Requests</Text>
        {isLoading ? (
          <ActivityIndicator size="small" color={colors.primary} style={styles.loader} />
        ) : error ? (
          <View style={styles.errorRow}>
            <Ionicons name="alert-circle-outline" size={14} color={colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : requests.length === 0 ? (
          <Text style={styles.emptyText}>Mentorship requests you send will appear here</Text>
        ) : (
          <View style={styles.cardList}>
            {requests.map(r => (
              <View key={r.id} style={styles.card}>
                <View style={styles.requestRow}>
                  <View style={styles.cardBody}>
                    <Text style={styles.cardTitle} numberOfLines={1}>
                      {anonLabel(r.alumniId)}
                    </Text>
                    <Text style={styles.cardMeta} numberOfLines={1}>
                      sent {dateStr(r.createdAt)}
                    </Text>
                    {r.message ? (
                      <Text style={styles.requestNote} numberOfLines={2}>
                        “{r.message}”
                      </Text>
                    ) : null}
                  </View>
                  <StatusChip label={r.status} color={REQUEST_STATUS_COLORS[r.status]} />
                </View>
                {r.status === 'PENDING' ? (
                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => handleCancel(r)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="close-circle-outline" size={14} color={colors.error} />
                      <Text style={[styles.actionBtnText, { color: colors.error }]}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        )}

        {/* My mentorships */}
        <Text style={[styles.sectionLabel, styles.sectionSpacer]}>My Mentorships</Text>
        {isLoading ? null : pairs.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="people-outline" size={28} color={colors.onSurfaceVariant} />
            </View>
            <Text style={styles.emptyTitle}>No mentorships yet</Text>
            <Text style={styles.emptySubtitle}>
              Accepted mentorship requests will appear here
            </Text>
          </View>
        ) : (
          <View style={styles.cardList}>
            {pairs.map(p => (
              <View key={p.id} style={styles.card}>
                <TouchableOpacity
                  onPress={() => setExpandedPairId(prev => (prev === p.id ? null : p.id))}
                  activeOpacity={0.8}
                  style={styles.cardHead}
                >
                  <View style={styles.cardBody}>
                    <Text style={styles.cardTitle} numberOfLines={1}>
                      {anonLabel(p.alumniId)}
                    </Text>
                    <Text style={styles.cardMeta} numberOfLines={1}>
                      since {dateStr(p.startedAt)}
                    </Text>
                  </View>
                  <StatusChip
                    label={p.status}
                    color={p.status === 'ACTIVE' ? colors.secondary : colors.onSurfaceVariant}
                  />
                  <Ionicons
                    name={expandedPairId === p.id ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={colors.onSurfaceVariant}
                  />
                </TouchableOpacity>

                {expandedPairId === p.id ? (
                  <View style={styles.cardDetail}>
                    <MessageThread
                      pairId={p.id}
                      pairStatus={p.status}
                      accessToken={token}
                      currentUserId={userId}
                    />
                    {p.status === 'ACTIVE' ? (
                      <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => handleEndPair(p)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="close-circle-outline" size={14} color={colors.error} />
                        <Text style={[styles.actionBtnText, { color: colors.error }]}>
                          End mentorship
                        </Text>
                      </TouchableOpacity>
                    ) : null}
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

  /* Hero Banner */
  heroBanner: {
    backgroundColor: colors.secondary,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.xs,
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 3,
  },
  heroIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: `${colors.onPrimary}25`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  heroBannerTitle: { ...typography.headlineSm, color: colors.onPrimary, textAlign: 'center' },
  heroBannerSub: { ...typography.bodySm, color: `${colors.onPrimary}90`, textAlign: 'center', marginTop: 4 },
  sectionLabel: {
    ...typography.labelSm,
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sectionSpacer: { marginTop: spacing.sm },
  loader: { marginVertical: spacing.lg },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  errorText: { ...typography.labelMd, color: colors.error, flex: 1 },
  emptyText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: colors.onSurfaceVariant,
  },

  searchCard: {
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
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.bodyMd,
    color: colors.onSurface,
    fontSize: 14,
  },
  inputMultiline: { minHeight: 72 },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnDisabled: { opacity: 0.6 },
  primaryBtnText: { ...typography.labelMd, color: colors.onPrimary },

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
  cardActions: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionBtnText: { ...typography.labelMd, color: colors.primary },

  matchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: `${colors.secondary}12`,
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  matchBadgeText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    color: colors.secondary,
  },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  tagChip: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagChipText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    color: colors.onSurfaceVariant,
  },

  requestRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.md,
    gap: spacing.sm,
  },
  requestNote: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: colors.onSurfaceVariant,
    fontStyle: 'italic',
    marginTop: 2,
  },
  statusChip: {
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusChipText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
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
