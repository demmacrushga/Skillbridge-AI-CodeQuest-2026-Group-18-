import React, { createContext, useContext, useEffect, useRef } from 'react';
import {
  Animated,
  StyleProp,
  StyleSheet,
  TextProps,
  TextStyle,
  TouchableOpacity,
  TouchableOpacityProps,
  ViewProps,
  ViewStyle,
} from 'react-native';
import { colors } from '@/constants/theme';

/* ──────────────────────────────────────────────────
   Press-Active Context – lets children know the
   card is being held so they can turn white.
   ────────────────────────────────────────────────── */

const PressActiveContext = createContext<Animated.Value>(new Animated.Value(0));

/**
 * Hook to read the current press-fill animation value
 * (0 = idle, 1 = fully pressed). Use inside an AnimatedPressable.
 */
export function usePressActive() {
  return useContext(PressActiveContext);
}

/* ──────────────────────────────────────────────────
   ActiveText – drop-in <Text> replacement that
   automatically fades to white when its parent
   AnimatedPressable is active.
   ────────────────────────────────────────────────── */

export function ActiveText({ style, children, ...props }: TextProps) {
  const fillAnim = usePressActive();
  const flat = StyleSheet.flatten(style) as TextStyle | undefined;
  const originalColor = flat?.color ?? colors.onSurface;

  const animatedColor = fillAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [originalColor as string, '#FFFFFF'],
  });

  return (
    <Animated.Text style={[style, { color: animatedColor }]} {...props}>
      {children}
    </Animated.Text>
  );
}

/* ──────────────────────────────────────────────────
   AnimatedFadeIn – entrance animation wrapper
   ────────────────────────────────────────────────── */

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

/* ──────────────────────────────────────────────────
   AnimatedPressable – tactile press-to-fill card
   with scale + Royal Blue (#2563EB) fill + white
   text support via PressActiveContext.
   ────────────────────────────────────────────────── */

interface AnimatedPressableProps extends TouchableOpacityProps {
  scaleTo?: number;
  activeFillColor?: string;
  isActive?: boolean;
  children: React.ReactNode;
}

export function AnimatedPressable({
  scaleTo = 0.94,
  activeFillColor = colors.secondary, // Exact App Royal Blue (#2563EB) Fill
  isActive = false,
  style,
  onPressIn,
  onPressOut,
  onPress,
  children,
  ...props
}: AnimatedPressableProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const fillAnim = useRef(new Animated.Value(isActive ? 1 : 0)).current;

  // React to programmatic changes in isActive
  useEffect(() => {
    Animated.timing(fillAnim, {
      toValue: isActive ? 1 : 0,
      duration: isActive ? 250 : 400,
      useNativeDriver: false,
    }).start();
  }, [isActive, fillAnim]);

  const handlePressIn = (e: any) => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: scaleTo,
        useNativeDriver: false,
        speed: 32,
        bounciness: 5,
      }),
      ...(isActive ? [] : [
        Animated.timing(fillAnim, {
          toValue: 1,
          duration: 80,
          useNativeDriver: false,
        })
      ]),
    ]).start();
    if (onPressIn) onPressIn(e);
  };

  const handlePressOut = (e: any) => {
    // Hold vivid blue fill for half a second (500ms) after touch release
    setTimeout(() => {
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: false,
          speed: 18,
          bounciness: 4,
        }),
        ...(isActive ? [] : [
          Animated.timing(fillAnim, {
            toValue: 0,
            duration: 400,
            useNativeDriver: false,
          })
        ]),
      ]).start();
    }, 500); // 500ms = half a second hold duration
    if (onPressOut) onPressOut(e);
  };

  const handlePress = (e: any) => {
    if (!onPress) return;
    requestAnimationFrame(() => {
      onPress(e);
    });
  };

  const overlayBackground = fillAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(0,0,0,0)', activeFillColor],
  });

  const flattenedStyle = StyleSheet.flatten(style) as ViewStyle | undefined;
  const existingTransforms = (flattenedStyle?.transform ?? []) as any[];
  const combinedTransforms = [...existingTransforms, { scale }];
  const extractedRadius = flattenedStyle?.borderRadius ?? 16;

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      {...props}
    >
      <PressActiveContext.Provider value={fillAnim}>
        <Animated.View style={[style, { transform: combinedTransforms, overflow: 'hidden' }]}>
          {/* Blue fill overlay sits BEHIND children so text is always on top */}
          <Animated.View
            style={[
              StyleSheet.absoluteFillObject,
              { backgroundColor: overlayBackground, borderRadius: extractedRadius },
            ]}
            pointerEvents="none"
          />
          {children}
        </Animated.View>
      </PressActiveContext.Provider>
    </TouchableOpacity>
  );
}
