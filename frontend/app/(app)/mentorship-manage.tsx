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
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '@/context/AuthContext';
import { colors, typography, spacing, radius } from '@/constants/theme';
import MessageThread from '@/components/mentorship/MessageThread';
import {
  getMyProfile,
  upsertProfile,
  getIncomingRequests,
  acceptRequest,
  declineRequest,
  getMyPairs,
  endPair,
} from '@/services/mentorship';
import {
  type MentorshipPair,
  type MentorshipRequest,
} from '@/types/mentorship';

function anonLabel(userId: string) {
  return `Student ${userId.replace(/-/g, '').slice(0, 4)}…`;
}

function dateStr(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function StatusChip({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.statusChip, { backgroundColor: `${color}15` }]}>
      <Text style={[styles.statusChipText, { color }]}>{label}</Text>
    </View>
  );
}

export default function MentorshipManageScreen() {
  const { state } = useAuth();
  const token = state.accessToken ?? '';
  const userId = state.user?.id;

  // Profile form state
  const [currentRole, setCurrentRole] = useState('');
  const [company, setCompany] = useState('');
  const [industry, setIndustry] = useState('');
  const [bio, setBio] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [available, setAvailable] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Requests + pairs state
  const [incoming, setIncoming] = useState<MentorshipRequest[]>([]);
  const [pairs, setPairs] = useState<MentorshipPair[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [respondingId, setRespondingId] = useState<string | null>(null);
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
        const [profileResult, incomingData, pairData] = await Promise.all([
          // 404 just means no profile created yet — show an empty form
          getMyProfile(token).catch((e: any) => {
            if (e.status === 404) return null;
            throw e;
          }),
          getIncomingRequests(token),
          getMyPairs(token),
        ]);
        if (profileResult) {
          setCurrentRole(profileResult.currentRole ?? '');
          setCompany(profileResult.company ?? '');
          setIndustry(profileResult.industry ?? '');
          setBio(profileResult.bio ?? '');
          setTagsText(profileResult.careerInterests.join(', '));
          setAvailable(profileResult.available);
        }
        setIncoming(incomingData);
        setPairs(pairData);
      } catch (e: any) {
        setError(e.message ?? 'Failed to load mentorship data');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [token]
  );

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const parsedTags = tagsText
    .split(',')
    .map(t => t.trim())
    .filter(Boolean);

  const handleSave = async () => {
    if (!token) return;
    setProfileError(null);
    if (parsedTags.length === 0) {
      setProfileError('Add at least one career interest tag');
      return;
    }
    setIsSaving(true);
    try {
      const saved = await upsertProfile(token, {
        ...(currentRole.trim() ? { currentRole: currentRole.trim() } : {}),
        ...(company.trim() ? { company: company.trim() } : {}),
        ...(industry.trim() ? { industry: industry.trim() } : {}),
        careerInterests: parsedTags,
        ...(bio.trim() ? { bio: bio.trim() } : {}),
        available,
      });
      setTagsText(saved.careerInterests.join(', '));
      Alert.alert('Profile saved', 'Your mentor profile is up to date');
    } catch (e: any) {
      setProfileError(e.message ?? 'Could not save profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAccept = async (request: MentorshipRequest) => {
    setRespondingId(request.id);
    try {
      await acceptRequest(token, request.id);
      load();
    } catch (e: any) {
      Alert.alert('Could not accept', e.message ?? 'Please try again');
    } finally {
      setRespondingId(null);
    }
  };

  const handleDecline = async (request: MentorshipRequest) => {
    setRespondingId(request.id);
    try {
      await declineRequest(token, request.id);
      load();
    } catch (e: any) {
      Alert.alert('Could not decline', e.message ?? 'Please try again');
    } finally {
      setRespondingId(null);
    }
  };

  const handleEndPair = (pair: MentorshipPair) => {
    Alert.alert(
      'End mentorship?',
      `Your mentorship with ${anonLabel(pair.studentId)} will end. Messages stay readable.`,
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
          <Text style={styles.headerSubtitle}>Your mentor profile and mentees</Text>
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
        {error ? (
          <View style={styles.errorRow}>
            <Ionicons name="alert-circle-outline" size={14} color={colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Profile editor */}
        <Text style={styles.sectionLabel}>My Mentor Profile</Text>
        <View style={styles.formCard}>
          <TextInput
            style={styles.input}
            placeholder="Current role (e.g. Senior Backend Engineer)"
            placeholderTextColor={colors.outline}
            value={currentRole}
            onChangeText={setCurrentRole}
            maxLength={150}
          />
          <TextInput
            style={styles.input}
            placeholder="Company"
            placeholderTextColor={colors.outline}
            value={company}
            onChangeText={setCompany}
            maxLength={150}
          />
          <TextInput
            style={styles.input}
            placeholder="Industry (e.g. Fintech)"
            placeholderTextColor={colors.outline}
            value={industry}
            onChangeText={setIndustry}
            maxLength={100}
          />
          <TextInput
            style={styles.input}
            placeholder="Career interest tags (comma-separated)"
            placeholderTextColor={colors.outline}
            autoCapitalize="none"
            value={tagsText}
            onChangeText={setTagsText}
          />
          {parsedTags.length > 0 ? (
            <View style={styles.tagRow}>
              {parsedTags.map((tag, i) => (
                <View key={`${tag}-${i}`} style={styles.tagChip}>
                  <Text style={styles.tagChipText}>{tag}</Text>
                </View>
              ))}
            </View>
          ) : null}
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            placeholder="Bio — how can you help students?"
            placeholderTextColor={colors.outline}
            value={bio}
            onChangeText={setBio}
            maxLength={2000}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Available for new mentees</Text>
            <Switch
              value={available}
              onValueChange={setAvailable}
              trackColor={{ false: colors.surfaceContainerHigh, true: colors.secondary }}
              thumbColor={colors.surfaceCard}
            />
          </View>
          {profileError ? (
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle-outline" size={14} color={colors.error} />
              <Text style={styles.errorText}>{profileError}</Text>
            </View>
          ) : null}
          <TouchableOpacity
            style={[styles.primaryBtn, isSaving && styles.primaryBtnDisabled]}
            onPress={handleSave}
            disabled={isSaving}
            activeOpacity={0.85}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color={colors.onPrimary} />
            ) : (
              <Text style={styles.primaryBtnText}>Save Profile</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Incoming requests */}
        <Text style={[styles.sectionLabel, styles.sectionSpacer]}>Incoming Requests</Text>
        {isLoading ? (
          <ActivityIndicator size="small" color={colors.primary} style={styles.loader} />
        ) : incoming.length === 0 ? (
          <Text style={styles.emptyText}>New mentorship requests will appear here</Text>
        ) : (
          <View style={styles.cardList}>
            {incoming.map(r => (
              <View key={r.id} style={styles.card}>
                <View style={styles.requestHead}>
                  <View style={styles.cardBody}>
                    <Text style={styles.cardTitle} numberOfLines={1}>
                      {anonLabel(r.studentId)}
                    </Text>
                    <Text style={styles.cardMeta} numberOfLines={1}>
                      sent {dateStr(r.createdAt)}
                    </Text>
                    {r.message ? <Text style={styles.requestNote}>“{r.message}”</Text> : null}
                  </View>
                </View>
                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => handleAccept(r)}
                    disabled={respondingId === r.id}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="checkmark-circle-outline" size={14} color={colors.secondary} />
                    <Text style={[styles.actionBtnText, { color: colors.secondary }]}>Accept</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => handleDecline(r)}
                    disabled={respondingId === r.id}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="close-circle-outline" size={14} color={colors.error} />
                    <Text style={[styles.actionBtnText, { color: colors.error }]}>Decline</Text>
                  </TouchableOpacity>
                  {respondingId === r.id ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : null}
                </View>
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
              Requests you accept will appear here as active mentorships
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
                      {anonLabel(p.studentId)}
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
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.bodyMd,
    color: colors.onSurface,
    fontSize: 14,
  },
  inputMultiline: { minHeight: 72 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  switchLabel: { ...typography.labelMd, color: colors.onSurface },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  primaryBtnDisabled: { opacity: 0.6 },
  primaryBtnText: { ...typography.labelMd, color: colors.onPrimary },

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
  requestHead: { padding: spacing.md, paddingBottom: spacing.xs },
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
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionBtnText: { ...typography.labelMd, color: colors.primary },
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
