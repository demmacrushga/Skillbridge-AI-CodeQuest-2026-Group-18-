import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, typography, spacing, radius } from '@/constants/theme';
import { getThread, sendMessage } from '@/services/mentorship';
import { type Message } from '@/types/mentorship';

function timeStr(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function MessageThread({
  pairId,
  pairStatus,
  accessToken,
  currentUserId,
}: {
  pairId: string;
  pairStatus: 'ACTIVE' | 'ENDED';
  accessToken: string;
  currentUserId?: string;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const thread = await getThread(accessToken, pairId);
        if (active) setMessages(thread.messages);
      } catch (e: any) {
        if (active) setError(e.message ?? 'Failed to load messages');
      } finally {
        if (active) setIsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [accessToken, pairId]);

  const handleSend = async () => {
    const body = draft.trim();
    if (!body || isSending) return;
    setIsSending(true);
    // Optimistic append
    const optimistic: Message = {
      id: `optimistic-${Date.now()}`,
      pairId,
      senderId: currentUserId ?? '',
      body,
      sentAt: new Date().toISOString(),
      readAt: null,
    };
    setMessages(prev => [...prev, optimistic]);
    setDraft('');
    try {
      const saved = await sendMessage(accessToken, pairId, { body });
      setMessages(prev => prev.map(m => (m.id === optimistic.id ? saved : m)));
    } catch (e: any) {
      // Rollback on error
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
      setDraft(body);
      setError(e.message ?? 'Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading) {
    return <ActivityIndicator size="small" color={colors.primary} style={styles.loader} />;
  }

  return (
    <View style={styles.container}>
      {error ? (
        <View style={styles.errorRow}>
          <Ionicons name="alert-circle-outline" size={14} color={colors.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {messages.length === 0 ? (
        <Text style={styles.emptyText}>No messages yet — say hello!</Text>
      ) : (
        <View style={styles.messageList}>
          {messages.map(m => {
            const mine = currentUserId !== undefined && m.senderId === currentUserId;
            return (
              <View
                key={m.id}
                style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}
              >
                <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{m.body}</Text>
                <Text style={[styles.bubbleMeta, mine && styles.bubbleMetaMine]}>
                  {timeStr(m.sentAt)}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {pairStatus === 'ENDED' ? (
        <View style={styles.endedNotice}>
          <Ionicons name="lock-closed-outline" size={13} color={colors.onSurfaceVariant} />
          <Text style={styles.endedNoticeText}>
            This mentorship has ended — messages are read-only
          </Text>
        </View>
      ) : (
        <View style={styles.composerRow}>
          <TextInput
            style={styles.composerInput}
            placeholder="Write a message…"
            placeholderTextColor={colors.outline}
            value={draft}
            onChangeText={setDraft}
            multiline
          />
          <TouchableOpacity
            style={[styles.sendBtn, (isSending || !draft.trim()) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={isSending || !draft.trim()}
            activeOpacity={0.85}
          >
            {isSending ? (
              <ActivityIndicator size="small" color={colors.onPrimary} />
            ) : (
              <Ionicons name="send" size={16} color={colors.onPrimary} />
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  loader: { marginVertical: spacing.md },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  errorText: { ...typography.labelMd, color: colors.error, flex: 1 },
  emptyText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: colors.onSurfaceVariant,
  },
  messageList: { gap: spacing.xs },
  bubble: {
    maxWidth: '82%',
    borderRadius: radius.lg,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.sm,
    gap: 2,
  },
  bubbleMine: {
    alignSelf: 'flex-end',
    backgroundColor: colors.primary,
    borderBottomRightRadius: radius.sm,
  },
  bubbleTheirs: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceContainerLow,
    borderBottomLeftRadius: radius.sm,
  },
  bubbleText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 18,
    color: colors.onSurface,
  },
  bubbleTextMine: { color: colors.onPrimary },
  bubbleMeta: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    color: colors.onSurfaceVariant,
  },
  bubbleMetaMine: { color: 'rgba(255,255,255,0.6)' },
  endedNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  endedNoticeText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: colors.onSurfaceVariant,
    flex: 1,
  },
  composerRow: { flexDirection: 'row', gap: spacing.xs, alignItems: 'flex-end' },
  composerInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.bodyMd,
    color: colors.onSurface,
    fontSize: 13,
    maxHeight: 96,
  },
  sendBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.6 },
});
