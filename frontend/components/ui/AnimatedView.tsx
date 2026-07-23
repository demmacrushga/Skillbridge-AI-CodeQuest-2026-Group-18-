import React, { useEffect, useRef } from 'react';
import {
  Animated,
  StyleProp,
  StyleSheet,
  TouchableOpacity,
  TouchableOpacityProps,
  ViewProps,
  ViewStyle,
} from 'react-native';

interface AnimatedViewProps extends ViewProps {
  delay?: number;
  duration?: number;
  slideDistance?: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

export function AnimatedFadeIn({
  delay = 0,
  duration = 400,
  slideDistance = 16,
  style,
  children,
  ...props
}: AnimatedViewProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(slideDistance)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration,
          useNativeDriver: true,
        }),
      ]).start();
    }, delay);

    return () => clearTimeout(timer);
  }, [delay, duration, opacity, slideDistance, translateY]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity,
          transform: [{ translateY }],
        },
      ]}
      {...props}
    >
      {children}
    </Animated.View>
  );
}

interface AnimatedPressableProps extends TouchableOpacityProps {
  scaleTo?: number;
  activeFillColor?: string;
  children: React.ReactNode;
}

export function AnimatedPressable({
  scaleTo = 0.96,
  activeFillColor = 'rgba(37, 99, 235, 0.12)', // Tactile Royal Blue Highlight Fill
  style,
  onPressIn,
  onPressOut,
  children,
  ...props
}: AnimatedPressableProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const fillAnim = useRef(new Animated.Value(0)).current;

  const handlePressIn = (e: any) => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: scaleTo,
        useNativeDriver: false,
        speed: 24,
        bounciness: 4,
      }),
      Animated.timing(fillAnim, {
        toValue: 1,
        duration: 120,
        useNativeDriver: false,
      }),
    ]).start();
    if (onPressIn) onPressIn(e);
  };

  const handlePressOut = (e: any) => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: false,
        speed: 24,
        bounciness: 4,
      }),
      Animated.timing(fillAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: false,
      }),
    ]).start();
    if (onPressOut) onPressOut(e);
  };

  const overlayBackground = fillAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(0,0,0,0)', activeFillColor],
  });

  const extractedRadius = (StyleSheet.flatten(style) as ViewStyle)?.borderRadius ?? 16;

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      {...props}
    >
      <Animated.View style={[style, { transform: [{ scale }], overflow: 'hidden' }]}>
        {children}
        <Animated.View
          style={[
            StyleSheet.absoluteFillObject,
            { backgroundColor: overlayBackground, borderRadius: extractedRadius },
          ]}
          pointerEvents="none"
        />
      </Animated.View>
    </TouchableOpacity>
  );
}
