// src/services/nanoService.ts

import { ModelId } from '../types';

export const checkNanoAvailability = async (): Promise<string> => {
  if (typeof LanguageModel === 'undefined') {
    return 'unavailable';
  }
  try {
    const availability = await LanguageModel.availability();
    return availability;
  } catch (error) {
    console.error('Error checking Gemini Nano availability:', error);
    return 'unavailable';
  }
};

export const createNanoSession = async (
  progressCallback: (progress: number) => void
): Promise<LanguageModelSession | null> => {
  if (typeof LanguageModel === 'undefined') {
    return null;
  }
  try {
    const session = await LanguageModel.create({
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
