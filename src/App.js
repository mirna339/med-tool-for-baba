import React, { useState, useEffect, useRef } from "react";
import { ReactMic } from "react-mic";

function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcription, setTranscription] = useState(""); // To store the transcription
  const [translation, setTranslation] = useState(""); // To store the translation
  const websocketRef = useRef(null); // Reference to WebSocket connection

  // Initialize WebSocket connection when the component mounts
  useEffect(() => {
    const ws = new WebSocket("ws://localhost:3002");
    websocketRef.current = ws;

    ws.onopen = () => {
      console.log("WebSocket connection established.");
    };

    ws.onmessage = (event) => {
      console.log("Transcription received:", event.data);
      setTranscription((prev) => `${prev} ${event.data}`);
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    ws.onclose = () => {
      console.log("WebSocket connection closed.");
    };

    return () => {
      ws.close(); // Clean up WebSocket connection on unmount
    };
  }, []);

  const handleData = (audioChunk) => {
    if (
      websocketRef.current &&
      websocketRef.current.readyState === WebSocket.OPEN
    ) {
      console.log("Sending audio chunk...");
      websocketRef.current.send(audioChunk);
    }
  };

  const handleStop = (recordedBlob) => {
    console.log("Recording stopped. Blob available:", recordedBlob);
    // Optional: Send the final blob to the backend for processing
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between",
        height: "100vh",
        fontFamily: "Arial, sans-serif",
        padding: "20px",
      }}
    >
      <div
        style={{
          display: "flex",
          width: "100%",
          justifyContent: "space-between",
          marginBottom: "20px",
        }}
      >
        {/* Transcription Section */}
        <div
          style={{
            flex: 1,
            textAlign: "left",
            marginRight: "20px",
          }}
        >
          <div
            style={{
              fontSize: "45px",
              color: "gray",
              marginTop: "100px",
              textAlign: "left",
            }}
          >
            {transcription || "Say something..."}
          </div>
        </div>

        {/* Translation Section */}
        <div
          style={{
            position: "absolute",
            right: "20px",
            top: "50%",
            transform: "translateY(-50%)",
            textAlign: "right",
          }}
        >
          <div
            style={{
              fontSize: "45px",
              color: "black",
              fontWeight: "bold",
              marginBottom: "-20px",
              marginRight: "-10px",
            }}
          >
            Translation
          </div>
          <div
            style={{
              fontSize: "18px",
              color: "#333",
            }}
          >
            {translation}
          </div>
        </div>
      </div>

      {/* Start/Stop Button */}
      <button
        style={{
          backgroundColor: "#0074D9",
          color: "white",
          width: "120px",
          height: "120px",
          borderRadius: "50%",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginTop: "auto",
        }}
        onClick={() => setIsRecording(!isRecording)}
      >
        {isRecording ? "Stop" : "Start"}
      </button>

      {/* ReactMic Component */}
      <ReactMic
        record={isRecording}
        className="sound-wave"
        onData={handleData}
        onStop={handleStop}
        strokeColor="#000000"
        backgroundColor="#FFFFFF"
        mimeType="audio/wav"
      />
    </div>
  );
}

export default App;
