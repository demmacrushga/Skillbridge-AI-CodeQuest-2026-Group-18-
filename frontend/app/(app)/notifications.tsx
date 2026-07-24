import { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  RefreshControl,
  Switch,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Skeleton } from '@/components/ui/Skeleton';
import { showToast } from '@/components/ui/Toast';
import { AnimatedPressable, ActiveText } from '@/components/ui/AnimatedView';
import { useAuth } from '@/context/AuthContext';
import { useTheme, useThemeStyles } from '@/context/ThemeContext';
import { typography, spacing, radius, type ThemeColors } from '@/constants/theme';
import {
  type Notification,
  type NotificationType,
  type Preferences,
} from '@/types/notification';
import {
  getMyNotifications,
  getUnreadCount,
  markRead,
  markAllRead,
  getPreferences,
  updatePreferences,
} from '@/services/notification';

const TYPE_LABELS: Record<NotificationType, string> = {
  CHALLENGE_SCORED: 'Challenge',
  MENTORSHIP_REQUEST_RECEIVED: 'Mentorship',
  MENTORSHIP_REQUEST_ACCEPTED: 'Mentorship',
  MENTORSHIP_REQUEST_DECLINED: 'Mentorship',
  MENTORSHIP_MESSAGE: 'Message',
  OPPORTUNITY_MATCH: 'Opportunity',
  ROADMAP_MILESTONE: 'Milestone',
  SYSTEM: 'System',
};

const TYPE_ICONS: Record<NotificationType, keyof typeof Ionicons.glyphMap> = {
  CHALLENGE_SCORED: 'trophy-outline',
  MENTORSHIP_REQUEST_RECEIVED: 'people-outline',
  MENTORSHIP_REQUEST_ACCEPTED: 'people-outline',
  MENTORSHIP_REQUEST_DECLINED: 'people-outline',
  MENTORSHIP_MESSAGE: 'chatbubble-outline',
  OPPORTUNITY_MATCH: 'briefcase-outline',
  ROADMAP_MILESTONE: 'compass-outline',
  SYSTEM: 'megaphone-outline',
};

const DEMO_NOTIFICATIONS: Notification[] = [
  {
    id: 'demo-1',
    type: 'SYSTEM',
    title: 'Welcome to SkillBridge Platform! 🎉',
    body: 'Your profile is ready. Explore industry challenges, AI career roadmaps, and alumni mentorship.',
    read: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'demo-2',
    type: 'OPPORTUNITY_MATCH',
    title: 'New Recruiter Match Available',
    body: 'Recruiters have posted new entry-level and internship roles matching your verified skills.',
    read: false,
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: 'demo-3',
    type: 'ROADMAP_MILESTONE',
    title: 'Milestone Progress Updated',
    body: 'You completed your active semester milestone! Your overall career readiness score has increased.',
    read: true,
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
  },
];

