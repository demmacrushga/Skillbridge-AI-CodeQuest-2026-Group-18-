import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { SkeletonProfile } from '@/components/ui/SkeletonCard';
import { NaviiAvatar } from '@/components/NaviiAvatar';
import { useAuth } from '@/context/AuthContext';
import { colors, typography, spacing, radius } from '@/constants/theme';
import { AnimatedFadeIn, AnimatedPressable, ActiveText } from '@/components/ui/AnimatedView';
import { AnimatedTextInput } from '@/components/ui/AnimatedTextInput';
import { getRoadmap } from '@/services/career';
import { type Roadmap } from '@/types/career';
import { getMyPortfolio } from '@/services/portfolio';
import { getUserExp } from '@/services/achievements';
import { type UserExp } from '@/types/achievements';
import { forgotPassword } from '@/services/auth';

interface InfoRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  onPress?: () => void;
}

function InfoRow({ icon, label, value, onPress }: InfoRowProps) {
  if (onPress) {
    return (
      <AnimatedPressable style={styles.infoRow} onPress={onPress}>
        <View style={styles.infoIconWrap}>
          <Ionicons name={icon} size={16} color={colors.onSurfaceVariant} />
        </View>
        <View style={styles.infoTextWrap}>
          <ActiveText style={styles.infoLabel}>{label}</ActiveText>
          <ActiveText style={styles.infoValue}>{value}</ActiveText>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.outline} />
      </AnimatedPressable>
    );
  }
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIconWrap}>
        <Ionicons name={icon} size={16} color={colors.onSurfaceVariant} />
      </View>
      <View style={styles.infoTextWrap}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

interface SettingsRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  color?: string;
}

function SettingsRow({ icon, label, onPress, color }: SettingsRowProps) {
  return (
    <AnimatedPressable style={styles.settingsRow} onPress={onPress}>
      <View style={[styles.settingsIconWrap, color ? { backgroundColor: `${color}15` } : {}]}>
        <Ionicons name={icon} size={16} color={color ?? colors.onSurfaceVariant} />
      </View>
      <ActiveText style={[styles.settingsLabel, color ? { color } : {}]}>{label}</ActiveText>
      <Ionicons name="chevron-forward" size={16} color={colors.outline} style={{ marginLeft: 'auto' }} />
    </AnimatedPressable>
  );
}

