import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { NaviiAvatar } from '@/components/NaviiAvatar';
import { useAuth } from '@/context/AuthContext';
import { colors, typography, spacing, radius } from '@/constants/theme';

interface InfoRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}

function InfoRow({ icon, label, value }: InfoRowProps) {
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

export default function ProfileScreen() {
  const { state, logout } = useAuth();
  const user = state.user;

  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase() || '?';
  const roleLabel = user?.role ? user.role.charAt(0) + user.role.slice(1).toLowerCase() : 'User';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerBrand}>
          <View style={styles.logoMark}>
            <Ionicons name="compass" size={18} color={colors.onPrimary} />
          </View>
          <Text style={styles.brandName}>SkillBridge</Text>
        </View>
        <View style={styles.headerBadge}>
          <Ionicons name="person-circle-outline" size={16} color={colors.primary} />
          <Text style={styles.headerBadgeText}>Profile</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Avatar card */}
        <View style={styles.avatarCard}>
          <NaviiAvatar
            seed={user?.id}
            size={88}
            fallback={initials}
            style={styles.avatar}
          />
          <Text style={styles.name}>{user?.firstName ?? 'Guest'} {user?.lastName ?? ''}</Text>
          <View style={styles.rolePill}>
            <Ionicons name="school-outline" size={13} color={colors.secondary} />
            <Text style={styles.roleText}>{roleLabel}</Text>
          </View>
          <View style={styles.verifiedRow}>
            <Ionicons
              name={user?.emailVerified ? 'shield-checkmark' : 'shield-outline'}
              size={14}
              color={user?.emailVerified ? colors.secondary : colors.outline}
            />
            <Text style={[styles.verifiedText, user?.emailVerified && styles.verifiedTextActive]}>
              {user?.emailVerified ? 'Email verified' : 'Email not verified'}
            </Text>
          </View>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statTile}>
            <Ionicons name="map-outline" size={18} color={colors.tertiary} />
            <Text style={styles.statValue}>—</Text>
            <Text style={styles.statLabel}>Roadmap</Text>
          </View>
          <View style={[styles.statTile, styles.statTileDivider]}>
            <Ionicons name="checkmark-circle-outline" size={18} color={colors.secondary} />
            <Text style={styles.statValue}>—</Text>
            <Text style={styles.statLabel}>Milestones</Text>
          </View>
          <View style={styles.statTile}>
            <Ionicons name="star-outline" size={18} color="#F59E0B" />
            <Text style={styles.statValue}>—</Text>
            <Text style={styles.statLabel}>XP Points</Text>
          </View>
        </View>

        {/* Account info */}
        <Text style={styles.sectionTitle}>Account Details</Text>
        <View style={styles.infoCard}>
          <InfoRow icon="mail-outline" label="Email" value={user?.email ?? '—'} />
          <InfoRow icon="person-outline" label="Full Name" value={`${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || '—'} />
          <InfoRow icon="ribbon-outline" label="Role" value={roleLabel} />
          <InfoRow
            icon={user?.emailVerified ? 'checkmark-circle-outline' : 'close-circle-outline'}
            label="Email Verified"
            value={user?.emailVerified ? 'Yes' : 'No'}
          />
        </View>

        {/* Settings links */}
        <Text style={styles.sectionTitle}>Settings</Text>
        <View style={styles.infoCard}>
          <TouchableOpacity style={styles.settingsRow}>
            <Ionicons name="notifications-outline" size={18} color={colors.onSurfaceVariant} />
            <Text style={styles.settingsLabel}>Notifications</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.outline} style={{ marginLeft: 'auto' }} />
          </TouchableOpacity>
          <View style={styles.rowDivider} />
          <TouchableOpacity style={styles.settingsRow}>
            <Ionicons name="lock-closed-outline" size={18} color={colors.onSurfaceVariant} />
            <Text style={styles.settingsLabel}>Change Password</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.outline} style={{ marginLeft: 'auto' }} />
          </TouchableOpacity>
          <View style={styles.rowDivider} />
          <TouchableOpacity style={styles.settingsRow}>
            <Ionicons name="help-circle-outline" size={18} color={colors.onSurfaceVariant} />
            <Text style={styles.settingsLabel}>Help & Support</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.outline} style={{ marginLeft: 'auto' }} />
          </TouchableOpacity>
        </View>

        {/* Sign out */}
        <TouchableOpacity style={styles.logoutBtn} onPress={logout} accessibilityRole="button" accessibilityLabel="Sign out">
          <Ionicons name="log-out-outline" size={18} color={colors.error} />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>

      </ScrollView>
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
    backgroundColor: colors.surfaceCard,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
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
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  headerBadgeText: { ...typography.labelSm, color: colors.primary },

  scrollContent: { padding: spacing.lg, paddingBottom: spacing.xxl + 24 },

  avatarCard: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  avatar: { marginBottom: spacing.md },
  name: { ...typography.headlineSm, color: colors.primary, marginBottom: spacing.sm },
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#ECFDF5',
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    marginBottom: spacing.sm,
  },
  roleText: { ...typography.labelSm, color: colors.secondary },
  verifiedRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  verifiedText: { ...typography.labelSm, color: colors.outline },
  verifiedTextActive: { color: colors.secondary },

  /* Stats */
  statsRow: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    overflow: 'hidden',
  },
  statTile: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    gap: 4,
  },
  statTileDivider: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.outlineVariant,
  },
  statValue: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18, color: colors.primary },
  statLabel: { ...typography.labelSm, color: colors.onSurfaceVariant, textAlign: 'center' },

  sectionTitle: {
    ...typography.labelMd,
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: spacing.sm,
  },

  infoCard: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    overflow: 'hidden',
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
  settingsLabel: { ...typography.bodyMd, color: colors.onSurface, fontSize: 14 },
  rowDivider: { height: 1, backgroundColor: colors.outlineVariant, marginHorizontal: spacing.lg },

  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: '#FFBAB5',
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    backgroundColor: '#FFF5F5',
    marginTop: spacing.sm,
  },
  logoutText: { ...typography.labelMd, color: colors.error, fontSize: 15 },
});