export default function NotificationsScreen() {
  const { state } = useAuth();
  const { colors } = useTheme();
  const styles = useThemeStyles(createStyles);
  const token = state.accessToken;

  const [notifications, setNotifications] = useState<Notification[]>(DEMO_NOTIFICATIONS);
  const [unread, setUnread] = useState(2);
  const [preferences, setPreferences] = useState<Preferences>({ pushEnabled: true, mutedTypes: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [listRes, countRes, prefsRes] = await Promise.allSettled([
        getMyNotifications(token),
        getUnreadCount(token),
        getPreferences(token),
      ]);

      const fetchedList = listRes.status === 'fulfilled' ? listRes.value : [];
      const fetchedCount = countRes.status === 'fulfilled' ? countRes.value.unread : 0;
      const fetchedPrefs = prefsRes.status === 'fulfilled' ? prefsRes.value : { pushEnabled: true, mutedTypes: [] };

      if (fetchedList.length > 0) {
        setNotifications(fetchedList);
        setUnread(fetchedCount);
      } else {
        setNotifications(DEMO_NOTIFICATIONS);
        setUnread(DEMO_NOTIFICATIONS.filter(n => !n.read).length);
      }
      setPreferences(fetchedPrefs);
    } catch {
      setNotifications(DEMO_NOTIFICATIONS);
      setUnread(DEMO_NOTIFICATIONS.filter(n => !n.read).length);
    } finally {
      setLoading(false);
    }
  }, [token]);

  function handleGoBack() {
    router.replace('/(app)/profile');
  }

  useFocusEffect(
    useCallback(() => {
      load();
      const onBackPress = () => {
        router.replace('/(app)/profile');
        return true;
      };
      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [load])
  );

  async function handleMarkRead(id: string) {
    if (!token) return;
    try {
      await markRead(token, id);
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, read: true } : n))
      );
      setUnread(u => Math.max(0, u - 1));
    } catch (err: any) {
      setError(err.message ?? 'Failed to mark read');
    }
  }

  async function handleMarkAllRead() {
    if (!token) return;
    try {
      await markAllRead(token);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnread(0);
    } catch (err: any) {
      setError(err.message ?? 'Failed to mark all read');
    }
  }

  async function togglePush(enabled: boolean) {
    if (!token) return;
    const current = preferences ?? { pushEnabled: true, mutedTypes: [] };
    setPreferences({ ...current, pushEnabled: enabled });
    showToast(enabled ? 'Push notifications enabled' : 'Push notifications disabled');
    try {
      const updated = await updatePreferences(token, { ...current, pushEnabled: enabled });
      setPreferences(updated);
    } catch (err: any) {
      setPreferences(current);
      setError(err.message ?? 'Failed to update preferences');
    }
  }

  async function toggleMute(type: NotificationType) {
    if (!token || !preferences) return;
    const muted = new Set(preferences.mutedTypes);
    if (muted.has(type)) muted.delete(type);
    else muted.add(type);
    try {
      const updated = await updatePreferences(token, {
        ...preferences,
        mutedTypes: Array.from(muted),
      });
      setPreferences(updated);
    } catch (err: any) {
      setError(err.message ?? 'Failed to update preferences');
    }
  }

  function handleNotificationPress(notification: Notification) {
    if (!notification.read) {
      handleMarkRead(notification.id);
    }
    switch (notification.type) {
      case 'CHALLENGE_SCORED':
        router.push('/(app)/challenges');
        break;
      case 'MENTORSHIP_REQUEST_RECEIVED':
      case 'MENTORSHIP_REQUEST_ACCEPTED':
      case 'MENTORSHIP_REQUEST_DECLINED':
      case 'MENTORSHIP_MESSAGE':
        if (state.user?.role === 'ALUMNI') {
          router.push('/(app)/alumni/requests');
        } else {
          router.push('/(app)/mentorship');
        }
        break;
      case 'OPPORTUNITY_MATCH':
        if (state.user?.role === 'RECRUITER') {
          router.push('/(app)/recruiter/post');
        } else {
          router.push('/(app)/opportunities');
        }
        break;
      case 'ROADMAP_MILESTONE':
        router.push('/(app)/career');
        break;
      case 'SYSTEM':
      default:
        router.push('/(app)');
        break;
    }
  }

  function renderItem({ item }: { item: Notification }) {
    return (
      <AnimatedPressable
        style={[styles.card, !item.read && styles.cardUnread]}
        onPress={() => handleNotificationPress(item)}
        activeFillColor="rgba(37, 99, 235, 0.15)"
      >
        <View style={styles.cardIcon}>
          <Ionicons name={TYPE_ICONS[item.type]} size={20} color={colors.secondary} />
        </View>
        <View style={styles.cardBody}>
          <View style={styles.cardHeader}>
            <ActiveText style={styles.cardType}>{TYPE_LABELS[item.type]}</ActiveText>
            {!item.read && <View style={styles.unreadDot} />}
          </View>
          <ActiveText style={styles.cardTitle}>{item.title}</ActiveText>
          <ActiveText style={styles.cardBodyText} numberOfLines={2}>
            {item.body}
          </ActiveText>
          <ActiveText style={styles.cardTime}>{new Date(item.createdAt).toLocaleString()}</ActiveText>
        </View>
      </AnimatedPressable>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleGoBack} style={styles.backBtn} accessibilityLabel="Back to Profile">
          <Ionicons name="arrow-back" size={22} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        {unread > 0 ? (
          <TouchableOpacity onPress={handleMarkAllRead} style={styles.markAllBtn}>
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Preferences */}
      <View style={styles.prefsCard}>
        <TouchableOpacity
          style={styles.prefRow}
          activeOpacity={0.8}
          onPress={() => togglePush(!(preferences?.pushEnabled ?? true))}
        >
          <Text style={styles.prefLabel}>Push notifications</Text>
          <Switch
            value={preferences?.pushEnabled ?? true}
            onValueChange={togglePush}
            trackColor={{ false: colors.outlineVariant, true: colors.secondary }}
            thumbColor="#fff"
          />
        </TouchableOpacity>
        <Text style={styles.prefHint}>Mute specific types:</Text>
        <View style={styles.muteGrid}>
          {(Object.keys(TYPE_LABELS) as NotificationType[]).map(type => {
            const muted = preferences?.mutedTypes.includes(type) ?? false;
            return (
              <TouchableOpacity
                key={type}
                style={[styles.muteChip, muted && styles.muteChipActive]}
                onPress={() => toggleMute(type)}
              >
                <Text style={[styles.muteChipText, muted && styles.muteChipTextActive]}>
                  {TYPE_LABELS[type]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Inbox */}
      <FlatList
        data={notifications}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        ListEmptyComponent={
          loading ? (
            <View style={{ gap: spacing.sm }}>
              {[1, 2, 3, 4, 5].map((key) => (
                <View key={key} style={styles.card}>
                  <Skeleton width={40} height={40} borderRadius={20} />
                  <View style={styles.cardBody}>
                    <Skeleton width="30%" height={12} style={{ marginBottom: 4 }} />
                    <Skeleton width="70%" height={16} style={{ marginBottom: 4 }} />
                    <Skeleton width="100%" height={14} style={{ marginBottom: 2 }} />
                    <Skeleton width="80%" height={14} style={{ marginBottom: 6 }} />
                    <Skeleton width="40%" height={12} />
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.empty}>
              <Ionicons name="notifications-off-outline" size={48} color={colors.secondary} />
              <Text style={styles.emptyText}>No Notifications Yet</Text>
              <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.onSurfaceVariant, textAlign: 'center', marginTop: 4 }}>
                You are all caught up! Updates about applications, mentorships, and matches will appear here.
              </Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surfaceCard,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceContainerLow,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { ...typography.headlineSm, color: colors.primary },
  markAllBtn: { paddingHorizontal: spacing.sm },
  markAllText: { ...typography.labelMd, color: colors.secondary },
  headerSpacer: { width: 60 },

  errorBanner: {
    backgroundColor: '#FEF2F2',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#FECACA',
  },
  errorText: { ...typography.bodySm, color: '#B91C1C' },

  prefsCard: {
    backgroundColor: colors.surfaceCard,
    margin: spacing.md,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  prefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  prefLabel: { ...typography.labelMd, color: colors.onSurface },
  prefHint: { ...typography.bodySm, color: colors.onSurfaceVariant, marginBottom: spacing.sm },
  muteGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  muteChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  muteChipActive: {
    backgroundColor: colors.secondary,
    borderColor: colors.secondary,
  },
  muteChipText: { ...typography.labelSm, color: colors.onSurfaceVariant },
  muteChipTextActive: { color: colors.onPrimary },

  listContent: { padding: spacing.md, paddingBottom: spacing.xxl },

  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  cardUnread: {
    borderLeftWidth: 4,
    borderLeftColor: colors.secondary,
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${colors.secondary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  cardBody: { flex: 1 },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  cardType: { ...typography.labelSm, color: colors.secondary },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.secondary,
  },
  cardTitle: { ...typography.labelMd, color: colors.onSurface, marginBottom: 2 },
  cardBodyText: { ...typography.bodySm, color: colors.onSurfaceVariant },
  cardTime: { ...typography.labelSm, color: colors.outline, marginTop: spacing.xs },

  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.md,
  },
  emptyText: { ...typography.bodyMd, color: colors.onSurfaceVariant },
});
