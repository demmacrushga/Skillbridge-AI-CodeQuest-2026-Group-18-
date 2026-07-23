import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';
import { colors, typography, spacing } from '@/constants/theme';
import { GlobalChatbot } from '@/components/GlobalChatbot';
import { GlobalToast } from '@/components/ui/Toast';
import { useAuth } from '@/context/AuthContext';

interface TabIconProps {
  name: keyof typeof Ionicons.glyphMap;
  focusedName: keyof typeof Ionicons.glyphMap;
  color: string;
  focused: boolean;
}

function TabIcon({ name, focusedName, color, focused }: TabIconProps) {
  return <Ionicons name={focused ? focusedName : name} size={24} color={color} />;
}

export default function AppLayout() {
  const { state } = useAuth();
  const role = state.user?.role;
  const isRecruiter = role === 'RECRUITER';
  const isAlumni = role === 'ALUMNI';
  const isStudent = !isRecruiter && !isAlumni;

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          animation: 'fade',
          tabBarActiveTintColor: colors.secondary,
          tabBarInactiveTintColor: colors.outline,
          tabBarStyle: styles.tabBar,
          tabBarLabelStyle: styles.tabLabel,
        }}
      >
        {/* Student Tabs */}
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            href: isStudent ? undefined : null,
            tabBarIcon: ({ color, focused }) => (
              <TabIcon name="home-outline" focusedName="home" color={color} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="career"
          options={{
            title: 'Explore',
            href: isStudent ? undefined : null,
            tabBarIcon: ({ color, focused }) => (
              <TabIcon name="compass-outline" focusedName="compass" color={color} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="portfolio"
          options={{
            title: 'Portfolio',
            href: isStudent ? undefined : null,
            tabBarIcon: ({ color, focused }) => (
              <TabIcon name="briefcase-outline" focusedName="briefcase" color={color} focused={focused} />
            ),
          }}
        />

        {/* Recruiter Tabs */}
        <Tabs.Screen
          name="recruiter/index"
          options={{
            title: 'Dashboard',
            href: isRecruiter ? undefined : null,
            tabBarIcon: ({ color, focused }) => (
              <TabIcon name="grid-outline" focusedName="grid" color={color} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="recruiter/postings"
          options={{
            title: 'Postings',
            href: isRecruiter ? undefined : null,
            tabBarIcon: ({ color, focused }) => (
              <TabIcon name="list-outline" focusedName="list" color={color} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="recruiter/all-applicants"
          options={{
            title: 'Applicants',
            href: isRecruiter ? undefined : null,
            tabBarIcon: ({ color, focused }) => (
              <TabIcon name="people-outline" focusedName="people" color={color} focused={focused} />
            ),
          }}
        />

        {/* Alumni Educator Tabs */}
        <Tabs.Screen
          name="alumni/index"
          options={{
            title: 'Mentorship',
            href: isAlumni ? undefined : null,
            tabBarIcon: ({ color, focused }) => (
              <TabIcon name="easel-outline" focusedName="easel" color={color} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="alumni/requests"
          options={{
            title: 'Mentees',
            href: isAlumni ? undefined : null,
            tabBarIcon: ({ color, focused }) => (
              <TabIcon name="people-outline" focusedName="people" color={color} focused={focused} />
            ),
          }}
        />

        {/* Shared Tab */}
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, focused }) => (
              <TabIcon name="person-outline" focusedName="person" color={color} focused={focused} />
            ),
          }}
        />

        {/* Hidden sub-screens */}
        <Tabs.Screen name="skill-gap" options={{ href: null }} />
        <Tabs.Screen name="career-paths" options={{ href: null }} />
        <Tabs.Screen name="roadmap" options={{ href: null }} />
        <Tabs.Screen name="mock-interview" options={{ href: null }} />
        <Tabs.Screen name="gap-report" options={{ href: null, tabBarStyle: { display: 'none' } }} />
        <Tabs.Screen name="portfolio-review" options={{ href: null, tabBarStyle: { display: 'none' } }} />
        <Tabs.Screen name="mock-interview-session" options={{ href: null, tabBarStyle: { display: 'none' } }} />
        <Tabs.Screen name="mock-interview-report" options={{ href: null, tabBarStyle: { display: 'none' } }} />
        <Tabs.Screen name="opportunities" options={{ href: null }} />
        <Tabs.Screen name="opportunities-manage" options={{ href: null }} />
        <Tabs.Screen name="challenges" options={{ href: null }} />
        <Tabs.Screen name="challenges-manage" options={{ href: null }} />
        <Tabs.Screen name="recruiter/post" options={{ href: null, tabBarStyle: { display: 'none' } }} />
        <Tabs.Screen name="recruiter/applicants" options={{ href: null, tabBarStyle: { display: 'none' } }} />
        <Tabs.Screen name="recruiter/applicant-portfolio" options={{ href: null, tabBarStyle: { display: 'none' } }} />
        <Tabs.Screen name="mentorship" options={{ href: null }} />
        <Tabs.Screen name="mentorship-manage" options={{ href: null }} />
        <Tabs.Screen name="help-support" options={{ href: null }} />
        <Tabs.Screen name="about" options={{ href: null }} />
        <Tabs.Screen name="notifications" options={{ href: null }} />
        <Tabs.Screen name="achievements" options={{ href: null, tabBarStyle: { display: 'none' } }} />
      </Tabs>
      <GlobalChatbot />
      <GlobalToast />
    </>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.surfaceCard,
    borderTopColor: colors.outlineVariant,
    borderTopWidth: 1,
    height: 72,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  tabLabel: {
    ...typography.labelSm,
    marginTop: spacing.xs,
  },
});
