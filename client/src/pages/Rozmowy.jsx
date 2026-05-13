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
  const [searching, setSearching] = useState(false);
  const [connected, setConnected] = useState(false);
  const [activeUsers, setActiveUsers] = useState(0);

  const [filterCountry, setFilterCountry] = useState("dowolny");
  const [filterGender, setFilterGender] = useState("dowolny");

  const [microphones, setMicrophones] = useState([]);
  const [selectedMic, setSelectedMic] = useState("");

  const loadDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const mics = devices.filter(device => device.kind === "audioinput");

      setMicrophones(mics);

      if (mics[0] && !selectedMic) {
        setSelectedMic(mics[0].deviceId);
      }
    } catch (err) {
      console.log(err);
    }
  };

  const stopTracks = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const startCamera = async () => {
    try {
      stopTracks();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: selectedMic
          ? {
              deviceId: {
                exact: selectedMic
              }
            }
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

    if (!streamRef.current) {
      const stream = await startCamera();

      if (!stream) return;
    }

    connectSocket();

    setSearching(true);
    setConnected(false);
    setPartner(null);
    setStatus("Szukanie aktywnej osoby...");

    const filters = {
      country: filterCountry,
      gender: filterGender
    };

    if (socket.connected) {
      socket.emit("find-video", filters);
    } else {
      socket.once("connect", () => {
        socket.emit("find-video", filters);
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
    setConnected(false);
    setSearching(true);
    setStatus("Szukanie nowej osoby...");

    socket.emit("next", "video");
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
    setSearching(false);
    setConnected(false);
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

  const changeMicrophone = async value => {
    setSelectedMic(value);

    if (cameraReady) {
      setTimeout(() => {
        startCamera();
      }, 100);
    }
  };

  useEffect(() => {
    connectSocket();
    loadDevices();

    socket.on("online-users", users => {
      setActiveUsers(users.length);
    });

    socket.on("video-searching", () => {
      setSearching(true);
      setConnected(false);
      setStatus("Szukanie aktywnej osoby...");
    });

    socket.on("video-found", async data => {
      setSearching(false);
      setConnected(true);
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
      setConnected(false);
      setSearching(false);
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
    <div className="page rozmowyPage">
      <h1 className="title">Rozmowy Video</h1>

      <p className="status">{status}</p>

      <div className="matchFilters">
        <div className="filterCard">
          <span>🌍 Kraj rozmówcy</span>

          <select
            value={filterCountry}
            onChange={e => setFilterCountry(e.target.value)}
          >
            <option value="dowolny">Dowolny kraj</option>
            <option value="Polska">Polska</option>
            <option value="Niemcy">Niemcy</option>
            <option value="Czechy">Czechy</option>
            <option value="Ukraina">Ukraina</option>
            <option value="USA">USA</option>
          </select>
        </div>

        <div className="filterCard">
          <span>🧑 Płeć rozmówcy</span>

          <select
            value={filterGender}
            onChange={e => setFilterGender(e.target.value)}
          >
            <option value="dowolny">Dowolna płeć</option>
            <option value="kobieta">Kobieta</option>
            <option value="mezczyzna">Mężczyzna</option>
            <option value="inna">Inna</option>
          </select>
        </div>
      </div>

      <div className="buttons topVideoButtons">
        <button className="blue mainStartButton" onClick={startSearching}>
          {cameraReady ? "Szukaj rozmówcy" : "Start kamerki"}
        </button>
      </div>

      <div className="videoWrapper">
        <div className="videoCard">
          <div className="videoLabel">Ty</div>

          <div className="videoBox">
            {cameraReady ? (
              <video ref={myVideo} autoPlay muted playsInline />
            ) : (
              <div className="videoPlaceholder">
                <div className="placeholderIcon">🎥</div>
                <h3>Twoja kamera</h3>
                <p>Kliknij Start kamerki, aby uruchomić podgląd.</p>
              </div>
            )}
          </div>

          <div className="micPanel">
            <div>
              <strong>🎙️ Mikrofon</strong>
              <p>Wybierz urządzenie audio</p>
            </div>

            <select
              value={selectedMic}
              onChange={e => changeMicrophone(e.target.value)}
            >
              <option value="">Domyślny mikrofon</option>

              {microphones.map(mic => (
                <option key={mic.deviceId} value={mic.deviceId}>
                  {mic.label || "Mikrofon"}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="videoCard">
          <div className="videoLabel">
            {partner
              ? `${partner.nick} • ${partner.age} lat`
              : "Losowy użytkownik"}
          </div>

          <div className="videoBox">
            {connected ? (
              <video ref={partnerVideo} autoPlay playsInline />
            ) : (
              <div className="videoPlaceholder partnerPlaceholder">
                <div className="placeholderPulse"></div>
                <div className="placeholderIcon">✨</div>

                <h3>
                  {searching
                    ? "Szukamy rozmówcy..."
                    : "Gotowy na rozmowę?"}
                </h3>

                <p>
                  {searching
                    ? "Trwa losowanie aktywnej osoby online."
                    : "Po kliknięciu Start pojawi się tutaj kamera rozmówcy."}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="buttons">
        <button className="green" onClick={addFriend}>
          Dodaj znajomego
        </button>

        <button className="dark" onClick={reportUser}>
          Zgłoś
        </button>

        <button className="red" onClick={stop}>
          Stop
        </button>

        <button className="blue" onClick={next}>
          Dalej
        </button>
      </div>

      <div className="activeUsersBox">
        🟢 Aktywni użytkownicy: {activeUsers}
      </div>
    </div>
  );
}

export default Rozmowy;