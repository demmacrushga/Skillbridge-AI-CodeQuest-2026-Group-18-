import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '@/context/AuthContext';
import { colors, typography, spacing, radius } from '@/constants/theme';

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function handleLogin() {
    setError('');
    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }
    setIsLoading(true);
    try {
      await login({ email: email.trim().toLowerCase(), password });
    } catch (e: unknown) {
      const err = e as { status?: number; message?: string };
      setError(err.status === 401 ? 'Invalid email or password.' : (err.message ?? 'Something went wrong. Try again.'));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* Back */}
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} accessibilityLabel="Go back">
            <Ionicons name="chevron-back" size={24} color={colors.primary} />
          </TouchableOpacity>

          {/* Brand */}
          <View style={styles.brandRow}>
            <View style={styles.logoMark}>
              <Ionicons name="compass" size={22} color={colors.onPrimary} />
            </View>
            <Text style={styles.brandName}>SkillBridge</Text>
          </View>

          {/* Heading */}
          <View style={styles.heading}>
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Sign in to continue your career journey</Text>
          </View>

          {/* Error */}
          {error ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle-outline" size={16} color={colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Form */}
          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>Email Address</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="mail-outline" size={18} color={colors.outline} />
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@university.edu.gh"
                  placeholderTextColor={colors.outline}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  accessibilityLabel="Email address"
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed-outline" size={18} color={colors.outline} />
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  placeholderTextColor={colors.outline}
                  secureTextEntry={!showPassword}
                  autoComplete="password"
                  accessibilityLabel="Password"
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(v => !v)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color={colors.outline}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity style={styles.forgotLink} accessibilityLabel="Forgot password">
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </TouchableOpacity>
          </View>

          {/* Sign in */}
          <TouchableOpacity
            style={[styles.primaryBtn, isLoading && styles.disabledBtn]}
            onPress={handleLogin}
            disabled={isLoading}
            accessibilityRole="button"
            accessibilityLabel="Sign in"
          >
            {isLoading ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <>
                <Ionicons name="log-in-outline" size={18} color={colors.onPrimary} />
                <Text style={styles.primaryBtnText}>Sign In</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or continue with</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Social */}
          <View style={styles.socialRow}>
            <TouchableOpacity style={styles.socialBtn} accessibilityLabel="Continue with Google">
              <Ionicons name="logo-google" size={18} color={colors.onSurface} />
              <Text style={styles.socialBtnText}>Google</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.socialBtn} accessibilityLabel="Continue with LinkedIn">
              <Ionicons name="logo-linkedin" size={18} color={colors.onSurface} />
              <Text style={styles.socialBtnText}>LinkedIn</Text>
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/register')} accessibilityLabel="Sign up">
              <Text style={styles.footerLink}>Sign Up</Text>
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

  backBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceContainerLow,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },

  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  logoMark: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandName: { ...typography.headlineSm, color: colors.primary, fontSize: 22 },

  heading: { marginBottom: spacing.xl },
  title: { ...typography.headlineLg, color: colors.primary, marginBottom: spacing.sm },
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

  form: { gap: spacing.md, marginBottom: spacing.lg },
  field: { gap: spacing.xs },
  label: { ...typography.labelMd, color: colors.onSurface },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surfaceCard,
    height: 54,
  },
  input: { flex: 1, ...typography.bodyMd, color: colors.onSurface },
  forgotLink: { alignSelf: 'flex-end' },
  forgotText: { ...typography.labelMd, color: colors.tertiary },

  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.secondary,
    borderRadius: radius.md,
    paddingVertical: 16,
    marginBottom: spacing.lg,
  },
  disabledBtn: { opacity: 0.6 },
  primaryBtnText: { ...typography.labelMd, color: colors.onPrimary, fontSize: 16 },

  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.outlineVariant },
  dividerText: { ...typography.labelSm, color: colors.outline },

  socialRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl },
  socialBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.md,
    paddingVertical: 14,
    backgroundColor: colors.surfaceCard,
  },
  socialBtnText: { ...typography.labelMd, color: colors.onSurface },

  footer: { flexDirection: 'row', justifyContent: 'center' },
  footerText: { ...typography.bodyMd, color: colors.onSurfaceVariant },
  footerLink: { ...typography.bodyMd, color: colors.tertiary, fontFamily: 'Inter_600SemiBold' },
});
