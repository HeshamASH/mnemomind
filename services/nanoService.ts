// src/services/nanoService.ts

import { ModelId } from '../types';

export const checkNanoAvailability = async (): Promise<string> => {
  if (window.ai && window.ai.LanguageModel) {
    try {
      const availability = await window.ai.LanguageModel.availability();
      return availability;
    } catch (error) {
      console.error('Error checking Gemini Nano availability:', error);
      return 'unavailable';
    }
  }
  return 'unavailable';
};

export const createNanoSession = async (
  progressCallback: (progress: number) => void
): Promise<LanguageModelSession | null> => {
  if (window.ai && window.ai.LanguageModel) {
    try {
      const session = await window.ai.LanguageModel.create({
        monitor: (monitor) => {
          monitor.addEventListener('downloadprogress', (e) => {
            progressCallback(e.loaded / e.total);
          });
        },
      });
      return session;
    } catch (error) {
      console.error('Error creating Gemini Nano session:', error);
      return null;
    }
  }
  return null;
};

export const streamNanoResponse = async (
  session: LanguageModelSession,
  prompt: string
): Promise<ReadableStream<string>> => {
  try {
    const stream = session.promptStreaming(prompt);
    return stream;
  } catch (error) {
    console.error('Error streaming Gemini Nano response:', error);
    throw error;
  }
};
