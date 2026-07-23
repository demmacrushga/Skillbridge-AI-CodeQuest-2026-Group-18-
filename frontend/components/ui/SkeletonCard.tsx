import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Skeleton } from './Skeleton';
import { colors, radius, spacing } from '@/constants/theme';

export function SkeletonDashboard() {
  return (
    <View style={styles.container}>
      {/* Banner / Header Skeleton */}
      <View style={styles.headerCard}>
        <View style={styles.rowBetween}>
          <View style={{ gap: spacing.xs, flex: 1 }}>
            <Skeleton width="60%" height={24} borderRadius={radius.md} />
            <Skeleton width="40%" height={16} borderRadius={radius.sm} />
          </View>
          <Skeleton width={44} height={44} borderRadius={radius.full} />
        </View>
        <View style={{ marginTop: spacing.md }}>
          <Skeleton width="100%" height={8} borderRadius={radius.full} />
        </View>
      </View>

      {/* Quick Links Skeleton */}
      <View style={styles.sectionHeader}>
        <Skeleton width={120} height={20} />
      </View>
      <View style={styles.quickLinksGrid}>
        {[1, 2, 3, 4, 5, 6].map((key) => (
          <View key={key} style={styles.quickLinkItem}>
            <Skeleton width={48} height={48} borderRadius={radius.lg} />
            <Skeleton width={56} height={12} style={{ marginTop: spacing.xs }} />
          </View>
        ))}
      </View>

      {/* Section List Skeleton */}
      <View style={styles.sectionHeader}>
        <Skeleton width={160} height={20} />
      </View>
      {[1, 2].map((key) => (
        <View key={key} style={styles.cardItem}>
          <View style={styles.rowBetween}>
            <Skeleton width="65%" height={18} />
            <Skeleton width={60} height={22} borderRadius={radius.full} />
          </View>
          <Skeleton width="85%" height={14} style={{ marginTop: spacing.sm }} />
          <View style={[styles.rowBetween, { marginTop: spacing.md }]}>
            <Skeleton width={80} height={14} />
            <Skeleton width={100} height={28} borderRadius={radius.md} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function SkeletonJobCard() {
  return (
    <View style={styles.cardItem}>
      <View style={styles.rowBetween}>
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Skeleton width="75%" height={20} />
          <Skeleton width="45%" height={14} />
        </View>
        <Skeleton width={44} height={44} borderRadius={radius.full} />
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.xs, marginVertical: spacing.md }}>
        <Skeleton width={70} height={24} borderRadius={radius.full} />
        <Skeleton width={90} height={24} borderRadius={radius.full} />
        <Skeleton width={60} height={24} borderRadius={radius.full} />
      </View>
      <View style={styles.rowBetween}>
        <Skeleton width={100} height={14} />
        <Skeleton width={90} height={32} borderRadius={radius.md} />
      </View>
    </View>
  );
}

export function SkeletonChallengeCard() {
  return (
    <View style={styles.cardItem}>
      <View style={styles.rowBetween}>
        <Skeleton width="70%" height={20} />
        <Skeleton width={75} height={24} borderRadius={radius.full} />
      </View>
      <Skeleton width="90%" height={14} style={{ marginTop: spacing.xs }} />
      <Skeleton width="60%" height={14} style={{ marginTop: spacing.xs }} />

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.outlineVariant }}>
        <Skeleton width={110} height={14} />
        <Skeleton width={80} height={32} borderRadius={radius.md} />
      </View>
    </View>
  );
}

export function SkeletonProfile() {
  return (
    <View style={styles.container}>
      <View style={styles.profileHeaderCard}>
        <Skeleton width={80} height={80} borderRadius={radius.full} />
        <Skeleton width={160} height={22} style={{ marginTop: spacing.md }} />
        <Skeleton width={220} height={14} style={{ marginTop: spacing.xs }} />
        <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.md }}>
          <Skeleton width={80} height={32} borderRadius={radius.full} />
          <Skeleton width={80} height={32} borderRadius={radius.full} />
        </View>
      </View>
      <View style={{ marginTop: spacing.lg }}>
        <Skeleton width={140} height={20} style={{ marginBottom: spacing.md }} />
        {[1, 2, 3].map((key) => (
          <View key={key} style={styles.cardItem}>
            <Skeleton width="50%" height={16} />
            <Skeleton width="80%" height={14} style={{ marginTop: spacing.xs }} />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    gap: spacing.md,
  },
  headerCard: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  profileHeaderCard: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionHeader: {
    marginVertical: spacing.xs,
  },
  quickLinksGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    gap: spacing.sm,
    backgroundColor: colors.surfaceCard,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  quickLinkItem: {
    alignItems: 'center',
    width: 64,
  },
  cardItem: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
});
