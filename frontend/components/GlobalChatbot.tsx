import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  DeviceEventEmitter,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { extractFromCV } from '@/services/portfolio';
import { setExtractedItems } from '@/services/extraction-state';
import { colors, typography, spacing, radius } from '@/constants/theme';
import { AnimatedFadeIn } from '@/components/ui/AnimatedView';
import { LinearGradient } from 'expo-linear-gradient';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

export function GlobalChatbot() {
  const { state } = useAuth();
  const [visible, setVisible] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Hi there! I am your SkillBridge AI assistant. How can I help you today?\n\nYou can ask me questions about your career roadmap, or upload your CV to automatically build your portfolio!',
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 20);

  useEffect(() => {
    if (visible) {
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages, visible]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('openChatbot', () => setVisible(true));
    return () => sub.remove();
  }, []);

  async function handleSend() {
    if (!input.trim()) return;

    const userText = input.trim();
    const newUserMsg: Message = { id: Date.now().toString(), role: 'user', text: userText };
    setMessages(prev => [...prev, newUserMsg]);
    setInput('');
    setIsTyping(true);

    setTimeout(() => {
      const lower = userText.toLowerCase();
      let reply = "I am your SkillBridge career assistant. I can analyze your skill gaps, generate personal career milestones, or extract portfolio items from your resume!";
      
      if (lower.includes('course') || lower.includes('roadmap') || lower.includes('learn')) {
        reply = "Based on your career roadmap, I recommend completing your active semester milestones first to boost your career readiness score.";
      } else if (lower.includes('hello') || lower.includes('hi')) {
        reply = "Hello! How can I assist you with your career goals today?";
      } else if (lower.includes('cv') || lower.includes('resume') || lower.includes('portfolio') || lower.includes('skill')) {
        reply = "You can tap the document attachment icon on the left of the input bar to upload your PDF or Word resume, and I'll automatically parse your achievements into portfolio items!";
      } else if (lower.includes('joke') || lower.includes('weather') || lower.includes('movie')) {
        reply = "I am focused on your career success! Let's discuss your skills, portfolio, or interview practice.";
      }

      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: reply,
      };
      setMessages(prev => [...prev, aiResponse]);
      setIsTyping(false);
    }, 1100);
  }

  async function handleUploadCV() {
    if (!state.accessToken) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;

      setIsUploading(true);
      const extracted = await extractFromCV(state.accessToken, result.assets[0]);
      setExtractedItems(extracted);
      setIsUploading(false);
      setVisible(false);
      router.push('/(app)/portfolio-review');
    } catch (err: any) {
      setIsUploading(false);
      const msg = err?.status === 503
        ? 'AI service unavailable. Please try again later.'
        : err?.message ?? 'Failed to extract items from CV.';
      Alert.alert('Error', msg);
    }
  }

  return (
    <>
      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setVisible(true)}
        activeOpacity={0.85}
        accessibilityLabel="Open SkillBridge AI Chatbot"
      >
        <Ionicons name="sparkles" size={24} color={colors.onPrimary} />
      </TouchableOpacity>

      {/* Light Mode Chat Modal */}
      <Modal visible={visible} animationType="slide" onRequestClose={() => setVisible(false)} statusBarTranslucent>
        <View style={styles.modalBg}>
          <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
          >
            {/* Header with notch padding */}
            <LinearGradient
              colors={[colors.primary, colors.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.header, { paddingTop: topInset + 8 }]}
            >
              <View style={styles.headerTitleRow}>
                <View style={styles.headerIconWrap}>
                  <Ionicons name="sparkles" size={16} color={colors.primary} />
                </View>
                <View>
                  <Text style={styles.headerTitle}>SkillBridge AI Assistant</Text>
                  <View style={styles.statusRow}>
                    <View style={styles.livePulseDot} />
                    <Text style={styles.headerSubtitle}>Always online · Ask or upload CV</Text>
                  </View>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setVisible(false)}
                style={styles.closeBtn}
                hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
                activeOpacity={0.7}
              >
                <Ionicons name="close-circle" size={28} color={colors.onPrimary} />
              </TouchableOpacity>
            </LinearGradient>

              {/* Messages Feed */}
              <View style={styles.feedWrapper}>
                <ScrollView
                  ref={scrollViewRef}
                  contentContainerStyle={styles.messagesList}
                  showsVerticalScrollIndicator={false}
                >
                  {messages.map(msg => (
                    <AnimatedFadeIn key={msg.id} delay={0} duration={300}>
                      <View style={[styles.messageRow, msg.role === 'user' ? styles.messageRowUser : styles.messageRowAssistant]}>
                        {msg.role === 'assistant' && (
                          <View style={styles.assistantAvatar}>
                            <Ionicons name="sparkles" size={12} color={colors.primary} />
                          </View>
                        )}
                        <View style={[styles.messageBubble, msg.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant]}>
                          <Text style={[styles.messageText, msg.role === 'user' ? styles.textUser : styles.textAssistant]}>
                            {msg.text}
                          </Text>
                        </View>
                      </View>
                    </AnimatedFadeIn>
                  ))}
                  {isTyping && (
                    <AnimatedFadeIn delay={0} duration={300}>
                      <View style={[styles.messageRow, styles.messageRowAssistant]}>
                        <View style={styles.assistantAvatar}>
                          <Ionicons name="sparkles" size={12} color={colors.primary} />
                        </View>
                        <View style={styles.typingIndicator}>
                          <ActivityIndicator size="small" color={colors.primary} />
                        </View>
                      </View>
                    </AnimatedFadeIn>
                  )}
                  {isUploading && (
                    <AnimatedFadeIn delay={0} duration={300}>
                      <View style={styles.uploadingBox}>
                        <ActivityIndicator size="small" color={colors.secondary} />
                        <Text style={styles.uploadingText}>Extracting portfolio items from CV...</Text>
                      </View>
                    </AnimatedFadeIn>
                  )}
                </ScrollView>
              </View>

              {/* Input Area Bar */}
              <View style={styles.inputAreaContainer}>
                <View style={styles.inputPillBar}>
                  <TouchableOpacity style={styles.attachBtn} onPress={handleUploadCV} disabled={isUploading}>
                    <Ionicons name="document-text-outline" size={22} color={colors.secondary} />
                  </TouchableOpacity>
                  <TextInput
                    style={styles.input}
                    placeholder="Ask me anything..."
                    placeholderTextColor={colors.outline}
                    value={input}
                    onChangeText={setInput}
                    multiline
                    maxLength={500}
                  />
                  <TouchableOpacity
                    style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]}
                    onPress={handleSend}
                    disabled={!input.trim()}
                  >
                    <View style={[styles.sendBtnInner, { backgroundColor: input.trim() ? colors.primary : colors.outlineVariant }]}>
                      <Ionicons name="send" size={16} color={input.trim() ? colors.onPrimary : colors.outline} />
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
            </KeyboardAvoidingView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 95,
    right: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.tertiary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 999,
  },
  modalBg: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 4,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerIconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    ...typography.headlineSm,
    fontSize: 17,
    color: colors.onPrimary,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.secondary,
  },
  headerSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: 'rgba(255,255,255,0.85)',
  },
  closeBtn: {
    padding: 4,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  feedWrapper: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  messagesList: {
    padding: spacing.md,
    paddingBottom: spacing.xxl + 20,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: spacing.md,
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  messageRowUser: {
    justifyContent: 'flex-end',
  },
  messageRowAssistant: {
    justifyContent: 'flex-start',
  },
  assistantAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: `${colors.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  messageBubble: {
    maxWidth: '82%',
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderRadius: 20,
  },
  bubbleUser: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    backgroundColor: colors.surfaceCard,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 21,
    fontFamily: 'Inter_400Regular',
  },
  textUser: {
    color: colors.onPrimary,
  },
  textAssistant: {
    color: colors.onSurface,
  },
  typingIndicator: {
    backgroundColor: colors.surfaceCard,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  uploadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surfaceCard,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  uploadingText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: colors.onSurfaceVariant,
  },
  inputAreaContainer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
  },
  inputPillBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: 24,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: Platform.OS === 'ios' ? 6 : 2,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  attachBtn: {
    padding: spacing.xs,
  },
  input: {
    flex: 1,
    color: colors.onSurface,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    maxHeight: 100,
    paddingHorizontal: spacing.xs,
  },
  sendBtn: {
    marginLeft: 4,
  },
  sendBtnDisabled: {
    opacity: 0.5,
  },
  sendBtnInner: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
