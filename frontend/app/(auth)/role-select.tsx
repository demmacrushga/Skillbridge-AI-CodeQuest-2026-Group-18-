import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Animated,
} from 'react-native';
import React, { useRef, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '@/context/AuthContext';
import { type UserRole } from '@/services/auth';
import { colors, typography, spacing, radius } from '@/constants/theme';
import { AnimatedFadeIn, AnimatedPressable } from '@/components/ui/AnimatedView';

const ROLES: { value: UserRole; label: string; description: string; badge: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  {
    value: 'STUDENT',
    label: 'Student',
    description: 'Currently enrolled, building skills and exploring career paths.',
    badge: 'Most Popular',
    icon: 'school-outline',
  },
  {
    value: 'ALUMNI',
    label: 'Alumni',
    description: 'Graduated and looking for new opportunities to grow.',
    badge: 'Growing',
    icon: 'ribbon-outline',
  },
  {
    value: 'RECRUITER',
    label: 'Recruiter',
    description: 'Finding top talent and connecting with the best candidates.',
    badge: 'High Demand',
    icon: 'briefcase-outline',
  },
];

export default function RoleSelectScreen() {
  const { register } = useAuth();
  const rawParams = useLocalSearchParams();
  const firstName = Array.isArray(rawParams.firstName) ? rawParams.firstName[0] : (rawParams.firstName as string) || '';
  const lastName = Array.isArray(rawParams.lastName) ? rawParams.lastName[0] : (rawParams.lastName as string) || '';
  const email = Array.isArray(rawParams.email) ? rawParams.email[0] : (rawParams.email as string) || '';
  const password = Array.isArray(rawParams.password) ? rawParams.password[0] : (rawParams.password as string) || '';

  // Default pre-select 'STUDENT' like modern apps
  const [selectedRole, setSelectedRole] = useState<UserRole>('STUDENT');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function handleCreateAccount() {
    setError('');
    setIsLoading(true);
    try {
      await register({
        firstName,
        lastName,
        email,
        password,
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

        {/* Back Button */}
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={24} color={colors.primary} />
        </TouchableOpacity>

        {/* Progress Bar */}
        <AnimatedFadeIn delay={100} duration={400}>
          <View style={styles.progressRow}>
            <View style={[styles.step, styles.stepDone]} />
            <View style={[styles.step, styles.stepActive]} />
          </View>
          <Text style={styles.stepLabel}>Step 2 of 2 — Select Your Path</Text>
        </AnimatedFadeIn>

        {/* Header */}
        <AnimatedFadeIn delay={200} duration={400}>
          <View style={styles.header}>
            <Text style={styles.title}>What best{'\n'}describes you?</Text>
            <Text style={styles.subtitle}>This helps us personalize your career and skill experience.</Text>
          </View>
        </AnimatedFadeIn>

        {/* Error Banner */}
        {error ? (
          <AnimatedFadeIn delay={0} duration={300}>
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle-outline" size={18} color={colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          </AnimatedFadeIn>
        ) : null}

        {/* Role Cards List */}
        <View style={styles.cards}>
          {ROLES.map((role, idx) => {
            const isSelected = selectedRole === role.value;
            return (
              <RoleCard
                key={role.value}
                role={role}
                isSelected={isSelected}
                onPress={() => setSelectedRole(role.value)}
                delay={300 + idx * 100}
              />
            );
          })}
        </View>

        {/* Create Account Button */}
        <AnimatedFadeIn delay={650} duration={450}>
          <AnimatedPressable
            style={[styles.primaryBtn, isLoading && styles.disabledBtn]}
            onPress={handleCreateAccount}
            disabled={isLoading}
            accessibilityRole="button"
            accessibilityLabel="Create account"
          >
            {isLoading ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <>
                <Text style={styles.primaryBtnText}>Complete Sign Up</Text>
                <Ionicons name="checkmark-done-outline" size={20} color={colors.onPrimary} />
              </>
            )}
          </AnimatedPressable>
        </AnimatedFadeIn>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  scroll: { flexGrow: 1, padding: spacing.lg },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceContainerLow,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  progressRow: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.xs },
  step: {
    flex: 1,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.outlineVariant,
  },
  stepDone: { backgroundColor: colors.secondary },
  stepActive: { backgroundColor: colors.secondary },
  stepLabel: { ...typography.labelSm, color: colors.outline, marginBottom: spacing.lg },
  header: { marginBottom: spacing.lg },
  title: { ...typography.headlineLg, color: colors.primary, marginBottom: spacing.xs },
  subtitle: { ...typography.bodyMd, color: colors.onSurfaceVariant },

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.errorContainer,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#FFBAB5',
  },
  errorText: { ...typography.labelMd, color: colors.error, flex: 1 },

  cards: { gap: spacing.md, marginBottom: spacing.xl },
  card: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1.5,
    borderColor: colors.outlineVariant,
    position: 'relative',
  },
  cardSelected: {
    borderColor: colors.secondary,
    backgroundColor: '#F0FDF4',
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  roleIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceContainerLow,
    justifyContent: 'center',
    alignItems: 'center',
  },
  roleIconWrapSelected: {
    backgroundColor: colors.secondary,
  },
  cardLabel: { ...typography.headlineSm, color: colors.primary, fontSize: 18 },
  cardLabelSelected: { color: colors.primary },
  badge: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  badgeSelected: { backgroundColor: `${colors.secondary}20` },
  badgeText: { ...typography.labelSm, color: colors.onSurfaceVariant, fontSize: 11 },
  badgeTextSelected: { color: colors.secondary },
  cardDesc: { ...typography.bodyMd, color: colors.onSurfaceVariant, fontSize: 13, lineHeight: 19 },
  cardDescSelected: { color: colors.onSurface },
  checkmark: {
    position: 'absolute',
    top: 12,
    right: 12,
  },

  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.secondary,
    borderRadius: radius.md,
    paddingVertical: 16,
    marginBottom: spacing.lg,
    elevation: 3,
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  disabledBtn: { opacity: 0.6 },
  primaryBtnText: { ...typography.labelMd, color: colors.onPrimary, fontSize: 16 },
});

function RoleCard({ role, isSelected, onPress, delay }: any) {
  const scale = useRef(new Animated.Value(isSelected ? 1.03 : 1)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: isSelected ? 1.03 : 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 6,
    }).start();
  }, [isSelected, scale]);

  return (
    <AnimatedFadeIn delay={delay} duration={450}>
      <AnimatedPressable
        onPress={onPress}
        accessibilityRole="radio"
        accessibilityState={{ selected: isSelected }}
        accessibilityLabel={`${role.label}: ${role.description}`}
      >
        <Animated.View style={[styles.card, isSelected && styles.cardSelected, { transform: [{ scale }] }]}>
          <View style={styles.cardTop}>
            <View style={styles.cardHeaderLeft}>
              <View style={[styles.roleIconWrap, isSelected && styles.roleIconWrapSelected]}>
                <Ionicons
                  name={role.icon}
                  size={20}
                  color={isSelected ? colors.onPrimary : colors.primary}
                />
              </View>
              <Text style={[styles.cardLabel, isSelected && styles.cardLabelSelected]}>
                {role.label}
              </Text>
            </View>
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
              <Ionicons name="checkmark-circle" size={20} color={colors.secondary} />
            </View>
          )}
        </Animated.View>
      </AnimatedPressable>
    </AnimatedFadeIn>
  );
}
