import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '@/context/AuthContext';
import { colors, typography, spacing, radius } from '@/constants/theme';
import { getIncomingRequests, acceptRequest, declineRequest, getMyPairs } from '@/services/mentorship';
import { type MentorshipRequest, type MentorshipPair } from '@/types/mentorship';
import { AnimatedFadeIn, AnimatedPressable, ActiveText } from '@/components/ui/AnimatedView';

export default function AlumniRequestsScreen() {
  const { state } = useAuth();
  const token = state.accessToken;

  const [activeTab, setActiveTab] = useState<'REQUESTS' | 'PAIRS'>('REQUESTS');
  const [requests, setRequests] = useState<MentorshipRequest[]>([]);
  const [pairs, setPairs] = useState<MentorshipPair[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchMentorshipData = useCallback(async () => {
    if (!token) return;
    try {
      const [reqData, pairData] = await Promise.all([
        getIncomingRequests(token).catch(() => []),
        getMyPairs(token).catch(() => []),
      ]);
      setRequests(reqData);
      setPairs(pairData);
    } catch (e) {
      console.error('Failed to load mentorship requests:', e);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      fetchMentorshipData();
    }, [fetchMentorshipData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchMentorshipData();
    setRefreshing(false);
  };

  const handleAccept = async (requestId: string) => {
    if (!token) return;
    setProcessingId(requestId);
    try {
      await acceptRequest(token, requestId);
      Alert.alert('Request Accepted', 'You are now mentoring this student candidate!');
      fetchMentorshipData();
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to accept request');
    } finally {
      setProcessingId(null);
    }
  };

  const handleDecline = async (requestId: string) => {
    if (!token) return;
    setProcessingId(requestId);
    try {
      await declineRequest(token, requestId);
      fetchMentorshipData();
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to decline request');
    } finally {
      setProcessingId(null);
    }
  };

  const pendingRequests = requests.filter(r => r.status === 'PENDING');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerLogoMark}>
            <Ionicons name="people" size={20} color={colors.onPrimary} />
          </View>
          <Text style={styles.headerBrandTitle}>Mentees & Requests</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabPill, activeTab === 'REQUESTS' && styles.tabPillActive]}
          onPress={() => setActiveTab('REQUESTS')}
        >
          <Text style={[styles.tabText, activeTab === 'REQUESTS' && styles.tabTextActive]}>
            Pending Requests ({pendingRequests.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabPill, activeTab === 'PAIRS' && styles.tabPillActive]}
          onPress={() => setActiveTab('PAIRS')}
        >
          <Text style={[styles.tabText, activeTab === 'PAIRS' && styles.tabTextActive]}>
            Active Mentees ({pairs.filter(p => p.status === 'ACTIVE').length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {isLoading && !refreshing ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xxl }} />
        ) : activeTab === 'REQUESTS' ? (
          pendingRequests.length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="mail-unread-outline" size={32} color={colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>No Pending Requests</Text>
              <Text style={styles.emptyDesc}>When students request your mentorship guidance, they will appear here.</Text>
            </View>
          ) : (
            <View style={styles.list}>
              {pendingRequests.map((item, idx) => (
                <AnimatedFadeIn key={item.id} delay={idx * 50}>
                  <View style={styles.card}>
                    <View style={styles.cardTop}>
                      <View style={styles.avatarWrap}>
                        <Ionicons name="person" size={20} color={colors.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.studentTitle}>Student Mentee</Text>
                        <Text style={styles.studentId}>ID: {item.studentId.substring(0, 8)}...</Text>
                      </View>
                      <Text style={styles.dateText}>{new Date(item.createdAt).toLocaleDateString()}</Text>
                    </View>

                    {item.message ? (
                      <View style={styles.messageBox}>
                        <Text style={styles.messageText}>"{item.message}"</Text>
                      </View>
                    ) : null}

                    {/* Action Buttons: Accept (GREEN), Decline (RED) */}
                    <View style={styles.actionsRow}>
                      <TouchableOpacity
                        style={[styles.btnGreen, processingId === item.id && { opacity: 0.6 }]}
                        onPress={() => handleAccept(item.id)}
                        disabled={processingId === item.id}
                      >
                        <Ionicons name="checkmark-circle-outline" size={16} color={colors.onPrimary} />
                        <Text style={styles.btnGreenText}>Accept Mentee</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.btnRed, processingId === item.id && { opacity: 0.6 }]}
                        onPress={() => handleDecline(item.id)}
                        disabled={processingId === item.id}
                      >
                        <Ionicons name="close-circle-outline" size={16} color={colors.onPrimary} />
                        <Text style={styles.btnRedText}>Decline</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </AnimatedFadeIn>
              ))}
            </View>
          )
        ) : (
          pairs.length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="people-outline" size={32} color={colors.secondary} />
              </View>
              <Text style={styles.emptyTitle}>No Active Mentees</Text>
              <Text style={styles.emptyDesc}>Accepted student candidates will appear here as your active mentees.</Text>
            </View>
          ) : (
            <View style={styles.list}>
              {pairs.map((pair, idx) => (
                <AnimatedFadeIn key={pair.id} delay={idx * 50}>
                  <AnimatedPressable style={styles.card}>
                    <View style={styles.cardTop}>
                      <View style={[styles.avatarWrap, { backgroundColor: `${colors.secondary}15` }]}>
                        <Ionicons name="school" size={20} color={colors.secondary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <ActiveText style={styles.studentTitle}>Mentee Student</ActiveText>
                        <ActiveText style={styles.studentId}>Student ID: {pair.studentId.substring(0, 8)}...</ActiveText>
                      </View>
                      <View style={styles.activePill}>
                        <ActiveText style={styles.activePillText}>Active Mentorship</ActiveText>
                      </View>
                    </View>
                  </AnimatedPressable>
                </AnimatedFadeIn>
              ))}
            </View>
          )
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerLogoMark: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBrandTitle: { ...typography.headlineSm, color: colors.onSurface },
  
  tabRow: { flexDirection: 'row', paddingHorizontal: spacing.md, gap: spacing.sm, marginVertical: spacing.xs },
  tabPill: { flex: 1, paddingVertical: 10, borderRadius: radius.full, backgroundColor: colors.surfaceContainerLow, alignItems: 'center' },
  tabPillActive: { backgroundColor: colors.secondary },
  tabText: { ...typography.labelSm, color: colors.onSurfaceVariant },
  tabTextActive: { color: colors.onPrimary },

  scrollContent: { padding: spacing.md, paddingBottom: spacing.xxl },
  list: { gap: spacing.md },

  card: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: `${colors.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  studentTitle: { ...typography.labelMd, color: colors.onSurface, fontSize: 16 },
  studentId: { ...typography.bodySm, color: colors.onSurfaceVariant, fontSize: 12 },
  dateText: { ...typography.bodySm, color: colors.onSurfaceVariant, fontSize: 12 },

  messageBox: {
    backgroundColor: colors.surfaceContainerLow,
    padding: spacing.sm,
    borderRadius: radius.md,
    marginTop: spacing.sm,
  },
  messageText: { ...typography.bodySm, color: colors.onSurface, fontStyle: 'italic' },

  actionsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  btnGreen: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.secondary,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    gap: 4,
  },
  btnGreenText: { ...typography.labelMd, color: colors.onPrimary },
  btnRed: {
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.error,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    gap: 4,
  },
  btnRedText: { ...typography.labelMd, color: colors.onPrimary },

  activePill: { backgroundColor: `${colors.secondary}15`, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full },
  activePillText: { ...typography.labelSm, color: colors.secondary, fontSize: 11 },

  emptyCard: {
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    marginTop: spacing.xl,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: `${colors.secondary}10`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: { ...typography.headlineSm, color: colors.onSurface, marginBottom: spacing.xs },
  emptyDesc: { fontFamily: 'Inter_400Regular', fontSize: 14, color: colors.onSurfaceVariant, textAlign: 'center' },
});
