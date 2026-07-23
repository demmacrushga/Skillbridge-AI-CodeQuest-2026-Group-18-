import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, typography, spacing, radius } from '@/constants/theme';
import { getPublicPortfolio } from '@/services/portfolio';
import { type PortfolioItem } from '@/types/portfolio';
import { AnimatedFadeIn } from '@/components/ui/AnimatedView';

const ITEM_TYPE_CONFIG: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string }> = {
  PROJECT: { icon: 'code-slash-outline', color: colors.secondary, bg: `${colors.secondary}15` },
  CERTIFICATION: { icon: 'ribbon-outline', color: colors.primary, bg: `${colors.primary}15` },
  PUBLICATION: { icon: 'document-text-outline', color: colors.tertiary, bg: `${colors.tertiary}15` },
  AWARD: { icon: 'trophy-outline', color: colors.secondary, bg: `${colors.secondary}15` },
  OTHER: { icon: 'briefcase-outline', color: colors.primary, bg: `${colors.primary}15` },
};

function CVItemCard({ item, index }: { item: PortfolioItem; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = ITEM_TYPE_CONFIG[item.itemType] ?? ITEM_TYPE_CONFIG.OTHER;
  const isVerified = item.verified;

  return (
    <AnimatedFadeIn delay={100 + index * 50}>
      <TouchableOpacity 
        style={[styles.cvCard, expanded && styles.cvCardExpanded]} 
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.8}
      >
        <View style={styles.cvCardHeader}>
          <View style={[styles.cvIconWrap, { backgroundColor: cfg.bg }]}>
            <Ionicons name={cfg.icon} size={22} color={cfg.color} />
          </View>
          <View style={styles.cvCardTitleWrap}>
            <Text style={styles.cvCardTitle} numberOfLines={expanded ? undefined : 1}>
              {item.title}
            </Text>
            {isVerified && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                <Text style={styles.verifiedText}>Verified</Text>
              </View>
            )}
          </View>
          <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={20} color={colors.outline} />
        </View>

        {expanded && (
          <View style={styles.cvCardBody}>
            <Text style={styles.cvCardDescription}>{item.description}</Text>
            {item.externalUrl && (
              <TouchableOpacity 
                style={styles.linkBtn} 
                onPress={() => Linking.openURL(item.externalUrl!)}
              >
                <Ionicons name="link-outline" size={16} color={colors.tertiary} />
                <Text style={styles.linkText}>View External Reference</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </TouchableOpacity>
    </AnimatedFadeIn>
  );
}

export default function ApplicantPortfolioScreen() {
  const { studentId } = useLocalSearchParams<{ studentId: string }>();
  
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!studentId) return;

      const fetchItems = async () => {
        setIsLoading(true);
        setError(null);
        try {
          const data = await getPublicPortfolio(studentId);
          setItems(data);
        } catch (e: any) {
          setError(e.message ?? 'Failed to load portfolio');
        } finally {
          setIsLoading(false);
        }
      };

      fetchItems();
    }, [studentId])
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Applicant CV</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Applicant Overview Head */}
        <AnimatedFadeIn delay={0}>
          <View style={styles.cvHead}>
            <View style={styles.cvAvatar}>
              <Ionicons name="person" size={48} color={colors.primary} />
            </View>
            <Text style={styles.cvName}>Applicant {studentId?.substring(0, 8)}...</Text>
            <Text style={styles.cvSubtitle}>Student Profile & Portfolio</Text>
          </View>
        </AnimatedFadeIn>

        {isLoading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xxl }} />
        ) : error ? (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle-outline" size={24} color={colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : items.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="document-text-outline" size={32} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>Empty Portfolio</Text>
            <Text style={styles.emptyDesc}>This applicant has not added any verified projects, certifications, or experiences yet.</Text>
          </View>
        ) : (
          <View style={styles.portfolioSection}>
            <Text style={styles.sectionTitle}>Portfolio Items</Text>
            <View style={styles.list}>
              {items.map((item, idx) => (
                <CVItemCard key={item.id} item={item} index={idx} />
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfaceContainerLow },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
    backgroundColor: colors.surfaceCard,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  backBtn: { padding: spacing.sm },
  headerTitle: { ...typography.headlineSm, color: colors.onSurface, marginLeft: spacing.xs },
  
  scrollContent: { padding: spacing.md, paddingBottom: spacing.xxl },
  
  cvHead: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.xl,
    marginBottom: spacing.xl,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  cvAvatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: `${colors.primary}10`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  cvName: { ...typography.headlineLg, fontSize: 24, color: colors.onSurface, textAlign: 'center' },
  cvSubtitle: { ...typography.bodyMd, color: colors.onSurfaceVariant, marginTop: 4 },

  errorCard: {
    backgroundColor: colors.errorContainer,
    padding: spacing.md,
    borderRadius: radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  errorText: { ...typography.bodyMd, color: colors.error, flex: 1 },
  
  emptyCard: {
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: `${colors.primary}10`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: { ...typography.headlineSm, color: colors.onSurface, marginBottom: spacing.xs },
  emptyDesc: { fontFamily: 'Inter_400Regular', fontSize: 14, color: colors.onSurfaceVariant, textAlign: 'center' },
  
  portfolioSection: {
    marginTop: spacing.sm,
  },
  sectionTitle: {
    ...typography.headlineSm,
    color: colors.onSurface,
    marginBottom: spacing.md,
    marginLeft: spacing.xs,
  },
  list: { gap: spacing.md },
  
  cvCard: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    overflow: 'hidden',
  },
  cvCardExpanded: {
    borderColor: colors.outline,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cvCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
  },
  cvIconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cvCardTitleWrap: { flex: 1, justifyContent: 'center' },
  cvCardTitle: { ...typography.labelMd, fontSize: 16, color: colors.onSurface },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  verifiedText: { ...typography.labelSm, color: colors.success, fontSize: 11 },
  
  cvCardBody: {
    padding: spacing.md,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceContainerHigh,
    marginTop: spacing.xs,
  },
  cvCardDescription: {
    ...typography.bodyMd,
    color: colors.onSurfaceVariant,
    lineHeight: 24,
    marginTop: spacing.sm,
  },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    gap: 6,
    padding: spacing.sm,
    backgroundColor: `${colors.tertiary}10`,
    borderRadius: radius.md,
    alignSelf: 'flex-start',
  },
  linkText: { ...typography.labelMd, color: colors.tertiary },
});
