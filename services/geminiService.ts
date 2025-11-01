import { GoogleGenAI, Content, Part, Tool } from "@google/genai";
import { ElasticResult, Intent, ChatMessage, GroundingOptions } from '../types';

export const getSystemInstruction = (hasDataSource: boolean): string => {
  if (!hasDataSource) {
      return `You are a helpful and friendly assistant. Respond conversationally.`;
  }
  return `You are "MnemoMind", a world-class AI assistant for analyzing documents and code.

**Your Core Task:**
Answer the user's question based *only* on the context provided with the latest user message. If the user provides an image or file, use it as primary context.

**Formatting Rules (Follow Strictly):**
1.  **Tone & Style:** Adopt a friendly, helpful, and slightly informal tone. Start with a positive and encouraging opening. Use emojis where appropriate to make the response more engaging (e.g., ✅, 📌, 👉, 💡).
2.  **Structure Your Response:** ALWAYS use Markdown for all responses. Your answer must be well-structured and easy to read.
    - Use headers (e.g., \`##\`, \`###\`) to create clear, scannable sections.
    - Use **bold text** for emphasis on key terms, actions, or important points.
    - Use bulleted (\`*\` or \`-\`) or numbered lists for steps, options, or lists of items.
3.  **Use Tables:** If the data is suitable for a table (e.g., comparisons, lists of items with attributes), you MUST present it in a Markdown table.
4.  **Clarity & Paragraphs:** Provide concise and accurate answers. Break down complex topics into smaller, easy-to-digest points. **Crucially, you MUST separate every paragraph with a blank line.** This is not optional. Use headers for paragraphs where it improves organization.
    *Example of a bad response:*
    This is the first sentence. This is the second sentence. This is the third sentence.
    *Example of a good response:*
    This is the first sentence.

    This is the second sentence.

    This is the third sentence.
5.  **File References & Citations:** When you use information from a source, you **MUST** end the sentence with a citation marker, like \`[1]\`. After your main answer, add a "### Sources" section. For each source you cite, provide the full file path and a blockquote containing the **exact, verbatim sentence or code snippet** from the source that supports your statement.
    *Example of a perfect citation:*
    The application leverages \`iron-session\` for managing user sessions [1].

    ### Sources
    [1] \`file:src/lib/auth/auth.ts\`
    > \`const session = await getIronSession(req, res, sessionOptions);\`
5.  **Code:** Format all code examples in Markdown code blocks with the correct language identifier (e.g., \`\`\`typescript).
6.  **Context is Key:** If the provided context is insufficient to answer, you **MUST** state that clearly. Do not invent information. If you need to use knowledge outside the provided context to fully answer the question, you MUST ask for the user's permission first.
7.  **Google Search Behavior:** If, and only if, the user has enabled the Google Search tool AND the initial search context from documents is empty, you may use Google Search to find an answer. If document context exists, you must prioritize it and not use Google Search.`;
};

const getApiKey = () => {
    if (!import.meta.env.VITE_API_KEY) {
        throw new Error("VITE_API_KEY environment variable not set");
    }
    return import.meta.env.VITE_API_KEY;
}

