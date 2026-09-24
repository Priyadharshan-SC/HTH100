"use client";

import { getSocket } from "./socket";
import { playVoiceStartCue, playVoiceEndCue, routeMediaStreamToAudioContext } from "./soundFX";

export type VoiceQuality = "GOOD" | "DEGRADED" | "POOR";

export interface VoiceStats {
  quality: VoiceQuality;
  rtt: number; // in ms
  packetLoss: number; // in %
  jitter: number; // in ms
}

export interface VoiceSessionInfo {
  active: boolean;
  sessionId?: string;
  adminId: string | null;
  adminName: string | null;
  adminSocketId: string | null;
  startedAt: string | null;
  isMuted: boolean;
}

// Configurable WebRTC ICE Servers (STUN & optional TURN for enterprise/LAN deployment)
export const getRtcConfig = (): RTCConfiguration => {
  const customIce = typeof process !== "undefined" ? process.env?.NEXT_PUBLIC_ICE_SERVERS : undefined;
  if (customIce) {
    try {
      const parsed = JSON.parse(customIce);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return { iceServers: parsed };
      }
    } catch {}
  }
  return {
    iceServers: [
      { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
      { urls: ["stun:stun2.l.google.com:19302", "stun:stun3.l.google.com:19302"] },
      { urls: ["stun:stun.cloudflare.com:3478"] },
    ],
  };
};

/* =========================================================================
   RECEIVER CLIENT (End Screen / Smart Board)
   Receives WebRTC audio track from active voice session
   ========================================================================= */

export class SmartBoardVoiceReceiver {
  private peerConnection: RTCPeerConnection | null = null;
  private currentPeerConnectionId: string | null = null;
  private currentVoiceSessionId: string | null = null;
  private audioEl: HTMLAudioElement | null = null;
  private remoteStream: MediaStream | null = null;
  private statsInterval: NodeJS.Timeout | null = null;
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private onTrackCallback?: (stream: MediaStream) => void;
  private onStateChangeCallback?: (state: "STANDBY" | "CONNECTING" | "CONNECTED" | "SPEAKING" | "DISCONNECTED") => void;
  private onStatsCallback?: (stats: VoiceStats) => void;
  private onPlaybackBlockedCallback?: () => void;
  private isMuted: boolean = false;
  private activeSession: VoiceSessionInfo | null = null;

  constructor(options: {
    audioElement?: HTMLAudioElement | null;
    onTrack?: (stream: MediaStream) => void;
    onStateChange?: (state: "STANDBY" | "CONNECTING" | "CONNECTED" | "SPEAKING" | "DISCONNECTED") => void;
    onStats?: (stats: VoiceStats) => void;
    onPlaybackBlocked?: () => void;
  }) {
    this.audioEl = options.audioElement || null;
    this.onTrackCallback = options.onTrack;
    this.onStateChangeCallback = options.onStateChange;
    this.onStatsCallback = options.onStats;
    this.onPlaybackBlockedCallback = options.onPlaybackBlocked;
  }

