/**
 * Voice Service - Real STT/TTS Integration
 * Production-grade voice recognition and synthesis
 */

import * as Haptics from 'expo-haptics';
import { Platform, PermissionsAndroid } from 'react-native';
import { VoiceState, VoiceConfig, STTResult, TTSOptions } from '../types';

// Lazy import expo-speech to avoid bundling issues
let Speech: any = null;
try {
  Speech = require('expo-speech');
} catch {
  console.warn('[VoiceService] expo-speech not available');
}

// ============================================
// TYPES
// ============================================

type SpeechEventCallback = (result: STTResult) => void;
type ErrorCallback = (error: Error) => void;

// ============================================
// VOICE SERVICE CLASS
// ============================================

class VoiceService {
  private isListening: boolean = false;
  private currentState: VoiceState = 'idle';
  private recognitionModule: any = null;
  
  // Default voice configuration
  private defaultConfig: VoiceConfig = {
    language: 'en-US',
    rate: 0.9,
    pitch: 1.0,
    volume: 1.0,
  };

  // Initialize voice service
  async initialize(): Promise<boolean> {
    try {
      // Check if we're on a platform that supports voice
      if (Platform.OS === 'web') {
        console.log('[VoiceService] Web platform - limited voice support');
        return false;
      }

      // Try to load expo-speech-recognition if available
      try {
        const Voice = require('expo-speech-recognition');
        this.recognitionModule = Voice;
        
        // Request permissions
        const { status } = await Voice.requestPermissionsAsync();
        return status === 'granted';
      } catch {
        // Fallback to basic speech recognition
        console.log('[VoiceService] expo-speech-recognition not available, using TTS only');
        return true;
      }
    } catch (error) {
      console.error('[VoiceService] Initialization failed:', error);
      return false;
    }
  }

  // ============================================
  // TEXT-TO-SPEECH (TTS)
  // ============================================

  async speak(
    text: string,
    options: Partial<TTSOptions> = {}
  ): Promise<void> {
    const config = { ...this.defaultConfig, ...options };
    
    try {
      this.currentState = 'speaking';
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      await new Promise<void>((resolve, reject) => {
        Speech.speak(text, {
          language: config.language,
          rate: config.rate,
          pitch: config.pitch,
          onStart: () => {
            options.onStart?.();
          },
          onDone: () => {
            this.currentState = 'idle';
            options.onDone?.();
            resolve();
          },
          onError: (error: string) => {
            this.currentState = 'error';
            options.onError?.(new Error(error));
            reject(new Error(error));
          },
          onStopped: () => {
            this.currentState = 'idle';
            resolve();
          },
        });
      });
    } catch (error) {
      this.currentState = 'error';
      throw error;
    }
  }

  async stop(): Promise<void> {
    await Speech.stop();
    this.currentState = 'idle';
    this.isListening = false;
  }

  // ============================================
  // SPEECH-TO-TEXT (STT)
  // ============================================

  async startListening(
    onResult: SpeechEventCallback,
    onError?: ErrorCallback,
    language: string = 'en-US'
  ): Promise<void> {
    if (this.isListening) {
      console.warn('[VoiceService] Already listening');
      return;
    }

    try {
      this.isListening = true;
      this.currentState = 'listening';
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      if (!this.recognitionModule) {
        throw new Error('Speech recognition not available');
      }

      await this.recognitionModule.startRecognitionAsync({
        language,
        interimResults: true,
        maxAlternatives: 1,
      });

      // Set up listeners
      this.recognitionModule.onResult((event: any) => {
        if (event.results && event.results.length > 0) {
          const result: STTResult = {
            text: event.results[0].transcript,
            confidence: event.results[0].confidence || 0.9,
            language,
            isFinal: event.isFinal,
          };
          onResult(result);
        }
      });

      this.recognitionModule.onError((event: any) => {
        this.isListening = false;
        this.currentState = 'error';
        onError?.(new Error(event.error));
      });

      this.recognitionModule.onEnd(() => {
        this.isListening = false;
        this.currentState = 'idle';
      });

    } catch (error) {
      this.isListening = false;
      this.currentState = 'error';
      onError?.(error as Error);
      throw error;
    }
  }

  async stopListening(): Promise<string> {
    if (!this.isListening) return '';

    try {
      if (this.recognitionModule) {
        await this.recognitionModule.stopRecognitionAsync();
      }
      this.isListening = false;
      this.currentState = 'processing';
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      setTimeout(() => {
        this.currentState = 'idle';
      }, 500);
      
      return '';
    } catch (error) {
      this.isListening = false;
      this.currentState = 'error';
      throw error;
    }
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  getState(): VoiceState {
    return this.currentState;
  }

  isCurrentlyListening(): boolean {
    return this.isListening;
  }

  async getAvailableLanguages(): Promise<string[]> {
    return ['en-US', 'en-GB', 'es-ES', 'fr-FR', 'de-DE', 'it-IT', 'ja-JP', 'ko-KR', 'zh-CN', 'hi-IN'];
  }

  async getAvailableVoices(): Promise<any[]> {
    try {
      return await Speech.getAvailableVoicesAsync();
    } catch {
      return [];
    }
  }

  // Check if voice features are supported
  isVoiceSupported(): boolean {
    return Platform.OS !== 'web';
  }

  // Check microphone permission
  async checkMicrophonePermission(): Promise<boolean> {
    if (Platform.OS === 'android') {
      const result = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
      );
      return result;
    }
    return true; // iOS handles this via expo-speech-recognition
  }

  // Request microphone permission
  async requestMicrophonePermission(): Promise<boolean> {
    if (Platform.OS === 'android') {
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
      );
      return result === PermissionsAndroid.RESULTS.GRANTED;
    }
    return this.initialize();
  }
}

// Singleton instance
export const voiceService = new VoiceService();