import { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Modal,
  TextInput,
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '@/context/AuthContext';
import { colors, typography, spacing, radius } from '@/constants/theme';
import { getMyProfile, getIncomingRequests, getMyPairs, upsertProfile } from '@/services/mentorship';
import { type AlumniProfile, type MentorshipRequest, type MentorshipPair } from '@/types/mentorship';
import { AnimatedFadeIn, AnimatedPressable } from '@/components/ui/AnimatedView';

export default function AlumniDashboardScreen() {
  const { state } = useAuth();
  const token = state.accessToken;
  const user = state.user;

  const [profile, setProfile] = useState<AlumniProfile | null>(null);
  const [incomingRequests, setIncomingRequests] = useState<MentorshipRequest[]>([]);
  const [pairs, setPairs] = useState<MentorshipPair[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Edit Profile Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [bio, setBio] = useState('');
  const [company, setCompany] = useState('');
  const [currentRole, setCurrentRole] = useState('');
  const [industry, setIndustry] = useState('');
  const [careerInterests, setCareerInterests] = useState('');
  const [available, setAvailable] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);

  const fetchAlumniData = async () => {
    if (!token) return;
    try {
      const [profData, reqData, pairData] = await Promise.all([
        getMyProfile(token).catch(() => null),
        getIncomingRequests(token).catch(() => []),
        getMyPairs(token).catch(() => []),
      ]);
      setProfile(profData);
      setIncomingRequests(reqData);
      setPairs(pairData);

      if (profData) {
        setBio(profData.bio || '');
        setCompany(profData.company || '');
        setCurrentRole(profData.currentRole || '');
        setIndustry(profData.industry || '');
        setCareerInterests(profData.careerInterests ? profData.careerInterests.join(', ') : '');
        setAvailable(profData.available ?? true);
      }
    } catch (e) {
      console.error('Failed to load alumni data:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchAlumniData();
    }, [token])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAlumniData();
    setRefreshing(false);
  };

  const handleSaveProfile = async () => {
    if (!token) return;
    setSavingProfile(true);
    try {
      const interestsList = careerInterests
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

      const updated = await upsertProfile(token, {
        bio: bio.trim() || undefined,
        company: company.trim() || undefined,
        currentRole: currentRole.trim() || undefined,
        industry: industry.trim() || undefined,
        careerInterests: interestsList,
        available,
      });

      setProfile(updated);
      setShowEditModal(false);
      Alert.alert('Success', 'Your teaching & mentor profile has been updated!');
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const pendingCount = incomingRequests.filter(r => r.status === 'PENDING').length;
  const activeMenteesCount = pairs.filter(p => p.status === 'ACTIVE').length;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header — Blended Homepage Header styling */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerLogoMark}>
            <Ionicons name="compass" size={20} color={colors.onPrimary} />
          </View>
          <Text style={styles.headerBrandTitle}>SkillBridge</Text>
        </View>
        <TouchableOpacity
          style={styles.headerBtn}
          accessibilityLabel="Notifications"
          onPress={() => router.push('/(app)/notifications')}
        >
          <Ionicons name="notifications-outline" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Greeting with Alumni Badge */}
        <AnimatedFadeIn delay={100} duration={400}>
          <View style={styles.greetingRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.greetingHello}>{greeting}</Text>
              <Text style={styles.greetingName}>{user?.firstName ?? 'Alumni Mentor'} 👋</Text>
            </View>
            <View style={styles.roleBadge}>
              <Ionicons name="school" size={12} color={colors.secondary} />
              <Text style={styles.roleBadgeText}>Alumni Educator</Text>
            </View>
          </View>
        </AnimatedFadeIn>

        {isLoading && !refreshing ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xxl }} />
        ) : (
          <>
            {/* Overview Stats Grid */}
            <AnimatedFadeIn delay={200}>
              <Text style={styles.sectionTitle}>Teaching Overview</Text>
              <View style={styles.statsGrid}>
                <AnimatedPressable
                  style={styles.statCard}
                  onPress={() => router.push('/(app)/alumni/requests')}
                >
                  <View style={[styles.statIconWrap, { backgroundColor: `${colors.secondary}15` }]}>
                    <Ionicons name="people" size={24} color={colors.secondary} />
                  </View>
                  <Text style={styles.statValue}>{activeMenteesCount}</Text>
                  <Text style={styles.statLabel}>Active Mentees</Text>
                </AnimatedPressable>

                <AnimatedPressable
                  style={styles.statCard}
                  onPress={() => router.push('/(app)/alumni/requests')}
                >
                  <View style={[styles.statIconWrap, { backgroundColor: `${colors.tertiary}15` }]}>
                    <Ionicons name="mail-unread" size={24} color={colors.tertiary} />
                  </View>
                  <Text style={styles.statValue}>{pendingCount}</Text>
                  <Text style={styles.statLabel}>Pending Requests</Text>
                </AnimatedPressable>

                <AnimatedPressable
                  style={styles.statCard}
                  onPress={() => setShowEditModal(true)}
                >
                  <View style={[styles.statIconWrap, { backgroundColor: `${colors.primary}15` }]}>
                    <Ionicons name={profile?.available ? "checkmark-circle" : "pause-circle"} size={24} color={colors.primary} />
                  </View>
                  <Text style={[styles.statValue, { fontSize: 16, marginTop: 4 }]}>
                    {profile?.available ? 'Accepting' : 'Paused'}
                  </Text>
                  <Text style={styles.statLabel}>Availability</Text>
                </AnimatedPressable>
              </View>
            </AnimatedFadeIn>

            {/* Mentor Profile Card */}
            <AnimatedFadeIn delay={250}>
              <AnimatedPressable style={styles.profileCard} onPress={() => setShowEditModal(true)}>
                <View style={styles.profileCardHeader}>
                  <View style={styles.profileIconWrap}>
                    <Ionicons name="easel" size={24} color={colors.secondary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.profileCardTitle}>Teaching & Mentor Specs</Text>
                    <Text style={styles.profileCardSub}>
                      {profile?.currentRole ? `${profile.currentRole} at ${profile.company || 'Company'}` : 'Configure your teaching expertise & industry'}
                    </Text>
                  </View>
                  <TouchableOpacity style={styles.editBtn} onPress={() => setShowEditModal(true)}>
                    <Ionicons name="create-outline" size={18} color={colors.primary} />
                    <Text style={styles.editBtnText}>Edit</Text>
                  </TouchableOpacity>
                </View>

                {profile?.careerInterests && profile.careerInterests.length > 0 ? (
                  <View style={styles.expertiseWrap}>
                    {profile.careerInterests.map((exp: string, idx: number) => (
                      <View key={idx} style={styles.expPill}>
                        <Text style={styles.expPillText}>{exp}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </AnimatedPressable>
            </AnimatedFadeIn>

            {/* Horizontally Scrollable Quick Actions */}
            <AnimatedFadeIn delay={300}>
              <Text style={styles.sectionTitle}>Quick Educator Actions</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.actionsScroll}
              >
                <AnimatedPressable
                  style={styles.actionCardScroll}
                  onPress={() => router.push('/(app)/alumni/requests')}
                >
                  <View style={[styles.actionIconWrap, { backgroundColor: `${colors.secondary}20` }]}>
                    <Ionicons name="checkmark-done-circle" size={28} color={colors.secondary} />
                  </View>
                  <Text style={styles.actionCardTitle}>Manage Requests</Text>
                  <Text style={styles.actionCardDesc}>Accept or decline student mentorships</Text>
                </AnimatedPressable>

                <AnimatedPressable
                  style={styles.actionCardScroll}
                  onPress={() => setShowEditModal(true)}
                >
                  <View style={[styles.actionIconWrap, { backgroundColor: `${colors.primary}20` }]}>
                    <Ionicons name="options" size={28} color={colors.primary} />
                  </View>
                  <Text style={styles.actionCardTitle}>Update Availability</Text>
                  <Text style={styles.actionCardDesc}>Set mentee topics & industry specs</Text>
                </AnimatedPressable>

                <AnimatedPressable
                  style={styles.actionCardScroll}
                  onPress={() => router.push('/(app)/career')}
                >
                  <View style={[styles.actionIconWrap, { backgroundColor: `${colors.tertiary}20` }]}>
                    <Ionicons name="map" size={28} color={colors.tertiary} />
                  </View>
                  <Text style={styles.actionCardTitle}>AI Career Roadmap</Text>
                  <Text style={styles.actionCardDesc}>Personalised progression milestones</Text>
                </AnimatedPressable>

                <AnimatedPressable
                  style={styles.actionCardScroll}
                  onPress={() => router.push('/(app)/profile')}
                >
                  <View style={[styles.actionIconWrap, { backgroundColor: `${colors.secondary}20` }]}>
                    <Ionicons name="person-circle" size={28} color={colors.secondary} />
                  </View>
                  <Text style={styles.actionCardTitle}>Educator Profile</Text>
                  <Text style={styles.actionCardDesc}>Manage account and support</Text>
                </AnimatedPressable>
              </ScrollView>
            </AnimatedFadeIn>
          </>
        )}
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal visible={showEditModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Educator & Mentor Specs</Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <Ionicons name="close" size={24} color={colors.onSurface} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ gap: spacing.md }}>
              <View>
                <Text style={styles.inputLabel}>Current Role / Job Title</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Senior Software Engineer"
                  placeholderTextColor={colors.outline}
                  value={currentRole}
                  onChangeText={setCurrentRole}
                />
              </View>

              <View>
                <Text style={styles.inputLabel}>Company / Institution</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Google / University of Ghana"
                  placeholderTextColor={colors.outline}
                  value={company}
                  onChangeText={setCompany}
                />
              </View>

              <View>
                <Text style={styles.inputLabel}>Industry</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Information Technology"
                  placeholderTextColor={colors.outline}
                  value={industry}
                  onChangeText={setIndustry}
                />
              </View>

              <View>
                <Text style={styles.inputLabel}>Teaching Topics & Interests (Comma separated)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. React Native, System Design, Career Prep"
                  placeholderTextColor={colors.outline}
                  value={careerInterests}
                  onChangeText={setCareerInterests}
                />
              </View>

              <View>
                <Text style={styles.inputLabel}>Mentor Bio</Text>
                <TextInput
                  style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
                  placeholder="Share a brief overview of your background and what you teach students..."
                  placeholderTextColor={colors.outline}
                  value={bio}
                  onChangeText={setBio}
                  multiline
                />
              </View>

              <View style={styles.switchRow}>
                <Text style={styles.inputLabel}>Available to Mentor Students</Text>
                <Switch
                  value={available}
                  onValueChange={setAvailable}
                  trackColor={{ false: colors.outlineVariant, true: colors.secondary }}
                />
              </View>

              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSaveProfile}
                disabled={savingProfile}
              >
                <Text style={styles.saveBtnText}>{savingProfile ? 'Saving Specs...' : 'Save Profile Specs'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: { padding: spacing.md, paddingBottom: spacing.xxl },

  greetingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xl },
  greetingHello: { fontFamily: 'Inter_500Medium', fontSize: 15, color: colors.onSurfaceVariant },
  greetingName: { ...typography.headlineLg, color: colors.onSurface, marginTop: 2, fontSize: 32 },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${colors.secondary}15`,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    gap: 4,
  },
  roleBadgeText: { ...typography.labelSm, color: colors.secondary },

  sectionTitle: { ...typography.headlineSm, color: colors.onSurface, marginBottom: spacing.md },
  
  statsGrid: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xl },
  statCard: {
    flex: 1,
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    alignItems: 'center',
  },
  statIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  statValue: { ...typography.headlineLg, color: colors.onSurface, fontSize: 22 },
  statLabel: { ...typography.labelSm, color: colors.onSurfaceVariant, textAlign: 'center', fontSize: 11 },

  profileCard: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    marginBottom: spacing.xl,
  },
  profileCardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  profileIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: `${colors.secondary}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileCardTitle: { ...typography.headlineSm, fontSize: 16, color: colors.onSurface },
  profileCardSub: { ...typography.bodySm, color: colors.onSurfaceVariant, marginTop: 2 },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: spacing.xs },
  editBtnText: { ...typography.labelSm, color: colors.primary },

  expertiseWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.md, paddingTop: spacing.xs, borderTopWidth: 1, borderTopColor: colors.outlineVariant },
  expPill: { backgroundColor: `${colors.secondary}15`, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full },
  expPillText: { ...typography.labelSm, color: colors.secondary, fontSize: 12 },

  actionsScroll: { gap: spacing.md, paddingRight: spacing.md },
  actionCardScroll: {
    width: 210,
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  actionIconWrap: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  actionCardTitle: { ...typography.labelMd, color: colors.onSurface, marginBottom: 4, fontSize: 16 },
  actionCardDesc: { fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.onSurfaceVariant },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.surfaceCard, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  modalTitle: { ...typography.headlineSm, color: colors.onSurface },
  inputLabel: { ...typography.labelSm, color: colors.onSurface, marginBottom: 4 },
  input: { backgroundColor: colors.surfaceContainerLow, borderRadius: radius.md, padding: spacing.md, ...typography.bodyMd, color: colors.onSurface, borderWidth: 1, borderColor: colors.outlineVariant },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: spacing.xs },
  saveBtn: { backgroundColor: colors.secondary, paddingVertical: spacing.md, borderRadius: radius.lg, alignItems: 'center', marginTop: spacing.md },
  saveBtnText: { ...typography.labelMd, color: colors.onPrimary },
});
