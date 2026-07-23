import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TextInputProps,
  StyleSheet,
  Animated,
  TouchableOpacity,
  StyleProp,
  ViewStyle,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, typography, spacing, radius } from '@/constants/theme';

interface AnimatedTextInputProps extends TextInputProps {
  label?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  error?: string;
  isPassword?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
}

export function AnimatedTextInput({
  label,
  icon,
  error,
  isPassword = false,
  containerStyle,
  onFocus,
  onBlur,
  secureTextEntry,
  style,
  ...props
}: AnimatedTextInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Animated values for focus transition
  const focusAnim = useRef(new Animated.Value(0)).current;

  const handleFocus = (e: any) => {
    setIsFocused(true);
    Animated.timing(focusAnim, {
      toValue: 1,
      duration: 220,
      useNativeDriver: false,
    }).start();
    if (onFocus) onFocus(e);
  };

  const handleBlur = (e: any) => {
    setIsFocused(false);
    Animated.timing(focusAnim, {
      toValue: 0,
      duration: 220,
      useNativeDriver: false,
    }).start();
    if (onBlur) onBlur(e);
  };

  const borderColor = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [error ? colors.error : colors.outlineVariant, error ? colors.error : colors.secondary],
  });

  const backgroundColor = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [error ? '#FFF5F5' : colors.surfaceCard, '#F0FDF4'],
  });

  const scale = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.01],
  });

  return (
    <View style={[styles.fieldContainer, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <Animated.View
        style={[
          styles.inputWrapper,
          {
            borderColor,
            backgroundColor,
            transform: [{ scale }],
          },
        ]}
      >
        {icon ? (
          <Ionicons
            name={icon}
            size={18}
            color={isFocused ? colors.secondary : error ? colors.error : colors.outline}
          />
        ) : null}

        <TextInput
          style={[styles.input, style]}
          onFocus={handleFocus}
          onBlur={handleBlur}
          secureTextEntry={isPassword ? !showPassword : secureTextEntry}
          placeholderTextColor={colors.outline}
          {...props}
        />

        {isPassword ? (
          <TouchableOpacity
            onPress={() => setShowPassword((v) => !v)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
          >
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={isFocused ? colors.secondary : colors.outline}
            />
          </TouchableOpacity>
        ) : null}
      </Animated.View>

      {error ? <Text style={styles.inlineError}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fieldContainer: {
    gap: 6,
  },
  label: {
    ...typography.labelMd,
    color: colors.onSurface,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    minHeight: 52,
  },
  input: {
    flex: 1,
    ...typography.bodyMd,
    color: colors.onSurface,
    paddingVertical: spacing.xs,
  },
  inlineError: {
    ...typography.labelSm,
    color: colors.error,
    marginTop: 2,
  },
});
