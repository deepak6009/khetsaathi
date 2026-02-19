import { useState, useCallback, useEffect, useRef } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useConnectionState,
  useVoiceAssistant,
  BarVisualizer,
  useLocalParticipant,
  useRoomContext,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { ConnectionState, RoomEvent } from "livekit-client";
import { Mic, MicOff, PhoneOff, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

interface VoiceChatProps {
  phone: string;
  language: string;
  onClose: () => void;
}

function VoiceUI({ onClose }: { onClose: () => void }) {
  const connectionState = useConnectionState();
  const { state: agentState, audioTrack } = useVoiceAssistant();
  const { localParticipant } = useLocalParticipant();
  const room = useRoomContext();
  const [isMuted, setIsMuted] = useState(false);
  const [debugInfo, setDebugInfo] = useState('');

  const isConnected = connectionState === ConnectionState.Connected;
  const isConnecting = connectionState === ConnectionState.Connecting;

  useEffect(() => {
    if (!room) return;

    const handleTrackSubscribed = (track: any, pub: any, participant: any) => {
      console.log(`[voice] Track subscribed: ${participant.identity}, kind=${track.kind}, sid=${pub.trackSid}`);
      setDebugInfo(`Agent audio connected`);
    };

    const handleTrackUnsubscribed = (track: any, pub: any, participant: any) => {
      console.log(`[voice] Track unsubscribed: ${participant.identity}`);
    };

    room.on(RoomEvent.TrackSubscribed, handleTrackSubscribed);
    room.on(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);

    return () => {
      room.off(RoomEvent.TrackSubscribed, handleTrackSubscribed);
      room.off(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);
    };
  }, [room]);

  const getStatusText = () => {
    if (isConnecting) return "Connecting...";
    if (!isConnected) return "Disconnected";
    switch (agentState) {
      case "listening": return "Listening...";
      case "thinking": return "Thinking...";
      case "speaking": return "Speaking...";
      default: return "Connected";
    }
  };

  const getStatusColor = () => {
    if (!isConnected) return "text-muted-foreground";
    switch (agentState) {
      case "listening": return "text-green-500";
      case "thinking": return "text-yellow-500";
      case "speaking": return "text-blue-500";
      default: return "text-muted-foreground";
    }
  };

  const isInIframe = window.self !== window.top;

  return (
    <div className="flex flex-col items-center gap-4 py-6 px-4">
      {isInIframe && (
        <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 rounded-md" data-testid="text-iframe-warning">
          <ExternalLink className="w-3 h-3 flex-shrink-0" />
          <span>For best voice experience, open in a new tab</span>
          <a
            href={window.location.href}
            target="_blank"
            rel="noopener noreferrer"
            className="underline font-medium"
            data-testid="link-open-new-tab"
          >
            Open
          </a>
        </div>
      )}

      <div className="w-full max-w-[200px] h-[80px] flex items-center justify-center">
        {audioTrack ? (
          <BarVisualizer
            state={agentState}
            barCount={5}
            trackRef={audioTrack}
            className="w-full h-full"
          />
        ) : (
          <div className="flex gap-1 items-center justify-center h-full">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className={`w-2 rounded-full bg-primary/30 ${isConnecting ? "animate-pulse" : ""}`}
                style={{ height: `${20 + Math.random() * 30}px` }}
              />
            ))}
          </div>
        )}
      </div>

      <p className={`text-sm font-medium ${getStatusColor()}`} data-testid="text-voice-status">
        {getStatusText()}
      </p>

      {debugInfo && (
        <p className="text-xs text-muted-foreground" data-testid="text-voice-debug">{debugInfo}</p>
      )}

      <div className="flex gap-3 items-center">
        <Button
          size="icon"
          variant={isMuted ? "destructive" : "outline"}
          onClick={() => {
            const newMuted = !isMuted;
            setIsMuted(newMuted);
            localParticipant.setMicrophoneEnabled(!newMuted);
          }}
          disabled={!isConnected}
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

export default function VoiceChat({ phone, language, onClose }: VoiceChatProps) {
  const [token, setToken] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const fetchedRef = useRef(false);

  const fetchToken = useCallback(async () => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch("/api/livekit/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, language }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to start voice call");
      }
      const data = await res.json();
      setToken(data.token);
      setUrl(data.url);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [phone, language]);

  useEffect(() => {
    fetchToken();
  }, [fetchToken]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center gap-3 py-8">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">Starting voice call...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-8">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" size="sm" onClick={() => { fetchedRef.current = false; fetchToken(); }}>
          Try Again
        </Button>
      </div>
    );
  }

  if (!token || !url) {
    return null;
  }

  return (
    <LiveKitRoom
      serverUrl={url}
      token={token}
      connect={true}
      audio={true}
      video={false}
      onDisconnected={onClose}
      data-testid="livekit-room"
    >
      <VoiceUI onClose={onClose} />
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}
