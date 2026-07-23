import { useEffect, useRef, useState } from 'react';
import {
  Text,
  StyleSheet,
  Animated,
  DeviceEventEmitter,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, typography, radius, spacing } from '@/constants/theme';

export interface ToastPayload {
  message: string;
  type?: 'success' | 'info' | 'error';
}

export function showToast(message: string, type: 'success' | 'info' | 'error' = 'success') {
  DeviceEventEmitter.emit('showToast', { message, type });
}

export function GlobalToast() {
  const [toast, setToast] = useState<ToastPayload | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-40)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('showToast', (data: ToastPayload) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setToast(data);

      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 80, useNativeDriver: true }),
      ]).start();

      timerRef.current = setTimeout(() => {
        Animated.parallel([
          Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
          Animated.timing(slideAnim, { toValue: -30, duration: 200, useNativeDriver: true }),
        ]).start(() => setToast(null));
      }, 2500);
    });

    return () => {
      sub.remove();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [fadeAnim, slideAnim]);

  if (!toast) return null;

  const isError = toast.type === 'error';
  const isInfo = toast.type === 'info';
  const bg = isError ? colors.error : isInfo ? colors.primary : colors.secondary;
  const icon = isError ? 'alert-circle' : isInfo ? 'information-circle' : 'checkmark-circle';

  return (
    <Animated.View
      style={[
        styles.toastContainer,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
      pointerEvents="none"
    >
      <View style={[styles.toastInner, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={18} color={colors.onPrimary} />
        <Text style={styles.toastText}>{toast.message}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    top: 54,
    left: spacing.lg,
    right: spacing.lg,
    alignItems: 'center',
    zIndex: 99999,
  },
  toastInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.full,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  toastText: {
    ...typography.labelMd,
    color: colors.onPrimary,
    fontSize: 13,
  },
});
