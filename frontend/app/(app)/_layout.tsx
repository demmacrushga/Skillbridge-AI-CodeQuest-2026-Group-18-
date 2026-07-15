import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';
import { colors, typography, spacing } from '@/constants/theme';

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
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.secondary,
        tabBarInactiveTintColor: colors.outline,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="home-outline" focusedName="home" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="skill-gap"
        options={{
          title: 'Skills',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name="analytics-outline"
              focusedName="analytics"
              color={color}
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="career"
        options={{
          title: 'Career',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name="compass-outline"
              focusedName="compass"
              color={color}
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="career-paths"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="roadmap"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="portfolio"
        options={{
          title: 'Portfolio',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name="briefcase-outline"
              focusedName="briefcase"
              color={color}
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="mock-interview"
        options={{
          title: 'Interview',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name="mic-outline"
              focusedName="mic"
              color={color}
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name="person-outline"
              focusedName="person"
              color={color}
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="gap-report"
        options={{
          href: null,
          tabBarStyle: { display: 'none' },
        }}
      />
      <Tabs.Screen
        name="portfolio-review"
        options={{
          href: null,
          tabBarStyle: { display: 'none' },
        }}
      />
      <Tabs.Screen
        name="mock-interview-session"
        options={{
          href: null,
          tabBarStyle: { display: 'none' },
        }}
      />
      <Tabs.Screen
        name="mock-interview-report"
        options={{
          href: null,
          tabBarStyle: { display: 'none' },
        }}
      />
    </Tabs>
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
