import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Linking,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, typography, spacing, radius } from '@/constants/theme';
import { AnimatedFadeIn } from '@/components/ui/AnimatedView';
import { useAuth } from '@/context/AuthContext';

const FAQS = [
  {
    q: 'How does SkillBridge match candidates with opportunities?',
    a: 'SkillBridge uses AI-driven skill vector matching to calculate match scores based on verified portfolio items, certifications, and required job skills.',
  },
  {
    q: 'How do I verify my portfolio items?',
    a: 'Tap on any portfolio item and select "Request Verification". Our automated AI verification system will review your achievements and issue a verified badge.',
  },
  {
    q: 'Can recruiters view my full profile?',
    a: 'Yes, when you apply to an opportunity posted by a recruiter, they receive access to view your interactive mobile CV and verified achievements.',
  },
  {
    q: 'How do I reset my password?',
    a: 'You can request a password reset link from your Profile Settings or the Login screen. A link will be sent directly to your registered email address.',
  },
];

export default function HelpSupportScreen() {
  const { state } = useAuth();
  const user = state.user;

  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [senderEmail, setSenderEmail] = useState(user?.email ?? '');
  const [senderPhone, setSenderPhone] = useState('');
  const [message, setMessage] = useState('');

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

  const handleLaunchEmailClient = async () => {
    if (!message.trim()) {
      Alert.alert('Empty Message', 'Please enter a message or question before launching your email app.');
      return;
    }

    const subject = encodeURIComponent('SkillBridge App Support Request');
    const bodyText = `Hello SkillBridge Support Team,\n\n${message.trim()}\n\n---\nSender Email: ${senderEmail}\nSender Phone: ${senderPhone || 'Not provided'}\nUser ID: ${user?.id || 'N/A'}`;
    const mailtoUrl = `mailto:support@skillbridge.edu.gh?subject=${subject}&body=${encodeURIComponent(bodyText)}`;

    try {
      const canOpen = await Linking.canOpenURL(mailtoUrl);
      if (canOpen) {
        await Linking.openURL(mailtoUrl);
      } else {
        await Linking.openURL(`mailto:support@skillbridge.edu.gh`);
      }
    } catch {
      Alert.alert(
        'Support Email',
        'Could not auto-launch email app. Please send an email directly to support@skillbridge.edu.gh'
      );
    }
  };

  const handleCallSupport = () => {
    Linking.openURL('tel:+233302000000').catch(() => {
      Alert.alert('Phone Call', 'Call support directly at +233 (0) 302 000 000');
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleGoBack} style={styles.backBtn} accessibilityLabel="Back to Profile">
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help & Support</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Hero Section in Emerald Green */}
        <AnimatedFadeIn delay={0}>
          <View style={styles.heroCard}>
            <View style={styles.heroIconWrap}>
              <Ionicons name="headset" size={32} color={colors.onPrimary} />
            </View>
            <Text style={styles.heroTitle}>How can we help you today?</Text>
            <Text style={styles.heroSubtitle}>Find instant answers or reach out directly to our support engineers.</Text>
          </View>
        </AnimatedFadeIn>

        {/* Quick Contact Cards */}
        <AnimatedFadeIn delay={100}>
          <View style={styles.quickContactRow}>
            <TouchableOpacity style={styles.quickContactCard} onPress={handleLaunchEmailClient} activeOpacity={0.8}>
              <View style={[styles.contactIconWrap, { backgroundColor: `${colors.secondary}15` }]}>
                <Ionicons name="mail" size={22} color={colors.secondary} />
              </View>
              <Text style={styles.contactCardTitle}>Email Support</Text>
              <Text style={styles.contactCardSub}>support@skillbridge.edu.gh</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.quickContactCard} onPress={handleCallSupport} activeOpacity={0.8}>
              <View style={[styles.contactIconWrap, { backgroundColor: `${colors.tertiary}15` }]}>
                <Ionicons name="call" size={22} color={colors.tertiary} />
              </View>
              <Text style={styles.contactCardTitle}>Phone Support</Text>
              <Text style={styles.contactCardSub}>+233 (0) 302 000 000</Text>
            </TouchableOpacity>
          </View>
        </AnimatedFadeIn>

        {/* Contact Form Section */}
        <AnimatedFadeIn delay={200}>
          <Text style={styles.sectionTitle}>Submit Support Request</Text>
          <View style={styles.formCard}>
            <Text style={styles.inputLabel}>Your Email Address</Text>
            <TextInput
              style={styles.textInput}
              placeholder="name@example.com"
              placeholderTextColor={colors.outline}
              value={senderEmail}
              onChangeText={setSenderEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={styles.inputLabel}>Phone Number (Optional)</Text>
            <TextInput
              style={styles.textInput}
              placeholder="+233 24 000 0000"
              placeholderTextColor={colors.outline}
              value={senderPhone}
              onChangeText={setSenderPhone}
              keyboardType="phone-pad"
            />

            <Text style={styles.inputLabel}>Describe Your Problem or Question</Text>
            <TextInput
              style={[styles.textInput, styles.messageInput]}
              placeholder="Type your detailed message here..."
              placeholderTextColor={colors.outline}
              value={message}
              onChangeText={setMessage}
              multiline
              numberOfLines={4}
            />

            <TouchableOpacity
              style={styles.sendEmailBtn}
              onPress={handleLaunchEmailClient}
              activeOpacity={0.85}
            >
              <Ionicons name="paper-plane" size={18} color={colors.onPrimary} />
              <Text style={styles.sendEmailBtnText}>Open Email App & Send</Text>
            </TouchableOpacity>
          </View>
        </AnimatedFadeIn>

        {/* FAQs */}
        <AnimatedFadeIn delay={300}>
          <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
          <View style={styles.faqList}>
            {FAQS.map((faq, idx) => {
              const isOpen = openIndex === idx;
              return (
                <TouchableOpacity
                  key={idx}
                  style={[styles.faqCard, isOpen && styles.faqCardOpen]}
                  onPress={() => setOpenIndex(isOpen ? null : idx)}
                  activeOpacity={0.8}
                >
                  <View style={styles.faqHeader}>
                    <Ionicons name="help-circle" size={20} color={colors.secondary} />
                    <Text style={styles.faqQuestion}>{faq.q}</Text>
                    <Ionicons name={isOpen ? "chevron-up" : "chevron-down"} size={18} color={colors.outline} />
                  </View>
                  {isOpen && (
                    <Text style={styles.faqAnswer}>{faq.a}</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </AnimatedFadeIn>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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

  /* Emerald Green Hero Card */
  heroCard: {
    backgroundColor: colors.secondary,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.lg,
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 3,
  },
  heroIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: `${colors.onPrimary}25`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  heroTitle: { ...typography.headlineSm, color: colors.onPrimary, textAlign: 'center' },
  heroSubtitle: { ...typography.bodySm, color: `${colors.onPrimary}90`, textAlign: 'center', marginTop: 4 },

  quickContactRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xl },
  quickContactCard: {
    flex: 1,
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    alignItems: 'center',
  },
  contactIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  contactCardTitle: { ...typography.labelMd, color: colors.onSurface, marginBottom: 2 },
  contactCardSub: { ...typography.labelSm, color: colors.onSurfaceVariant, fontSize: 11, textAlign: 'center' },

  sectionTitle: { ...typography.headlineSm, fontSize: 18, color: colors.onSurface, marginBottom: spacing.md },
  
  formCard: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    marginBottom: spacing.xl,
    gap: spacing.xs,
  },
  inputLabel: { ...typography.labelSm, color: colors.onSurface, marginTop: spacing.xs },
  textInput: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    ...typography.bodyMd,
    color: colors.onSurface,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    marginBottom: spacing.xs,
  },
  messageInput: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  sendEmailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.secondary,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    gap: 8,
    marginTop: spacing.sm,
  },
  sendEmailBtnText: { ...typography.labelMd, color: colors.onPrimary, fontSize: 15 },

  faqList: { gap: spacing.sm, marginBottom: spacing.xl },
  faqCard: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  faqCardOpen: { borderColor: colors.secondary },
  faqHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  faqQuestion: { ...typography.labelMd, color: colors.onSurface, flex: 1 },
  faqAnswer: { ...typography.bodyMd, color: colors.onSurfaceVariant, marginTop: spacing.sm, lineHeight: 22 },
});
