import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, typography, spacing, radius } from '@/constants/theme';
import { AnimatedFadeIn, AnimatedPressable } from '@/components/ui/AnimatedView';
import { AnimatedTextInput } from '@/components/ui/AnimatedTextInput';

export default function RegisterScreen() {
  const params = useLocalSearchParams<{ prefillEmail?: string }>();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState(params.prefillEmail || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [step, setStep] = useState(1);

  // Field touch / error states
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [generalError, setGeneralError] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (params.prefillEmail) {
      setEmail(params.prefillEmail);
    }
  }, [params.prefillEmail]);

  // Password requirement validation flags
  const hasMinLength = password.length >= 8;
  const hasNumber = /\d/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const isPasswordValid = hasMinLength && hasNumber && hasUppercase;

  // Real-time field errors
  const firstNameError = touched.firstName && !firstName.trim() ? 'First name is required' : '';
  const lastNameError = touched.lastName && !lastName.trim() ? 'Last name is required' : '';
  const emailError =
    touched.email && (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      ? 'Please enter a valid email address'
      : '';
  const passwordError =
    touched.password && !isPasswordValid ? 'Password must meet all 3 security requirements' : '';
  const confirmPasswordError =
    touched.confirmPassword && (confirmPassword !== password) ? 'Passwords do not match' : '';

  function handleNextStep() {
    setGeneralError('');
    setTouched({ firstName: true, lastName: true, email: true });

    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      setGeneralError('Please fill in all basic details.');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setGeneralError('Please enter a valid email address.');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    
    setStep(2);
    setTouched({});
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }

  function handleSubmit() {
    setGeneralError('');
    setTouched({ password: true, confirmPassword: true });

    if (!isPasswordValid) {
      setGeneralError('Password does not meet the security requirements.');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    if (password !== confirmPassword) {
      setGeneralError('Passwords do not match.');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }

    router.push({
      pathname: '/(auth)/role-select',
      params: {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        password: password,
      }
    });
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* Back button */}
          <TouchableOpacity onPress={() => step === 2 ? setStep(1) : router.back()} style={styles.backBtn} accessibilityLabel="Go back">
            <Ionicons name="chevron-back" size={24} color={colors.primary} />
          </TouchableOpacity>

          {/* Progress Indicator */}
          <AnimatedFadeIn delay={100} duration={400}>
            <View style={styles.progressRow}>
              <View style={[styles.step, styles.stepActive]} />
              <View style={[styles.step, step === 2 && styles.stepActive]} />
            </View>
            <Text style={styles.stepLabel}>Step {step} of 2 — {step === 1 ? 'Account Details' : 'Security'}</Text>
          </AnimatedFadeIn>

          {/* Header */}
          <AnimatedFadeIn delay={200} duration={400}>
            <View style={styles.header}>
              <Text style={styles.title}>Create Account</Text>
              <Text style={styles.subtitle}>Connect with AI career paths and verified projects</Text>
            </View>
          </AnimatedFadeIn>

          {/* General Banner Error */}
          {generalError ? (
            <AnimatedFadeIn delay={0} duration={300}>
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle-outline" size={18} color={colors.error} />
                <Text style={styles.errorBannerText}>{generalError}</Text>
              </View>
            </AnimatedFadeIn>
          ) : null}

          {/* Form Fields */}
          <View style={styles.form}>
            {/* Step 1 Fields */}
            {step === 1 && (
              <>
                {/* Name Fields Row */}
                <AnimatedFadeIn delay={300} duration={450}>
                  <View style={styles.nameRow}>
                <AnimatedTextInput
                  containerStyle={{ flex: 1 }}
                  label="First Name"
                  icon="person-outline"
                  value={firstName}
                  onChangeText={(v) => {
                    setFirstName(v);
                    setTouched((t) => ({ ...t, firstName: true }));
                  }}
                  onBlur={() => setTouched((t) => ({ ...t, firstName: true }))}
                  placeholder="Jane"
                  autoCapitalize="words"
                  error={firstNameError}
                />

                <AnimatedTextInput
                  containerStyle={{ flex: 1 }}
                  label="Last Name"
                  icon="person-outline"
                  value={lastName}
                  onChangeText={(v) => {
                    setLastName(v);
                    setTouched((t) => ({ ...t, lastName: true }));
                  }}
                  onBlur={() => setTouched((t) => ({ ...t, lastName: true }))}
                  placeholder="Doe"
                  autoCapitalize="words"
                  error={lastNameError}
                />
              </View>
            </AnimatedFadeIn>

            {/* Email Field */}
            <AnimatedFadeIn delay={400} duration={450}>
              <AnimatedTextInput
                label="Email Address"
                icon="mail-outline"
                value={email}
                onChangeText={(v) => {
                  setEmail(v);
                  setTouched((t) => ({ ...t, email: true }));
                }}
                onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                placeholder="you@university.edu.gh"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                error={emailError}
              />
            </AnimatedFadeIn>
            </>
          )}

          {/* Step 2 Fields */}
          {step === 2 && (
            <>
            {/* Password Field */}
            <AnimatedFadeIn delay={300} duration={450}>
              <View style={styles.field}>
                <AnimatedTextInput
                  label="Password"
                  icon="lock-closed-outline"
                  isPassword
                  value={password}
                  onChangeText={(v) => {
                    setPassword(v);
                    setTouched((t) => ({ ...t, password: true }));
                  }}
                  onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                  placeholder="Enter strong password"
                  error={passwordError}
                />

                {/* Dynamic Password Requirement Guide */}
                {isPasswordValid ? (
                  <AnimatedFadeIn delay={0} duration={300}>
                    <View style={styles.reqSuccessBadge}>
                      <Ionicons name="checkmark-circle" size={16} color={colors.secondary} />
                      <Text style={styles.reqSuccessBadgeText}>Strong password — all requirements met!</Text>
                    </View>
                  </AnimatedFadeIn>
                ) : (
                  <View style={styles.reqContainer}>
                    <Text style={styles.reqTitle}>Password Requirements:</Text>
                    <View style={styles.reqRow}>
                      <Ionicons
                        name={hasMinLength ? 'checkmark-circle' : 'ellipse-outline'}
                        size={15}
                        color={hasMinLength ? colors.secondary : colors.outline}
                      />
                      <Text style={[styles.reqItemText, hasMinLength && styles.reqItemSuccess]}>
                        At least 8 characters long
                      </Text>
                    </View>

                    <View style={styles.reqRow}>
                      <Ionicons
                        name={hasNumber ? 'checkmark-circle' : 'ellipse-outline'}
                        size={15}
                        color={hasNumber ? colors.secondary : colors.outline}
                      />
                      <Text style={[styles.reqItemText, hasNumber && styles.reqItemSuccess]}>
                        Contains at least 1 number (0-9)
                      </Text>
                    </View>

                    <View style={styles.reqRow}>
                      <Ionicons
                        name={hasUppercase ? 'checkmark-circle' : 'ellipse-outline'}
                        size={15}
                        color={hasUppercase ? colors.secondary : colors.outline}
                      />
                      <Text style={[styles.reqItemText, hasUppercase && styles.reqItemSuccess]}>
                        Contains at least 1 uppercase letter (A-Z)
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            </AnimatedFadeIn>

            {/* Confirm Password Field */}
            <AnimatedFadeIn delay={400} duration={450}>
              <AnimatedTextInput
                label="Confirm Password"
                icon="lock-closed-outline"
                isPassword
                value={confirmPassword}
                onChangeText={(v) => {
                  setConfirmPassword(v);
                  setTouched((t) => ({ ...t, confirmPassword: true }));
                }}
                onBlur={() => setTouched((t) => ({ ...t, confirmPassword: true }))}
                placeholder="Re-enter password"
                error={confirmPasswordError}
              />
            </AnimatedFadeIn>
            </>
          )}
          </View>

          {/* Submit Button */}
          <AnimatedFadeIn delay={500} duration={450}>
            <AnimatedPressable
              style={styles.primaryBtn}
              onPress={step === 1 ? handleNextStep : handleSubmit}
              accessibilityRole="button"
              accessibilityLabel={step === 1 ? "Continue to Password" : "Complete Registration"}
            >
              <Text style={styles.primaryBtnText}>
                {step === 1 ? 'Continue' : 'Complete Registration'}
              </Text>
              <Ionicons name={step === 1 ? "arrow-forward" : "checkmark"} size={18} color={colors.onPrimary} />
            </AnimatedPressable>
          </AnimatedFadeIn>

          {/* Footer Link */}
          <AnimatedFadeIn delay={800} duration={450}>
            <View style={styles.footer}>
              <Text style={styles.footerText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => router.replace('/(auth)/login')} accessibilityLabel="Sign in">
                <Text style={styles.footerLink}>Sign In</Text>
              </TouchableOpacity>
            </View>
          </AnimatedFadeIn>

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
    marginBottom: spacing.md,
  },
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
  errorBannerText: { ...typography.labelMd, color: colors.error, flex: 1 },

  form: { gap: spacing.md, marginBottom: spacing.lg },
  nameRow: { flexDirection: 'row', gap: spacing.sm },
  field: { gap: 6 },
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
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surfaceCard,
    height: 52,
  },
  inputInner: { flex: 1, ...typography.bodyMd, color: colors.onSurface },
  inputError: {
    borderColor: colors.error,
    backgroundColor: '#FFF5F5',
  },
  inlineError: {
    ...typography.labelSm,
    color: colors.error,
    marginTop: 2,
  },

  /* Password Requirement Guide */
  reqContainer: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.xs,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  reqTitle: {
    ...typography.labelSm,
    color: colors.onSurface,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 2,
  },
  reqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  reqItemText: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
    fontSize: 12,
  },
  reqItemSuccess: {
    color: colors.secondary,
    fontFamily: 'Inter_500Medium',
  },

  /* Compact Collapsed Success Badge */
  reqSuccessBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    backgroundColor: colors.successContainer,
    borderColor: `${colors.secondary}35`,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
  },
  reqSuccessBadgeText: {
    ...typography.labelSm,
    color: colors.secondary,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
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
    elevation: 2,
  },
  primaryBtnText: { ...typography.labelMd, color: colors.onPrimary, fontSize: 16 },
  footer: { flexDirection: 'row', justifyContent: 'center' },
  footerText: { ...typography.bodyMd, color: colors.onSurfaceVariant },
  footerLink: { ...typography.bodyMd, color: colors.tertiary, fontFamily: 'Inter_600SemiBold' },
});