  public init(venueCode?: string, displayId?: string) {
    const socket = getSocket();

    const storedVenue = venueCode || (typeof window !== "undefined" ? window.localStorage?.getItem("hth_venue_code") : null) || "VENUE-01";
    const storedDisplay = displayId || (typeof window !== "undefined" ? window.localStorage?.getItem("hth_display_id") : null) || "DISPLAY-01";

    socket.emit("register-display", {
      venueCode: storedVenue,
      displayId: storedDisplay,
      displayName: `${storedVenue} / ${storedDisplay}`,
    });

    const handleVoiceStart = (data: { session: VoiceSessionInfo }) => {
      this.activeSession = data.session;
      this.currentVoiceSessionId = data.session?.sessionId || `session-${Date.now()}`;
      this.isMuted = data.session?.isMuted || false;
      playVoiceStartCue();
      this.onStateChangeCallback?.("CONNECTING");

      // Request stream from broadcaster
      socket.emit("voice-request-stream", {
        receiverSocketId: socket.id,
        voiceSessionId: this.currentVoiceSessionId,
      });
    };

    const handleVoiceEnd = () => {
      this.activeSession = null;
      this.currentVoiceSessionId = null;
      playVoiceEndCue();
      this.cleanupRTC();
      this.onStateChangeCallback?.("STANDBY");
    };

    const handleVoiceMute = (data: { isMuted: boolean }) => {
      this.isMuted = data.isMuted;
      if (this.isMuted) {
        this.onStateChangeCallback?.("CONNECTED");
      } else if (this.remoteStream) {
        this.onStateChangeCallback?.("SPEAKING");
      }
    };

    socket.on("voice-session-started", handleVoiceStart);
    socket.on("VOICE_STARTED", handleVoiceStart);

    socket.on("voice-session-ended", handleVoiceEnd);
    socket.on("VOICE_ENDED", handleVoiceEnd);

    socket.on("voice-mute-updated", handleVoiceMute);
    socket.on("VOICE_MUTED", () => handleVoiceMute({ isMuted: true }));
    socket.on("VOICE_UNMUTED", () => handleVoiceMute({ isMuted: false }));

    // WebRTC Signaling
    socket.on(
      "voice-signal-offer",
      async (data: {
        offer: RTCSessionDescriptionInit;
        from: string;
        voiceSessionId: string;
        peerConnectionId: string;
      }) => {
        await this.handleOffer(data);
      }
    );

    socket.on(
      "voice-signal-ice",
      async (data: {
        candidate: RTCIceCandidateInit;
        peerConnectionId: string;
        voiceSessionId: string;
      }) => {
        if (!data.candidate || data.peerConnectionId !== this.currentPeerConnectionId) {
          return;
        }

        if (this.peerConnection && this.peerConnection.remoteDescription) {
          try {
            await this.peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
          } catch (e) {
            console.warn("Receiver error adding ICE candidate:", e);
          }
        } else {
          // Queue ICE candidate until remote description is set
          this.pendingCandidates.push(data.candidate);
        }
      }
    );

    // Initial check: if already active on page load
    socket.emit("voice-get-state", (session: VoiceSessionInfo | null) => {
      if (session && session.active) {
        this.activeSession = session;
        this.currentVoiceSessionId = session.sessionId || `session-${Date.now()}`;
        this.isMuted = session.isMuted;
        this.onStateChangeCallback?.("CONNECTING");
        socket.emit("voice-request-stream", {
          receiverSocketId: socket.id,
          voiceSessionId: this.currentVoiceSessionId,
        });
      } else {
        this.onStateChangeCallback?.("STANDBY");
      }
    });
  }

