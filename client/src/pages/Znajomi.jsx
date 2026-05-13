import { useEffect, useRef, useState } from "react";
import socket, { SERVER_URL, connectSocket } from "../socket/socket";

function Znajomi() {
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [activeFriend, setActiveFriend] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [typingUser, setTypingUser] = useState("");
  const [recording, setRecording] = useState(false);

  const messagesEndRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);

  const user = JSON.parse(localStorage.getItem("user") || "null");

  const scrollBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  const requestNotifications = async () => {
    if (!("Notification" in window)) return;

    if (Notification.permission === "default") {
      await Notification.requestPermission();
    }
  };

  const showNotification = data => {
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    new Notification(`Nowa wiadomość od ${data.from.nick}`, {
      body: data.text,
      icon: "/favicon.svg"
    });
  };

  const loadFriends = async () => {
    const res = await fetch(`${SERVER_URL}/api/friends`, {
      headers: {
        Authorization: localStorage.getItem("token")
      }
    });

    const data = await res.json();
    setFriends(data);
  };

  const loadRequests = async () => {
    const res = await fetch(`${SERVER_URL}/api/friend-requests`, {
      headers: {
        Authorization: localStorage.getItem("token")
      }
    });

    const data = await res.json();
    setRequests(data);
  };

  const loadMessages = async friend => {
    setActiveFriend(friend);

    const res = await fetch(`${SERVER_URL}/api/private/${friend.id}`, {
      headers: {
        Authorization: localStorage.getItem("token")
      }
    });

    const data = await res.json();
    setMessages(data);

    socket.emit("private-read", {
      friendId: friend.id
    });

    scrollBottom();
  };

  const acceptRequest = requestId => {
    socket.emit("accept-friend-request", requestId);

    setTimeout(() => {
      loadFriends();
      loadRequests();
    }, 300);
  };

  const rejectRequest = requestId => {
    socket.emit("reject-friend-request", requestId);

    setTimeout(() => {
      loadRequests();
    }, 300);
  };

  const sendMessage = payload => {
    if (!activeFriend) {
      alert("Wybierz znajomego");
      return;
    }

    socket.emit("private-message", {
      to: activeFriend.id,
      text: payload.text || "",
      media: payload.media || "",
      mediaType: payload.mediaType || "",
      fileName: payload.fileName || "",
      voice: payload.voice || "",
      video: payload.video || "",
      image: payload.image || ""
    });

    setText("");
  };

  const sendText = () => {
    if (!text.trim()) return;

    sendMessage({
      text
    });
  };

  const handleTyping = value => {
    setText(value);

    if (!activeFriend) return;

    socket.emit("private-typing", {
      to: activeFriend.id
    });
  };

  const sendFile = e => {
    const file = e.target.files[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      const base64 = reader.result;

      if (file.type.startsWith("image/")) {
        sendMessage({
          image: base64,
          media: base64,
          mediaType: "image",
          fileName: file.name
        });
      }

      if (file.type.startsWith("video/")) {
        sendMessage({
          video: base64,
          media: base64,
          mediaType: "video",
          fileName: file.name
        });
      }
    };

    reader.readAsDataURL(file);
  };

  const startVoice = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true
      });

      chunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;

      recorder.ondataavailable = e => {
        chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: "audio/webm"
        });

        const reader = new FileReader();

        reader.onload = () => {
          sendMessage({
            voice: reader.result,
            media: reader.result,
            mediaType: "voice",
            fileName: "voice-message.webm"
          });
        };

        reader.readAsDataURL(blob);

        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setRecording(true);
    } catch (err) {
      console.log(err);
      alert("Brak dostępu do mikrofonu");
    }
  };

  const stopVoice = () => {
    if (!recorderRef.current) return;

    recorderRef.current.stop();
    setRecording(false);
  };

  useEffect(() => {
    connectSocket();
    requestNotifications();
    loadFriends();
    loadRequests();

    socket.on("new-friend-request", () => {
      loadRequests();
    });

    socket.on("friend-request-accepted", () => {
      loadFriends();
      loadRequests();
    });

    socket.on("friend-request-rejected", () => {
      loadRequests();
    });

    socket.on("private-message", msg => {
      setMessages(prev => {
        const exists = prev.some(m => m.id === msg.id);
        if (exists) return prev;
        return [...prev, msg];
      });

      if (activeFriend && msg.from === activeFriend.id) {
        socket.emit("private-read", {
          friendId: activeFriend.id
        });
      }

      scrollBottom();
    });

    socket.on("private-typing", data => {
      if (!activeFriend) return;
      if (data.from !== activeFriend.id) return;

      setTypingUser(`${data.nick} pisze...`);

      setTimeout(() => {
        setTypingUser("");
      }, 1500);
    });

    socket.on("private-read", data => {
      if (!activeFriend) return;
      if (data.by !== activeFriend.id) return;

      setMessages(prev =>
        prev.map(msg => {
          if (msg.from === user?.id) {
            return {
              ...msg,
              read: true
            };
          }

          return msg;
        })
      );
    });

    socket.on("private-notification", data => {
      showNotification(data);
    });

    return () => {
      socket.off("new-friend-request");
      socket.off("friend-request-accepted");
      socket.off("friend-request-rejected");
      socket.off("private-message");
      socket.off("private-typing");
      socket.off("private-read");
      socket.off("private-notification");
    };
  }, [activeFriend]);

  return (
    <div className="friendLayout discordStyle">
      <div className="friendList discordSidebar">
        <h2>Zaproszenia</h2>

        {requests.length === 0 && (
          <p className="mutedText">Brak zaproszeń</p>
        )}

        {requests.map(request => (
          <div key={request.id} className="friendRequestCard">
            <strong>{request.from.nick}</strong>

            <p>
              {request.from.name}, {request.from.age} lat
            </p>

            <div className="miniButtons">
              <button className="green" onClick={() => acceptRequest(request.id)}>
                Akceptuj
              </button>

              <button className="red" onClick={() => rejectRequest(request.id)}>
                Odrzuć
              </button>
            </div>
          </div>
        ))}

        <h2 className="friendsTitle">Znajomi</h2>

        {friends.length === 0 && (
          <p className="mutedText">Brak znajomych</p>
        )}

        {friends.map(friend => (
          <div
            key={friend.id}
            className={`friendItem discordFriendItem ${
              activeFriend?.id === friend.id ? "activeFriend" : ""
            }`}
            onClick={() => loadMessages(friend)}
          >
            <div className="smallAvatar">
              {friend.avatar ? (
                <img src={friend.avatar} alt="avatar" />
              ) : (
                friend.nick[0]?.toUpperCase()
              )}
            </div>

            <div>
              <strong>{friend.nick}</strong>
              <p>{friend.role || "user"}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="chatPanel discordChatPanel">
        <div className="discordChatHeader">
          {activeFriend ? (
            <>
              <div className="smallAvatar">
                {activeFriend.avatar ? (
                  <img src={activeFriend.avatar} alt="avatar" />
                ) : (
                  activeFriend.nick[0]?.toUpperCase()
                )}
              </div>

              <div>
                <h2>{activeFriend.nick}</h2>
                <p>
                  {activeFriend.name}, {activeFriend.age} lat • {activeFriend.role}
                </p>
              </div>
            </>
          ) : (
            <h2>Wybierz znajomego</h2>
          )}
        </div>

        <div className="messages discordMessages">
          {messages.map(msg => (
            <div
              key={msg.id}
              className={msg.from === user?.id ? "message me discordMessage" : "message other discordMessage"}
            >
              {msg.text && <p>{msg.text}</p>}

              {msg.image && (
                <img className="chatImage" src={msg.image} alt="wysłane" />
              )}

              {msg.video && (
                <video className="chatVideo" src={msg.video} controls />
              )}

              {msg.voice && (
                <audio className="chatAudio" src={msg.voice} controls />
              )}

              <span className="messageMeta">
                {new Date(msg.date).toLocaleTimeString()}

                {msg.from === user?.id && (
                  <>
                    {" "}
                    • {msg.read ? "Przeczytane" : "Wysłane"}
                  </>
                )}
              </span>
            </div>
          ))}

          <div ref={messagesEndRef}></div>
        </div>

        {typingUser && (
          <div className="typingStatus">
            {typingUser}
          </div>
        )}

        <div className="bottomBar discordInputBar">
          <input
            value={text}
            onChange={e => handleTyping(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") {
                sendText();
              }
            }}
            placeholder="Napisz wiadomość..."
          />

          <label className="fileButton">
            📎
            <input
              type="file"
              accept="image/*,video/*"
              onChange={sendFile}
              style={{ display: "none" }}
            />
          </label>

          {!recording ? (
            <button className="voiceButton" onClick={startVoice}>
              🎙️
            </button>
          ) : (
            <button className="recordingButton" onClick={stopVoice}>
              ⏹
            </button>
          )}

          <button className="sendButton" onClick={sendText}>
            Wyślij
          </button>
        </div>
      </div>
    </div>
  );
}

export default Znajomi;