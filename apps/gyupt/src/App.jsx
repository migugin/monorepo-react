import { marked } from "marked";
import "./App.scss";
import { useState, useRef, useEffect } from "react";

function App() {
  const [messages, setMessages] = useState([]);
  const [userInput, setUserInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showInfo, setShowInfo] = useState(true);
  const chatLogRef = useRef(null);

  // 새로운 메시지가 추가될 때마다 스크롤을 아래로
  useEffect(() => {
    if (chatLogRef.current) {
      chatLogRef.current.scrollTop = chatLogRef.current.scrollHeight;
    }
  }, [messages]);

  function appendMessage(sender, message) {
    setShowInfo(false);
    setMessages((prevMessages) => [...prevMessages, { sender, message, id: Date.now() }]);
  }

  async function sendMessage() {
    const message = userInput.trim();

    // if message = empty do nothing
    if (message === "") {
      return;
    }

    // if message = developer - show our message
    if (message === "developer") {
      setUserInput("");
      appendMessage("user", message);
      setIsLoading(true);
      setTimeout(() => {
        appendMessage("bot", "구미베어");
        setIsLoading(false);
      }, 2000);
      return;
    }

    appendMessage("user", message);
    setUserInput("");
    setIsLoading(true);

    const options = {
      url: "https://chatgpt-42.p.rapidapi.com/deepseekai",
      method: "POST",
      headers: {
        "x-rapidapi-key": "cb0d93b4b4msh8e82fa9746063b3p16032fjsnbf57fba928b8",
        "x-rapidapi-host": "chatgpt-42.p.rapidapi.com",
        "Content-Type": "application/json",
      },
      body: `{"messages":[{"role":"user","content":"${message}"}]}`,
      // if you want use official api you need have this body
      // `{"model":"gpt-3.5-turbo","messages":[{"role":"user","content":"${message}"}]}`
    };

    try {
      const response = await fetch(options.url, options);
      const result = await response.text();
      const message = JSON.parse(result).result;
      appendMessage("bot", message);
    } catch (err) {
      appendMessage("bot", `Error : ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }

  function handleKeyDown(event) {
    if (!isLoading && event.key === "Enter" && !event.nativeEvent.isComposing) {
      sendMessage();
    }
  }

  return (
    <div className="container">
      <div className="header">
        <h3>GYUPT</h3>
      </div>

      {showInfo && (
        <div className="info">
          <p>Hello!</p>
        </div>
      )}

      <div className="chat-container">
        <div id="chat-log" ref={chatLogRef}>
          {messages.map((msg) => (
            <div key={msg.id} className={`chat-box ${msg.sender}`}>
              <div className="icon" id={msg.sender === "user" ? "user-icon" : "bot-icon"}>
                <i className={msg.sender === "user" ? "fa-regular fa-user" : "fa-solid fa-robot"}></i>
              </div>
              <div className={`${msg.sender}-box`}>
                <p dangerouslySetInnerHTML={{ __html: marked.parse(msg.message) }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="input-container">
        <input
          type="text"
          id="user-input"
          placeholder="메세지를 입력하세요."
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button id="send-button" onClick={sendMessage}>
          <i className={isLoading ? "fas fa-spinner fa-pulse" : "fa-solid fa-paper-plane"} id="button-icon"></i>
        </button>
      </div>
    </div>
  );
}

export default App;