  private async handleOffer(data: {
    offer: RTCSessionDescriptionInit;
    from: string;
    voiceSessionId: string;
    peerConnectionId: string;
  }) {
    // 1. Cleanup any previous connection cleanly before establishing new one
    this.cleanupRTC();
    const socket = getSocket();

    this.currentPeerConnectionId = data.peerConnectionId;
    this.currentVoiceSessionId = data.voiceSessionId;
    this.pendingCandidates = [];

    const pc = new RTCPeerConnection(getRtcConfig());
    this.peerConnection = pc;

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("voice-signal-ice", {
          target: data.from,
          candidate: event.candidate,
          voiceSessionId: data.voiceSessionId,
          peerConnectionId: data.peerConnectionId,
        });
      }
    };

    pc.ontrack = (event) => {
      const stream = event.streams[0] || new MediaStream([event.track]);
      this.remoteStream = stream;

      // 1. Primary HTML5 Audio Element playback
      if (this.audioEl) {
        this.audioEl.srcObject = stream;
        this.audioEl.muted = false;
        this.audioEl.volume = 1.0;
        this.audioEl.play().catch((err) => {
          console.warn("Smart Board audio playback restricted by browser policy:", err);
          this.onPlaybackBlockedCallback?.();
        });
      }

      // 2. Dual-channel Web Audio Context routing (Bypasses Smart TV element restrictions)
      routeMediaStreamToAudioContext(stream);

      this.onTrackCallback?.(stream);

      if (this.isMuted) {
        this.onStateChangeCallback?.("CONNECTED");
      } else {
        this.onStateChangeCallback?.("SPEAKING");
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
        this.onStateChangeCallback?.("DISCONNECTED");
      } else if (pc.connectionState === "connected") {
        this.startStatsMonitoring();
      }
    };

    // State machine check: setRemoteDescription(offer) only when in stable or closed state
    if (pc.signalingState !== "stable") {
      console.warn(`[WebRTC Receiver] Unexpected signaling state: ${pc.signalingState}, expected stable`);
      return;
    }

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(data.offer));

      // Process any queued ICE candidates that arrived before offer was set
      for (const candidate of this.pendingCandidates) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          // ignore queued candidate error
        }
      }
      this.pendingCandidates = [];

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit("voice-signal-answer", {
        target: data.from,
        voiceSessionId: data.voiceSessionId,
        peerConnectionId: data.peerConnectionId,
        answer,
      });
    } catch (err) {
      console.error("[WebRTC Receiver] Negotiation error:", err);
    }
  }

  private startStatsMonitoring() {
    if (this.statsInterval) clearInterval(this.statsInterval);

    this.statsInterval = setInterval(async () => {
      if (!this.peerConnection) return;
      try {
        const stats = await this.peerConnection.getStats();
        let rtt = 15;
        let packetLoss = 0;
        let jitter = 2;

        stats.forEach((report: any) => {
          if (report.type === "candidate-pair" && report.currentRoundTripTime) {
            rtt = Math.round(report.currentRoundTripTime * 1000);
          }
          if (report.type === "inbound-rtp" && report.kind === "audio") {
            if (report.packetsLost && report.packetsReceived) {
              const total = report.packetsLost + report.packetsReceived;
              packetLoss = Math.round((report.packetsLost / total) * 100);
            }
            if (report.jitter) {
              jitter = Math.round(report.jitter * 1000);
            }
          }
        });

        let quality: VoiceQuality = "GOOD";
        if (rtt > 400 || packetLoss > 5) quality = "POOR";
        else if (rtt > 200 || packetLoss > 2) quality = "DEGRADED";

        this.onStatsCallback?.({ quality, rtt, packetLoss, jitter });
      } catch (e) {
        // ignore stats error
      }
    }, 2000);
  }

  private cleanupRTC() {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }
    if (this.peerConnection) {
      this.peerConnection.onicecandidate = null;
      this.peerConnection.ontrack = null;
      this.peerConnection.onconnectionstatechange = null;
      this.peerConnection.close();
      this.peerConnection = null;
    }
    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach((t) => t.stop());
      this.remoteStream = null;
    }
    this.currentPeerConnectionId = null;
    this.pendingCandidates = [];
  }

  public destroy() {
    this.cleanupRTC();
  }
}

/* =========================================================================
   BROADCASTER CLIENT (Admin Portal)
   Publishes microphone stream via WebRTC with state machine validation
   ========================================================================= */

interface PeerEntry {
  peerConnectionId: string;
  pc: RTCPeerConnection;
  isNegotiating: boolean;
  hasAppliedAnswer: boolean;
  pendingCandidates: RTCIceCandidateInit[];
}

export class AdminVoiceBroadcaster {
  private localStream: MediaStream | null = null;
  private peerEntries: Map<string, PeerEntry> = new Map();
  private currentVoiceSessionId: string | null = null;
  private isMuted: boolean = false;
  private statsInterval: NodeJS.Timeout | null = null;
  private onStatsCallback?: (stats: VoiceStats) => void;

