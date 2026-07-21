import { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  RefreshControl,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '@/context/AuthContext';
import { colors, typography, spacing, radius } from '@/constants/theme';
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

export default function NotificationsScreen() {
  const { state } = useAuth();
  const token = state.accessToken;

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [list, count, prefs] = await Promise.all([
        getMyNotifications(token),
        getUnreadCount(token),
        getPreferences(token),
      ]);
      setNotifications(list);
      setUnread(count.unread);
      setPreferences(prefs);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load();
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
    if (!token || !preferences) return;
    try {
      const updated = await updatePreferences(token, { ...preferences, pushEnabled: enabled });
      setPreferences(updated);
    } catch (err: any) {
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

  function renderItem({ item }: { item: Notification }) {
    return (
      <TouchableOpacity
        style={[styles.card, !item.read && styles.cardUnread]}
        onPress={() => handleMarkRead(item.id)}
        activeOpacity={0.8}
      >
        <View style={styles.cardIcon}>
          <Ionicons name={TYPE_ICONS[item.type]} size={20} color={colors.secondary} />
        </View>
        <View style={styles.cardBody}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardType}>{TYPE_LABELS[item.type]}</Text>
            {!item.read && <View style={styles.unreadDot} />}
          </View>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.cardBodyText} numberOfLines={2}>
            {item.body}
          </Text>
          <Text style={styles.cardTime}>{new Date(item.createdAt).toLocaleString()}</Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
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
        <View style={styles.prefRow}>
          <Text style={styles.prefLabel}>Push notifications</Text>
          <Switch
            value={preferences?.pushEnabled ?? true}
            onValueChange={togglePush}
            trackColor={{ false: colors.outlineVariant, true: colors.secondary }}
            thumbColor="#fff"
          />
        </View>
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
          <View style={styles.empty}>
            <Ionicons name="notifications-off-outline" size={48} color={colors.outline} />
            <Text style={styles.emptyText}>No notifications yet</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
    borderRadius: radius.full,
    backgroundColor: `${colors.secondary}15`,
    justifyContent: 'center',
    alignItems: 'center',
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
