import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Image, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, typography, spacing, radius } from '@/constants/theme';
import { AnimatedFadeIn, AnimatedPressable } from '@/components/ui/AnimatedView';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function WelcomeScreen() {
  // Smooth initial mount fade-in & scale-up + gentle breathing pulse loop
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    // 1. Initial mount animation: Fade in & scale up smoothly
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // 2. Start gentle repeating breathing/pulse loop after mounting
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.07,
            duration: 1900,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1.0,
            duration: 1900,
            useNativeDriver: true,
          }),
        ])
      ).start();
    });

    // Ambient AI engine glow pulse loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 0.8,
          duration: 1800,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0.3,
          duration: 1800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [fadeAnim, scaleAnim, pulseAnim, glowAnim]);

  // Combined scale transformation: initial mount scale * gentle repeating pulse
  const combinedScale = Animated.multiply(scaleAnim, pulseAnim);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.hero}>
        
        {/* Innovation Chip Badge */}
        <AnimatedFadeIn delay={100} duration={500} slideDistance={10} style={{ alignItems: 'center' }}>
          <View style={styles.innovationBadge}>
            <Ionicons name="sparkles" size={14} color={colors.secondary} />
            <Text style={styles.innovationBadgeText}>NEXT-GEN AI SKILL NETWORK</Text>
          </View>
        </AnimatedFadeIn>

        {/* Ambient Glowing Halo & Prominent Logo (NO plain text element rendered below logo) */}
        <View style={styles.logoContainer}>
          {/* Animated Ambient AI Glow Ring */}
          <Animated.View
            style={[
              styles.glowHalo,
              {
                opacity: glowAnim,
                transform: [{ scale: combinedScale }],
              },
            ]}
          />

          {/* Enlarged Logo Asset with Mount Fade-In, Scale-Up & Gentle Breathing Pulse */}
          <Animated.View
            style={[
              styles.logoMarkWrap,
              {
                opacity: fadeAnim,
                transform: [{ scale: combinedScale }],
              },
            ]}
          >
            <Image
              source={require('@/assets/images/official-logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </Animated.View>
        </View>

        {/* Catchy Tagline & Innovative Mission Subtitle */}
        <AnimatedFadeIn delay={350} duration={500} slideDistance={15} style={{ alignItems: 'center' }}>
          <Text style={styles.tagline}>AI-Powered Career & Skill Ecosystem</Text>
          <Text style={styles.subtitle}>
            Empowering talent with real-time AI skill vector matching, verified project challenges, and autonomous career guidance.
          </Text>
        </AnimatedFadeIn>

        {/* 3-Pillar Innovation Matrix Showcase */}
        <AnimatedFadeIn delay={450} duration={500} slideDistance={20} style={{ width: '100%', marginTop: spacing.md }}>
          <View style={styles.innovationMatrix}>
            <View style={styles.innovationCard}>
              <View style={[styles.cardIconWrap, { backgroundColor: colors.tertiaryContainer }]}>
                <Ionicons name="hardware-chip-outline" size={20} color={colors.tertiary} />
              </View>
              <Text style={styles.cardTitle}>AI Vector Match</Text>
              <Text style={styles.cardSub}>99.2% Role Precision</Text>
            </View>

            <View style={styles.innovationCard}>
              <View style={[styles.cardIconWrap, { backgroundColor: colors.successContainer }]}>
                <Ionicons name="shield-checkmark-outline" size={20} color={colors.secondary} />
              </View>
              <Text style={styles.cardTitle}>Verified Skills</Text>
              <Text style={styles.cardSub}>Proof of Mastery</Text>
            </View>

            <View style={styles.innovationCard}>
              <View style={[styles.cardIconWrap, { backgroundColor: colors.tertiaryContainer }]}>
                <Ionicons name="rocket-outline" size={20} color={colors.tertiary} />
              </View>
              <Text style={styles.cardTitle}>Smart Agent</Text>
              <Text style={styles.cardSub}>Automated Growth</Text>
            </View>
          </View>
        </AnimatedFadeIn>

        {/* High-Impact Ergonomic Continue Action Button */}
        <View style={styles.actionContainer}>
          <AnimatedFadeIn delay={550} duration={500} slideDistance={20}>
            <AnimatedPressable
              style={styles.continueCard}
              onPress={() => router.push('/(auth)/login')}
              accessibilityRole="button"
              accessibilityLabel="Get Started with SkillBridge"
            >
              <View style={styles.continueTextGroup}>
                <Text style={styles.continueTitle}>Get Started</Text>
                <Text style={styles.continueSub}>Sign in or create an account to explore</Text>
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
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
  },
  hero: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  
  /* Innovation Badge Chip */
  innovationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    backgroundColor: colors.successContainer,
    borderColor: `${colors.secondary}35`,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    marginBottom: spacing.md,
  },
  innovationBadgeText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 11,
    letterSpacing: 1.2,
    color: colors.secondary,
  },

  /* Logo & Ambient Aura Container */
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginVertical: spacing.xs,
    width: '100%',
  },
  glowHalo: {
    position: 'absolute',
    width: Math.min(SCREEN_WIDTH * 0.8, 340),
    height: 160,
    borderRadius: 80,
    backgroundColor: `${colors.secondary}14`,
    borderWidth: 1.5,
    borderColor: `${colors.secondary}25`,
  },
  logoMarkWrap: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
  },
  logoImage: {
    width: Math.min(SCREEN_WIDTH * 0.9, 360),
    height: 180,
  },

  tagline: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 16,
    color: colors.primary,
    letterSpacing: 0.2,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.bodyMd,
    color: colors.onSurfaceVariant,
    maxWidth: 340,
    textAlign: 'center',
    lineHeight: 22,
    fontSize: 14,
  },

  /* Innovation Feature Showcase Grid */
  innovationMatrix: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  innovationCard: {
    flex: 1,
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.md + 2,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  cardIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 12,
    color: colors.onSurface,
    textAlign: 'center',
  },
  cardSub: {
    ...typography.bodySm,
    fontSize: 10,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    marginTop: 2,
  },

  /* Raised Ergonomic Action Container */
  actionContainer: {
    marginTop: spacing.lg,
    width: '100%',
    paddingHorizontal: spacing.xs,
  },
  continueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.secondary,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 6,
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
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12,
  },
  continueIconWrap: {
    width: 42,
    height: 42,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.md,
  },
});


