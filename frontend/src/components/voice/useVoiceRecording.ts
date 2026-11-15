import { useState, useRef, useEffect, useCallback } from "react";
import { detectSupportedAudioMime } from "./types";

export type RecordingStage = "idle" | "recording" | "paused" | "recorded" | "processing" | "review";

export function useVoiceRecording(language: string = "auto") {
  const [stage, setStage] = useState<RecordingStage>("idle");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  // Live audio level visualizer
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const [duration, setDuration] = useState(0);
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const recognitionRef = useRef<any>(null);
  const liveTranscriptRef = useRef<string>("");

  const [error, setError] = useState<string | null>(null);

  // Cleanup on unmount or URL/stream change
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close().catch(() => {});
      }
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [audioUrl, stream]);

  const startRecording = useCallback(async () => {
    setError(null);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError(
        "Microphone access is not supported by this browser. Use the standard form below.",
      );
      return;
    }

    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      setStream(audioStream);

      // Initialize live audio level meter
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          const audioCtx = new AudioContextClass();
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 64;
          const source = audioCtx.createMediaStreamSource(audioStream);
          source.connect(analyser);
          audioContextRef.current = audioCtx;
          analyserRef.current = analyser;

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const updateLevel = () => {
            if (!analyserRef.current) return;
            analyserRef.current.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
            const avg = sum / dataArray.length;
            setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
            animFrameRef.current = requestAnimationFrame(updateLevel);
          };
          updateLevel();
        }
      } catch (_) {}

      const { mime, cleanMime } = detectSupportedAudioMime();
      const recorder = new MediaRecorder(audioStream, { mimeType: mime });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const elapsedSecs = Math.max(1, Math.round((Date.now() - (startTimeRef.current || Date.now())) / 1000));
        setDuration(elapsedSecs);
        const finalBlob = new Blob(chunksRef.current, { type: cleanMime });
        setAudioBlob(finalBlob);
        const url = URL.createObjectURL(finalBlob);
        setAudioUrl(url);
        audioStream.getTracks().forEach((track) => track.stop());
        setStream(null);
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        if (audioContextRef.current && audioContextRef.current.state !== "closed") {
          audioContextRef.current.close().catch(() => {});
        }
        setAudioLevel(0);
        setStage("recorded");
      };

      mediaRecorderRef.current = recorder;
      recorder.start(500); // 500ms chunks
      startTimeRef.current = Date.now();
      liveTranscriptRef.current = "";
      setDuration(0);
      setStage("recording");

      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          const recognition = new SpeechRecognition();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang =
            language === "auto"
              ? "en-IN"
              : language === "te"
                ? "te-IN"
                : language === "hi"
                  ? "hi-IN"
                  : `${language}-IN`;
          recognition.onresult = (event: any) => {
            let full = "";
            for (let i = 0; i < event.results.length; i++) {
              full += event.results[i][0].transcript + " ";
            }
            if (full.trim()) {
              liveTranscriptRef.current = full.trim();
            }
          };
          recognition.start();
          recognitionRef.current = recognition;
        } catch (_) {}
      }

      timerRef.current = window.setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      if (
        err.name === "NotAllowedError" ||
        err.name === "PermissionDeniedError"
      ) {
        setError(
          "Microphone permission was denied. Please allow microphone access in your browser to speak your report.",
        );
      } else if (
        err.name === "NotFoundError" ||
        err.name === "DevicesNotFoundError"
      ) {
        setError(
          "No microphone device was detected on your computer or phone.",
        );
      } else {
        setError(`Unable to record audio: ${err.message || err.toString()}`);
      }
    }
  }, [language]);

  const pauseRecording = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      mediaRecorderRef.current.pause();
      if (timerRef.current) clearInterval(timerRef.current);
      setStage("paused");
    }
  }, []);

  const resumeRecording = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "paused"
    ) {
      mediaRecorderRef.current.resume();
      timerRef.current = window.setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
      setStage("recording");
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (_) {}
    }
    if (timerRef.current) clearInterval(timerRef.current);

    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      try {
        if (typeof mediaRecorderRef.current.requestData === "function") {
          mediaRecorderRef.current.requestData();
        }
      } catch (_) {}
      mediaRecorderRef.current.stop();
    } else {
      setStage("recorded");
    }
  }, []);

  const resetRecording = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (_) {}
    }
    liveTranscriptRef.current = "";
    if (timerRef.current) clearInterval(timerRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => {});
    }
    if (stream) stream.getTracks().forEach((track) => track.stop());
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setStream(null);
    setAudioBlob(null);
    setAudioUrl(null);
    setDuration(0);
    setAudioLevel(0);
    setStage("idle");
    setError(null);
  }, [audioUrl, stream]);

  return {
    stage,
    setStage,
    audioBlob,
    audioUrl,
    audioLevel,
    duration,
    error,
    setError,
    liveTranscriptRef,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    resetRecording,
  };
}
