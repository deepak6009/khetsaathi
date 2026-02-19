import { useState, useCallback, useEffect, useRef } from "react";
import { Mic, MicOff, PhoneOff, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface VoiceChatProps {
  phone: string;
  language: string;
  imageUrls: string[];
  onClose: () => void;
}

type VoiceStatus = "connecting" | "listening" | "recording" | "transcribing" | "thinking" | "speaking" | "error";

export default function VoiceChat({ phone, language, imageUrls, onClose }: VoiceChatProps) {
  const [status, setStatus] = useState<VoiceStatus>("connecting");
  const [isMuted, setIsMuted] = useState(false);
  const [transcripts, setTranscripts] = useState<Array<{ role: "user" | "assistant"; text: string }>>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const isRecordingRef = useRef(false);
  const chunksRef = useRef<Blob[]>([]);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const vadFrameRef = useRef<number | null>(null);
  const audioQueueRef = useRef<ArrayBuffer[]>([]);
  const isPlayingRef = useRef(false);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const [audioLevel, setAudioLevel] = useState(0);

  const SILENCE_THRESHOLD = 15;
  const SILENCE_DURATION = 1500;
  const MIN_RECORDING_MS = 500;
  const recordingStartRef = useRef<number>(0);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcripts]);

  const playNextAudio = useCallback(async () => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) return;
    isPlayingRef.current = true;

    const audioData = audioQueueRef.current.shift()!;
    try {
      const blob = new Blob([audioData], { type: "audio/mp3" });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => {
        URL.revokeObjectURL(url);
        isPlayingRef.current = false;
        if (audioQueueRef.current.length > 0) {
          playNextAudio();
        } else {
          setStatus("listening");
          startVAD();
        }
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        isPlayingRef.current = false;
        setStatus("listening");
        startVAD();
      };
      await audio.play();
    } catch {
      isPlayingRef.current = false;
      setStatus("listening");
      startVAD();
    }
  }, []);

  const startVAD = useCallback(() => {
    if (!analyserRef.current || isMuted) return;

    const analyser = analyserRef.current;
    const dataArray = new Uint8Array(analyser.fftSize);
    let speechDetected = false;

    const checkAudio = () => {
      if (!analyserRef.current) return;
      analyser.getByteTimeDomainData(dataArray);

      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const val = dataArray[i] - 128;
        sum += val * val;
      }
      const rms = Math.sqrt(sum / dataArray.length);
      setAudioLevel(Math.min(rms / 50, 1));

      if (rms > SILENCE_THRESHOLD) {
        if (!speechDetected && !isRecordingRef.current) {
          speechDetected = true;
          startRecording();
        }
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }
      } else if (isRecordingRef.current) {
        if (!silenceTimerRef.current) {
          silenceTimerRef.current = setTimeout(() => {
            const elapsed = Date.now() - recordingStartRef.current;
            if (elapsed >= MIN_RECORDING_MS) {
              stopRecording();
              speechDetected = false;
            }
            silenceTimerRef.current = null;
          }, SILENCE_DURATION);
        }
      }

      vadFrameRef.current = requestAnimationFrame(checkAudio);
    };

    vadFrameRef.current = requestAnimationFrame(checkAudio);
  }, [isMuted]);

  const startRecording = useCallback(() => {
    if (!streamRef.current || isRecordingRef.current) return;
    isRecordingRef.current = true;
    chunksRef.current = [];
    recordingStartRef.current = Date.now();
    setStatus("recording");

    const recorder = new MediaRecorder(streamRef.current, {
      mimeType: "audio/webm;codecs=opus",
    });
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "audio/webm;codecs=opus" });
      if (blob.size > 0 && wsRef.current?.readyState === WebSocket.OPEN) {
        blob.arrayBuffer().then((buf) => {
          wsRef.current?.send(buf);
        });
      }
      chunksRef.current = [];
    };
    mediaRecorderRef.current = recorder;
    recorder.start(100);
  }, []);

  const stopRecording = useCallback(() => {
    if (!isRecordingRef.current || !mediaRecorderRef.current) return;
    isRecordingRef.current = false;

    if (vadFrameRef.current) {
      cancelAnimationFrame(vadFrameRef.current);
      vadFrameRef.current = null;
    }

    if (mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;
    setStatus("transcribing");
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;

        const audioCtx = new AudioContext();
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 2048;
        source.connect(analyser);
        audioContextRef.current = audioCtx;
        analyserRef.current = analyser;

        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const ws = new WebSocket(`${protocol}//${window.location.host}/ws/voice`);
        wsRef.current = ws;

        ws.onopen = () => {
          ws.send(JSON.stringify({
            type: "start",
            phone,
            language,
            imageUrls,
          }));
        };

        ws.onmessage = async (event) => {
          if (event.data instanceof Blob) {
            const arrayBuf = await event.data.arrayBuffer();
            audioQueueRef.current.push(arrayBuf);
            setStatus("speaking");
            playNextAudio();
            return;
          }

          try {
            const msg = JSON.parse(event.data);
            switch (msg.type) {
              case "started":
                setStatus("listening");
                break;
              case "transcript":
                setTranscripts(prev => [...prev, { role: msg.role, text: msg.text }]);
                break;
              case "status":
                if (msg.status === "listening") {
                  if (!isPlayingRef.current) {
                    setStatus("listening");
                    startVAD();
                  }
                } else {
                  setStatus(msg.status as VoiceStatus);
                }
                break;
              case "wants_plan":
                setTranscripts(prev => [...prev, {
                  role: "assistant",
                  text: language === "Telugu"
                    ? "మీకు ఏ భాషలో ప్లాన్ కావాలి?"
                    : language === "Hindi"
                      ? "आपको किस भाषा में प्लान चाहिए?"
                      : "Which language would you like the plan in?"
                }]);
                break;
              case "plan_ready":
                break;
              case "diagnosis_ready":
                break;
              case "error":
                setErrorMsg(msg.message);
                setStatus("listening");
                startVAD();
                break;
            }
          } catch {}
        };

        ws.onerror = () => {
          setErrorMsg("Connection error");
          setStatus("error");
        };

        ws.onclose = () => {
          if (!cancelled) {
            setStatus("error");
            setErrorMsg("Connection closed");
          }
        };

      } catch (err: any) {
        setErrorMsg(err.message || "Microphone access denied");
        setStatus("error");
      }
    }

    init();

    return () => {
      cancelled = true;
      if (vadFrameRef.current) cancelAnimationFrame(vadFrameRef.current);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (mediaRecorderRef.current?.state !== "inactive") {
        try { mediaRecorderRef.current?.stop(); } catch {}
      }
      streamRef.current?.getTracks().forEach(t => t.stop());
      audioContextRef.current?.close();
      wsRef.current?.close();
    };
  }, [phone, language, imageUrls, playNextAudio, startVAD]);

  useEffect(() => {
    if (status === "listening" && !isMuted) {
      startVAD();
    }
  }, [status, isMuted, startVAD]);

  const toggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    streamRef.current?.getAudioTracks().forEach(t => { t.enabled = !newMuted; });
    if (newMuted) {
      if (vadFrameRef.current) cancelAnimationFrame(vadFrameRef.current);
      if (isRecordingRef.current) stopRecording();
    } else if (status === "listening") {
      startVAD();
    }
  };

  const handleClose = () => {
    if (vadFrameRef.current) cancelAnimationFrame(vadFrameRef.current);
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (mediaRecorderRef.current?.state !== "inactive") {
      try { mediaRecorderRef.current?.stop(); } catch {}
    }
    streamRef.current?.getTracks().forEach(t => t.stop());
    audioContextRef.current?.close();
    wsRef.current?.close();
    onClose();
  };

  const getStatusText = () => {
    switch (status) {
      case "connecting": return "Connecting...";
      case "listening": return isMuted ? "Muted" : "Listening...";
      case "recording": return "Hearing you...";
      case "transcribing": return "Processing...";
      case "thinking": return "Thinking...";
      case "speaking": return "Speaking...";
      case "error": return errorMsg || "Error";
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case "listening": return "text-green-500";
      case "recording": return "text-red-500";
      case "thinking": return "text-yellow-500";
      case "speaking": return "text-blue-500";
      case "error": return "text-destructive";
      default: return "text-muted-foreground";
    }
  };

  const bars = 5;

  return (
    <div className="flex flex-col items-center gap-4 py-6 px-4" data-testid="voice-chat-panel">
      <div className="w-full max-w-[200px] h-[80px] flex items-center justify-center gap-1">
        {Array.from({ length: bars }).map((_, i) => {
          const baseHeight = 12;
          const maxExtra = 48;
          let height = baseHeight;
          if (status === "recording") {
            height = baseHeight + audioLevel * maxExtra * (0.5 + 0.5 * Math.sin(Date.now() / 200 + i));
          } else if (status === "speaking") {
            height = baseHeight + maxExtra * 0.4 * (0.5 + 0.5 * Math.sin(Date.now() / 300 + i * 1.2));
          } else if (status === "connecting" || status === "transcribing" || status === "thinking") {
            height = baseHeight + 8 * Math.sin(Date.now() / 400 + i);
          }
          return (
            <div
              key={i}
              className={`w-2 rounded-full transition-all duration-100 ${
                status === "recording" ? "bg-red-500" :
                status === "speaking" ? "bg-blue-500" :
                status === "listening" ? "bg-green-500/50" :
                "bg-primary/30"
              }`}
              style={{ height: `${Math.max(baseHeight, height)}px` }}
            />
          );
        })}
      </div>

      <p className={`text-sm font-medium ${getStatusColor()}`} data-testid="text-voice-status">
        {getStatusText()}
      </p>

      {transcripts.length > 0 && (
        <div className="w-full max-h-[150px] overflow-y-auto space-y-2 px-2">
          {transcripts.slice(-4).map((t, i) => (
            <div
              key={i}
              className={`text-xs px-3 py-1.5 rounded-lg max-w-[85%] ${
                t.role === "user"
                  ? "bg-primary/10 text-foreground ml-auto"
                  : "bg-muted text-foreground mr-auto"
              }`}
              data-testid={`text-voice-transcript-${i}`}
            >
              {t.text.length > 100 ? t.text.substring(0, 100) + "..." : t.text}
            </div>
          ))}
          <div ref={transcriptEndRef} />
        </div>
      )}

      <div className="flex gap-3 items-center">
        <Button
          size="icon"
          variant={isMuted ? "destructive" : "outline"}
          onClick={toggleMute}
          disabled={status === "connecting"}
          data-testid="button-toggle-mute"
        >
          {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </Button>

        <Button
          size="icon"
          variant="destructive"
          onClick={handleClose}
          data-testid="button-end-voice"
        >
          <PhoneOff className="w-4 h-4" />
        </Button>
      </div>

      {status === "error" && errorMsg && (
        <p className="text-xs text-destructive text-center" data-testid="text-voice-error">{errorMsg}</p>
      )}
    </div>
  );
}
