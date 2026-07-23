import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, typography, spacing, radius } from '@/constants/theme';
import { AnimatedFadeIn, AnimatedPressable } from '@/components/ui/AnimatedView';

export default function WelcomeScreen() {
  // Creative expanding & breathing scale animation for the logo
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Breathing scale animation (increasing and decreasing in size smoothly)
    Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.15,
          duration: 1800,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 1800,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Floating translation loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -8,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [scaleAnim, floatAnim]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.hero}>
        {/* Animated Expanding & Floating Clean Logo (No background gray shadow) */}
        <AnimatedFadeIn delay={100} duration={600} slideDistance={20} style={{ alignItems: 'center' }}>
          <View style={styles.logoContainer}>
            <Animated.View
              style={[
                styles.logoMarkWrap,
                {
                  transform: [
                    { translateY: floatAnim },
                    { scale: scaleAnim },
                  ],
                },
              ]}
            >
              <Image
                source={require('@/assets/images/official-logo.png')}
                style={{ width: 260, height: 130 }}
                resizeMode="contain"
              />
            </Animated.View>
          </View>
        </AnimatedFadeIn>

        {/* Hero Title & Subtitle */}
        <AnimatedFadeIn delay={300} duration={500} slideDistance={15} style={{ alignItems: 'center' }}>
          <Text style={styles.title}>SkillBridge</Text>
          <Text style={styles.tagline}>AI-Powered Career & Skill Network</Text>
          <Text style={styles.subtitle}>
            Bridge the gap between campus and career with personalized AI guidance, job matching, and industry challenges.
          </Text>
        </AnimatedFadeIn>

        {/* Ergonomically Raised Continue Action Button */}
        <View style={{ marginTop: spacing.xl, width: '100%', paddingHorizontal: spacing.xs }}>
          <AnimatedFadeIn delay={450} duration={500} slideDistance={20}>
            <AnimatedPressable
              style={styles.continueCard}
              onPress={() => router.push('/(auth)/login')}
              accessibilityRole="button"
              accessibilityLabel="Continue to login"
            >
              <View style={styles.continueTextGroup}>
                <Text style={styles.continueTitle}>Continue</Text>
                <Text style={styles.continueSub}>Sign in or create your account to proceed</Text>
              </View>
              <View style={styles.continueIconWrap}>
                <Ionicons name="arrow-forward" size={22} color={colors.onPrimary} />
              </View>
            </AnimatedPressable>
          </AnimatedFadeIn>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: spacing.lg,
  },
  hero: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: spacing.md,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  logoMarkWrap: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoMark: {
    width: 84,
    height: 84,
    borderRadius: radius.xl + 4,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 44,
    lineHeight: 52,
    letterSpacing: -1,
    color: colors.primary,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  tagline: {
    ...typography.labelSm,
    color: colors.tertiary,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.bodyLg,
    color: colors.onSurfaceVariant,
    maxWidth: 320,
    textAlign: 'center',
    lineHeight: 26,
  },

  /* Raised Ergonomic Action Container */
  continueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.secondary,
    borderRadius: radius.lg,
    paddingVertical: spacing.md + 4,
    paddingHorizontal: spacing.lg,
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  continueTextGroup: {
    flex: 1,
    gap: 2,
  },
  continueTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 18,
    color: colors.onPrimary,
  },
  continueSub: {
    ...typography.bodySm,
    color: 'rgba(255, 255, 255, 0.88)',
    fontSize: 12,
  },
  continueIconWrap: {
    width: 42,
    height: 42,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.md,
  },
});