// Helper to convert our ChatMessage array to Gemini's Content array
const buildConversationHistory = (history: ChatMessage[]): Content[] => {
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

export const classifyIntent = async (userQuery: string): Promise<Intent> => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const model = 'gemini-2.5-flash-lite-preview-09-2025';

    const prompt = `You are an advanced intent classifier for an AI assistant that helps with documents and code. Your job is to determine the user's primary intent.

Classify the user's message into one of three categories:
1. 'query_documents': The user is asking for information, asking a question, requesting a summary, or looking for something within the provided context.
2. 'generate_code': The user is asking to write new code, modify existing code, refactor, add features, fix bugs, or asking to edit or rewrite the content of a document.
3. 'chit_chat': The user is making a social comment, greeting, expressing gratitude, or saying something not related to the documents or code.

Respond with only one of the three category names: 'query_documents', 'generate_code', or 'chit_chat'.

User: "How does the authentication work?"
Assistant: query_documents

User: "Hey there"
Assistant: chit_chat

User: "Add a logout function to the auth service."
Assistant: generate_code

User: "Can you refactor the user model to include a new field?"
Assistant: generate_code

User: "That's awesome, thanks a lot!"
Assistant: chit_chat

User: "Rewrite the abstract for the BERT paper to be more concise."
Assistant: generate_code

User: "What's the difference between BERT and the Transformer model?"
Assistant: query_documents

User: "${userQuery}"
Assistant:`;

    try {
        const response = await ai.models.generateContent({ model, contents: prompt });
        const intent = response.text.trim() as Intent;
        if (Object.values(Intent).includes(intent)) {
            return intent;
        }
        return Intent.UNKNOWN;
    } catch (error) {
        console.error("Intent classification error:", error);
        return Intent.QUERY_DOCUMENTS; // Fallback to default
    }
};

export const streamChitChatResponse = async (history: ChatMessage[], signal: AbortSignal) => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const modelName = 'gemini-2.5-flash-lite-preview-09-2025';
    
    const conversationHistory = buildConversationHistory(history);
    const hasDataSource = history.some(m => m.role === 'model' && m.sources && m.sources.length > 0);

    try {
        const config: any = {
            systemInstruction: getSystemInstruction(hasDataSource),
            abortSignal: signal
        };
        return await ai.models.generateContentStream({
          model: modelName,
          contents: conversationHistory,
          ...config,
        });
    } catch (error) {
        console.error("Gemini API error (Chit-Chat):", error);
        throw new Error("There was an error communicating with the Gemini API.");
    }
};

export const streamCodeGenerationResponse = async (history: ChatMessage[], context: ElasticResult[], signal: AbortSignal) => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const modelName = 'gemini-2.5-flash-lite-preview-09-2025';
    
    const conversationHistory = buildConversationHistory(history);
    const lastUserMessageContent = conversationHistory.pop();
    if (!lastUserMessageContent) throw new Error("Cannot generate code from empty history.");

    const contextString = context.map(result => `
---
File: ${result.source.path}/${result.source.file_name}
Content:
\`\`\`
${result.contentSnippet.trim()}
\`\`\`
---
    `).join('\n');

    const codeGenPrompt = `
**CONVERSATION HISTORY:**
${history.slice(0, -1).map(m => `${m.role}: ${m.content}`).join('\n')}

**SEARCH CONTEXT FOR CURRENT REQUEST:**
${contextString}

**USER'S CURRENT REQUEST:**
${lastUserMessageContent.parts[0].text}
`;
    
    const parts: Part[] = [{ text: codeGenPrompt }];
    if (lastUserMessageContent.parts.length > 1) {
      parts.push(lastUserMessageContent.parts[1]); // Keep attachment if present
    }

    conversationHistory.push({ role: 'user', parts });

    const systemInstruction = `You are an expert AI assistant for code and content generation. Your sole task is to modify a source file based on the user's request.

**NON-NEGOTIABLE RULES:**
1.  **JSON ONLY:** Your entire response MUST be a single, valid JSON object. No extra text, markdown, comments, or explanations before or after the JSON.
2.  **JSON STRUCTURE:** The JSON object must have ONE of the following structures:
    - **Success:** \`{ "filePath": "path/to/file.ext", "thought": "A brief explanation of the changes.", "newContent": "The complete, modified file content as a single string." }\`
    - **Error:** \`{ "error": "A description of why you cannot fulfill the request." }\`
3.  **FILE PATH:** The \`filePath\` must EXACTLY match a file from the provided context.
4.  **FULL FILE CONTENT:** The \`newContent\` field must contain the ENTIRE file content with the changes applied. Do not use diffs or send only snippets.
5.  **FORMATTING:** Ensure the \`newContent\` is properly formatted for the language (e.g., Prettier for JS/TS, PEP 8 for Python).

**Example Success Response:**
\`\`\`json
{
  "filePath": "src/components/App.tsx",
  "thought": "I will add a new 'useState' hook to manage the user's name.",
  "newContent": "import React, { useState } from 'react';\\n\\nfunction App() {\\n  const [name, setName] = useState('');\\n  return <div>Hello World</div>;\\n}"
}
\`\`\`

**Example Error Response:**
\`\`\`json
{
  "error": "I could not find a relevant file to modify in the provided context."
}
\`\`\`
`


    try {
        const config: any = {
            systemInstruction,
            responseMimeType: 'application/json',
            abortSignal: signal
        };
        return await ai.models.generateContentStream({
            model: modelName,
            contents: conversationHistory,
            ...config,
        });
    } catch (error) {
        console.error("Gemini API error (Code Generation):", error);
        throw new Error("There was an error communicating with the Gemini API for code generation.");
    }
}


