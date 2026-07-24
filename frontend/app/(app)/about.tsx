import { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { typography, spacing, radius, type ThemeColors } from '@/constants/theme';
import { useTheme, useThemeStyles } from '@/context/ThemeContext';
import { AnimatedFadeIn } from '@/components/ui/AnimatedView';

export default function AboutScreen() {
  const { colors } = useTheme();
  const styles = useThemeStyles(createStyles);

  function handleGoBack() {
    router.replace('/(app)/profile');
  }

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        router.replace('/(app)/profile');
        return true;
      };
      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [])
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleGoBack} style={styles.backBtn} accessibilityLabel="Back to Profile">
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>About SkillBridge</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <AnimatedFadeIn delay={0}>
          <View style={styles.brandHeroCard}>
            <View style={styles.logoMark}>
              <Ionicons name="compass" size={40} color={colors.onPrimary} />
            </View>
            <Text style={styles.brandTitle}>SkillBridge AI</Text>
            <Text style={styles.versionBadge}>Version 1.0.0 (Build 2026)</Text>
            <Text style={styles.brandDesc}>
              Empowering students and recruiters with AI-driven skill verification, portfolio management, and automated career roadmap matching.
            </Text>
          </View>
        </AnimatedFadeIn>

        <AnimatedFadeIn delay={150}>
          <Text style={styles.sectionTitle}>Key Features</Text>
          <View style={styles.featuresCard}>
            <View style={styles.featureRow}>
              <View style={[styles.featureIconWrap, { backgroundColor: `${colors.secondary}15` }]}>
                <Ionicons name="sparkles" size={20} color={colors.secondary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.featureTitle}>AI Vector Talent Matching</Text>
                <Text style={styles.featureDesc}>Matches candidate skills directly to recruiter job specifications.</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.featureRow}>
              <View style={[styles.featureIconWrap, { backgroundColor: `${colors.secondary}15` }]}>
                <Ionicons name="checkmark-circle-outline" size={20} color={colors.secondary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.featureTitle}>Verified Portfolio CV</Text>
                <Text style={styles.featureDesc}>Extracts and verifies student achievements with mobile CV view.</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.featureRow}>
              <View style={[styles.featureIconWrap, { backgroundColor: `${colors.tertiary}15` }]}>
                <Ionicons name="map-outline" size={20} color={colors.tertiary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.featureTitle}>Career Roadmaps</Text>
                <Text style={styles.featureDesc}>Step-by-step skill gap reports and personalized milestone tracking.</Text>
              </View>
            </View>
          </View>
        </AnimatedFadeIn>

        <AnimatedFadeIn delay={300}>
          <Text style={styles.sectionTitle}>Built for Excellence</Text>
          <View style={styles.infoBox}>
            <Text style={styles.infoBoxText}>
              Developed by Group 18 for CodeQuest 2026. Built with modern microservices architecture and Expo React Native.
            </Text>
          </View>

          <TouchableOpacity
            style={styles.legalBtn}
            onPress={() => Linking.openURL('https://skillbridge.edu.gh/privacy')}
          >
            <Text style={styles.legalBtnText}>Privacy Policy & Terms of Service</Text>
            <Ionicons name="open-outline" size={16} color={colors.secondary} />
          </TouchableOpacity>
        </AnimatedFadeIn>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.surface },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.md,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.outlineVariant,
    },
    backBtn: { padding: spacing.xs },
    headerTitle: { ...typography.headlineSm, color: colors.onSurface, marginLeft: spacing.xs },

    scrollContent: { padding: spacing.md, paddingBottom: spacing.xxl },

    brandHeroCard: {
      backgroundColor: colors.secondary,
      borderRadius: radius.xl,
      padding: spacing.xl,
      alignItems: 'center',
      marginBottom: spacing.xl,
      shadowColor: colors.secondary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 10,
      elevation: 3,
    },
    logoMark: {
      width: 72,
      height: 72,
      borderRadius: 22,
      backgroundColor: 'rgba(255, 255, 255, 0.25)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md,
    },
    brandTitle: { ...typography.headlineLg, fontSize: 26, color: '#FFFFFF' },
    versionBadge: { ...typography.labelSm, color: 'rgba(255, 255, 255, 0.8)', marginTop: 2, marginBottom: spacing.sm },
    brandDesc: { ...typography.bodyMd, color: 'rgba(255, 255, 255, 0.95)', textAlign: 'center', lineHeight: 22 },

    sectionTitle: { ...typography.headlineSm, fontSize: 18, color: colors.onSurface, marginBottom: spacing.md },

    featuresCard: {
      backgroundColor: colors.surfaceCard,
      borderRadius: radius.xl,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      marginBottom: spacing.xl,
    },
    featureRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xs },
    featureIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    featureTitle: { ...typography.labelMd, color: colors.onSurface },
    featureDesc: { ...typography.bodySm, color: colors.onSurfaceVariant, marginTop: 2 },
    divider: { height: 1, backgroundColor: colors.outlineVariant, marginVertical: spacing.md },

    infoBox: {
      backgroundColor: `${colors.secondary}10`,
      padding: spacing.md,
      borderRadius: radius.md,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: `${colors.secondary}20`,
    },
    infoBoxText: { ...typography.bodySm, color: colors.onSurface, lineHeight: 20, textAlign: 'center' },

    legalBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: spacing.md,
    },
    legalBtnText: { ...typography.labelMd, color: colors.secondary },
  });