  public async startBroadcast(adminName: string, adminId: string): Promise<{ success: boolean; error?: string }> {
    const socket = getSocket();

    // 1. Get microphone with speech optimization
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1, // Mono speech optimization
          sampleRate: 48000,
        },
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Microphone permission denied";
      return { success: false, error: errorMsg };
    }

    this.currentVoiceSessionId = `session-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    // 2. Request voice session lock from server
    return new Promise((resolve) => {
      socket.emit(
        "voice-start-session",
        {
          adminName,
          adminId,
          sessionId: this.currentVoiceSessionId,
        },
        (res: { success: boolean; error?: string; owner?: string; session?: VoiceSessionInfo }) => {
          if (!res.success) {
            this.stopBroadcast();
            resolve({ success: false, error: res.error || "Broadcast locked by another admin" });
            return;
          }

          if (res.session?.sessionId) {
            this.currentVoiceSessionId = res.session.sessionId;
          }

          // Handle incoming stream requests from receivers
          socket.on("voice-request-stream", async (data: { receiverSocketId: string; voiceSessionId?: string }) => {
            if (data.voiceSessionId && data.voiceSessionId !== this.currentVoiceSessionId) {
              console.warn("[WebRTC Broadcaster] Ignoring request for obsolete session:", data.voiceSessionId);
              return;
            }
            await this.createConnectionForReceiver(data.receiverSocketId);
          });

          // State-Machine protected answer handler (PREVENTS "Called in wrong state: stable" ERROR)
          socket.on(
            "voice-signal-answer",
            async (data: {
              from: string;
              voiceSessionId: string;
              peerConnectionId: string;
              answer: RTCSessionDescriptionInit;
            }) => {
              // Guard 1: Verify current active session ID
              if (data.voiceSessionId !== this.currentVoiceSessionId) {
                console.warn("[WebRTC Broadcaster] Discarding answer from obsolete session:", data.voiceSessionId);
                return;
              }

              // Guard 2: Verify peer connection exists and ID matches
              const entry = this.peerEntries.get(data.from);
              if (!entry || entry.peerConnectionId !== data.peerConnectionId) {
                console.warn("[WebRTC Broadcaster] Discarding answer for unmatched peer connection:", data.peerConnectionId);
                return;
              }

              // Guard 3: CRITICAL STATE MACHINE CHECK
              // Only call setRemoteDescription when in "have-local-offer" state!
              if (entry.pc.signalingState !== "have-local-offer") {
                console.warn(
                  `[WebRTC Broadcaster] Discarding answer: RTCPeerConnection is in '${entry.pc.signalingState}' state, expected 'have-local-offer'`
                );
                return;
              }

              if (entry.hasAppliedAnswer) {
                console.warn("[WebRTC Broadcaster] Discarding duplicate answer for:", data.peerConnectionId);
                return;
              }

              try {
                entry.hasAppliedAnswer = true;
                await entry.pc.setRemoteDescription(new RTCSessionDescription(data.answer));
                entry.isNegotiating = false;

                // Process any queued candidates
                for (const candidate of entry.pendingCandidates) {
                  try {
                    await entry.pc.addIceCandidate(new RTCIceCandidate(candidate));
                  } catch (e) {
                    // ignore
                  }
                }
                entry.pendingCandidates = [];
              } catch (err) {
                console.error("[WebRTC Broadcaster] Error applying remote answer:", err);
              }
            }
          );

          // Handle ICE candidates safely
          socket.on(
            "voice-signal-ice",
            async (data: {
              from: string;
              voiceSessionId: string;
              peerConnectionId: string;
              candidate: RTCIceCandidateInit;
            }) => {
              const entry = this.peerEntries.get(data.from);
              if (!entry || entry.peerConnectionId !== data.peerConnectionId) {
                return;
              }

              if (entry.pc && entry.pc.remoteDescription) {
                try {
                  await entry.pc.addIceCandidate(new RTCIceCandidate(data.candidate));
                } catch (e) {
                  // ignore
                }
              } else if (entry) {
                entry.pendingCandidates.push(data.candidate);
              }
            }
          );

          this.startBroadcasterStats();
          resolve({ success: true });
        }
      );
    });
  }

  private async createConnectionForReceiver(receiverSocketId: string) {
    if (!this.localStream || !this.currentVoiceSessionId) return;
    const socket = getSocket();

    // Cleanup previous connection for this receiver if any
    const existing = this.peerEntries.get(receiverSocketId);
    if (existing) {
      existing.pc.onicecandidate = null;
      existing.pc.onconnectionstatechange = null;
      existing.pc.close();
      this.peerEntries.delete(receiverSocketId);
    }

    const peerConnectionId = `peer-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const pc = new RTCPeerConnection(getRtcConfig());

    const entry: PeerEntry = {
      peerConnectionId,
      pc,
      isNegotiating: true,
      hasAppliedAnswer: false,
      pendingCandidates: [],
    };
    this.peerEntries.set(receiverSocketId, entry);

    // Add audio track with Opus interactive low-latency configuration
    this.localStream.getAudioTracks().forEach((track) => {
      pc.addTrack(track, this.localStream!);
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("voice-signal-ice", {
          target: receiverSocketId,
          voiceSessionId: this.currentVoiceSessionId,
          peerConnectionId,
          candidate: event.candidate,
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
        pc.close();
        this.peerEntries.delete(receiverSocketId);
      }
    };

    try {
      const offer = await pc.createOffer({
        offerToReceiveAudio: false,
        offerToReceiveVideo: false,
      });

      // Ensure state is stable before setting local offer
      if (pc.signalingState === "stable") {
        await pc.setLocalDescription(offer);

        socket.emit("voice-signal-offer", {
          target: receiverSocketId,
          voiceSessionId: this.currentVoiceSessionId,
          peerConnectionId,
          offer,
        });
      }
    } catch (err) {
      console.error("[WebRTC Broadcaster] createOffer error:", err);
      entry.isNegotiating = false;
    }
  }

  public setMute(muted: boolean) {
    this.isMuted = muted;
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
    }
    const socket = getSocket();
    socket.emit("voice-mute-toggle", { isMuted: muted });
  }

  public stopBroadcast() {
    const socket = getSocket();
    socket.emit("voice-end-session");

    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }

    this.peerEntries.forEach((entry) => {
      entry.pc.onicecandidate = null;
      entry.pc.onconnectionstatechange = null;
      entry.pc.close();
    });
    this.peerEntries.clear();
    this.currentVoiceSessionId = null;

    socket.off("voice-request-stream");
    socket.off("voice-signal-answer");
    socket.off("voice-signal-ice");
  }

  public getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  public setStatsCallback(cb: (stats: VoiceStats) => void) {
    this.onStatsCallback = cb;
  }

  private startBroadcasterStats() {
    if (this.statsInterval) clearInterval(this.statsInterval);

    this.statsInterval = setInterval(async () => {
      let totalRtt = 0;
      let count = 0;

      this.peerEntries.forEach(async (entry) => {
        try {
          const stats = await entry.pc.getStats();
          stats.forEach((report: any) => {
            if (report.type === "candidate-pair" && report.currentRoundTripTime) {
              totalRtt += report.currentRoundTripTime * 1000;
              count++;
            }
          });
        } catch (e) {
          // ignore
        }
      });

      const avgRtt = count > 0 ? Math.round(totalRtt / count) : 15;
      let quality: VoiceQuality = "GOOD";
      if (avgRtt > 400) quality = "POOR";
      else if (avgRtt > 200) quality = "DEGRADED";

      this.onStatsCallback?.({
        quality,
        rtt: avgRtt,
        packetLoss: 0,
        jitter: 1,
      });
    }, 2000);
  }
}
