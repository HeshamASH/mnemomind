import { GoogleGenAI, Content, Part, Tool } from "@google/genai";
import { ChatMessage } from '../types';

const getApiKey = () => {
    if (!import.meta.env.VITE_API_KEY) {
        throw new Error("VITE_API_KEY environment variable not set");
    }
    return import.meta.env.VITE_API_KEY;
}

// Helper to convert our ChatMessage array to Gemini's Content array
export const buildConversationHistory = (history: ChatMessage[]): Content[] => {
    return history.map(msg => {
        const parts: Part[] = [{ text: msg.content }];
        if (msg.attachment) {
            parts.push({
                inlineData: {
                    mimeType: msg.attachment.type,
                    data: msg.attachment.content,
                }
            })
        }
        return { role: msg.role, parts };
    });
};