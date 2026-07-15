import { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, typography, spacing, radius } from '@/constants/theme';

export default function RegisterScreen() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  function handleContinue() {
    setError('');

    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password) {
      setError('All fields are required.');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address.');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }

    router.push(`/(auth)/role-select?firstName=${encodeURIComponent(firstName.trim())}&lastName=${encodeURIComponent(lastName.trim())}&email=${encodeURIComponent(email.trim().toLowerCase())}&password=${encodeURIComponent(password)}`);
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} accessibilityLabel="Go back">
            <Ionicons name="chevron-back" size={28} color={colors.primary} />
          </TouchableOpacity>

          <View style={styles.progressRow}>
            <View style={[styles.step, styles.stepActive]} />
            <View style={styles.step} />
          </View>
          <Text style={styles.stepLabel}>Step 1 of 2 — Account Setup</Text>

          <View style={styles.header}>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Bridge the gap between campus and career</Text>
          </View>

          {error ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.form}>
            <View style={styles.nameRow}>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={styles.label}>First Name</Text>
                <TextInput
                  style={styles.input}
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder="Jane"
                  placeholderTextColor={colors.outlineVariant}
                  autoCapitalize="words"
                  accessibilityLabel="First name"
                />
              </View>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={styles.label}>Last Name</Text>
                <TextInput
                  style={styles.input}
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder="Doe"
                  placeholderTextColor={colors.outlineVariant}
                  autoCapitalize="words"
                  accessibilityLabel="Last name"
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Email Address</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@university.edu"
                placeholderTextColor={colors.outlineVariant}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                accessibilityLabel="Email address"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.passwordWrapper}>
                <TextInput
                  style={[styles.input, { flex: 1, borderWidth: 0 }]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Min. 8 characters"
                  placeholderTextColor={colors.outlineVariant}
                  secureTextEntry={!showPassword}
                  accessibilityLabel="Password"
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}>
                  <Text style={styles.toggleText}>{showPassword ? 'Hide' : 'Show'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Confirm Password</Text>
              <TextInput
                style={styles.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Re-enter password"
                placeholderTextColor={colors.outlineVariant}
                secureTextEntry={!showPassword}
                accessibilityLabel="Confirm password"
              />
            </View>
          </View>

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={handleContinue}
            accessibilityRole="button"
            accessibilityLabel="Continue to role selection"
          >
            <Text style={styles.primaryBtnText}>Continue →</Text>
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => router.replace('/(auth)/login')} accessibilityLabel="Sign in">
              <Text style={styles.footerLink}>Sign In</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
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
  stepActive: { backgroundColor: colors.secondary },
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
  form: { gap: spacing.md, marginBottom: spacing.lg },
  nameRow: { flexDirection: 'row', gap: spacing.sm },
  field: { gap: spacing.xs },
  label: { ...typography.labelMd, color: colors.onSurface },
  input: {
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 52,
    ...typography.bodyMd,
    color: colors.onSurface,
    backgroundColor: colors.surfaceCard,
  },
  passwordWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.md,
    paddingRight: spacing.md,
    backgroundColor: colors.surfaceCard,
    height: 52,
  },
  toggleText: { ...typography.labelMd, color: colors.tertiary },
  primaryBtn: {
    backgroundColor: colors.secondary,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  primaryBtnText: { ...typography.labelMd, color: colors.onPrimary, fontSize: 16 },
  footer: { flexDirection: 'row', justifyContent: 'center' },
  footerText: { ...typography.bodyMd, color: colors.onSurfaceVariant },
  footerLink: { ...typography.bodyMd, color: colors.tertiary, fontFamily: 'Inter_600SemiBold' },
});
