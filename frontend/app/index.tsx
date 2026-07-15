import { Redirect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { View, ActivityIndicator } from 'react-native';
import { colors } from '@/constants/theme';

export default function Index() {
  const { state } = useAuth();

  if (state.isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surface }}>
        <ActivityIndicator size="large" color={colors.secondary} />
      </View>
    );
  }

  return state.user
    ? <Redirect href="/(app)" />
    : <Redirect href="/(auth)/welcome" />;
}
