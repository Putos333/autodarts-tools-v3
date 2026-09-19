/**
 * face-to-face-client.ts – WebRTC-Peer-to-Peer Video-Verbindung (v2.9.81)
 *
 * - Kein Video verlässt die WebRTC-P2P-Verbindung (Backend nur Signaling).
 * - STUN-Server: Google Public.
 * - Verwendet WebSocket ans FastAPI-Backend /api/face/signal/{code}/{peer_id}.
 */

export interface FaceEvents {
  onRemoteStream: (stream: MediaStream) => void;
  onLocalStream?: (stream: MediaStream) => void;
  onPeerJoined?: () => void;
  onPeerLeft?: () => void;
  onError?: (err: string) => void;
  onConnectionState?: (state: RTCPeerConnectionState) => void;
}

export interface FaceOptions {
  backendUrl: string;
  code: string;
  peerId: string;
  audio?: boolean;
  video?: boolean;
}

const STUN_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

export class FaceSession {
  private pc: RTCPeerConnection | null = null;
  private ws: WebSocket | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private role: "caller" | "callee" | null = null;
  private stopped = false;

  constructor(private opts: FaceOptions, private events: FaceEvents) {}

  async start(): Promise<void> {
    this.pc = new RTCPeerConnection(STUN_SERVERS);
    this.remoteStream = new MediaStream();
    this.pc.ontrack = (ev) => {
      ev.streams[0].getTracks().forEach((t) => this.remoteStream!.addTrack(t));
      this.events.onRemoteStream(this.remoteStream!);
    };
    this.pc.onicecandidate = (ev) => {
      if (ev.candidate) this.sendSignal({ type: "ice", candidate: ev.candidate });
    };
    this.pc.onconnectionstatechange = () => {
      this.events.onConnectionState?.(this.pc!.connectionState);
    };

    // Local Media
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: this.opts.audio ?? true,
        video: this.opts.video ?? { width: 640, height: 480 },
      });
      this.events.onLocalStream?.(this.localStream);
      this.localStream.getTracks().forEach((t) => this.pc!.addTrack(t, this.localStream!));
    } catch (e) {
      this.events.onError?.("Kamera/Mikrofon konnte nicht geöffnet werden: " + (e as Error).message);
      throw e;
    }

    // Signaling WS
    const wsUrl = this.buildWsUrl();
    this.ws = new WebSocket(wsUrl);
    this.ws.onopen = () => { /* nothing */ };
    this.ws.onerror = () => this.events.onError?.("WebSocket-Fehler zum Signaling-Server");
    this.ws.onclose = () => { if (!this.stopped) this.events.onPeerLeft?.(); };
    this.ws.onmessage = (ev) => this.handleSignal(ev.data);
  }

  private buildWsUrl(): string {
    const base = this.opts.backendUrl.replace(/\/+$/, "").replace(/^http/i, (m) => (m.toLowerCase() === "http" ? "ws" : "wss"));
    return `${base}/api/face/signal/${encodeURIComponent(this.opts.code)}/${encodeURIComponent(this.opts.peerId)}`;
  }

  private sendSignal(msg: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private async handleSignal(raw: string): Promise<void> {
    let msg: any;
    try { msg = JSON.parse(raw); } catch { return; }
    switch (msg.type) {
      case "room_full":
        this.events.onError?.("Raum ist voll (max. 2 Teilnehmer)");
        this.stop();
        return;
      case "joined":
        this.role = msg.role;
        // Wenn ein zweiter Peer bereits im Raum ist: sofort Offer erstellen
        if (this.role === "callee") {
          // Callee wartet auf Offer
        } else if (msg.peers >= 2) {
          await this.createOffer();
        }
        return;
      case "peer_joined":
        this.events.onPeerJoined?.();
        // Ich bin Caller → jetzt Offer senden
        if (this.role === "caller") await this.createOffer();
        return;
      case "peer_left":
        this.events.onPeerLeft?.();
        return;
      case "offer":
        await this.pc!.setRemoteDescription(new RTCSessionDescription(msg.sdp));
        const answer = await this.pc!.createAnswer();
        await this.pc!.setLocalDescription(answer);
        this.sendSignal({ type: "answer", sdp: this.pc!.localDescription });
        return;
      case "answer":
        await this.pc!.setRemoteDescription(new RTCSessionDescription(msg.sdp));
        return;
      case "ice":
        try {
          await this.pc!.addIceCandidate(new RTCIceCandidate(msg.candidate));
        } catch (e) { /* ignore duplicates */ }
        return;
      case "hangup":
        this.stop();
        this.events.onPeerLeft?.();
        return;
    }
  }

  private async createOffer(): Promise<void> {
    const offer = await this.pc!.createOffer();
    await this.pc!.setLocalDescription(offer);
    this.sendSignal({ type: "offer", sdp: this.pc!.localDescription });
  }

  toggleAudio(enabled?: boolean): boolean {
    if (!this.localStream) return false;
    const track = this.localStream.getAudioTracks()[0];
    if (!track) return false;
    track.enabled = enabled ?? !track.enabled;
    return track.enabled;
  }

  toggleVideo(enabled?: boolean): boolean {
    if (!this.localStream) return false;
    const track = this.localStream.getVideoTracks()[0];
    if (!track) return false;
    track.enabled = enabled ?? !track.enabled;
    return track.enabled;
  }

  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    try { this.sendSignal({ type: "hangup" }); } catch { /* ignore */ }
    this.localStream?.getTracks().forEach((t) => t.stop());
    this.pc?.close();
    this.ws?.close();
    this.pc = null;
    this.ws = null;
    this.localStream = null;
    this.remoteStream = null;
  }

  getLocalStream(): MediaStream | null { return this.localStream; }
  getRemoteStream(): MediaStream | null { return this.remoteStream; }
}

/** Erstellt einen neuen Raum via REST und liefert den 6-stelligen Code. */
export async function createFaceRoom(backendUrl: string): Promise<string | null> {
  try {
    const resp = await fetch(`${backendUrl.replace(/\/+$/, "")}/api/face/rooms`, { method: "POST" });
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.code ?? null;
  } catch { return null; }
}
