import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Animated,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '@/context/AuthContext';
import { useTheme, useThemeStyles } from '@/context/ThemeContext';
import { typography, spacing, radius, type ThemeColors } from '@/constants/theme';
import { getCareerPaths, generateRoadmap, getRoadmap, completeMilestone } from '@/services/career';
import { type CareerPath, type Milestone, type Roadmap } from '@/types/career';
import { type UserRole } from '@/services/auth';
import { AnimatedFadeIn, AnimatedPressable, ActiveText } from '@/components/ui/AnimatedView';

// ─── Roadmap type config ──────────────────────────────────────────────────────

const TYPE_CONFIG: Record<Milestone['type'], { icon: keyof typeof Ionicons.glyphMap; color: string; label: string }> = {
  SKILL: { icon: 'book-outline', color: '#2563EB', label: 'Skill' },
  PROJECT: { icon: 'code-slash-outline', color: '#059669', label: 'Project' },
  CERT: { icon: 'trophy-outline', color: '#6366F1', label: 'Cert' },
  EXPERIENCE: { icon: 'briefcase-outline', color: '#3B82F6', label: 'Exp' },
};

// ─── Career path picker config ────────────────────────────────────────────────

interface PathMeta {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  demand: string;
}

const PATH_META: Record<string, PathMeta> = {
  'Software Engineer': { icon: 'code-slash-outline', color: '#2563EB', demand: 'High Demand' },
  'Data Analyst': { icon: 'bar-chart-outline', color: '#059669', demand: 'Fastest Growing' },
  'Accountant': { icon: 'calculator-outline', color: '#64748B', demand: 'Evergreen' },
  'Electrical Engineer': { icon: 'flash-outline', color: '#2563EB', demand: 'High Demand' },
  'Civil Engineer': { icon: 'construct-outline', color: '#64748B', demand: 'Stable' },
};

function getPathMeta(name: string): PathMeta {
  return PATH_META[name] ?? { icon: 'briefcase-outline', color: '#059669', demand: 'In Demand' };
}

interface LevelOption {
  value: string;
  label: string;
  sublabel: string;
}

const LEVELS_BY_ROLE: Record<Extract<UserRole, 'STUDENT' | 'ALUMNI'>, LevelOption[]> = {
  STUDENT: [
    { value: 'Level 100', label: '100', sublabel: 'Year 1' },
    { value: 'Level 200', label: '200', sublabel: 'Year 2' },
    { value: 'Level 300', label: '300', sublabel: 'Year 3' },
    { value: 'Level 400', label: '400', sublabel: 'Year 4' },
  ],
  ALUMNI: [
    { value: 'Recent Graduate', label: '1', sublabel: 'Recent Graduate · 0–12 months' },
    { value: 'Early Career', label: '2', sublabel: 'Early Career · 1–3 years' },
    { value: 'Mid Career', label: '3', sublabel: 'Mid Career · 3–7 years' },
    { value: 'Career Changer', label: '4', sublabel: 'Career Changer · Transitioning' },
  ],
};

const GENERATING_STEPS_BY_ROLE: Record<Extract<UserRole, 'STUDENT' | 'ALUMNI'>, string[]> = {
  STUDENT: [
    'Analysing your career path…',
    'Mapping KNUST semester structure…',
    'Generating milestones with Claude AI…',
    'Personalising to your skills…',
    'Finalising your roadmap…',
  ],
  ALUMNI: [
    'Analysing your career path…',
    'Mapping your career stage…',
    'Generating milestones with Claude AI…',
    'Personalising to your experience…',
    'Finalising your roadmap…',
  ],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function usePulse() {
  const anim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 0.3, duration: 1000, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  }, [anim]);
  return anim;
}

function groupBySemester(milestones: Milestone[]) {
  return milestones.reduce<Record<number, Milestone[]>>((acc, m) => {
    if (!acc[m.semester]) acc[m.semester] = [];
    acc[m.semester].push(m);
    return acc;
  }, {});
}

function periodLabel(role: Extract<UserRole, 'STUDENT' | 'ALUMNI'>, n: number) {
  return role === 'ALUMNI' ? `Phase ${n}` : `Semester ${n}`;
}

function periodShort(role: Extract<UserRole, 'STUDENT' | 'ALUMNI'>, n: number) {
  return role === 'ALUMNI' ? `P${n}` : `S${n}`;
}

// ─── Generating overlay ───────────────────────────────────────────────────────

