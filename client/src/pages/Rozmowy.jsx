import { useEffect, useRef, useState } from "react";
import socket, { connectSocket } from "../socket/socket";

function Rozmowy() {
  const myVideo = useRef(null);
  const partnerVideo = useRef(null);
  const peerRef = useRef(null);
  const streamRef = useRef(null);

  const [status, setStatus] = useState("Kliknij Start, aby rozpocząć");
  const [partner, setPartner] = useState(null);
  const [cameraReady, setCameraReady] = useState(false);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });

      streamRef.current = stream;

      if (myVideo.current) {
        myVideo.current.srcObject = stream;
      }

      setCameraReady(true);
      setStatus("Kamerka i mikrofon działają");

      return stream;
    } catch (err) {
      console.log(err);
      setStatus("Brak dostępu do kamerki lub mikrofonu");
      return null;
    }
  };

  const createPeer = async initiator => {
    if (!streamRef.current) return;

    const peer = new RTCPeerConnection({
      iceServers: [
        {
          urls: "stun:stun.l.google.com:19302"
        }
      ]
    });

    peerRef.current = peer;

    streamRef.current.getTracks().forEach(track => {
      peer.addTrack(track, streamRef.current);
    });

    peer.ontrack = event => {
      if (partnerVideo.current) {
        partnerVideo.current.srcObject = event.streams[0];
      }
    };

    peer.onicecandidate = event => {
      if (event.candidate) {
        socket.emit("webrtc-signal", {
          candidate: event.candidate
        });
      }
    };

    if (initiator) {
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);

      socket.emit("webrtc-signal", {
        offer
      });
    }
  };

  const startSearching = async () => {
    if (!localStorage.getItem("token")) {
      setStatus("Musisz się zalogować");
      return;
    }

    connectSocket();

    if (!streamRef.current) {
      const stream = await startCamera();
      if (!stream) return;
    }

    setStatus("Szukanie aktywnej osoby...");
    socket.emit("find-video");
  };

  const next = () => {
    if (peerRef.current) {
      peerRef.current.close();
      peerRef.current = null;
    }

    if (partnerVideo.current) {
      partnerVideo.current.srcObject = null;
    }

    setPartner(null);
    setStatus("Szukanie nowej osoby...");
    socket.emit("next", "video");
    socket.emit("find-video");
  };

  const stop = () => {
    socket.emit("stop");

    if (peerRef.current) {
      peerRef.current.close();
      peerRef.current = null;
    }

    if (partnerVideo.current) {
      partnerVideo.current.srcObject = null;
    }

    setPartner(null);
    setStatus("Zatrzymano rozmowę");
  };

  const addFriend = () => {
    if (!partner) {
      alert("Najpierw połącz się z rozmówcą");
      return;
    }

    socket.emit("send-friend-request", partner.id);
    alert("Wysłano zaproszenie do znajomych");
  };

  useEffect(() => {
    socket.on("video-searching", () => {
      setStatus("Szukanie aktywnej osoby...");
    });

    socket.on("video-found", async data => {
      setStatus("Połączono");
      setPartner(data.partner);

      try {
        await createPeer(data.initiator);
      } catch (err) {
        console.log(err);
        setStatus("Błąd połączenia video");
      }
    });

    socket.on("webrtc-signal", async data => {
      try {
        if (!peerRef.current) {
          await createPeer(false);
        }

        const peer = peerRef.current;

        if (!peer) return;

        if (data.offer) {
          await peer.setRemoteDescription(
            new RTCSessionDescription(data.offer)
          );

          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);

          socket.emit("webrtc-signal", {
            answer
          });
        }

        if (data.answer) {
          await peer.setRemoteDescription(
            new RTCSessionDescription(data.answer)
          );
        }

        if (data.candidate) {
          await peer.addIceCandidate(
            new RTCIceCandidate(data.candidate)
          );
        }
      } catch (err) {
        console.log(err);
      }
    });

    socket.on("partner-left", () => {
      if (partnerVideo.current) {
        partnerVideo.current.srcObject = null;
      }

      if (peerRef.current) {
        peerRef.current.close();
        peerRef.current = null;
      }

      setPartner(null);
      setStatus("Rozmówca wyszedł");
    });

    return () => {
      socket.off("video-searching");
      socket.off("video-found");
      socket.off("webrtc-signal");
      socket.off("partner-left");
    };
  }, []);

  return (
    <div className="page">
      <h1 className="title">Rozmowy Video</h1>

      <p className="status">{status}</p>

      <div className="buttons">
        <button className="blue" onClick={startSearching}>
          {cameraReady ? "Szukaj rozmówcy" : "Start kamerki"}
        </button>
      </div>

      <div className="videoWrapper">
        <div className="videoCard">
          <div className="videoLabel">
            {partner ? partner.nick : "Losowy użytkownik"}
          </div>

          <div className="videoBox">
            <video ref={partnerVideo} autoPlay playsInline />
          </div>
        </div>

        <div className="videoCard">
          <div className="videoLabel">Ty</div>

          <div className="videoBox">
            <video ref={myVideo} autoPlay muted playsInline />
          </div>
        </div>
      </div>

      <div className="buttons">
        <button className="green" onClick={addFriend}>
          Dodaj znajomego
        </button>

        <button className="red" onClick={stop}>
          Stop
        </button>

        <button className="blue" onClick={next}>
          Dalej
        </button>
      </div>
    </div>
  );
}

export default Rozmowy;