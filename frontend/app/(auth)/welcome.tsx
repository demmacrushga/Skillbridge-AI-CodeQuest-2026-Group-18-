import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, typography, spacing, radius } from '@/constants/theme';

export default function WelcomeScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.hero}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>AI-POWERED</Text>
        </View>
        <Text style={styles.title}>SkillBridge{'\n'}AI</Text>
        <Text style={styles.subtitle}>
          Bridge the gap between campus and career with personalised AI guidance.
        </Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => router.push('/(auth)/register')}
          accessibilityRole="button"
          accessibilityLabel="Create account"
        >
          <Text style={styles.primaryBtnText}>Create Account</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.ghostBtn}
          onPress={() => router.push('/(auth)/login')}
          accessibilityRole="button"
          accessibilityLabel="Sign in"
        >
          <Text style={styles.ghostBtnText}>Sign In</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
  },
  hero: {
    flex: 1,
    justifyContent: 'center',
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.secondary,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginBottom: spacing.lg,
  },
  badgeText: {
    ...typography.labelSm,
    color: colors.onPrimary,
    letterSpacing: 1.5,
  },
  title: {
    ...typography.displayLg,
    color: colors.onPrimary,
    marginBottom: spacing.md,
  },
  subtitle: {
    ...typography.bodyLg,
    color: 'rgba(255,255,255,0.65)',
    maxWidth: 300,
  },
  actions: {
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  primaryBtn: {
    backgroundColor: colors.secondary,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: {
    ...typography.labelMd,
    color: colors.onPrimary,
    fontSize: 16,
  },
  ghostBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ghostBtnText: {
    ...typography.labelMd,
    color: colors.onPrimary,
    fontSize: 16,
  },
});
