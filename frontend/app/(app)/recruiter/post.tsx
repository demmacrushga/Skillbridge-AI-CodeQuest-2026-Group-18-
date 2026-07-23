import { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '@/context/AuthContext';
import { colors, typography, spacing, radius } from '@/constants/theme';
import { postOpportunity } from '@/services/matching';
import { type PostOpportunityPayload, type SkillRequirement, type OpportunityType } from '@/types/matching';
import { AnimatedFadeIn, AnimatedPressable } from '@/components/ui/AnimatedView';
import { AnimatedTextInput } from '@/components/ui/AnimatedTextInput';

export default function PostOpportunityScreen() {
  const { state } = useAuth();
  const token = state.accessToken;

  // Wizard state
  const [step, setStep] = useState(1);
  const scrollRef = useRef<ScrollView>(null);
  
  // Form State
  const [title, setTitle] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [description, setDescription] = useState('');
  
  const [location, setLocation] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
  const [opportunityType, setOpportunityType] = useState<OpportunityType>('ENTRY_LEVEL');
  
  const [skills, setSkills] = useState<SkillRequirement[]>([]);
  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillRequired, setNewSkillRequired] = useState(true);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAddSkill = () => {
    const s = newSkillName.trim();
    if (!s) return;
    if (skills.some(x => x.skillName.toLowerCase() === s.toLowerCase())) {
      setNewSkillName('');
      return;
    }
    setSkills(prev => [...prev, { skillName: s, required: newSkillRequired }]);
    setNewSkillName('');
    setNewSkillRequired(true);
  };

  const handleRemoveSkill = (skillName: string) => {
    setSkills(prev => prev.filter(s => s.skillName !== skillName));
  };

  const handleNextStep = () => {
    setError('');
    if (step === 1) {
      if (!title.trim() || !companyName.trim() || !description.trim()) {
        setError('Title, Company Name, and Description are required.');
        scrollRef.current?.scrollTo({ y: 0, animated: true });
        return;
      }
      setStep(2);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } else if (step === 2) {
      setStep(3);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    }
  };

  const handleBackStep = () => {
    setError('');
    if (step > 1) {
      setStep(step - 1);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } else {
      router.back();
    }
  };

  const handleSubmit = async () => {
    setError('');
    if (skills.length === 0) {
      setError('Please add at least one required skill for the opportunity.');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }

    if (!token) return;
    setIsLoading(true);

    try {
      let formattedUrl = externalUrl.trim();
      if (formattedUrl && !/^https?:\/\//i.test(formattedUrl)) {
        formattedUrl = `https://${formattedUrl}`;
      }

      const payload: PostOpportunityPayload = {
        title: title.trim(),
        companyName: companyName.trim(),
        description: description.trim(),
        location: location.trim() || undefined,
        externalUrl: formattedUrl || undefined,
        opportunityType,
        requiredSkills: skills,
      };

      await postOpportunity(token, payload);
      Alert.alert('Success', 'Your opportunity has been posted successfully!', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (e: any) {
      console.error('Post opportunity failed:', e);
      const statusPrefix = e.status ? `(Status ${e.status}): ` : '';
      const msg = typeof e.message === 'string' ? e.message : 'Failed to post opportunity';
      setError(`${statusPrefix}${msg}`);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBackStep} style={styles.backBtn}>
          <Ionicons name={step === 1 ? "close" : "chevron-back"} size={24} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Post Opportunity</Text>
      </View>

      {/* Progress Indicator */}
      <View style={styles.progressContainer}>
        <View style={styles.progressRow}>
          <View style={[styles.stepDot, styles.stepDone]} />
          <View style={[styles.stepLine, step >= 2 && styles.stepLineDone]} />
          <View style={[styles.stepDot, step >= 2 ? styles.stepDone : styles.stepPending]} />
          <View style={[styles.stepLine, step >= 3 && styles.stepLineDone]} />
          <View style={[styles.stepDot, step >= 3 ? styles.stepDone : styles.stepPending]} />
        </View>
        <Text style={styles.stepLabel}>
          Step {step} of 3 — {step === 1 ? 'Basic Info' : step === 2 ? 'Details' : 'Requirements'}
        </Text>
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {error ? (
          <AnimatedFadeIn delay={0} duration={300}>
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle-outline" size={18} color={colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          </AnimatedFadeIn>
        ) : null}

        {step === 1 && (
          <AnimatedFadeIn delay={100}>
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Basic Information</Text>
              <Text style={styles.sectionDesc}>Let's start with the core details of the position.</Text>
              
              <View style={{ marginTop: spacing.md }}>
                <AnimatedTextInput
                  label="Job Title"
                  value={title}
                  onChangeText={setTitle}
                  placeholder="e.g. Junior Software Engineer"
                />

                <AnimatedTextInput
                  label="Company Name"
                  value={companyName}
                  onChangeText={setCompanyName}
                  placeholder="e.g. Tech Corp"
                />

                <Text style={styles.inputLabel}>Description</Text>
                <TextInput
                  style={[styles.input, styles.inputMultiline]}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Describe the role, responsibilities, and benefits..."
                  placeholderTextColor={colors.outline}
                  multiline
                  numberOfLines={6}
                />
              </View>
            </View>
          </AnimatedFadeIn>
        )}

        {step === 2 && (
          <AnimatedFadeIn delay={100}>
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Opportunity Details</Text>
              <Text style={styles.sectionDesc}>Specify the type and location of this role.</Text>
              
              <View style={{ marginTop: spacing.md }}>
                <Text style={styles.inputLabel}>Opportunity Type</Text>
                <View style={styles.typeSelector}>
                  <TouchableOpacity
                    style={[styles.typeBtn, opportunityType === 'ENTRY_LEVEL' && styles.typeBtnActive]}
                    onPress={() => setOpportunityType('ENTRY_LEVEL')}
                  >
                    <Text style={[styles.typeBtnText, opportunityType === 'ENTRY_LEVEL' && styles.typeBtnTextActive]}>
                      Entry Level Job
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.typeBtn, opportunityType === 'INTERNSHIP' && styles.typeBtnActive]}
                    onPress={() => setOpportunityType('INTERNSHIP')}
                  >
                    <Text style={[styles.typeBtnText, opportunityType === 'INTERNSHIP' && styles.typeBtnTextActive]}>
                      Internship
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={{ marginTop: spacing.lg }}>
                  <AnimatedTextInput
                    label="Location (Optional)"
                    value={location}
                    onChangeText={setLocation}
                    placeholder="e.g. Remote, New York, etc."
                  />
                </View>

                <View style={{ marginTop: spacing.md }}>
                  <AnimatedTextInput
                    label="External Application Link (Optional)"
                    value={externalUrl}
                    onChangeText={setExternalUrl}
                    placeholder="https://company.com/apply"
                    keyboardType="url"
                    autoCapitalize="none"
                  />
                  <Text style={[styles.sectionDesc, { marginTop: 4 }]}>
                    If provided, candidates will be redirected to this link to apply instead of applying internally.
                  </Text>
                </View>
              </View>
            </View>
          </AnimatedFadeIn>
        )}

        {step === 3 && (
          <AnimatedFadeIn delay={100}>
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Skills Required</Text>
              <Text style={styles.sectionDesc}>Add skills to match with highly qualified students.</Text>
              
              <View style={styles.skillsList}>
                {skills.length === 0 ? (
                  <Text style={[styles.sectionDesc, { fontStyle: 'italic', marginVertical: spacing.sm }]}>
                    No skills added yet. Add at least one skill.
                  </Text>
                ) : null}
                {skills.map(s => (
                  <View key={s.skillName} style={styles.skillChip}>
                    <Text style={styles.skillChipText}>
                      {s.skillName} {s.required ? '(Required)' : '(Nice to have)'}
                    </Text>
                    <TouchableOpacity onPress={() => handleRemoveSkill(s.skillName)}>
                      <Ionicons name="close-circle" size={16} color={colors.primary} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>

              <View style={styles.addSkillBox}>
                <TextInput
                  style={styles.addSkillInput}
                  placeholder="e.g. React Native, Python, Design..."
                  placeholderTextColor={colors.outline}
                  value={newSkillName}
                  onChangeText={setNewSkillName}
                  onSubmitEditing={handleAddSkill}
                />
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Is this an absolute requirement?</Text>
                  <Switch
                    value={newSkillRequired}
                    onValueChange={setNewSkillRequired}
                    trackColor={{ false: colors.surfaceContainerHigh, true: colors.secondary }}
                    thumbColor={colors.onPrimary}
                  />
                </View>
                <TouchableOpacity style={styles.addSkillBtn} onPress={handleAddSkill}>
                  <Ionicons name="add" size={18} color={colors.onPrimary} />
                  <Text style={styles.addSkillBtnText}>Add Skill</Text>
                </TouchableOpacity>
              </View>
            </View>
          </AnimatedFadeIn>
        )}

        <View style={styles.bottomNav}>
          {step < 3 ? (
            <AnimatedPressable style={styles.submitBtn} onPress={handleNextStep}>
              <Text style={styles.submitBtnText}>Continue</Text>
              <Ionicons name="arrow-forward" size={18} color={colors.onPrimary} />
            </AnimatedPressable>
          ) : (
            <AnimatedPressable
              style={[styles.submitBtn, isLoading && styles.disabledBtn]}
              onPress={handleSubmit}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <>
                  <Text style={styles.submitBtnText}>Publish Opportunity</Text>
                  <Ionicons name="checkmark-done" size={20} color={colors.onPrimary} />
                </>
              )}
            </AnimatedPressable>
          )}
        </View>

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
    backgroundColor: colors.surfaceCard,
  },
  backBtn: { padding: spacing.sm },
  headerTitle: { ...typography.headlineSm, color: colors.onSurface, marginLeft: spacing.xs },
  
  progressContainer: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    backgroundColor: colors.surfaceCard,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  stepDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  stepDone: { backgroundColor: colors.secondary },
  stepPending: { backgroundColor: colors.surfaceContainerHigh },
  stepLine: {
    flex: 1,
    height: 3,
    backgroundColor: colors.surfaceContainerHigh,
    marginHorizontal: 4,
    borderRadius: 2,
  },
  stepLineDone: { backgroundColor: colors.secondary },
  stepLabel: {
    ...typography.labelSm,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
  },

  scrollContent: { padding: spacing.md, paddingBottom: spacing.xxl },
  errorBanner: {
    flexDirection: 'row',
    backgroundColor: colors.errorContainer,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
    alignItems: 'center',
  },
  errorText: { ...typography.bodyMd, color: colors.error, flex: 1 },
  section: {
    paddingVertical: spacing.sm,
  },
  sectionLabel: { ...typography.headlineMd, color: colors.onSurface, marginBottom: 4 },
  sectionDesc: { fontFamily: 'Inter_400Regular', fontSize: 14, color: colors.onSurfaceVariant },
  inputLabel: { ...typography.labelMd, color: colors.onSurface, marginBottom: spacing.xs },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.md,
    padding: spacing.md,
    ...typography.bodyMd,
    color: colors.onSurface,
    marginBottom: spacing.md,
  },
  inputMultiline: { height: 120, textAlignVertical: 'top' },
  
  typeSelector: { flexDirection: 'row', gap: spacing.sm },
  typeBtn: {
    flex: 1,
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.outlineVariant,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  typeBtnActive: {
    backgroundColor: `${colors.secondary}10`,
    borderColor: colors.secondary,
  },
  typeBtnText: { ...typography.labelMd, color: colors.onSurfaceVariant, fontSize: 15 },
  typeBtnTextActive: { color: colors.secondary },
  
  skillsList: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginVertical: spacing.md },
  skillChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${colors.primary}15`,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
    gap: 6,
  },
  skillChipText: { ...typography.labelMd, fontSize: 13, color: colors.primary },
  
  addSkillBox: {
    backgroundColor: colors.surfaceCard,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    gap: spacing.md,
  },
  addSkillInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    ...typography.bodyMd,
    fontSize: 15,
    color: colors.onSurface,
  },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  switchLabel: { ...typography.labelMd, color: colors.onSurfaceVariant },
  addSkillBtn: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  addSkillBtnText: { ...typography.labelMd, color: colors.onPrimary, fontSize: 15 },
  
  bottomNav: {
    marginTop: spacing.xl,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
  },
  submitBtn: {
    flexDirection: 'row',
    backgroundColor: colors.secondary,
    paddingVertical: 16,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  disabledBtn: { opacity: 0.7 },
  submitBtnText: { ...typography.labelMd, color: colors.onPrimary, fontSize: 16 },
});
