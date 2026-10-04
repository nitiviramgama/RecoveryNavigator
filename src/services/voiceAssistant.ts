import { Language } from '../types';
import { interpretVoiceCommandWithAI } from './geminiClient';

export interface VoiceAssistantCallbacks {
  onNavigate: (section: string) => void;
  onLogMedication: (name: string) => void;
  onLogExercise: (title: string) => void;
  onSpokenFeedback: (text: string) => void;
  onStatusChange: (isListening: boolean, transcript: string) => void;
}

class VoiceAssistantService {
  private recognition: any = null;
  private isListening = false;
  private currentLanguage: Language = 'en';
  private callbacks: VoiceAssistantCallbacks | null = null;

  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private speechRequestId = 0;
  private isSpeaking = false;
  private speechQueue: string[] = [];
  private processingSpeechQueue = false;

  constructor() {
    this.initRecognition();
  }

  // ============================================================
  // SPEECH RECOGNITION
  // ============================================================

  private initRecognition() {
    if (typeof window === 'undefined') return;

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn('Speech Recognition is not supported in this browser.');
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = false;
    this.recognition.interimResults = false;

    this.recognition.onstart = () => {
      this.isListening = true;
      this.callbacks?.onStatusChange(true, '');
    };

    this.recognition.onend = () => {
      this.isListening = false;
      this.callbacks?.onStatusChange(false, '');
    };

    this.recognition.onerror = (event: any) => {
      console.warn('Speech recognition error:', event.error);
      this.isListening = false;
      this.callbacks?.onStatusChange(false, '');
    };

    this.recognition.onresult = async (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript || '';

      this.callbacks?.onStatusChange(false, transcript);

      await this.handleTranscript(transcript);
    };
  }

  // ============================================================
  // CALLBACKS
  // ============================================================

  public registerCallbacks(callbacks: VoiceAssistantCallbacks) {
    this.callbacks = callbacks;
  }

  // ============================================================
  // LANGUAGE
  // ============================================================

  public setLanguage(lang: Language) {
    this.currentLanguage = lang;

    if (!this.recognition) return;

    if (lang === 'hi') {
      this.recognition.lang = 'hi-IN';
    } else if (lang === 'gu') {
      this.recognition.lang = 'gu-IN';
    } else {
      this.recognition.lang = 'en-US';
    }
  }

  // ============================================================
  // START LISTENING
  // ============================================================

  public startListening() {
    // Stop any current AI speech immediately.
    this.stopSpeaking();

    if (!this.recognition) {
      this.initRecognition();
    }

    if (!this.recognition || this.isListening) {
      return;
    }

    try {
      this.setLanguage(this.currentLanguage);
      this.recognition.start();
    } catch (error) {
      console.warn('Could not start recognition:', error);
    }
  }

  // ============================================================
  // STOP LISTENING
  // ============================================================

  public stopListening() {
    if (!this.recognition || !this.isListening) {
      return;
    }

    try {
      this.recognition.stop();
    } catch (error) {
      console.warn('Could not stop recognition:', error);
    }
  }

  // ============================================================
  // HANDLE VOICE COMMAND
  // ============================================================

  public async handleTranscript(transcript: string) {
    if (!transcript?.trim()) return;

    try {
      const parsed = await interpretVoiceCommandWithAI(
        transcript,
        this.currentLanguage
      );

      const feedback =
        parsed.spokenFeedback || 'Command processed';

      this.callbacks?.onSpokenFeedback(feedback);

      // Browser speech starts without waiting for Gemini TTS audio.
      await this.speak(feedback);

      if (
        parsed.action === 'NAVIGATE' &&
        parsed.parameters?.target
      ) {
        this.callbacks?.onNavigate(parsed.parameters.target);
      } else if (parsed.action === 'LOG_MEDICATION') {
        this.callbacks?.onLogMedication(
          parsed.parameters?.medicationName || 'morning'
        );
      } else if (parsed.action === 'LOG_EXERCISE') {
        this.callbacks?.onLogExercise(
          parsed.parameters?.exerciseTitle || 'exercise'
        );
      }
    } catch (error) {
      console.error('Voice command processing failed:', error);
    }
  }

  // ============================================================
  // SPEAK
  // ============================================================

