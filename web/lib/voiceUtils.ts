/**
 * Voice Utilities - Browser Web Speech API wrapper
 * Provides text-to-speech and speech-to-text capabilities
 */

export interface VoiceRecognitionConfig {
  language: string;
  continuous: boolean;
  interimResults: boolean;
  onResult: (transcript: string, isFinal: boolean) => void;
  onError: (error: string) => void;
  onEnd: () => void;
}

export interface VoiceRecognition {
  start: (config: VoiceRecognitionConfig) => void;
  stop: () => void;
  abort: () => void;
}

export interface VoiceSynthesis {
  speak: (
    text: string,
    options?: {
      language?: string;
      rate?: number;
      pitch?: number;
      volume?: number;
      onEnd?: () => void;
      onError?: (error: string) => void;
    }
  ) => void;
  stop: () => void;
  cancel: () => void;
}

/**
 * Get browser Web Speech API instance for speech recognition
 */
export function getVoiceRecognition(): VoiceRecognition {
  const SpeechRecognition =
    typeof window !== "undefined"
      ? (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition
      : null;

  if (!SpeechRecognition) {
    throw new Error("Speech Recognition not supported");
  }

  const recognition = new SpeechRecognition();

  return {
    start(config: VoiceRecognitionConfig) {
      recognition.continuous = config.continuous;
      recognition.interimResults = config.interimResults;
      recognition.language = config.language || "en-US";

      let interimTranscript = "";

      recognition.onstart = () => {
        console.log("Speech recognition started");
      };

      recognition.onresult = (event: any) => {
        interimTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            config.onResult(transcript, true);
          } else {
            interimTranscript += transcript;
            config.onResult(interimTranscript, false);
          }
        }
      };

      recognition.onerror = (event: any) => {
        const errorMap: Record<string, string> = {
          "no-speech": "no-speech",
          "audio-capture": "audio-capture",
          "network": "network",
          "not-allowed": "not-allowed",
          "service-not-allowed": "service-not-allowed",
        };
        config.onError(errorMap[event.error] || event.error);
      };

      recognition.onend = () => {
        config.onEnd();
      };

      try {
        recognition.start();
      } catch (_err) {
        console.log("Recognition already running");
      }
    },

    stop() {
      try {
        recognition.stop();
      } catch (_err) {
        console.log("Recognition not running");
      }
    },

    abort() {
      try {
        recognition.abort();
      } catch (_err) {
        console.log("Recognition not running");
      }
    },
  };
}

/**
 * Get browser Web Speech API instance for speech synthesis
 */
export function getVoiceSynthesis(): VoiceSynthesis {
  const synth =
    typeof window !== "undefined" ? window.speechSynthesis : null;

  if (!synth) {
    throw new Error("Speech Synthesis not supported");
  }

  return {
    speak(text: string, options = {}) {
      const {
        language = "en-US",
        rate = 1,
        pitch = 1,
        volume = 1,
        onEnd,
        onError,
      } = options as any;

      const utterance = new (window as any).SpeechSynthesisUtterance(text);
      utterance.language = language;
      utterance.rate = rate;
      utterance.pitch = pitch;
      utterance.volume = Math.max(0, Math.min(1, volume));

      utterance.onend = () => {
        onEnd?.();
      };

      utterance.onerror = (event: any) => {
        onError?.(event.error || "Unknown error");
      };

      synth.cancel();
      synth.speak(utterance);
    },

    stop() {
      synth?.cancel();
    },

    cancel() {
      synth?.cancel();
    },
  };
}

/**
 * Check browser capabilities for voice features
 */
export function getVoiceCapabilities(): {
  recognition: boolean;
  synthesis: boolean;
} {
  if (typeof window === "undefined") {
    return { recognition: false, synthesis: false };
  }

  const recognition =
    !!(((window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition) &&
      navigator.mediaDevices?.getUserMedia);

  const synthesis = !!((window as any).SpeechSynthesisUtterance);

  return { recognition, synthesis };
}

/**
 * Request microphone permission from user
 */
export async function requestMicrophonePermission(): Promise<boolean> {
  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      console.warn("getUserMedia not supported");
      return false;
    }

    await navigator.mediaDevices.getUserMedia({ audio: true });
    return true;
  } catch (_err) {
    console.error("Microphone permission denied");
    return false;
  }
}