function GeneratingOverlay({ careerPath, role }: { careerPath: string; role: Extract<UserRole, 'STUDENT' | 'ALUMNI'> }) {
  const [stepIdx, setStepIdx] = useState(0);
  const steps = GENERATING_STEPS_BY_ROLE[role];
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const dotAnim = useRef(new Animated.Value(0)).current;
  const jumpAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const interval = setInterval(() => {
      Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
        setStepIdx(i => Math.min(i + 1, steps.length - 1));
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      });
    }, 3500);

    Animated.loop(
      Animated.sequence([
        Animated.timing(dotAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(dotAnim, { toValue: 0, duration: 700, useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(jumpAnim, { toValue: -20, duration: 400, useNativeDriver: true }),
        Animated.timing(jumpAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
      ])
    ).start();

    return () => clearInterval(interval);
  }, [fadeAnim, dotAnim, jumpAnim, steps.length]);

  const { colors } = useTheme();
  const styles = useThemeStyles(createStyles);
  return (
    <SafeAreaView style={styles.generatingContainer}>
      <View style={styles.generatingVisual}>
        <Animated.View style={[styles.generatingIconWrap, { transform: [{ translateY: jumpAnim }] }]}>
          <Ionicons name="sparkles" size={42} color={colors.tertiary} />
        </Animated.View>
      </View>
      <Text style={styles.generatingTitle}>Building your roadmap</Text>
      <Text style={styles.generatingPath}>{careerPath}</Text>
      <Animated.Text style={[styles.generatingStep, { opacity: fadeAnim }]}>
        {steps[stepIdx]}
      </Animated.Text>
      <Text style={styles.generatingNote}>
        {role === 'ALUMNI'
          ? "Claude AI is crafting a career-stage plan for working professionals.\nThis takes around 30–60 seconds."
          : "Claude AI is crafting a full semester-by-semester plan.\nThis takes around 30–60 seconds."}
      </Text>
      <View style={styles.generatingDots}>
        {[0, 1, 2].map(i => (
          <Animated.View
            key={i}
            style={[
              styles.generatingDot,
              {
                opacity: dotAnim.interpolate({
                  inputRange: [0, 0.33, 0.66, 1],
                  outputRange: i === 0 ? [0.3, 1, 0.3, 0.3] : i === 1 ? [0.3, 0.3, 1, 0.3] : [0.3, 0.3, 0.3, 1],
                }),
              },
            ]}
          />
        ))}
      </View>
    </SafeAreaView>
  );
}

// ─── Skill tag input ──────────────────────────────────────────────────────────

function SkillTagInput({
  skills, onChange,
}: {
  skills: string[]; onChange: (v: string[]) => void;
}) {
  const { colors } = useTheme();
  const styles = useThemeStyles(createStyles);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<TextInput>(null);

  function commitDraft(raw: string) {
    const trimmed = raw.trim().replace(/,+$/, '').trim();
    if (trimmed && !skills.includes(trimmed)) onChange([...skills, trimmed]);
    setDraft('');
  }

  function handleChangeText(text: string) {
    if (text.endsWith(',')) commitDraft(text.slice(0, -1));
    else setDraft(text);
  }

  return (
    <TouchableOpacity
      style={styles.tagContainer}
      onPress={() => inputRef.current?.focus()}
      activeOpacity={1}
    >
      {skills.map(s => (
        <View key={s} style={styles.tag}>
          <Text style={styles.tagText}>{s}</Text>
          <TouchableOpacity onPress={() => onChange(skills.filter(x => x !== s))} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Ionicons name="close" size={13} color={colors.tertiary} />
          </TouchableOpacity>
        </View>
      ))}
      <TextInput
        ref={inputRef}
        style={styles.tagInput}
        value={draft}
        onChangeText={handleChangeText}
        onSubmitEditing={() => commitDraft(draft)}
        onBlur={() => commitDraft(draft)}
        placeholder={skills.length === 0 ? 'e.g. Python, Excel, AutoCAD…' : 'Add more…'}
        placeholderTextColor={colors.outline}
        returnKeyType="done"
        blurOnSubmit={false}
      />
    </TouchableOpacity>
  );
}

// ─── Completed milestone row ──────────────────────────────────────────────────

function CompletedRow({ milestone }: { milestone: Milestone }) {
  const { colors } = useTheme();
  const styles = useThemeStyles(createStyles);
  const cfg = TYPE_CONFIG[milestone.type] ?? TYPE_CONFIG.SKILL;
  return (
    <View style={styles.completedRow}>
      <View style={[styles.completedCheck, { backgroundColor: `${colors.secondary}18` }]}>
        <Ionicons name="checkmark" size={13} color={colors.secondary} />
      </View>
      <Text style={styles.completedTitle} numberOfLines={1}>{milestone.title}</Text>
      <View style={[styles.completedTypeBadge, { backgroundColor: `${cfg.color}12` }]}>
        <Text style={[styles.completedTypeText, { color: cfg.color }]}>{cfg.label}</Text>
      </View>
    </View>
  );
}

// ─── Up Next card ─────────────────────────────────────────────────────────────

function UpNextCard({
  milestone, onComplete, completing, noteValue, onNoteChange, pulseOpacity,
}: {
  milestone: Milestone;
  onComplete: () => void;
  completing: boolean;
  noteValue: string;
  onNoteChange: (v: string) => void;
  pulseOpacity: Animated.Value;
}) {
  const { colors } = useTheme();
  const styles = useThemeStyles(createStyles);
  const cfg = TYPE_CONFIG[milestone.type] ?? TYPE_CONFIG.SKILL;
  const [evidenceOpen, setEvidenceOpen] = useState(false);

  return (
    <View style={styles.upNextCard}>
      <View style={[styles.upNextAccent, { backgroundColor: colors.tertiary }]} />
      <View style={styles.upNextInner}>
        <View style={styles.upNextHeader}>
          <View style={styles.upNextLiveRow}>
            <Animated.View style={[styles.liveDot, { opacity: pulseOpacity }]} />
            <Text style={styles.upNextEyebrow}>UP NEXT</Text>
          </View>
          <View style={[styles.typePill, { backgroundColor: `${cfg.color}15`, borderColor: `${cfg.color}30` }]}>
            <Ionicons name={cfg.icon} size={11} color={cfg.color} />
            <Text style={[styles.typePillText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
        </View>
        <Text style={styles.upNextTitle}>{milestone.title}</Text>
        {milestone.description ? <Text style={styles.upNextDesc}>{milestone.description}</Text> : null}
        {evidenceOpen && (
          <TextInput
            style={styles.evidenceInput}
            placeholder="What did you do? Add a link, note, or screenshot description…"
            placeholderTextColor={colors.outline}
            value={noteValue}
            onChangeText={onNoteChange}
            multiline
            autoFocus
          />
        )}
        <View style={styles.upNextActions}>
          <TouchableOpacity style={styles.evidenceToggle} onPress={() => setEvidenceOpen(v => !v)}>
            <Ionicons name={evidenceOpen ? 'close-circle-outline' : 'attach-outline'} size={16} color={colors.onSurfaceVariant} />
            <Text style={styles.evidenceToggleText}>{evidenceOpen ? 'Remove note' : 'Add evidence'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.completeBtn, completing && styles.completeBtnLoading]}
            onPress={onComplete}
            disabled={completing}
          >
            {completing ? (
              <ActivityIndicator size="small" color={colors.onPrimary} />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={17} color={colors.onPrimary} />
                <Text style={styles.completeBtnText}>Mark Complete</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ─── Upcoming milestone card ──────────────────────────────────────────────────

function UpcomingCard({
  milestone, onComplete, completing, noteValue, onNoteChange,
}: {
  milestone: Milestone;
  onComplete: () => void;
  completing: boolean;
  noteValue: string;
  onNoteChange: (v: string) => void;
}) {
  const { colors } = useTheme();
  const styles = useThemeStyles(createStyles);
  const cfg = TYPE_CONFIG[milestone.type] ?? TYPE_CONFIG.SKILL;
  const [expanded, setExpanded] = useState(false);
  const [evidenceOpen, setEvidenceOpen] = useState(false);

  return (
    <TouchableOpacity style={styles.upcomingCard} onPress={() => setExpanded(v => !v)} activeOpacity={0.82}>
      <View style={styles.upcomingHeader}>
        <View style={[styles.upcomingIconCircle, { backgroundColor: `${cfg.color}12` }]}>
          <Ionicons name={cfg.icon} size={16} color={cfg.color} />
        </View>
        <Text style={styles.upcomingTitle} numberOfLines={expanded ? undefined : 1}>{milestone.title}</Text>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.outline} />
      </View>
      {expanded && (
        <View style={styles.upcomingBody}>
          {milestone.description ? <Text style={styles.upcomingDesc}>{milestone.description}</Text> : null}
          {evidenceOpen && (
            <TextInput
              style={styles.evidenceInput}
              placeholder="Add evidence note…"
              placeholderTextColor={colors.outline}
              value={noteValue}
              onChangeText={onNoteChange}
              multiline
            />
          )}
          <View style={styles.upcomingActions}>
            <TouchableOpacity
              style={styles.evidenceToggleSmall}
              onPress={e => { e.stopPropagation?.(); setEvidenceOpen(v => !v); }}
            >
              <Ionicons name="attach-outline" size={15} color={colors.onSurfaceVariant} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.completeBtnOutlined, completing && { opacity: 0.6 }]}
              onPress={e => { e.stopPropagation?.(); onComplete(); }}
              disabled={completing}
            >
              {completing ? (
                <ActivityIndicator size="small" color={colors.secondary} />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={15} color={colors.secondary} />
                  <Text style={styles.completeBtnOutlinedText}>Mark Complete</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function CareerScreen() {
  const { state } = useAuth();
  const { colors } = useTheme();
  const styles = useThemeStyles(createStyles);
  const user = state.user;
  const role: Extract<UserRole, 'STUDENT' | 'ALUMNI'> = user?.role === 'ALUMNI' ? 'ALUMNI' : 'STUDENT';
  const levels = LEVELS_BY_ROLE[role];
  const pulseOpacity = usePulse();
  const tabScrollRef = useRef<ScrollView>(null);

  // Shared state
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [changingPath, setChangingPath] = useState(false);

  // Picker state
  const [paths, setPaths] = useState<CareerPath[]>([]);
  const [loadingPaths, setLoadingPaths] = useState(true);
  const [selectedPath, setSelectedPath] = useState<CareerPath | null>(null);
  const [level, setLevel] = useState(levels[1].value);
  const [skills, setSkills] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Roadmap state
  const [refreshing, setRefreshing] = useState(false);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [noteMap, setNoteMap] = useState<Record<string, string>>({});
  const [selectedSemester, setSelectedSemester] = useState<number>(1);

  useEffect(() => {
    getCareerPaths()
      .then(setPaths)
      .catch(() => { })
      .finally(() => setLoadingPaths(false));
  }, []);

  const fetchRoadmap = useCallback(async () => {
    if (!state.accessToken || !state.user) {
      setIsLoading(false);
      return;
    }
    try {
      const data = await getRoadmap(state.accessToken, state.user.id);
      setRoadmap(data);
      setError(null);
      setIsGenerating(false);
      setChangingPath(false);
      const firstIncompleteSem = data.milestones
        .filter(m => !m.completed)
        .sort((a, b) => a.semester - b.semester)[0]?.semester;
      const sems = [...new Set(data.milestones.map(m => m.semester))].sort((a, b) => a - b);
      setSelectedSemester(firstIncompleteSem ?? sems[0] ?? 1);
    } catch (e: unknown) {
      const err = e as { status?: number; message?: string };
      if (err.status === 404) {
        setRoadmap(null);
        setError(null);
      } else {
        setError(err.message ?? 'Failed to load roadmap.');
      }
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [state.accessToken, state.user]);

  useFocusEffect(
    useCallback(() => {
      fetchRoadmap();
    }, [fetchRoadmap])
  );

  async function handleGenerate() {
    if (!selectedPath) {
      Alert.alert('Choose a path', 'Please select a career path first.');
      return;
    }
    if (!state.accessToken) {
      Alert.alert('Not authenticated', 'Please log in again.');
      return;
    }
    setIsGenerating(true);
    setGenerateError(null);
    try {
      await generateRoadmap(state.accessToken, {
        careerPath: selectedPath.name,
        academicLevel: level,
        currentSkills: skills,
        role,
      });
      await fetchRoadmap();
    } catch (e: unknown) {
      const err = e as { message?: string };
      setGenerateError(err.message ?? 'Failed to generate roadmap');
    } finally {
      setIsGenerating(false);
    }
  }

  function handleChangePath() {
    Alert.alert(
      'Change Career Path',
      'Your current roadmap will be replaced when you generate a new one.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Change Path', style: 'destructive', onPress: () => setChangingPath(true) },
      ]
    );
  }

  async function handleComplete(milestoneId: string) {
    if (!state.accessToken || !state.user?.id) return;
    setCompletingId(milestoneId);
    try {
      const updated = await completeMilestone(state.accessToken, milestoneId, state.user.id, {
        evidenceNote: noteMap[milestoneId]?.trim() || undefined,
      });
      setNoteMap(prev => { const n = { ...prev }; delete n[milestoneId]; return n; });
      setRoadmap(prev => {
        if (!prev) return null;
        const nextMilestones = prev.milestones.map(m => m.id === milestoneId ? { ...m, completed: true } : m);
        const currentSemMilestones = nextMilestones.filter(m => m.semester === selectedSemester);
        const semAllDone = currentSemMilestones.every(m => m.completed);

        if (semAllDone) {
          const sems = [...new Set(nextMilestones.map(m => m.semester))].sort((a, b) => a - b);
          const currentIdx = sems.indexOf(selectedSemester);
          if (currentIdx >= 0 && currentIdx < sems.length - 1) {
            setTimeout(() => setSelectedSemester(sems[currentIdx + 1]), 300);
          }
        }

        return {
          ...prev,
          progressPercent: updated.progressPercent,
          milestones: nextMilestones,
        };
      });
    } catch (e: unknown) {
      const err = e as { message?: string };
      Alert.alert('Error', err.message ?? 'Failed to complete milestone');
    } finally {
      setCompletingId(null);
    }
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={colors.secondary} />
      </SafeAreaView>
    );
  }

  // ── Error (fetch failure — NOT picker fallback) ────────────────────────────
  if (error) {
    return (
      <SafeAreaView style={styles.centered}>
        <View style={styles.errorIconWrap}>
          <Ionicons name="cloud-offline-outline" size={44} color={colors.outline} />
        </View>
        <Text style={styles.errorStateTitle}>Couldn't load your roadmap</Text>
        <Text style={styles.errorStateSub}>{error}</Text>
        <TouchableOpacity
          style={styles.retryBtn}
          onPress={() => { setIsLoading(true); fetchRoadmap(); }}
        >
          <Ionicons name="refresh-outline" size={17} color={colors.onPrimary} />
          <Text style={styles.retryBtnText}>Try Again</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // ── Recruiters / Admins don't need a personal roadmap ─────────────────────
  if (user?.role === 'RECRUITER' || user?.role === 'ADMIN') {
    return (
      <SafeAreaView style={styles.centered}>
        <View style={styles.errorIconWrap}>
          <Ionicons name="briefcase-outline" size={44} color={colors.outline} />
        </View>
        <Text style={styles.errorStateTitle}>Career roadmap</Text>
        <Text style={styles.errorStateSub}>
          This space is for personal career planning. Use the Opportunities tab to post and manage roles.
        </Text>
      </SafeAreaView>
    );
  }

  // ── Generating overlay ────────────────────────────────────────────────────
  if (isGenerating) {
    return <GeneratingOverlay careerPath={selectedPath?.name ?? 'your career path'} role={role} />;
  }

  // ── Picker view (no roadmap yet, or user chose to change path) ────────────
  if (!roadmap || changingPath) {
    const pathRows: CareerPath[][] = [];
    for (let i = 0; i < paths.length; i += 2) pathRows.push(paths.slice(i, i + 2));
    const canGenerate = !!selectedPath;

    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.pickerHeader}>
          <View style={styles.headerLeft}>
            <View style={styles.logoMark}>
              <Ionicons name="compass" size={16} color={colors.onPrimary} />
            </View>
            <Text style={styles.pickerHeaderTitle}>Career</Text>
          </View>
          {(changingPath || wizardStep > 1) && (
            <TouchableOpacity
              onPress={() => {
                if (wizardStep > 1) setWizardStep(prev => (prev - 1) as 1 | 2 | 3);
                else setChangingPath(false);
              }}
              style={styles.headerLink}
            >
              <Ionicons name="chevron-back" size={14} color={colors.tertiary} />
              <Text style={styles.headerLinkText}>{wizardStep > 1 ? 'Back' : 'Back to roadmap'}</Text>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <AnimatedFadeIn style={styles.heroCard} delay={100}>
            <Text style={styles.heroTitle}>Build your{'\n'}career roadmap</Text>
            <Text style={styles.heroSubtitle}>
              {role === 'ALUMNI'
                ? 'AI-powered career milestones — tailored to your professional stage.'
                : 'AI-powered, semester-by-semester — tailored to you at KNUST.'}
            </Text>
          </AnimatedFadeIn>

          {generateError && (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle-outline" size={15} color={colors.error} />
              <Text style={styles.errorBannerText}>{generateError}</Text>
            </View>
          )}

          {wizardStep === 1 && (
            <>
              <View style={styles.stepHeader}>
                <View style={styles.stepNum}><Text style={styles.stepNumText}>1</Text></View>
                <Text style={styles.stepTitle}>Choose your career path</Text>
              </View>

              {loadingPaths ? (
                <ActivityIndicator style={{ marginVertical: spacing.lg }} color={colors.secondary} />
              ) : (
                <View style={styles.pathGrid}>
                  {pathRows.map((row, ri) => (
                    <View key={ri} style={styles.pathRow}>
                      {row.map(path => {
                        const meta = getPathMeta(path.name);
                        const isSelected = selectedPath?.id === path.id;
                        return (
                          <AnimatedPressable
                            key={path.id}
                            style={styles.pathCard}
                            isActive={isSelected}
                            onPress={() => {
                              setSelectedPath(isSelected ? null : path);
                              if (!isSelected) {
                                setTimeout(() => setWizardStep(2), 250);
                              }
                            }}
                          >
                            <View style={[styles.pathIconWrap, { backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : `${meta.color}15` }]}>
                              <Ionicons name={meta.icon} size={26} color={isSelected ? colors.onPrimary : meta.color} />
                            </View>
                            <ActiveText style={styles.pathName} numberOfLines={2}>
                              {path.name}
                            </ActiveText>
                            <View style={[styles.demandPill, isSelected ? { backgroundColor: 'rgba(255,255,255,0.2)' } : { backgroundColor: `${meta.color}12` }]}>
                              <ActiveText style={[styles.demandText, { color: isSelected ? colors.onPrimary : meta.color }]}>
                                {meta.demand}
                              </ActiveText>
                            </View>
                            {isSelected && (
                              <View style={styles.pathCheckmark}>
                                <Ionicons name="checkmark-circle" size={18} color={colors.onPrimary} />
                              </View>
                            )}
                          </AnimatedPressable>
                        );
                      })}
                      {row.length === 1 && <View style={styles.pathCardPlaceholder} />}
                    </View>
                  ))}
                </View>
              )}

              <TouchableOpacity
                style={[styles.generateBtn, !canGenerate && styles.generateBtnDisabled, { marginTop: spacing.xl }]}
                onPress={() => setWizardStep(2)}
                disabled={!canGenerate}
                activeOpacity={0.85}
              >
                <View>
                  <Text style={styles.generateBtnText}>Continue to Step 2</Text>
                </View>
                <Ionicons name="arrow-forward" size={18} color={colors.onPrimary} style={{ marginLeft: 'auto' }} />
              </TouchableOpacity>
              {!canGenerate && <Text style={styles.generateHint}>Select a career path to continue</Text>}
            </>
          )}

          {wizardStep === 2 && (
            <>
              <View style={styles.stepHeader}>
                <View style={styles.stepNum}><Text style={styles.stepNumText}>2</Text></View>
                <Text style={styles.stepTitle}>{role === 'ALUMNI' ? 'Your career stage' : 'Your academic level'}</Text>
              </View>

              <View style={styles.levelTrack}>
                {levels.map((l, idx) => {
                  const isSelected = level === l.value;
                  const isPast = role === 'STUDENT' && levels.findIndex(x => x.value === level) > idx;
                  return (
                    <View key={l.value} style={styles.levelStep}>
                      {idx < levels.length - 1 && (
                        <View style={[styles.levelConnector, (isSelected || isPast) && role === 'STUDENT' && styles.levelConnectorActive]} />
                      )}
                      <TouchableOpacity
                        style={[styles.levelNode, isSelected && styles.levelNodeSelected, isPast && styles.levelNodePast]}
                        onPress={() => setLevel(l.value)}
                      >
                        {isPast
                          ? <Ionicons name="checkmark" size={14} color={colors.onPrimary} />
                          : <Text style={[styles.levelNodeText, isSelected && styles.levelNodeTextSelected]}>{l.label}</Text>
                        }
                      </TouchableOpacity>
                      <Text style={[styles.levelYear, isSelected && styles.levelYearSelected]}>{l.sublabel}</Text>
                    </View>
                  );
                })}
              </View>

              <View style={[styles.levelContextCard, { borderColor: colors.outlineVariant }]}>
                <Ionicons name="information-circle-outline" size={15} color={colors.onSurfaceVariant} />
                <Text style={styles.levelContextText}>
                  {role === 'ALUMNI'
                    ? <>We'll tailor milestones for an <Text style={{ color: colors.primary, fontFamily: 'Inter_500Medium' }}>{levels.find(l2 => l2.value === level)?.sublabel ?? level}</Text> professional.</>
                    : <>We'll generate milestones from <Text style={{ color: colors.primary, fontFamily: 'Inter_500Medium' }}>{levels.find(l2 => l2.value === level)?.sublabel ?? level}</Text> onwards — skipping semesters you've already completed.</>}
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.generateBtn, { marginTop: spacing.xl }]}
                onPress={() => setWizardStep(3)}
                activeOpacity={0.85}
              >
                <View>
                  <Text style={styles.generateBtnText}>Continue to Step 3</Text>
                </View>
                <Ionicons name="arrow-forward" size={18} color={colors.onPrimary} style={{ marginLeft: 'auto' }} />
              </TouchableOpacity>
            </>
          )}

          {wizardStep === 3 && (
            <>
              <View style={styles.stepHeader}>
                <View style={styles.stepNum}><Text style={styles.stepNumText}>3</Text></View>
                <Text style={styles.stepTitle}>Your current skills</Text>
              </View>

              <SkillTagInput skills={skills} onChange={setSkills} />
              <Text style={styles.inputHint}>
                Type a skill and press comma or return to add it. The AI uses these to personalise your milestones.
              </Text>

              <TouchableOpacity
                style={[styles.generateBtn, !canGenerate && styles.generateBtnDisabled, { marginTop: spacing.xl }]}
                onPress={handleGenerate}
                disabled={!canGenerate}
                activeOpacity={0.85}
              >
                <Ionicons name="sparkles" size={19} color={colors.onPrimary} />
                <View>
                  <Text style={styles.generateBtnText}>Generate My Roadmap</Text>
                  {selectedPath && (
                    <Text style={styles.generateBtnSub}>{selectedPath.name} · {level}</Text>
                  )}
                </View>
                <Ionicons name="arrow-forward" size={18} color={colors.onPrimary} style={{ marginLeft: 'auto' }} />
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Roadmap view ──────────────────────────────────────────────────────────
  const grouped = groupBySemester(roadmap.milestones);
  const semesters = Object.keys(grouped).map(Number).sort((a, b) => a - b);
  const firstIncompleteId = roadmap.milestones
    .slice().sort((a, b) => a.semester - b.semester || a.order - b.order)
    .find(m => !m.completed)?.id;

  const doneCount = roadmap.milestones.filter(m => m.completed).length;
  const totalCount = roadmap.milestones.length;

  const currentMilestones = (grouped[selectedSemester] ?? []).slice().sort((a, b) => a.order - b.order);
  const semDone = currentMilestones.filter(m => m.completed).length;
  const semTotal = currentMilestones.length;
  const semAllDone = semDone === semTotal;
  const currentIdx = semesters.indexOf(selectedSemester);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.roadmapHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.roadmapHeaderTitle} numberOfLines={1}>{roadmap.careerPath}</Text>
          <Text style={styles.roadmapHeaderSub}>AI Career Roadmap</Text>
        </View>
        <TouchableOpacity
          style={styles.changePathBtn}
          onPress={handleChangePath}
          accessibilityLabel="Change career path"
        >
          <Ionicons name="swap-horizontal-outline" size={19} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.progressStrip}>
        <View style={styles.progressStripRow}>
          <Text style={styles.progressStripLabel}>{doneCount} of {totalCount} milestones complete</Text>
          <Text style={styles.progressStripPct}>{roadmap.progressPercent}%</Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.min(roadmap.progressPercent, 100)}%` }]} />
        </View>
      </View>

      {/* Fitts's Law-Compliant Spacious Semester & Year Selection Cards */}
      <View style={styles.semesterCardsWrap}>
        <Text style={styles.sectionEyebrow}>SELECT SEMESTER / YEAR</Text>
        <ScrollView
          ref={tabScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.md }}
        >
          {semesters.map(sem => {
            const semMs = grouped[sem] ?? [];
            const semDoneCount = semMs.filter(m => m.completed).length;
            const allDone = semDoneCount === semMs.length && semMs.length > 0;
            const hasNext = semMs.some(m => m.id === firstIncompleteId);
            const isSelected = sem === selectedSemester;
            return (
              <AnimatedPressable
                key={sem}
                style={[
                  styles.spaciousSemesterCard,
                  allDone && !isSelected && styles.spaciousSemesterCardDone
                ]}
                isActive={isSelected}
                onPress={() => setSelectedSemester(sem)}
              >
                <View style={styles.spaciousSemTop}>
                  <ActiveText style={styles.spaciousSemYearLabel}>
                    {periodShort(role, sem)}
                  </ActiveText>
                  {allDone ? (
                    <Ionicons name="checkmark-circle" size={16} color={isSelected ? colors.onPrimary : colors.secondary} />
                  ) : hasNext && !isSelected ? (
                    <View style={styles.tabActiveDot} />
                  ) : null}
                </View>

                <View>
                  <ActiveText style={styles.spaciousSemProgressText}>
                    {semDoneCount}/{semMs.length} Milestones
                  </ActiveText>
                  <View style={[styles.semMiniBarTrack, isSelected && { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
                    <View
                      style={[
                        styles.semMiniBarFill,
                        isSelected && { backgroundColor: colors.onPrimary },
                        { width: semMs.length > 0 ? `${(semDoneCount / semMs.length) * 100}%` : '0%' }
                      ]}
                    />
                  </View>
                </View>
              </AnimatedPressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchRoadmap(); }}
            tintColor={colors.secondary}
          />
        }
      >
        <View style={styles.semHeading}>
          <Text style={styles.semTitle}>{periodLabel(role, selectedSemester)}</Text>
          <View style={[styles.semPill, semAllDone && styles.semPillDone]}>
            {semAllDone ? <Ionicons name="checkmark-circle" size={13} color={colors.secondary} /> : null}
            <Text style={[styles.semPillText, semAllDone && styles.semPillTextDone]}>
              {semAllDone ? 'Complete' : `${semDone}/${semTotal} done`}
            </Text>
          </View>
        </View>

        <View style={styles.stepDots}>
          {currentMilestones.map(m => (
            <View
              key={m.id}
              style={[styles.stepDot, m.completed && styles.stepDotDone, m.id === firstIncompleteId && styles.stepDotActive]}
            />
          ))}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalMilestoneScroll}
          decelerationRate="fast"
          snapToInterval={310}
        >
          {currentMilestones.map(milestone => {
            if (milestone.completed) return (
              <View key={milestone.id} style={styles.cardContainerHorizontal}>
                <CompletedRow milestone={milestone} />
              </View>
            );
            if (milestone.id === firstIncompleteId) {
              return (
                <View key={milestone.id} style={styles.cardContainerHorizontal}>
                  <UpNextCard
                    milestone={milestone}
                    onComplete={() => handleComplete(milestone.id)}
                    completing={completingId === milestone.id}
                    noteValue={noteMap[milestone.id] ?? ''}
                    onNoteChange={text => setNoteMap(prev => ({ ...prev, [milestone.id]: text }))}
                    pulseOpacity={pulseOpacity}
                  />
                </View>
              );
            }
            return (
              <View key={milestone.id} style={styles.cardContainerHorizontal}>
                <UpcomingCard
                  milestone={milestone}
                  onComplete={() => handleComplete(milestone.id)}
                  completing={completingId === milestone.id}
                  noteValue={noteMap[milestone.id] ?? ''}
                  onNoteChange={text => setNoteMap(prev => ({ ...prev, [milestone.id]: text }))}
                />
              </View>
            );
          })}
        </ScrollView>

        <View style={styles.semNav}>
          <TouchableOpacity
            style={[styles.navBtn, currentIdx === 0 && styles.navBtnDisabled]}
            onPress={() => currentIdx > 0 && setSelectedSemester(semesters[currentIdx - 1])}
            disabled={currentIdx === 0}
          >
            <Ionicons name="chevron-back" size={17} color={currentIdx === 0 ? colors.outline : colors.onPrimary} />
            <Text style={[styles.navBtnText, currentIdx === 0 && styles.navBtnTextDisabled]}>Prev</Text>
          </TouchableOpacity>
          <Text style={styles.navPageText}>{currentIdx + 1} / {semesters.length}</Text>
          <TouchableOpacity
            style={[styles.navBtn, currentIdx === semesters.length - 1 && styles.navBtnDisabled]}
            onPress={() => currentIdx < semesters.length - 1 && setSelectedSemester(semesters[currentIdx + 1])}
            disabled={currentIdx === semesters.length - 1}
          >
            <Text style={[styles.navBtnText, currentIdx === semesters.length - 1 && styles.navBtnTextDisabled]}>Next</Text>
            <Ionicons name="chevron-forward" size={17} color={currentIdx === semesters.length - 1 ? colors.outline : colors.onPrimary} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  centered: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: colors.surface, padding: spacing.xl, gap: spacing.sm,
  },

  /* Error state */
  errorIconWrap: {
    width: 88, height: 88, borderRadius: radius.full,
    backgroundColor: colors.surfaceContainerLow,
    justifyContent: 'center', alignItems: 'center', marginBottom: spacing.md,
  },
  errorStateTitle: { ...typography.headlineSm, color: colors.primary, textAlign: 'center' },
  errorStateSub: { ...typography.bodyMd, color: colors.onSurfaceVariant, textAlign: 'center', marginBottom: spacing.lg },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.secondary, borderRadius: radius.lg,
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
  },
  retryBtnText: { ...typography.labelMd, color: colors.onPrimary },

  /* Generating overlay */
  generatingContainer: {
    flex: 1, backgroundColor: colors.surface,
    justifyContent: 'center', alignItems: 'center', padding: spacing.xl,
  },
  generatingVisual: { marginBottom: spacing.xl },
  generatingIconWrap: { width: 88, height: 88, borderRadius: 44, backgroundColor: `${colors.tertiary}15`, justifyContent: 'center', alignItems: 'center' },
  generatingTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 26, color: colors.primary, textAlign: 'center', marginBottom: spacing.xs },
  generatingPath: { fontFamily: 'Inter_500Medium', fontSize: 15, color: colors.tertiary, textAlign: 'center', marginBottom: spacing.xl },
  generatingStep: { ...typography.labelMd, color: colors.onSurfaceVariant, textAlign: 'center', marginBottom: spacing.lg },
  generatingNote: { ...typography.bodyMd, fontSize: 13, lineHeight: 20, color: colors.outline, textAlign: 'center', marginBottom: spacing.xl },
  generatingDots: { flexDirection: 'row', gap: spacing.sm },
  generatingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.tertiary },

  /* Picker header */
  pickerHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + 2,
    backgroundColor: colors.surface,
    borderBottomWidth: 0,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  logoMark: { width: 30, height: 30, borderRadius: radius.md, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  pickerHeaderTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: colors.primary },
  headerLink: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  headerLinkText: { ...typography.labelMd, color: colors.tertiary },

  /* Picker scroll */
  scrollContent: { padding: spacing.lg, paddingBottom: spacing.xxl + 100 },
  heroCard: {
    marginBottom: spacing.xl,
    backgroundColor: colors.surfaceCard,
    padding: spacing.xl,
    borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.outlineVariant,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 2
  },
  heroTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 30, lineHeight: 38, color: colors.primary, marginBottom: spacing.sm },
  heroSubtitle: { ...typography.bodyMd, color: colors.onSurfaceVariant, lineHeight: 22 },

  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.errorContainer,
    borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md,
  },
  errorBannerText: { ...typography.labelMd, color: colors.error, flex: 1 },

  stepHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md, marginTop: spacing.lg },
  stepNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  stepNumText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: colors.onPrimary },
  stepTitle: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 16, color: colors.primary },

  pathGrid: { gap: spacing.sm },
  pathRow: { flexDirection: 'row', gap: spacing.sm },
  pathCard: {
    flex: 1, backgroundColor: colors.surfaceCard, borderRadius: radius.xl,
    padding: spacing.md, borderWidth: 1.5, borderColor: colors.outlineVariant,
    gap: spacing.sm, position: 'relative', minHeight: 150,
  },
  pathCardPlaceholder: { flex: 1 },
  pathIconWrap: { width: 50, height: 50, borderRadius: radius.lg, justifyContent: 'center', alignItems: 'center', alignSelf: 'flex-start' },
  pathName: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, lineHeight: 20, color: colors.primary, flex: 1 },
  pathNameSelected: { color: colors.onPrimary },
  demandPill: { borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  demandText: { ...typography.labelSm, fontSize: 10 },
  pathCheckmark: { position: 'absolute', top: spacing.sm, right: spacing.sm },

  levelTrack: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: spacing.xs, marginBottom: spacing.md },
  levelStep: { alignItems: 'center', flex: 1, position: 'relative' },
  levelConnector: { position: 'absolute', top: 16, left: '50%', right: '-50%', height: 2, backgroundColor: colors.outlineVariant, zIndex: 0 },
  levelConnectorActive: { backgroundColor: colors.secondary },
  levelNode: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surfaceContainerLow, borderWidth: 2, borderColor: colors.outlineVariant, justifyContent: 'center', alignItems: 'center', zIndex: 1 },
  levelNodeSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  levelNodePast: { backgroundColor: colors.secondary, borderColor: colors.secondary },
  levelNodeText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, color: colors.onSurfaceVariant },
  levelNodeTextSelected: { color: colors.onPrimary },
  levelYear: { ...typography.labelSm, fontSize: 11, color: colors.onSurfaceVariant, marginTop: spacing.xs, textAlign: 'center' },
  levelYearSelected: { color: colors.primary, fontFamily: 'Inter_600SemiBold' },
  levelContextCard: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, backgroundColor: colors.surfaceContainerLow, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, marginBottom: spacing.sm },
  levelContextText: { ...typography.labelSm, color: colors.onSurfaceVariant, flex: 1, lineHeight: 18, fontFamily: 'Inter_400Regular' },

  tagContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, backgroundColor: colors.surfaceCard, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.outlineVariant, padding: spacing.md, minHeight: 54 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: `${colors.tertiary}12`, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: `${colors.tertiary}30` },
  tagText: { ...typography.labelSm, color: colors.tertiary, fontSize: 12 },
  tagInput: { ...typography.bodyMd, color: colors.onSurface, fontSize: 14, minWidth: 120, paddingVertical: 2 },
  inputHint: { ...typography.labelSm, color: colors.outline, marginTop: spacing.xs, lineHeight: 17, fontFamily: 'Inter_400Regular' },

  generateBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.secondary, borderRadius: radius.xl, paddingVertical: spacing.lg, paddingHorizontal: spacing.lg, marginTop: spacing.xl },
  generateBtnDisabled: { opacity: 0.45 },
  generateBtnText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 17, color: colors.onPrimary },
  generateBtnSub: { ...typography.labelSm, color: 'rgba(255,255,255,0.65)', marginTop: 1 },
  generateHint: { ...typography.labelSm, color: colors.outline, textAlign: 'center', marginTop: spacing.md, fontFamily: 'Inter_400Regular' },

  /* Roadmap header */
  roadmapHeader: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 0,
  },
  roadmapHeaderTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 17, color: colors.primary },
  roadmapHeaderSub: { ...typography.labelSm, color: colors.onSurfaceVariant, marginTop: 1 },
  changePathBtn: { width: 38, height: 38, borderRadius: radius.full, backgroundColor: colors.surfaceContainerLow, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },

  /* Progress strip */
  progressStrip: { backgroundColor: colors.secondary, paddingHorizontal: spacing.lg, paddingTop: spacing.sm + 2, paddingBottom: spacing.md, borderBottomLeftRadius: radius.xl, borderBottomRightRadius: radius.xl, shadowColor: colors.secondary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 3 },
  progressStripRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  progressStripLabel: { ...typography.labelSm, color: 'rgba(255,255,255,0.85)' },
  progressStripPct: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: colors.onPrimary },
  progressTrack: { height: 8, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: radius.full, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.onPrimary, borderRadius: radius.full },

  /* Semester cards — Fitts's Law compliant */
  semesterCardsWrap: {
    paddingVertical: spacing.md,
    backgroundColor: colors.surfaceCard,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  sectionEyebrow: {
    ...typography.labelSm,
    fontSize: 10,
    color: colors.onSurfaceVariant,
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  spaciousSemesterCard: {
    width: 155,
    minHeight: 74,
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radius.lg,
    padding: spacing.sm + 4,
    borderWidth: 1.5,
    borderColor: colors.outlineVariant,
    justifyContent: 'space-between',
  },
  spaciousSemesterCardSelected: {
    backgroundColor: colors.secondary,
    borderColor: colors.secondary,
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  spaciousSemesterCardDone: {
    backgroundColor: colors.successContainer,
    borderColor: `${colors.secondary}35`,
  },
  spaciousSemTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  spaciousSemYearLabel: {
    ...typography.labelSm,
    fontSize: 13,
    color: colors.onSurface,
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  spaciousSemProgressText: {
    ...typography.labelSm,
    fontSize: 10,
    color: colors.onSurfaceVariant,
    marginBottom: 4,
  },
  semMiniBarTrack: {
    height: 4,
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  semMiniBarFill: {
    height: '100%',
    backgroundColor: colors.secondary,
    borderRadius: radius.full,
  },

  /* Semester tabs */
  tabBarWrap: { backgroundColor: colors.surfaceCard, borderBottomWidth: 1, borderBottomColor: colors.outlineVariant },
  tabBarContent: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.xs, flexDirection: 'row' },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.full, backgroundColor: colors.surfaceContainerLow, borderWidth: 1, borderColor: colors.outlineVariant },
  tabSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabDone: { backgroundColor: colors.successContainer, borderColor: `${colors.secondary}35` },
  tabActiveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.tertiary },
  tabText: { ...typography.labelSm, color: colors.onSurfaceVariant, fontSize: 12 },
  tabTextSelected: { color: colors.onPrimary },
  tabTextDone: { color: colors.secondary },
  tabCount: { ...typography.labelSm, color: colors.outline, fontSize: 10 },
  tabCountSelected: { color: 'rgba(255,255,255,0.6)' },

  /* Semester content */
  semHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  semTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 20, color: colors.primary },
  semPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.surfaceContainerLow, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: colors.outlineVariant },
  semPillDone: { backgroundColor: colors.successContainer, borderColor: `${colors.secondary}35` },
  semPillText: { ...typography.labelSm, color: colors.onSurfaceVariant, fontSize: 11 },
  semPillTextDone: { color: colors.secondary },

  stepDots: { flexDirection: 'row', gap: 6, marginBottom: spacing.lg },
  stepDot: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.outlineVariant },
  stepDotDone: { backgroundColor: colors.secondary },
  stepDotActive: { backgroundColor: colors.tertiary },

  milestoneList: { gap: spacing.sm },
  horizontalMilestoneScroll: { gap: spacing.md, paddingBottom: spacing.md, paddingRight: spacing.lg },
  cardContainerHorizontal: { width: 310 },

  /* Completed row */
  completedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surfaceCard, borderRadius: radius.lg, paddingVertical: 12, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.outlineVariant },
  completedCheck: { width: 26, height: 26, borderRadius: radius.full, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  completedTitle: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 14, color: colors.onSurfaceVariant, textDecorationLine: 'line-through' },
  completedTypeBadge: { borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3, flexShrink: 0 },
  completedTypeText: { ...typography.labelSm, fontSize: 10 },

  /* Up Next card */
  upNextCard: { flexDirection: 'row', backgroundColor: colors.surfaceCard, borderRadius: radius.lg, borderWidth: 1, borderColor: `${colors.tertiary}35`, overflow: 'hidden', shadowColor: colors.tertiary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 3 },
  upNextAccent: { width: 4, flexShrink: 0 },
  upNextInner: { flex: 1, padding: spacing.md },
  upNextHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  upNextLiveRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.tertiary },
  upNextEyebrow: { ...typography.labelSm, color: colors.tertiary, fontSize: 10, letterSpacing: 0.8 },
  typePill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1 },
  typePillText: { ...typography.labelSm, fontSize: 10 },
  upNextTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 17, lineHeight: 23, color: colors.primary, marginBottom: spacing.xs },
  upNextDesc: { ...typography.bodyMd, fontSize: 13, lineHeight: 19, color: colors.onSurfaceVariant, marginBottom: spacing.md },
  evidenceInput: { backgroundColor: colors.surfaceContainerLow, borderRadius: radius.md, borderWidth: 1, borderColor: colors.outlineVariant, padding: spacing.md, fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.onSurface, minHeight: 72, textAlignVertical: 'top', marginBottom: spacing.sm },
  upNextActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, marginTop: spacing.xs },
  evidenceToggle: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 6, paddingHorizontal: spacing.sm },
  evidenceToggleText: { ...typography.labelSm, color: colors.onSurfaceVariant, fontSize: 12 },
  completeBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.secondary, borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: spacing.md, flex: 1, justifyContent: 'center' },
  completeBtnLoading: { opacity: 0.65 },
  completeBtnText: { ...typography.labelMd, color: colors.onPrimary },

  /* Upcoming card */
  upcomingCard: { backgroundColor: colors.surfaceCard, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.outlineVariant, overflow: 'hidden' },
  upcomingHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 13, paddingHorizontal: spacing.md },
  upcomingIconCircle: { width: 30, height: 30, borderRadius: radius.full, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  upcomingTitle: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 14, color: colors.onSurface, lineHeight: 20 },
  upcomingBody: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, borderTopWidth: 1, borderTopColor: colors.outlineVariant, paddingTop: spacing.md, gap: spacing.sm },
  upcomingDesc: { ...typography.bodyMd, fontSize: 13, lineHeight: 19, color: colors.onSurfaceVariant },
  upcomingActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  evidenceToggleSmall: { width: 34, height: 34, borderRadius: radius.full, backgroundColor: colors.surfaceContainerLow, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.outlineVariant },
  completeBtnOutlined: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderColor: colors.secondary, borderRadius: radius.md, paddingVertical: 9 },
  completeBtnOutlinedText: { ...typography.labelMd, color: colors.secondary },

  /* Semester navigation */
  semNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xl, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.outlineVariant },
  navBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.secondary, shadowColor: colors.secondary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 2 },
  navBtnDisabled: { opacity: 0.35, backgroundColor: colors.surfaceContainerHigh },
  navBtnText: { ...typography.labelMd, color: colors.onPrimary, fontSize: 13 },
  navBtnTextDisabled: { color: colors.outline },
  navPageText: { ...typography.labelSm, color: colors.onSurfaceVariant },
});