  public async speak(text: string): Promise<void> {
    if (!text?.trim()) return;

    this.stopSpeaking();

    const requestId = ++this.speechRequestId;

    if (
      typeof window === 'undefined' ||
      !('speechSynthesis' in window)
    ) {
      console.warn('Browser Speech Synthesis is not supported.');
      this.isSpeaking = false;
      return;
    }

    try {
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);

      if (this.currentLanguage === 'hi') {
        utterance.lang = 'hi-IN';
      } else if (this.currentLanguage === 'gu') {
        utterance.lang = 'gu-IN';
      } else {
        utterance.lang = 'en-US';
      }

      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      // Prefer a voice matching the selected language.
      const voices = window.speechSynthesis.getVoices();

      const matchingVoice = voices.find((voice) => {
        const voiceLang = voice.lang?.toLowerCase() || '';

        if (this.currentLanguage === 'hi') {
          return voiceLang.startsWith('hi');
        }

        if (this.currentLanguage === 'gu') {
          return voiceLang.startsWith('gu');
        }

        return voiceLang.startsWith('en');
      });

      if (matchingVoice) {
        utterance.voice = matchingVoice;
      }

      this.currentUtterance = utterance;
      this.isSpeaking = true;

      if (requestId !== this.speechRequestId) {
        this.isSpeaking = false;
        this.currentUtterance = null;
        return;
      }

      utterance.onstart = () => {
        if (requestId === this.speechRequestId) {
          this.isSpeaking = true;
        }
      };

      utterance.onend = () => {
        if (requestId === this.speechRequestId) {
          this.isSpeaking = false;
          this.currentUtterance = null;
        }
      };

      utterance.onerror = (event: any) => {
        if (
          event?.error !== 'canceled' &&
          event?.error !== 'interrupted'
        ) {
          console.warn(
            'Speech synthesis error:',
            event?.error
          );
        }

        if (requestId === this.speechRequestId) {
          this.isSpeaking = false;
          this.currentUtterance = null;
        }
      };

      // Starts immediately; no Gemini audio generation is required.
      window.speechSynthesis.speak(utterance);
    } catch (error) {
      console.warn('Speech synthesis failed:', error);
      this.isSpeaking = false;
      this.currentUtterance = null;
    }
  }

  // Queue speech chunks so streamed AI replies can be spoken continuously.
  public async speakQueued(text: string): Promise<void> {
    const clean = text?.trim();
    if (!clean) return;

    this.speechQueue.push(clean);
    if (this.processingSpeechQueue) return;

    this.processingSpeechQueue = true;
    try {
      while (this.speechQueue.length) {
        const next = this.speechQueue.shift();
        if (next) await this.speakWithoutCancelling(next);
      }
    } finally {
      this.processingSpeechQueue = false;
    }
  }

  private speakWithoutCancelling(text: string): Promise<void> {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        resolve();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text);
      if (this.currentLanguage === 'hi') utterance.lang = 'hi-IN';
      else if (this.currentLanguage === 'gu') utterance.lang = 'gu-IN';
      else utterance.lang = 'en-US';

      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      const voices = window.speechSynthesis.getVoices();
      const matchingVoice = voices.find((voice) => {
        const voiceLang = voice.lang?.toLowerCase() || '';
        return this.currentLanguage === 'hi'
          ? voiceLang.startsWith('hi')
          : this.currentLanguage === 'gu'
            ? voiceLang.startsWith('gu')
            : voiceLang.startsWith('en');
      });
      if (matchingVoice) utterance.voice = matchingVoice;

      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();
      window.speechSynthesis.speak(utterance);
    });
  }

  // ============================================================
  // STOP SPEAKING
  // ============================================================

  public stopSpeaking() {
    // Invalidate every previous speech request.
    this.speechRequestId++;
    this.speechQueue = [];

    if (
      typeof window !== 'undefined' &&
      'speechSynthesis' in window
    ) {
      try {
        window.speechSynthesis.cancel();
      } catch (error) {
        console.warn('Could not stop speech synthesis:', error);
      }
    }

    this.currentUtterance = null;
    this.isSpeaking = false;
  }

  // ============================================================
  // TOGGLE SPEAKING
  // ============================================================

  public async toggleSpeaking(text: string): Promise<void> {
    if (this.isSpeaking) {
      this.stopSpeaking();
      return;
    }

    await this.speak(text);
  }

  // ============================================================
  // STATUS
  // ============================================================

  public getIsListening(): boolean {
    return this.isListening;
  }

  public getIsSpeaking(): boolean {
    return this.isSpeaking;
  }
}

export const voiceAssistant = new VoiceAssistantService();
