"use client";

import { useState, useEffect, useRef } from "react";
import { Mic, MicOff, Volume2, VolumeX, Send, RotateCcw } from "lucide-react";
import SchemeCard from "@/components/SchemeCard";
import type { AgentPipelineResponse } from "@/types/citizen";
import type { RankedScheme } from "@/types/scheme";
import {
  getVoiceRecognition,
  getVoiceSynthesis,
  getVoiceCapabilities,
  requestMicrophonePermission,
  VoiceRecognitionConfig,
  VoiceRecognition,
  VoiceSynthesis,
} from "@/lib/voiceUtils";

type ConversationPhase =
  | "idle"
  | "greeting"
  | "listening"
  | "processing"
  | "speaking"
  | "completed";

interface ConversationMessage {
  role: "agent" | "user";
  text: string;
  timestamp: Date;
}

export default function VoiceEligibilityForm() {
  // State management
  const [phase, setPhase] = useState<ConversationPhase>("idle");
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [totalSteps, setTotalSteps] = useState<number>(5);
  const [citizenData, setCitizenData] = useState<Record<string, unknown>>({});
  const [currentTranscript, setCurrentTranscript] = useState<string>("");
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [useVoiceOutput, setUseVoiceOutput] = useState<boolean>(true);
  const [vocalCapabilities, setVocalCapabilities] =
    useState<{ recognition: boolean; synthesis: boolean }>({
      recognition: false,
      synthesis: false,
    });
  const [result, setResult] = useState<{
    eligibilityResult: AgentPipelineResponse;
    voiceSummary: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState<number>(0);

  // Refs
  const recognitionRef = useRef<VoiceRecognition | null>(null);
  const synthesisRef = useRef<VoiceSynthesis | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const conversationSessionRef = useRef<string>(
    `session_${Date.now()}`
  );

  const phaseRef = useRef<ConversationPhase>("idle");
  const currentTranscriptRef = useRef<string>("");
  const retryCountRef = useRef<number>(0);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    currentTranscriptRef.current = currentTranscript;
  }, [currentTranscript]);

  useEffect(() => {
    retryCountRef.current = retryCount;
  }, [retryCount]);

  // Initialize voice services
  useEffect(() => {
    const caps = getVoiceCapabilities();
    setVocalCapabilities(caps);

    recognitionRef.current = getVoiceRecognition();
    synthesisRef.current = getVoiceSynthesis();

    if (!caps.recognition || !caps.synthesis) {
      setError(
        "⚠️ Your browser doesn't support voice features. Please use Chrome, Edge, or Safari."
      );
    }
  }, []);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Start assessment
  async function handleStartAssessment() {
    setError(null);
    setPhase("greeting");

    // Request microphone permission
    if (!vocalCapabilities.recognition) {
      setError("Voice recognition not supported");
      return;
    }

    const hasPermission = await requestMicrophonePermission();
    if (!hasPermission && vocalCapabilities.recognition) {
      setError(
        "Microphone permission required. Please check your browser settings."
      );
      setPhase("idle");
      return;
    }

    try {
      // Call API to start assessment
      const response = await fetch("/api/voice-eligibility", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start",
          sessionId: conversationSessionRef.current,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to start assessment");
      }

      const data = await response.json();

      // Add greeting message
      const greetingMsg: ConversationMessage = {
        role: "agent",
        text: data.greeting,
        timestamp: new Date(),
      };
      setMessages([greetingMsg]);

      // Speak greeting
      if (useVoiceOutput && synthesisRef.current) {
        setIsSpeaking(true);
        synthesisRef.current.speak(data.greeting, {
          language: "en-IN",
          rate: 1,
          onEnd: () => {
            setIsSpeaking(false);
            // Ask first question after greeting
            setTimeout(() => {
              askNextQuestion(data.firstQuestion, 0);
            }, 500);
          },
        });
      } else {
        // Ask first question immediately if no voice output
        setTimeout(() => {
          askNextQuestion(data.firstQuestion, 0);
        }, 500);
      }

      setCurrentStep(0);
      setTotalSteps(data.totalSteps);
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to start assessment";
      setError(errorMsg);
      setPhase("idle");
    }
  }

  // Ask next question
  function askNextQuestion(question: string, step: number) {
    const questionMsg: ConversationMessage = {
      role: "agent",
      text: question,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, questionMsg]);
    setCurrentStep(step);
    setPhase("listening");

    // Auto-start listening after a brief delay
    if (vocalCapabilities.recognition) {
      setTimeout(() => {
        startListening();
      }, 500);
    }
  }

  // Start voice recognition
  function startListening() {
    if (!vocalCapabilities.recognition) {
      setError("Voice recognition not supported in this browser. Please use Chrome, Edge, or Safari.");
      return;
    }

    // Check microphone permission first
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(() => {
        // Permission granted, proceed with recognition
        setIsListening(true);
        setCurrentTranscript("");
        setPhase("listening");
        setError(null); // Clear any previous errors

        const config: VoiceRecognitionConfig = {
          language: "en-IN",
          continuous: false,
          interimResults: true,

          onResult: (transcript: string, isFinal: boolean) => {
            setCurrentTranscript(transcript);

            if (isFinal && transcript.trim()) {
              setIsListening(false);
              processUserResponse(transcript);
            }
          },

          onError: (error: string) => {
            console.error("Recognition error:", error);
            setIsListening(false);

            // Handle different error types
            if (error === "network" || error === "no-speech" || error === "audio-capture") {
              const nextRetry = retryCountRef.current + 1;
              if (nextRetry <= 3) {
                console.log(`Retrying voice recognition (${nextRetry}/3)...`);
                setRetryCount(nextRetry);
                retryCountRef.current = nextRetry;
                setTimeout(() => {
                  startListening();
                }, 1500);
              } else {
                setError("Voice recognition failed after multiple attempts. Please try typing your response instead.");
                setPhase("listening");
              }
            } else if (error === "not-allowed") {
              setError("Microphone permission denied. Please allow microphone access and try again.");
              setPhase("idle");
            } else {
              setError(`Voice recognition error: ${error}. Please try again.`);
              setPhase("listening");
            }
          },

          onEnd: () => {
            setIsListening(false);
            // Auto-restart if no final result and not in error state
            if (
              phaseRef.current === "listening" &&
              !currentTranscriptRef.current.trim() &&
              retryCountRef.current < 2
            ) {
              console.log("No speech detected, restarting...");
              const nextRetry = retryCountRef.current + 1;
              setRetryCount(nextRetry);
              retryCountRef.current = nextRetry;
              setTimeout(() => startListening(), 1000);
            }
          },
        };

        recognitionRef.current?.start(config);
      })
      .catch((err) => {
        console.error("Microphone permission denied:", err);
        setError("Microphone access is required for voice recognition. Please allow microphone access and try again.");
        setPhase("idle");
      });
  }

  // Process user response
  async function processUserResponse(transcript: string) {
    if (!transcript.trim()) {
      setError("I didn't catch that. Please try again.");
      startListening();
      return;
    }

    setPhase("processing");

    // Add user message
    const userMsg: ConversationMessage = {
      role: "user",
      text: transcript,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setCurrentTranscript("");
    setRetryCount(0);
    retryCountRef.current = 0;

    try {
      // Call API to process response
      const response = await fetch("/api/voice-eligibility", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "process",
          response: transcript,
          currentStep,
          citizenData,
          sessionId: conversationSessionRef.current,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to process response");
      }

      const data = await response.json();

      if (data.status === "retry") {
        // Ask again with error message
        const retryMsg: ConversationMessage = {
          role: "agent",
          text: data.error,
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, retryMsg]);

        if (useVoiceOutput) {
          setIsSpeaking(true);
          synthesisRef.current?.speak(data.error, {
            language: "en-IN",
            rate: 1,
            onEnd: () => {
              setIsSpeaking(false);
              setTimeout(() => startListening(), 500);
            },
          });
        } else {
          setTimeout(() => startListening(), 500);
        }
      } else if (data.status === "progress") {
        // Move to next question
        setCitizenData(data.citizenData || {});

        const acknowledgment: ConversationMessage = {
          role: "agent",
          text: data.acknowledgment,
          timestamp: new Date(),
        };

        const nextQuestion: ConversationMessage = {
          role: "agent",
          text: data.currentQuestion,
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, acknowledgment, nextQuestion]);

        if (useVoiceOutput) {
          setIsSpeaking(true);
          synthesisRef.current?.speak(
            `${data.acknowledgment} ${data.currentQuestion}`,
            {
              language: "en-IN",
              rate: 1,
              onEnd: () => {
                setIsSpeaking(false);
                setTimeout(() => startListening(), 500);
              },
            }
          );
        } else {
          setTimeout(() => startListening(), 500);
        }

        setCurrentStep(data.currentStep);
      } else if (data.status === "completed") {
        // Assessment complete - submit
        setCitizenData(data.citizenData || {});
        submitAssessment(data.citizenData);
      }
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to process response";
      setError(errorMsg);
      setTimeout(() => startListening(), 2000);
    }
  }

  // Submit assessment and get eligibility results
  async function submitAssessment(
    completeData: Record<string, unknown>
  ) {
    setPhase("processing");

    try {
      const response = await fetch("/api/voice-eligibility", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit",
          citizenData: completeData,
          sessionId: conversationSessionRef.current,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get eligibility results");
      }

      const data = await response.json();

      // Add summary message
      const summaryMsg: ConversationMessage = {
        role: "agent",
        text: data.voiceSummary,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, summaryMsg]);

      // Speak summary
      if (useVoiceOutput && synthesisRef.current) {
        setIsSpeaking(true);
        synthesisRef.current.speak(data.voiceSummary, {
          language: "en-IN",
          rate: 0.95,
          onEnd: () => {
            setIsSpeaking(false);
            setPhase("completed");
          },
        });
      } else {
        setPhase("completed");
      }

      setResult({
        eligibilityResult: data.eligibilityResult,
        voiceSummary: data.voiceSummary,
      });
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to complete assessment";
      setError(errorMsg);
    }
  }

  // Stop listening
  function stopListening() {
    recognitionRef.current?.stop();
    setIsListening(false);
    setPhase("listening");
  }

  // Reset conversation
  function resetConversation() {
    recognitionRef.current?.abort();
    synthesisRef.current?.stop();

    setPhase("idle");
    setMessages([]);
    setCurrentStep(0);
    setCitizenData({});
    setCurrentTranscript("");
    setIsListening(false);
    setIsSpeaking(false);
    setError(null);
    setResult(null);
    setRetryCount(0);
    retryCountRef.current = 0;
    conversationSessionRef.current = `session_${Date.now()}`;
  }

  // Manual submit via text (for accessibility)
  function handleManualSubmit() {
    if (currentTranscript.trim()) {
      processUserResponse(currentTranscript);
    } else {
      setError("Please speak or type a response first.");
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6 text-center">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            🎙️ Voice Eligibility Assistant
          </h1>
          <p className="text-lg text-gray-600">
            Speak naturally to discover which government schemes you're
            eligible for
          </p>

          {!vocalCapabilities.recognition && (
            <div className="mt-4 p-3 bg-red-100 text-red-800 rounded-lg">
              ⚠️ Voice not supported. Please use Chrome, Edge, or Safari.
            </div>
          )}

          {vocalCapabilities.recognition && !vocalCapabilities.synthesis && (
            <div className="mt-4 p-3 bg-yellow-100 text-yellow-800 rounded-lg">
              ⚠️ Voice input supported but text-to-speech not available. Questions will appear as text.
            </div>
          )}
        </div>

        {/* Main Container */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Conversation Area */}
          <div className="min-h-96 max-h-96 overflow-y-auto bg-gradient-to-b from-gray-50 to-white p-6 space-y-4">
            {messages.length === 0 && phase === "idle" ? (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                <Volume2 className="w-16 h-16 text-blue-500 animate-bounce" />
                <p className="text-xl font-semibold text-gray-700">
                  Ready to start?
                </p>
                <p className="text-gray-600 max-w-sm">
                  Click "Start Assessment" to begin the voice-based eligibility
                  check. Speak clearly, and we'll guide you through the process.
                </p>
              </div>
            ) : (
              <>
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${
                      msg.role === "agent"
                        ? "justify-start"
                        : "justify-end"
                    }`}
                  >
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-3 rounded-lg ${
                        msg.role === "agent"
                          ? "bg-blue-100 text-blue-900"
                          : "bg-green-100 text-green-900"
                      }`}
                    >
                      <p className="text-sm md:text-base">
                        {msg.text}
                      </p>
                      <span className="text-xs opacity-70 mt-1 block">
                        {msg.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                ))}

                {currentTranscript && (
                  <div className="flex justify-end">
                    <div className="max-w-xs lg:max-w-md px-4 py-3 rounded-lg bg-gray-200 text-gray-800 opacity-75">
                      <p className="text-sm md:text-base italic">
                        {currentTranscript}...
                      </p>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Control Panel */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 space-y-4">
            {/* Status Display */}
            {phase !== "idle" && phase !== "completed" && (
              <div className="text-white text-center">
                <p className="text-sm font-medium">
                  Question {currentStep + 1} of {totalSteps}
                </p>
                <div className="w-full bg-blue-400 rounded-full h-2 mt-2">
                  <div
                    className="bg-white rounded-full h-2 transition-all duration-300"
                    style={{
                      width: `${((currentStep + 1) / totalSteps) * 100}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div className="bg-red-100 text-red-800 p-3 rounded-lg text-sm">
                {error}
                {error.includes("network") && (
                  <div className="mt-2">
                    <button
                      onClick={() => {
                        setError(null);
                        startListening();
                      }}
                      className="text-red-600 underline hover:text-red-800"
                    >
                      Try Again
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Control Buttons */}
            <div className="flex flex-col md:flex-row gap-3 items-center justify-center">
              {phase === "idle" ? (
                <button
                  onClick={handleStartAssessment}
                  disabled={!vocalCapabilities.recognition}
                  className="flex items-center gap-2 px-6 py-3 bg-white text-blue-600 font-semibold rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <Mic className="w-5 h-5" />
                  Start Assessment
                </button>
              ) : phase === "completed" ? (
                <button
                  onClick={resetConversation}
                  className="flex items-center gap-2 px-6 py-3 bg-white text-blue-600 font-semibold rounded-lg hover:bg-gray-100 transition-all"
                >
                  <RotateCcw className="w-5 h-5" />
                  Start Over
                </button>
              ) : (
                <>
                  <button
                    onClick={
                      isListening ? stopListening : startListening
                    }
                    disabled={isSpeaking || phase === "processing"}
                    className={`flex items-center gap-2 px-6 py-3 font-semibold rounded-lg transition-all ${
                      isListening
                        ? "bg-red-500 text-white hover:bg-red-600"
                        : "bg-white text-blue-600 hover:bg-gray-100"
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {isListening ? (
                      <>
                        <MicOff className="w-5 h-5" />
                        Stop Listening
                      </>
                    ) : (
                      <>
                        <Mic className="w-5 h-5" />
                        Start Listening
                      </>
                    )}
                  </button>

                  {currentTranscript && (
                    <button
                      onClick={handleManualSubmit}
                      disabled={isSpeaking || phase === "processing"}
                      className="flex items-center gap-2 px-6 py-3 bg-white text-blue-600 font-semibold rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      <Send className="w-5 h-5" />
                      Submit
                    </button>
                  )}

                  <button
                    onClick={resetConversation}
                    className="flex items-center gap-2 px-4 py-3 bg-red-500 text-white font-semibold rounded-lg hover:bg-red-600 transition-all"
                  >
                    <RotateCcw className="w-5 h-5" />
                    Reset
                  </button>
                </>
              )}

              {/* Voice Output Toggle */}
              <button
                onClick={() => setUseVoiceOutput(!useVoiceOutput)}
                className={`flex items-center gap-2 px-4 py-3 font-semibold rounded-lg transition-all ${
                  useVoiceOutput
                    ? "bg-white text-blue-600 hover:bg-gray-100"
                    : "bg-gray-400 text-white hover:bg-gray-500"
                }`}
              >
                {useVoiceOutput ? (
                  <>
                    <Volume2 className="w-5 h-5" />
                    Voice On
                  </>
                ) : (
                  <>
                    <VolumeX className="w-5 h-5" />
                    Voice Off
                  </>
                )}
              </button>
            </div>

            {/* Listening/Speaking Indicators */}
            {isListening && (
              <div className="text-center">
                <div className="inline-flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-white text-sm font-medium">
                    Listening... Speak now
                  </span>
                </div>
              </div>
            )}

            {isSpeaking && (
              <div className="text-center">
                <div className="inline-flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse" />
                  <span className="text-white text-sm font-medium">
                    Speaking...
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Results Section */}
        {result && phase === "completed" && (
          <div className="mt-8 space-y-6">
            <div className="bg-green-50 border-l-4 border-green-500 p-6 rounded-lg">
              <h2 className="text-2xl font-bold text-green-800 mb-3">
                ✅ Eligibility Assessment Complete
              </h2>
              <p className="text-green-700 text-lg">
                {result.voiceSummary}
              </p>
            </div>

            {/* Eligible Schemes */}
            {result.eligibilityResult?.ranked_schemes &&
              result.eligibilityResult.ranked_schemes.length > 0 && (
                <div>
                  <h3 className="text-2xl font-bold text-gray-800 mb-4">
                    🏆 Schemes You're Eligible For
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(
                      result.eligibilityResult
                        .ranked_schemes as RankedScheme[]
                    ).map((scheme, idx) => (
                      <SchemeCard
                        key={idx}
                        name={scheme.name}
                        description={scheme.description}
                        eligibility={scheme.eligibility_text}
                        benefits={scheme.benefits}
                        score={scheme.relevance_score}
                        reasons={scheme.reasons_pass}
                        onApply={() => {
                          /* Handle apply */
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
          </div>
        )}
      </div>
    </div>
  );
}