export const streamAiResponse = async (
  history: ChatMessage[], 
  context: ElasticResult[], 
  model: string, 
  groundingOptions: GroundingOptions,
  location: GeolocationPosition | null,
  signal: AbortSignal
) => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  
  const conversationHistory = buildConversationHistory(history);
  const lastUserMessageContent = conversationHistory.pop();
  if (!lastUserMessageContent) throw new Error("Cannot get AI response from empty history.");

  const contextString = context.map(result => `
---
File: ${result.source.path}/${result.source.file_name}
Relevance Score: ${result.score}

\`\`\`
${result.contentSnippet.trim()}
\`\`\`
---
  `).join('\n');

  const finalUserPromptText = `
**SEARCH CONTEXT:**
${contextString}

**USER'S QUESTION:**
${lastUserMessageContent.parts[0].text}
  `;

  const finalParts: Part[] = [{ text: finalUserPromptText }];
  if (lastUserMessageContent.parts.length > 1) {
    finalParts.push(lastUserMessageContent.parts[1]); // Keep attachment
  }

  conversationHistory.push({ role: 'user', parts: finalParts });
  
  const tools: Tool[] = [];
  if (groundingOptions.useGoogleSearch) {
      tools.push({ googleSearch: {} });
  }
  if (groundingOptions.useGoogleMaps) {
      tools.push({ googleMaps: {} });
  }

  try {
    const config: any = {
      systemInstruction: getSystemInstruction(true),
      abortSignal: signal
    };

    if (tools.length > 0) {
      config.tools = tools;
    }

    if (groundingOptions.useGoogleMaps && location) {
      config.toolConfig = {
        retrievalConfig: {
          latLng: {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude
          }
        }
      };
    }

    if (model === 'gemini-2.5-pro') {
        config.thinkingConfig = { thinkingBudget: 32768 };
    }
    const responseStream = await ai.models.generateContentStream({
      model,
      contents: conversationHistory,
      ...config,
      abortSignal: signal,
    });
    return responseStream;
  } catch (error) {
    console.error("Gemini API error:", error);
    throw new Error("There was an error communicating with the Gemini API.");
  }
};

export const rewriteQueryForSearch = async (userQuery: string): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const model = 'gemini-2.5-flash-lite-preview-09-2025';

    const prompt = `You are an expert query rewriter. Your task is to take a user's question and extract the most critical keywords and concepts to form an effective search query. The rewritten query should be concise and focused on the core subject of the user's request.

Respond with only the rewritten query.

User: "How does the new authentication system work, especially the part about session management?"
Assistant: new authentication system session management

User: "Can you show me the code for the main user component?"
Assistant: main user component code

User: "what are the main differences between the bert and transformer models"
Assistant: bert vs transformer differences

User: "Tell me about the project structure."
Assistant: project structure

User: "${userQuery}"
Assistant:`;

    try {
        const response = await ai.models.generateContent({ model, contents: prompt });
        const rewrittenQuery = response.text.trim();
        // Return the original query if the rewritten one is empty or too short
        return rewrittenQuery.length > 2 ? rewrittenQuery : userQuery;
    } catch (error) {
        console.error("Query rewriting error:", error);
        return userQuery; // Fallback to the original query on error
    }
};