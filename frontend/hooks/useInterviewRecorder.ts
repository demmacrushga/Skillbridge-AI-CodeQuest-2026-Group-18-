import { useCallback, useEffect, useRef, useState } from 'react';
import { Audio } from 'expo-av';
import { Platform } from 'react-native';

export type RecorderPermission = 'granted' | 'denied' | 'pending';

export type InterviewRecorderState = {
  isRecording: boolean;
  recordingSeconds: number;
  permission: RecorderPermission;
  start: () => Promise<void>;
  stop: () => Promise<{ uri: string | null; contentType: string }>;
};

const MAX_SECONDS = 5 * 60;
const MIME_TYPE = 'audio/m4a';

export function useInterviewRecorder(): InterviewRecorderState {
  const [permission, setPermission] = useState<RecorderPermission>('pending');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopRef = useRef<() => Promise<{ uri: string | null; contentType: string }>>(async () => ({ uri: null, contentType: MIME_TYPE }));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Audio.requestPermissionsAsync();
        if (cancelled) return;
        setPermission(status === 'granted' ? 'granted' : 'denied');
      } catch {
        if (!cancelled) setPermission('denied');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const stop = useCallback(async () => {
    stopTimer();
    setIsRecording(false);
    const recording = recordingRef.current;
    recordingRef.current = null;
    if (!recording) {
      return { uri: null, contentType: MIME_TYPE };
    }
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      return { uri, contentType: MIME_TYPE };
    } catch {
      return { uri: null, contentType: MIME_TYPE };
    } finally {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
          staysActiveInBackground: false,
        });
      } catch {
        /* noop */
      }
    }
  }, []);

  stopRef.current = stop;

  const start = useCallback(async () => {
    if (permission !== 'granted' || isRecording) return;
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: false,
      });

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recording.startAsync();

      recordingRef.current = recording;
      setIsRecording(true);
      setRecordingSeconds(0);

      timerRef.current = setInterval(() => {
        setRecordingSeconds(prev => {
          if (prev + 1 >= MAX_SECONDS) {
            void stopRef.current();
            return MAX_SECONDS;
          }
          return prev + 1;
        });
      }, 1000);
    } catch {
      setIsRecording(false);
    }
  }, [permission, isRecording]);

  useEffect(() => {
    return () => {
      stopTimer();
      const rec = recordingRef.current;
      if (rec) {
        try {
          void rec.stopAndUnloadAsync();
        } catch {
          /* noop */
        }
      }
    };
  }, []);

  if (Platform.OS === 'web') {
    return {
      isRecording: false,
      recordingSeconds: 0,
      permission: 'denied',
      start: async () => {},
      stop: async () => ({ uri: null, contentType: MIME_TYPE }),
    };
  }

  return { isRecording, recordingSeconds, permission, start, stop };
}