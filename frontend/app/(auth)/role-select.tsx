import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '@/context/AuthContext';
import { type UserRole } from '@/services/auth';
import { colors, typography, spacing, radius } from '@/constants/theme';

const ROLES: { value: UserRole; label: string; description: string; badge: string }[] = [
  {
    value: 'STUDENT',
    label: 'Student',
    description: 'Currently enrolled, building skills and exploring career paths.',
    badge: 'Most Popular',
  },
  {
    value: 'ALUMNI',
    label: 'Alumni',
    description: 'Graduated and looking for new opportunities to grow.',
    badge: 'Growing',
  },
  {
    value: 'RECRUITER',
    label: 'Recruiter',
    description: 'Finding top talent and connecting with the best candidates.',
    badge: 'High Demand',
  },
];

export default function RoleSelectScreen() {
  const { register } = useAuth();
  const params = useLocalSearchParams<{
    firstName: string;
    lastName: string;
    email: string;
    password: string;
  }>();

  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function handleCreateAccount() {
    if (!selectedRole) {
      setError('Please select your role to continue.');
      return;
    }
    setError('');
    setIsLoading(true);
    try {
      await register({
        firstName: params.firstName,
        lastName: params.lastName,
        email: params.email,
        password: params.password,
        role: selectedRole,
      });
    } catch (e: unknown) {
      const err = e as { status?: number };
      setError(
        err.status === 409
          ? 'An account with this email already exists.'
          : 'Something went wrong. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>

        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={28} color={colors.primary} />
        </TouchableOpacity>

        <View style={styles.progressRow}>
          <View style={[styles.step, styles.stepDone]} />
          <View style={[styles.step, styles.stepActive]} />
        </View>
        <Text style={styles.stepLabel}>Step 2 of 2 — Select Your Path</Text>

        <View style={styles.header}>
          <Text style={styles.title}>What best{'\n'}describes you?</Text>
          <Text style={styles.subtitle}>This helps us personalise your career experience.</Text>
        </View>

        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.cards}>
          {ROLES.map((role) => {
            const isSelected = selectedRole === role.value;
            return (
              <TouchableOpacity
                key={role.value}
                style={[styles.card, isSelected && styles.cardSelected]}
                onPress={() => setSelectedRole(role.value)}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`${role.label}: ${role.description}`}
              >
                <View style={styles.cardTop}>
                  <Text style={[styles.cardLabel, isSelected && styles.cardLabelSelected]}>
                    {role.label}
                  </Text>
                  <View style={[styles.badge, isSelected && styles.badgeSelected]}>
                    <Text style={[styles.badgeText, isSelected && styles.badgeTextSelected]}>
                      {role.badge}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.cardDesc, isSelected && styles.cardDescSelected]}>
                  {role.description}
                </Text>
                {isSelected && (
                  <View style={styles.checkmark}>
                    <Ionicons name="checkmark" size={16} color={colors.onPrimary} />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={[styles.primaryBtn, (!selectedRole || isLoading) && styles.disabledBtn]}
          onPress={handleCreateAccount}
          disabled={!selectedRole || isLoading}
          accessibilityRole="button"
          accessibilityLabel="Create account"
        >
          {isLoading
            ? <ActivityIndicator color={colors.onPrimary} />
            : <Text style={styles.primaryBtnText}>Create Account</Text>
          }
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  scroll: { flexGrow: 1, padding: spacing.lg },
  backBtn: { marginBottom: spacing.md },
  progressRow: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.xs },
  step: {
    flex: 1,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.outlineVariant,
  },
  stepDone: { backgroundColor: colors.secondary },
  stepActive: { backgroundColor: colors.tertiary },
  stepLabel: { ...typography.labelSm, color: colors.outline, marginBottom: spacing.lg },
  header: { marginBottom: spacing.lg },
  title: { ...typography.headlineLg, color: colors.primary, marginBottom: spacing.xs },
  subtitle: { ...typography.bodyMd, color: colors.onSurfaceVariant },
  errorBanner: {
    backgroundColor: colors.errorContainer,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  errorText: { ...typography.labelMd, color: colors.error },
  cards: { gap: spacing.md, marginBottom: spacing.xl },
  card: {
    backgroundColor: colors.surfaceCard,
    borderWidth: 1.5,
    borderColor: colors.outlineVariant,
    borderRadius: radius.lg,
    padding: spacing.lg,
    position: 'relative',
  },
  cardSelected: {
    borderColor: colors.secondary,
    backgroundColor: '#F0FDF4',
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  cardLabel: { ...typography.headlineSm, color: colors.primary },
  cardLabelSelected: { color: colors.secondary },
  cardDesc: { ...typography.bodyMd, color: colors.onSurfaceVariant },
  cardDescSelected: { color: colors.onSurface },
  badge: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  badgeSelected: { backgroundColor: '#DCFCE7' },
  badgeText: { ...typography.labelSm, color: colors.outline },
  badgeTextSelected: { color: '#15803D' },
  checkmark: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: 24,
    height: 24,
    borderRadius: radius.full,
    backgroundColor: colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryBtn: {
    backgroundColor: colors.secondary,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
  },
  disabledBtn: { opacity: 0.5 },
  primaryBtnText: { ...typography.labelMd, color: colors.onPrimary, fontSize: 16 },
});
