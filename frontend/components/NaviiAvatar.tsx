import { useState } from 'react';
import { Image, View, Text, StyleSheet, type ImageStyle, type StyleProp } from 'react-native';
import { colors, typography } from '@/constants/theme';

interface NaviiAvatarProps {
  seed: string | undefined;
  size?: number;
  fallback?: string;
  style?: StyleProp<ImageStyle>;
}

export function NaviiAvatar({ seed, size = 44, fallback = '?', style }: NaviiAvatarProps) {
  const [failed, setFailed] = useState(false);

  const containerStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
  };

  if (!seed || failed) {
    return (
      <View style={[styles.fallback, containerStyle, style]}>
        <Text style={[styles.fallbackText, { fontSize: size * 0.4 }]}>{fallback}</Text>
      </View>
    );
  }

  const uri = `https://api.navii.dev/avatar/${encodeURIComponent(seed)}.png?size=${Math.round(size * 2)}&tileBg=auto`;

  return (
    <Image
      source={{ uri }}
      style={[containerStyle, style]}
      onError={() => setFailed(true)}
      accessibilityLabel="User avatar"
    />
  );
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  fallbackText: {
    ...typography.labelMd,
    color: colors.onPrimary,
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
});
