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
const NATIVE_MIME_TYPE = 'audio/m4a';
const WEB_MIME_TYPE = 'audio/webm';

export function useInterviewRecorder(): InterviewRecorderState {
  const [permission, setPermission] = useState<RecorderPermission>('pending');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  // Native refs
  const recordingRef = useRef<Audio.Recording | null>(null);
  
  // Web refs
  const mediaRecorderRef = useRef<any>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (Platform.OS === 'web') {
          if (typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia) {
            setPermission('granted');
          } else {
            setPermission('denied');
          }
        } else {
          const { status } = await Audio.requestPermissionsAsync();
          if (cancelled) return;
          setPermission(status === 'granted' ? 'granted' : 'denied');
        }
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

  const stop = useCallback(async (): Promise<{ uri: string | null; contentType: string }> => {
    stopTimer();
    setIsRecording(false);

    if (Platform.OS === 'web') {
      return new Promise((resolve) => {
        const recorder = mediaRecorderRef.current;
        if (!recorder || recorder.state === 'inactive') {
          resolve({ uri: null, contentType: WEB_MIME_TYPE });
          return;
        }

        recorder.onstop = () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const audioUrl = URL.createObjectURL(audioBlob);
          audioChunksRef.current = [];

          if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
          }
          resolve({ uri: audioUrl, contentType: WEB_MIME_TYPE });
        };

        recorder.stop();
      });
    }

    // Native expo-av
    const recording = recordingRef.current;
    recordingRef.current = null;
    if (!recording) {
      return { uri: null, contentType: NATIVE_MIME_TYPE };
    }
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      return { uri, contentType: NATIVE_MIME_TYPE };
    } catch {
      return { uri: null, contentType: NATIVE_MIME_TYPE };
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

  const start = useCallback(async () => {
    if (isRecording) return;
    try {
      if (Platform.OS === 'web') {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;
        audioChunksRef.current = [];

        const recorder = new (window as any).MediaRecorder(stream);
        recorder.ondataavailable = (e: any) => {
          if (e.data.size > 0) {
            audioChunksRef.current.push(e.data);
          }
        };

        recorder.start();
        mediaRecorderRef.current = recorder;
        setIsRecording(true);
        setRecordingSeconds(0);

        timerRef.current = setInterval(() => {
          setRecordingSeconds(prev => {
            if (prev + 1 >= MAX_SECONDS) {
              void stop();
              return MAX_SECONDS;
            }
            return prev + 1;
          });
        }, 1000);
      } else {
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
              void stop();
              return MAX_SECONDS;
            }
            return prev + 1;
          });
        }, 1000);
      }
    } catch (e) {
      console.error('Failed to start recording:', e);
      setIsRecording(false);
    }
  }, [isRecording, stop]);

  useEffect(() => {
    return () => {
      stopTimer();
      if (Platform.OS === 'web') {
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach(track => track.stop());
        }
      } else {
        const rec = recordingRef.current;
        if (rec) {
          try {
            void rec.stopAndUnloadAsync();
          } catch {
            /* noop */
          }
        }
      }
    };
  }, []);

  return { isRecording, recordingSeconds, permission, start, stop };
}