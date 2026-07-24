import { useMemo, useState } from 'react';
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
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '@/context/AuthContext';
import { forgotPassword } from '@/services/auth';
import { useTheme } from '@/context/ThemeContext';
import { typography, spacing, radius, type ThemeColors } from '@/constants/theme';
import { AnimatedFadeIn, AnimatedPressable } from '@/components/ui/AnimatedView';
import { AnimatedTextInput } from '@/components/ui/AnimatedTextInput';

export default function LoginScreen() {
  const { colors } = useTheme();
  const { login } = useAuth();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Forgot password state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');

  async function handleLogin() {
    setError('');
    if (!email || !password) {
      setError('Please fill in both email and password.');
      return;
    }
    setIsLoading(true);
    try {
      await login({ email: email.trim().toLowerCase(), password });
    } catch (e: unknown) {
      const err = e as { status?: number; message?: string };
      if (err.status === 401) {
        // Wrong credentials — show the actual error, don't redirect
        setError('Invalid email or password. Please check your credentials and try again.');
      } else if (err.status === 0) {
        // Network error
        setError('Unable to connect to the server. Please check your internet connection.');
      } else {
        setError(err.message ?? 'Something went wrong. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSendForgot() {
    setForgotError('');
    const trimmedEmail = forgotEmail.trim();

    if (!trimmedEmail) {
      setForgotError('Please enter your email address.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setForgotError('Please enter a valid email address (e.g. name@university.edu.gh).');
      return;
    }

    setForgotLoading(true);
    try {
      await forgotPassword(trimmedEmail);
      setForgotSuccess(true);
    } catch (e: any) {
      setForgotError(e.message ?? 'Failed to send reset link. Please try again.');
    } finally {
      setForgotLoading(false);
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
          <AnimatedFadeIn delay={100} duration={400}>
            <View style={styles.brandRow}>
              <View style={styles.logoMark}>
                <Ionicons name="compass" size={22} color={colors.onPrimary} />
              </View>
            </View>
          </AnimatedFadeIn>

          {/* Heading */}
          <AnimatedFadeIn delay={200} duration={400}>
            <View style={styles.heading}>
              <Text style={styles.title}>Welcome Back</Text>
              <Text style={styles.subtitle}>Sign in to continue your career journey</Text>
            </View>
          </AnimatedFadeIn>

          {/* Error */}
          {error ? (
            <AnimatedFadeIn delay={0} duration={300}>
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle-outline" size={18} color={colors.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            </AnimatedFadeIn>
          ) : null}

          {/* Form */}
          <AnimatedFadeIn delay={300} duration={450}>
            <View style={styles.form}>
              <AnimatedTextInput
                label="Email Address"
                icon="mail-outline"
                value={email}
                onChangeText={setEmail}
                placeholder="you@university.edu.gh"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                accessibilityLabel="Email address"
              />

              <AnimatedTextInput
                label="Password"
                icon="lock-closed-outline"
                isPassword
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                autoComplete="password"
                accessibilityLabel="Password"
              />

              <TouchableOpacity
                style={styles.forgotLink}
                onPress={() => {
                  setForgotEmail(email);
                  setForgotError('');
                  setForgotSuccess(false);
                  setShowForgotModal(true);
                }}
                accessibilityLabel="Forgot password"
              >
                <Text style={styles.forgotText}>Forgot Password?</Text>
              </TouchableOpacity>
            </View>
          </AnimatedFadeIn>

          {/* Sign in button */}
          <AnimatedFadeIn delay={400} duration={450}>
            <AnimatedPressable
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
            </AnimatedPressable>
          </AnimatedFadeIn>

          {/* Footer */}
          <AnimatedFadeIn delay={500} duration={450}>
            <View style={styles.footer}>
              <Text style={styles.footerText}>Don't have an account? </Text>
              <TouchableOpacity onPress={() => router.push('/(auth)/register')} accessibilityLabel="Sign up">
                <Text style={styles.footerLink}>Sign Up</Text>
              </TouchableOpacity>
            </View>
          </AnimatedFadeIn>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Forgot Password Modal */}
      <Modal
        visible={showForgotModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowForgotModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Reset Password</Text>
              <TouchableOpacity onPress={() => setShowForgotModal(false)}>
                <Ionicons name="close" size={22} color={colors.onSurface} />
              </TouchableOpacity>
            </View>

            {forgotSuccess ? (
              <View style={styles.modalSuccessBox}>
                <Ionicons name="checkmark-circle-outline" size={40} color={colors.secondary} />
                <Text style={styles.modalSuccessTitle}>Reset Link Sent!</Text>
                <Text style={styles.modalSuccessDesc}>
                  We have sent instructions to reset your password to <Text style={{ fontFamily: 'Inter_600SemiBold' }}>{forgotEmail}</Text>. Please check your inbox.
                </Text>
                <TouchableOpacity
                  style={styles.modalCloseBtn}
                  onPress={() => setShowForgotModal(false)}
                >
                  <Text style={styles.modalCloseBtnText}>Done</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ gap: spacing.md }}>
                <Text style={styles.modalDesc}>
                  Enter the email address registered with your account and we will send you a password reset link.
                </Text>
                <AnimatedTextInput
                  label="Registered Email"
                  icon="mail-outline"
                  value={forgotEmail}
                  onChangeText={(v) => {
                    setForgotEmail(v);
                    setForgotError('');
                  }}
                  placeholder="you@university.edu.gh"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  error={forgotError}
                />
                <TouchableOpacity
                  style={[styles.primaryBtn, forgotLoading && styles.disabledBtn]}
                  onPress={handleSendForgot}
                  disabled={forgotLoading}
                >
                  {forgotLoading ? (
                    <ActivityIndicator color={colors.onPrimary} />
                  ) : (
                    <Text style={styles.primaryBtnText}>Send Reset Link</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
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
    borderRadius: radius.lg,
    padding: spacing.lg,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  modalTitle: { ...typography.headlineSm, color: colors.primary, fontSize: 20 },
  modalDesc: { ...typography.bodyMd, color: colors.onSurfaceVariant, lineHeight: 22 },
  modalSuccessBox: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  modalSuccessTitle: { ...typography.headlineSm, color: colors.primary, fontSize: 20 },
  modalSuccessDesc: { ...typography.bodyMd, color: colors.onSurfaceVariant, textAlign: 'center', lineHeight: 22 },
  modalCloseBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.sm,
  },
  modalCloseBtnText: { ...typography.labelMd, color: colors.onPrimary },
});