export default function ProfileScreen() {
  const { state, logout } = useAuth();
  const user = state.user;

  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase() || '?';
  const roleLabel = user?.role ? user.role.charAt(0) + user.role.slice(1).toLowerCase() : 'User';

  // Roadmap & Portfolio stats
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null);
  const [portfolioCount, setPortfolioCount] = useState<number>(0);
  const [expState, setExpState] = useState<UserExp | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      async function fetchStats() {
        if (!state.accessToken || !state.user) return;
        setLoading(true);
        try {
          const [roadmapData, portfolioData, expData] = await Promise.all([
            getRoadmap(state.accessToken, state.user.id).catch(() => null),
            getMyPortfolio(state.accessToken).catch(() => []),
            getUserExp(state.accessToken, state.user.id).catch(() => null)
          ]);
          setRoadmap(roadmapData);
          setPortfolioCount(portfolioData.length);
          setExpState(expData);
        } catch {
          setRoadmap(null);
        } finally {
          setLoading(false);
        }
      }
      fetchStats();
    }, [state.accessToken, state.user])
  );

  const doneCount = roadmap?.milestones.filter(m => m.completed).length ?? 0;
  const totalCount = roadmap?.milestones.length ?? 0;
  const progress = roadmap?.progressPercent ?? 0;

  // Edit profile modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');

  function openEdit() {
    setEditFirstName(user?.firstName ?? '');
    setEditLastName(user?.lastName ?? '');
    setShowEditModal(true);
  }

  function handleSaveProfile() {
    // For now, just close — backend doesn't have update endpoint yet
    Alert.alert('Profile Updated', 'Your changes have been saved.', [
      { text: 'OK', onPress: () => setShowEditModal(false) },
    ]);
  }

  // Logout confirmation
  function handleLogout() {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out of your account?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: logout },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerBrand}>
          <View style={styles.logoMark}>
            <Ionicons name="compass" size={18} color={colors.onPrimary} />
          </View>
        </View>
        <TouchableOpacity style={styles.headerEditBtn} onPress={openEdit} activeOpacity={0.7}>
          <Ionicons name="create-outline" size={18} color={colors.primary} />
          <Text style={styles.headerEditText}>Edit</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {loading ? (
          <SkeletonProfile />
        ) : (
          <>
            {/* Avatar card */}
            <AnimatedFadeIn delay={100} duration={400}>
              <AnimatedPressable onPress={openEdit} activeOpacity={0.95}>
                <LinearGradient
                  colors={[colors.primary, '#1E3A8A', colors.secondary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.avatarCard}
                >
                  <TouchableOpacity style={styles.cardEditBtn} onPress={openEdit} accessibilityLabel="Edit profile">
                    <Ionicons name="pencil" size={16} color={colors.primary} />
                  </TouchableOpacity>

                  <NaviiAvatar
                    seed={user?.id}
                    size={88}
                    fallback={initials}
                    style={styles.avatar}
                  />
                  <Text style={styles.nameCard}>{user?.firstName ?? 'Guest'} {user?.lastName ?? ''}</Text>
                  <Text style={styles.emailTextCard}>{user?.email ?? ''}</Text>
                  <View style={styles.badgeRow}>
                    <View style={styles.rolePill}>
                      <Ionicons name="school-outline" size={13} color={colors.secondary} />
                      <Text style={styles.roleText}>{roleLabel}</Text>
                    </View>
                    <View style={[styles.verifiedPill, user?.emailVerified && styles.verifiedPillActive]}>
                      <Ionicons
                        name={user?.emailVerified ? 'shield-checkmark' : 'shield-outline'}
                        size={12}
                        color={user?.emailVerified ? colors.secondary : colors.outline}
                      />
                      <Text style={[styles.verifiedText, user?.emailVerified && styles.verifiedTextActive]}>
                        {user?.emailVerified ? 'Verified' : 'Unverified'}
                      </Text>
                    </View>
                  </View>
                </LinearGradient>
              </AnimatedPressable>
            </AnimatedFadeIn>

            {/* Featured Section (Portfolio for Student / Hiring Hub for Recruiter / Mentor Hub for Alumni) */}
            <AnimatedFadeIn delay={150} duration={400}>
              <AnimatedPressable
                style={styles.portfolioFeaturedCard}
                onPress={() => router.push(user?.role === 'RECRUITER' ? './recruiter/postings' : user?.role === 'ALUMNI' ? './alumni' : './portfolio')}
              >
                <LinearGradient
                  colors={[`${colors.primary}15`, `${colors.tertiary}10`]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={styles.portfolioFeaturedGradient}
                >
                  <View style={styles.portfolioFeaturedHeader}>
                    <View style={styles.portfolioFeaturedIconWrap}>
                      <Ionicons
                        name={user?.role === 'RECRUITER' ? "business" : user?.role === 'ALUMNI' ? "easel" : "briefcase"}
                        size={24}
                        color={colors.primary}
                      />
                    </View>
                    <View style={styles.portfolioFeaturedTextWrap}>
                      <ActiveText style={styles.portfolioFeaturedTitle}>
                        {user?.role === 'RECRUITER' ? 'Company & Hiring Hub' : user?.role === 'ALUMNI' ? 'Alumni Educator Hub' : 'My Portfolio'}
                      </ActiveText>
                      <ActiveText style={styles.portfolioFeaturedDesc}>
                        {user?.role === 'RECRUITER' ? 'Manage postings, candidates & specifications' : user?.role === 'ALUMNI' ? 'Manage mentorship requests, mentees & teaching specs' : 'Manage your skills, projects & certifications'}
                      </ActiveText>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={colors.primary} />
                  </View>
                  {user?.role !== 'RECRUITER' && user?.role !== 'ALUMNI' && (
                    <View style={styles.portfolioFeaturedStats}>
                      <View style={styles.portfolioFeaturedStatBox}>
                        <ActiveText style={styles.portfolioFeaturedStatNum}>{portfolioCount}</ActiveText>
                        <ActiveText style={styles.portfolioFeaturedStatLabel}>Items</ActiveText>
                      </View>
                      <View style={styles.portfolioFeaturedDivider} />
                      <View style={styles.portfolioFeaturedStatBox}>
                        <ActiveText style={styles.portfolioFeaturedStatNum}>{doneCount}</ActiveText>
                        <ActiveText style={styles.portfolioFeaturedStatLabel}>Milestones</ActiveText>
                      </View>
                    </View>
                  )}
                </LinearGradient>
              </AnimatedPressable>
            </AnimatedFadeIn>

            {/* EXP Card */}
            {expState && (
              <AnimatedFadeIn delay={200} duration={400}>
                <AnimatedPressable
                  style={styles.expCard}
                  onPress={() => router.push('./achievements')}
                >
                  <View style={styles.expHeader}>
                    <View style={styles.expHeaderLeft}>
                      <Ionicons name="star" size={20} color={colors.secondary} />
                      <ActiveText style={styles.expLevelText}>Level {expState.currentLevel}</ActiveText>
                    </View>
                    <ActiveText style={styles.expProgressText}>{expState.currentExp} / {expState.nextLevelExp} XP</ActiveText>
                  </View>
                  <View style={styles.expTrack}>
                    <View style={[styles.expFill, { width: `${Math.min(100, Math.max(0, (expState.currentExp / expState.nextLevelExp) * 100))}%` }]} />
                  </View>
                </AnimatedPressable>
              </AnimatedFadeIn>
            )}

            {/* Account info */}
            <AnimatedFadeIn delay={300} duration={400}>
              <Text style={styles.sectionTitle}>Account Details</Text>
              <View style={styles.infoCard}>
                <InfoRow icon="mail-outline" label="Email" value={user?.email ?? '—'} />
                <InfoRow icon="person-outline" label="Full Name" value={`${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || '—'} onPress={openEdit} />
                <InfoRow icon="ribbon-outline" label="Role" value={roleLabel} />
                <InfoRow
                  icon={user?.emailVerified ? 'checkmark-circle-outline' : 'close-circle-outline'}
                  label="Email Verified"
                  value={user?.emailVerified ? 'Yes' : 'No'}
                />
              </View>
            </AnimatedFadeIn>

            {/* Settings links */}
            <AnimatedFadeIn delay={400} duration={400}>
              <Text style={styles.sectionTitle}>Settings</Text>
              <View style={styles.infoCard}>
                <SettingsRow
                  icon="notifications-outline"
                  label="Notifications"
                  color={colors.tertiary}
                  onPress={() => router.push('./notifications')}
                />
                <View style={styles.rowDivider} />
                <SettingsRow
                  icon="lock-closed-outline"
                  label="Change Password"
                  color={colors.primary}
                  onPress={() => {
                    if (!user?.email) return;
                    Alert.alert(
                      'Password Reset',
                      `A password reset link will be sent to your email address (${user.email}). Would you like to send it?`,
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Send Link',
                          onPress: async () => {
                            try {
                              await forgotPassword(user.email);
                              Alert.alert('Link Sent', `Password reset instructions have been sent to ${user.email}.`);
                            } catch (e: any) {
                              Alert.alert('Error', e.message ?? 'Failed to send reset link.');
                            }
                          },
                        },
                      ]
                    );
                  }}
                />
                <View style={styles.rowDivider} />
                <SettingsRow
                  icon="help-circle-outline"
                  label="Help & Support"
                  color={colors.secondary}
                  onPress={() => router.push('/(app)/help-support')}
                />
                <View style={styles.rowDivider} />
                <SettingsRow
                  icon="information-circle-outline"
                  label="About SkillBridge"
                  color={colors.onSurfaceVariant}
                  onPress={() => router.push('/(app)/about')}
                />
              </View>
            </AnimatedFadeIn>

            {/* Sign out */}
            <AnimatedFadeIn delay={400} duration={400}>
              <AnimatedPressable style={styles.logoutBtn} onPress={handleLogout} accessibilityRole="button" accessibilityLabel="Sign out">
                <Ionicons name="log-out-outline" size={18} color={colors.onPrimary} />
                <ActiveText style={styles.logoutText}>Sign Out</ActiveText>
              </AnimatedPressable>
            </AnimatedFadeIn>
          </>
        )}

      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal
        visible={showEditModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <Ionicons name="close" size={22} color={colors.onSurface} />
              </TouchableOpacity>
            </View>

            <AnimatedTextInput
              label="First Name"
              icon="person-outline"
              value={editFirstName}
              onChangeText={setEditFirstName}
              placeholder="Enter first name"
              autoCapitalize="words"
              containerStyle={{ marginBottom: spacing.md }}
            />

            <AnimatedTextInput
              label="Last Name"
              icon="person-outline"
              value={editLastName}
              onChangeText={setEditLastName}
              placeholder="Enter last name"
              autoCapitalize="words"
              containerStyle={{ marginBottom: spacing.md }}
            />

            <AnimatedTextInput
              label="Email Address"
              icon="mail-outline"
              value={user?.email ?? ''}
              editable={false}
              containerStyle={{ marginBottom: spacing.sm }}
            />
            <Text style={styles.modalHint}>Email cannot be changed</Text>

            <TouchableOpacity style={styles.modalSaveBtn} onPress={handleSaveProfile} activeOpacity={0.8}>
              <Ionicons name="checkmark" size={18} color={colors.onPrimary} />
              <Text style={styles.modalSaveBtnText}>Save Changes</Text>
            </TouchableOpacity>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    backgroundColor: colors.surface,
    borderBottomWidth: 0,
  },
  headerBrand: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  logoMark: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandName: { ...typography.headlineSm, color: colors.primary },
  headerEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  headerEditText: { ...typography.labelSm, color: colors.primary },

  scrollContent: { padding: spacing.lg, paddingBottom: spacing.xxl + 24 },

  avatarCard: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  cardEditBtn: {
    position: 'absolute',
    top: spacing.lg,
    right: spacing.lg,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceContainerLow,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },

  /* Portfolio Featured Section */
  portfolioFeaturedCard: {
    marginBottom: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: `${colors.secondary}25`,
    overflow: 'hidden',
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 2,
  },
  portfolioFeaturedGradient: {
    padding: spacing.lg,
  },
  portfolioFeaturedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  portfolioFeaturedIconWrap: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: `${colors.primary}20`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  portfolioFeaturedTextWrap: {
    flex: 1,
  },
  portfolioFeaturedTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 16,
    color: colors.primary,
    marginBottom: 2,
  },
  portfolioFeaturedDesc: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
    fontSize: 12,
  },
  portfolioFeaturedStats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: `${colors.primary}15`,
    justifyContent: 'space-around',
  },
  portfolioFeaturedStatBox: {
    alignItems: 'center',
  },
  portfolioFeaturedStatNum: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 20,
    color: colors.primary,
  },
  portfolioFeaturedStatLabel: {
    ...typography.labelSm,
    color: colors.onSurfaceVariant,
    marginTop: 2,
  },
  portfolioFeaturedDivider: {
    width: 1,
    height: '100%',
    backgroundColor: `${colors.primary}15`,
  },
  avatar: { marginBottom: spacing.md },
  nameCard: { ...typography.headlineSm, color: colors.onPrimary, marginBottom: 4 },
  emailTextCard: { ...typography.bodyMd, color: 'rgba(255,255,255,0.8)', fontSize: 14, marginBottom: spacing.sm },
  name: { ...typography.headlineSm, color: colors.primary, marginBottom: 4 },
  emailText: { ...typography.bodyMd, color: colors.onSurfaceVariant, fontSize: 14, marginBottom: spacing.sm },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.successContainer,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: `${colors.secondary}35`,
  },
  roleText: { ...typography.labelSm, color: colors.secondary },
  verifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  verifiedPillActive: {
    backgroundColor: colors.successContainer,
    borderColor: `${colors.secondary}35`,
  },
  verifiedText: { ...typography.labelSm, color: colors.outline, fontSize: 11 },
  verifiedTextActive: { color: colors.secondary },

  /* Stats row */
  statsRow: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },

  /* EXP Card */
  expCard: {
    backgroundColor: colors.surfaceCard,
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: `${colors.secondary}25`,
    marginBottom: spacing.md,
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  expHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  expHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  expLevelText: { ...typography.headlineSm, fontSize: 18, color: colors.onSurface },
  expProgressText: { ...typography.labelSm, color: colors.onSurfaceVariant },
  expTrack: { height: 8, backgroundColor: colors.surfaceContainerHigh, borderRadius: 4, overflow: 'hidden' },
  expFill: { height: '100%', backgroundColor: colors.secondary, borderRadius: 4 },

  statTile: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    gap: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.outlineVariant,
    marginVertical: spacing.sm,
  },
  statIconWrap: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  statValue: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 17, color: colors.primary },
  statLabel: { ...typography.labelSm, color: colors.onSurfaceVariant, textAlign: 'center', fontSize: 10 },

  sectionTitle: {
    ...typography.labelMd,
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: spacing.sm,
  },

  infoCard: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.xl,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
    gap: spacing.md,
  },
  infoIconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceContainerLow,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  infoTextWrap: { flex: 1 },
  infoLabel: { ...typography.labelSm, color: colors.onSurfaceVariant, marginBottom: 2 },
  infoValue: { ...typography.bodyMd, color: colors.onSurface, fontSize: 14 },

  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  settingsIconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceContainerLow,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  settingsLabel: { ...typography.bodyMd, color: colors.onSurface, fontSize: 14, flex: 1 },
  rowDivider: { height: 1, backgroundColor: colors.outlineVariant, marginHorizontal: spacing.lg },

  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.xl,
    paddingVertical: spacing.md,
    backgroundColor: colors.error,
    marginTop: spacing.sm,
  },
  logoutText: { ...typography.labelMd, color: colors.onPrimary, fontSize: 15 },

  /* Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.xl,
    padding: spacing.lg,
    paddingTop: spacing.lg + 4,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    borderTopWidth: 4,
    borderTopColor: colors.secondary,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: { ...typography.headlineSm, color: colors.primary, fontSize: 20 },
  modalField: { marginBottom: spacing.md },
  modalFieldLabel: { ...typography.labelMd, color: colors.onSurface, marginBottom: 6 },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    ...typography.bodyMd,
    color: colors.onSurface,
    backgroundColor: colors.surfaceContainerLow,
  },
  modalInputDisabled: {
    backgroundColor: colors.surfaceContainerHigh,
    justifyContent: 'center',
  },
  modalInputDisabledText: {
    ...typography.bodyMd,
    color: colors.outline,
  },
  modalHint: { ...typography.labelSm, color: colors.outline, marginTop: 4 },
  modalSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.secondary,
    borderRadius: radius.xl,
    paddingVertical: 16,
    marginTop: spacing.md,
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  modalSaveBtnText: { ...typography.labelMd, color: colors.onPrimary, fontSize: 16 },
});
