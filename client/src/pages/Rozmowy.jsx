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
  const [activeUsers, setActiveUsers] = useState(0);

  const [filterCountry, setFilterCountry] = useState("dowolny");
  const [filterGender, setFilterGender] = useState("dowolny");

  const [microphones, setMicrophones] = useState([]);
  const [selectedMic, setSelectedMic] = useState("");

  const loadDevices = async () => {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const mics = devices.filter(device => device.kind === "audioinput");
    setMicrophones(mics);

    if (mics[0] && !selectedMic) {
      setSelectedMic(mics[0].deviceId);
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: selectedMic
          ? { deviceId: { exact: selectedMic } }
          : true
      });

      streamRef.current = stream;

      if (myVideo.current) {
        myVideo.current.srcObject = stream;
      }

      setCameraReady(true);
      setStatus("Kamerka i mikrofon działają");

      await loadDevices();

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
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
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

      socket.emit("webrtc-signal", { offer });
    }
  };

  const startSearching = async () => {
    if (!localStorage.getItem("token")) {
      setStatus("Musisz się zalogować");
      return;
    }

    if (!streamRef.current) {
      const stream = await startCamera();
      if (!stream) return;
    }

    connectSocket();

    setStatus("Szukanie aktywnej osoby...");

    const data = {
      country: filterCountry,
      gender: filterGender
    };

    if (socket.connected) {
      socket.emit("find-video", data);
    } else {
      socket.once("connect", () => {
        socket.emit("find-video", data);
      });
    }
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

    socket.emit("next", {
      type: "video",
      country: filterCountry,
      gender: filterGender
    });
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

  const reportUser = () => {
    if (!partner) {
      alert("Najpierw połącz się z rozmówcą");
      return;
    }

    const reason = prompt("Powód zgłoszenia:");

    if (!reason) return;

    socket.emit("report-user", {
      targetId: partner.id,
      reason,
      type: "video"
    });

    alert("Wysłano zgłoszenie");
  };

  useEffect(() => {
    connectSocket();
    loadDevices();

    socket.on("online-users", users => {
      setActiveUsers(users.length);
    });

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
          await peer.setRemoteDescription(new RTCSessionDescription(data.offer));
          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          socket.emit("webrtc-signal", { answer });
        }

        if (data.answer) {
          await peer.setRemoteDescription(new RTCSessionDescription(data.answer));
        }

        if (data.candidate) {
          await peer.addIceCandidate(new RTCIceCandidate(data.candidate));
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
      socket.off("online-users");
      socket.off("video-searching");
      socket.off("video-found");
      socket.off("webrtc-signal");
      socket.off("partner-left");
    };
  }, []);

  return (
    <div className="page">
      <div className="particlesBg"></div>

      <h1 className="title neonTitle">Rozmowy Video</h1>

      <p className="status">{status}</p>

      <div className="filterBar">
        <select value={filterCountry} onChange={e => setFilterCountry(e.target.value)}>
          <option value="dowolny">Dowolny kraj</option>
          <option value="Polska">Polska</option>
          <option value="Niemcy">Niemcy</option>
          <option value="Czechy">Czechy</option>
          <option value="Ukraina">Ukraina</option>
          <option value="USA">USA</option>
        </select>

        <select value={filterGender} onChange={e => setFilterGender(e.target.value)}>
          <option value="dowolny">Dowolna płeć</option>
          <option value="kobieta">Kobieta</option>
          <option value="mezczyzna">Mężczyzna</option>
          <option value="inna">Inna</option>
        </select>

        <select
          className="deviceSelect"
          value={selectedMic}
          onChange={e => setSelectedMic(e.target.value)}
        >
          <option value="">Domyślny mikrofon</option>

          {microphones.map(mic => (
            <option key={mic.deviceId} value={mic.deviceId}>
              {mic.label || "Mikrofon"}
            </option>
          ))}
        </select>
      </div>

      <div className="buttons">
        <button className="blue" onClick={startSearching}>
          {cameraReady ? "Szukaj rozmówcy" : "Start kamerki"}
        </button>
      </div>

      <div className="videoWrapper">
        <div className="videoCard">
          <div className="videoLabel">Ty</div>

          <div className="videoBox">
            <video ref={myVideo} autoPlay muted playsInline />
          </div>
        </div>

        <div className="videoCard">
          <div className="videoLabel">
            {partner
              ? `${partner.nick} • ${partner.age} lat • ${partner.country || "brak kraju"}`
              : "Losowy użytkownik"}
          </div>

          <div className="videoBox">
            <video ref={partnerVideo} autoPlay playsInline />
          </div>
        </div>
      </div>

      <div className="buttons">
        <button className="green" onClick={addFriend}>Dodaj znajomego</button>
        <button className="dark" onClick={reportUser}>Zgłoś</button>
        <button className="red" onClick={stop}>Stop</button>
        <button className="blue" onClick={next}>Dalej</button>
      </div>

      <div className="activeUsersBox">
        🟢 Aktywni użytkownicy: {activeUsers}
      </div>
    </div>
  );
}

export default Rozmowy;