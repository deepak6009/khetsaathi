import { useState, useCallback, useEffect, useRef } from "react";
import { Mic, MicOff, PhoneOff, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useVoiceAssistant,
  BarVisualizer,
  useConnectionState,
  useLocalParticipant,
  useRoomContext,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { ConnectionState, RoomEvent, TranscriptionSegment, Participant } from "livekit-client";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface VoiceChatProps {
  phone: string;
  language: string;
  imageUrls: string[];
  onClose: () => void;
  onTranscript?: (message: ChatMessage) => void;
}

function VoiceAssistantUI({
  language,
  onClose,
  onTranscript,
}: {
  language: string;
  onClose: () => void;
  onTranscript?: (message: ChatMessage) => void;
}) {
  const { audioTrack, state } = useVoiceAssistant();
  const connectionState = useConnectionState();
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const isMuted = !isMicrophoneEnabled;
  const room = useRoomContext();
  const processedSegmentsRef = useRef<Set<string>>(new Set());
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  useEffect(() => {
    if (!room) return;
    processedSegmentsRef.current.clear();

    const handleTranscription = (
      segments: TranscriptionSegment[],
      participant?: Participant,
    ) => {
      for (const segment of segments) {
        if (segment.final && !processedSegmentsRef.current.has(segment.id)) {
          processedSegmentsRef.current.add(segment.id);
          const text = segment.text.trim();
          if (text && onTranscriptRef.current) {
            const isLocal = participant?.identity === localParticipant?.identity;
            onTranscriptRef.current({
              role: isLocal ? "user" : "assistant",
              content: text,
            });
          }
        }
      }
    };

    room.on(RoomEvent.TranscriptionReceived, handleTranscription);
    return () => {
      room.off(RoomEvent.TranscriptionReceived, handleTranscription);
      processedSegmentsRef.current.clear();
    };
  }, [room, localParticipant?.identity]);

  const toggleMute = useCallback(async () => {
    if (localParticipant) {
      await localParticipant.setMicrophoneEnabled(isMuted);
    }
  }, [localParticipant, isMuted]);

  const getStatusText = () => {
    if (connectionState === ConnectionState.Connecting) return language === "Telugu" ? "కనెక్ట్ అవుతోంది..." : language === "Hindi" ? "कनेक्ट हो रहा है..." : "Connecting...";
    if (connectionState === ConnectionState.Disconnected) return language === "Telugu" ? "డిస్కనెక్ట్ అయింది" : language === "Hindi" ? "डिस्कनेक्ट" : "Disconnected";

    switch (state) {
      case "listening": return isMuted
        ? (language === "Telugu" ? "మ్యూట్" : language === "Hindi" ? "म्यूट" : "Muted")
        : (language === "Telugu" ? "వింటోంది..." : language === "Hindi" ? "सुन रहा है..." : "Listening...");
      case "thinking": return language === "Telugu" ? "ఆలోచిస్తోంది..." : language === "Hindi" ? "सोच रहा है..." : "Thinking...";
      case "speaking": return language === "Telugu" ? "మాట్లాడుతోంది..." : language === "Hindi" ? "बोल रहा है..." : "Speaking...";
      default: return language === "Telugu" ? "సిద్ధంగా ఉంది..." : language === "Hindi" ? "तैयार हो रहा है..." : "Getting ready...";
    }
  };

  const getStatusColor = () => {
    if (connectionState !== ConnectionState.Connected) return "text-muted-foreground";
    switch (state) {
      case "listening": return isMuted ? "text-red-500" : "text-green-500";
      case "thinking": return "text-yellow-500";
      case "speaking": return "text-blue-500";
      default: return "text-muted-foreground";
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 py-6 px-4" data-testid="voice-chat-panel">
      <div className="w-full max-w-[200px] h-[80px] flex items-center justify-center">
        <BarVisualizer
          trackRef={audioTrack}
          state={state}
          barCount={5}
          style={{ width: "100%", height: "100%" }}
        />
      </div>

      <p className={`text-sm font-medium ${getStatusColor()}`} data-testid="text-voice-status">
        {getStatusText()}
      </p>

      <div className="flex gap-3 items-center">
        <Button
          size="icon"
          variant={isMuted ? "destructive" : "outline"}
          onClick={toggleMute}
          disabled={connectionState !== ConnectionState.Connected}
          data-testid="button-toggle-mute"
        >
          {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </Button>

        <Button
          size="icon"
          variant="destructive"
          onClick={onClose}
          data-testid="button-end-voice"
        >
          <PhoneOff className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

export default function VoiceChat({ phone, language, imageUrls, onClose, onTranscript }: VoiceChatProps) {
  const [connectionDetails, setConnectionDetails] = useState<{
    token: string;
    url: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [micReady, setMicReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function initVoice() {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) return;
        setMicReady(true);
      } catch (micErr: any) {
        if (cancelled) return;
        const micMessage = language === "Telugu"
          ? "మైక్రోఫోన్ అనుమతి అవసరం. దయచేసి బ్రౌజర్ సెట్టింగ్స్‌లో మైక్రోఫోన్ అనుమతించండి."
          : language === "Hindi"
          ? "माइक्रोफ़ोन की अनुमति आवश्यक है। कृपया ब्राउज़र सेटिंग्स में माइक्रोफ़ोन की अनुमति दें।"
          : "Microphone permission is required. Please allow microphone access in your browser settings.";
        setError(micMessage);
        return;
      }

      try {
        const resp = await fetch("/api/livekit/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone, language, imageUrls }),
        });
        if (cancelled) return;
        if (!resp.ok) {
          const data = await resp.json();
          throw new Error(data.message || "Failed to get token");
        }
        const data = await resp.json();
        setConnectionDetails({ token: data.token, url: data.url });
      } catch (err: any) {
        if (cancelled) return;
        setError(err.message || "Connection failed");
      }
    }
    initVoice();
    return () => { cancelled = true; };
  }, [phone, language, imageUrls]);

  const handleDisconnect = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleError = useCallback((err: Error) => {
    console.error("LiveKit room error:", err);
  }, []);

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 py-6 px-4" data-testid="voice-chat-panel">
        <AlertTriangle className="w-8 h-8 text-yellow-500" />
        <p className="text-sm text-destructive text-center" data-testid="text-voice-error">{error}</p>
        <Button variant="outline" onClick={onClose} data-testid="button-close-error">
          {language === "Telugu" ? "మూసివేయి" : language === "Hindi" ? "बंद करें" : "Close"}
        </Button>
      </div>
    );
  }

  if (!connectionDetails || !micReady) {
    return (
      <div className="flex flex-col items-center gap-4 py-6 px-4" data-testid="voice-chat-panel">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">
          {language === "Telugu" ? "కనెక్ట్ అవుతోంది..." : language === "Hindi" ? "कनेक्ट हो रहा है..." : "Connecting..."}
        </p>
      </div>
    );
  }

  return (
    <LiveKitRoom
      serverUrl={connectionDetails.url}
      token={connectionDetails.token}
      connect={true}
      audio={true}
      video={false}
      onDisconnected={handleDisconnect}
      onError={handleError}
    >
      <VoiceAssistantUI language={language} onClose={handleDisconnect} onTranscript={onTranscript} />
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}
