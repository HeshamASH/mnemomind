import { GoogleGenerativeAI, Content, Part, Tool, GenerateContentResponse, FunctionDeclarationTool, FunctionDeclarationsTool, GoogleSearchTool } from "@google/generative-ai";
import { ElasticResult, Intent, ChatMessage, GroundingOptions, GeolocationPosition } from '../types'; // Added GeolocationPosition

// Function to safely get text from a stream chunk
const getTextFromChunk = (chunk: GenerateContentResponse): string => {
    // Check candidates, content, parts, and text existence safely
    return chunk?.candidates?.[0]?.content?.parts?.[0]?.text || '';
};

// Updated instruction with a placeholder for dynamic replacement
const getSystemInstruction = (hasDataSource: boolean, isGoogleSearchEnabled: boolean): string => {
  if (!hasDataSource) {
    return `You are a helpful and friendly assistant. Respond conversationally.`;
  }

  const searchGuidance = isGoogleSearchEnabled
    ? "If the provided context is insufficient, attempt to use your available tools (like Google Search) to find the answer."
    : "If the provided context is insufficient, you MUST state clearly that you cannot answer based on the provided documents. Do not invent information or use knowledge outside the provided context.";

  return `You are "MnemoMind", a world-class AI assistant for analyzing documents and code.

**Your Core Task:**
Answer the user's question based *only* on the context provided with the latest user message. If the user provides an image or file, use it as primary context.

**Formatting Rules (Follow Strictly):**
1.  **Structure Your Response:** ALWAYS use Markdown for all responses. Your answer must be well-structured.
    - Use headers (e.g., \`#\`, \`##\`) to organize sections for anything other than chit-chat.
    - Use bold text for emphasis.
    - Use bulleted (\`*\` or \`-\`) or numbered lists for itemization.
2.  **Use Tables:** If the data is suitable for a table (e.g., comparisons, lists of items with attributes), you MUST present it in a Markdown table.
3.  **Clarity:** Provide concise and accurate answers.
4.  **File References & Citations:** When you use information from a source document provided in the context, you **MUST** end the sentence or statement with a citation marker, like \`[1]\`. Your citation numbers \`[1]\`, \`[2]\`, etc., **MUST correspond directly to the order of the source context items** provided to you. Citation numbers must be greater than zero. **DO NOT** use \`[0]\` as a citation. **DO NOT** add a separate "Sources" section listing file paths or quotes at the end of your response.
5.  **Code:** Format all code examples in Markdown code blocks with the correct language identifier (e.g., \`\`\`typescript).
6.  **Context is Key:** ${searchGuidance}`;
};


const getApiKey = () => {
    // Ensure VITE_API_KEY is available in the environment
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_API_KEY; // Prioritize GEMINI specific key if exists
    if (!apiKey) {
        throw new Error("VITE_GEMINI_API_KEY or VITE_API_KEY environment variable not set");
    }
    return apiKey;
}

// Helper to convert our ChatMessage array to Gemini's Content array
const buildConversationHistory = (history: ChatMessage[]): Content[] => {
    // Filter out system messages if any, and map others
    return history.filter(msg => msg.role !== 'system').map(msg => {
        const parts: Part[] = [{ text: msg.content }];
        if (msg.attachment) {
            parts.push({
                inlineData: {
                    mimeType: msg.attachment.type,
                    data: msg.attachment.content,
                }
            })
        }
        // Map user/model roles correctly for Gemini API
        const role = msg.role === 'user' ? 'user' : 'model';
        return { role, parts };
    });
};

export const classifyIntent = async (userQuery: string, model: string): Promise<Intent> => {
    const ai = new GoogleGenerativeAI(getApiKey()); // Pass API key during instantiation

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
        const genAI = ai.getGenerativeModel({ model }); // Get model instance
        const result = await genAI.generateContent(prompt);
        const response = await result.response;
        const intent = response.text().trim() as Intent;

        if (Object.values(Intent).includes(intent)) {
            return intent;
        }
        console.warn(`Unknown intent classified: ${intent}`);
        return Intent.UNKNOWN; // Or fallback to QUERY_DOCUMENTS
    } catch (error) {
        console.error("Intent classification error:", error);
        return Intent.QUERY_DOCUMENTS; // Fallback to default
    }
};

export const rewriteQuery = async (userQuery: string, model: string): Promise<string> => {
    const ai = new GoogleGenerativeAI(getApiKey()); // Pass API key

    const prompt = `Rewrite conversational queries into clean, keyword-focused search phrases suitable for a vector database search. Rules:

- Focus on the core intent and key entities/nouns.
- Remove greetings, politeness, questions words (who, what, when, where, why, how), and filler words ('can you tell me about', 'I want to know', 'please find').
- Keep important technical terms, proper nouns, and specific identifiers.
- Output only the rewritten query phrase.
- Do not answer the question.

Example 1:
User Question: "Hey MnemoMind, can you explain how the authentication middleware works in the Express app?"
Rewritten Query: "authentication middleware express app"

Example 2:
User Question: "What's the difference between the 'useState' and 'useEffect' hooks in React?"
Rewritten Query: "useState useEffect react hooks difference"

Example 3:
User Question: "Find the section about payment processing fees."
Rewritten Query: "payment processing fees"

User Question: "Thanks for the help earlier! Now, where is the configuration file for the database connection located?"
Rewritten Query: "database connection configuration file location"

User Question: "${userQuery}"
Rewritten Query:`;

    try {
        const genAI = ai.getGenerativeModel({ model }); // Get model instance
        const result = await genAI.generateContent(prompt);
        const response = await result.response;
        const rewritten = response.text().trim();
        // Basic check to prevent empty rewrites
        return rewritten || userQuery;
    } catch (error) {
        console.error("Query rewriting error:", error);
        return userQuery; // Fallback to original query on error
    }
};

export const streamChitChatResponse = async (history: ChatMessage[], model: string) => {
    const ai = new GoogleGenerativeAI(getApiKey()); // Pass API key

    const conversationHistory = buildConversationHistory(history);
    // Determine if any past model messages included sources (elastic or grounding chunks)
    const hasDataSourceContext = history.some(m => m.role === 'model' && ( (m.elasticSources && m.elasticSources.length > 0) || (m.groundingChunks && m.groundingChunks.length > 0) ));

    try {
        const genAI = ai.getGenerativeModel({
             model,
             // Chit-chat doesn't typically need search fallback, so pass false for isGoogleSearchEnabled
             systemInstruction: getSystemInstruction(hasDataSourceContext, false)
        });
        // Configuration for streaming
        const generationConfig = {
          // Add any specific config like temperature if needed
          // temperature: 0.7,
        };

        const result = await genAI.generateContentStream({
          contents: conversationHistory,
          generationConfig: generationConfig
        });

        // Return the async iterable directly
        return result.stream;

    } catch (error) {
        console.error("Gemini API error (Chit-Chat):", error);
        throw new Error("There was an error communicating with the Gemini API.");
    }
};

export const streamCodeGenerationResponse = async (history: ChatMessage[], context: ElasticResult[], model: string) => {
    const ai = new GoogleGenerativeAI(getApiKey()); // Pass API key

    const conversationHistory = buildConversationHistory(history);
    const lastUserMessageContent = conversationHistory.pop(); // Remove last user message to add context below
    if (!lastUserMessageContent) throw new Error("Cannot generate code from empty history.");

    // Format context from Elastic results
    const contextString = context.map((result, index) => `
---
Context Item ${index + 1}:
File Path: ${result.source.path}/${result.source.fileName}
Content Snippet:
\`\`\`
${result.contentSnippet.trim()}
\`\`\`
---
    `).join('\n');

    // Combine previous history, context, and the last user request
    const codeGenPrompt = `
**Previous Conversation History (if any):**
${conversationHistory.map(m => `${m.role}: ${m.parts?.map(p => p.text || '[attachment]').join(' ')}`).join('\n')}

**Relevant Context Snippets from Files:**
${contextString || "No specific file context was found for this request."}

**User's Current Request:**
${lastUserMessageContent.parts[0].text}
`;

    // Reconstruct the last message with the combined prompt
    const finalParts: Part[] = [{ text: codeGenPrompt }];
    if (lastUserMessageContent.parts && lastUserMessageContent.parts.length > 1 && lastUserMessageContent.parts[1].inlineData) {
      finalParts.push(lastUserMessageContent.parts[1]); // Keep attachment if present
    }
    const finalUserMessage: Content = { role: 'user', parts: finalParts };

    // Define the specific system instruction for code generation
    const systemInstruction = `You are an expert AI assistant specialized in code generation and modification based on provided context. Your task is to modify a single source file based on the user's request, using the relevant context snippets and conversation history.

**CRITICAL RULES (Follow Exactly):**
1.  **JSON Output ONLY:** Respond ONLY with a single, valid JSON object. Do NOT add any introductory text, concluding remarks, markdown formatting, apologies, or comments outside the JSON structure.
2.  **JSON Structure:** The JSON object MUST adhere to ONE of the following structures:
    * **Success:** \`{ "filePath": string, "thought": string, "newContent": string }\`
    * **Error:** \`{ "error": string }\`
3.  **'filePath'**: Identify the SINGLE most relevant file path from the provided "Context Snippets" section to apply the user's request. The value MUST exactly match the format "path/filename.ext" as shown in the context (e.g., "src/components/Button.tsx"). If no single relevant file is found in the context, use the error structure.
4.  **'thought'**: Provide a brief, one-sentence explanation summarizing the changes made or the reason for not making changes.
5.  **'newContent'**: This field MUST contain the COMPLETE and UNALTERED original content of the identified file, but with the user's requested modifications applied. It must be a single string containing the entire file content.
6.  **Code Formatting**: Ensure the 'newContent' is professionally formatted according to standard style guides for the file's language (e.g., Prettier for TypeScript/JavaScript, PEP 8 for Python). Preserve existing indentation and style where possible.
7.  **NO Diff Format**: Do NOT use diff formats (e.g., lines starting with '+' or '-').
8.  **NO Snippets**: Do NOT return only the changed function or section. Return the ENTIRE file content.
9.  **Error Handling**: If you cannot fulfill the request (e.g., context insufficient, request ambiguous, relevant file not found in context, trying to edit non-text file like PDF/image), respond using the error JSON structure: \`{ "error": "Your explanation here." }\`. Be specific about why the request failed (e.g., "Could not find a relevant file path in the provided context snippets.").
10. **File Type Restriction**: Only edit text-based files (source code, markdown, json, txt, etc.). If the most relevant context snippet is from a non-editable format (PDF, image), use the error structure: \`{ "error": "The relevant file appears to be a [PDF/image/etc.] and cannot be edited programmatically." }\``;


    try {
        const genAI = ai.getGenerativeModel({
             model,
             systemInstruction: systemInstruction, // Pass instruction
             generationConfig: {
                responseMimeType: 'application/json' // Request JSON output
             }
        });

        // Generate content using the final user message (containing history and context)
        const result = await genAI.generateContentStream({
            contents: [finalUserMessage], // Send only the combined final message
            // generationConfig is already set in getGenerativeModel
        });
        return result.stream; // Return the async iterable
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
  location?: GeolocationPosition | null // Add location parameter
): Promise<AsyncGenerator<GenerateContentResponse>> => {
  const ai = new GoogleGenerativeAI(getApiKey()); // Pass API key

  const conversationHistory = buildConversationHistory(history);
  const lastUserMessageContent = conversationHistory.pop(); // Prep for adding context
  if (!lastUserMessageContent) throw new Error("Cannot get AI response from empty history.");

  // Format context string from Elastic results
  // Assign explicit numbers for citation reference
  const contextString = context.map((result, index) => `
---
Source Context [${index + 1}]:
File: ${result.source.path}/${result.source.fileName}
Relevance Score: ${result.score.toFixed(4)}
Content Snippet:
\`\`\`
${result.contentSnippet.trim()}
\`\`\`
---
  `).join('\n');

  // Construct the final prompt including context
  const finalUserPromptText = `
**Previous Conversation History (if any):**
${conversationHistory.map(m => `${m.role}: ${m.parts?.map(p => p.text || '[attachment]').join(' ')}`).join('\n')}

**Retrieved Context for Answering the Question:**
${contextString || "No specific document context was retrieved for this question."}

**User's Current Question:**
${lastUserMessageContent.parts[0].text}

**Instructions:**
Answer the user's question based *only* on the provided "Retrieved Context".
Follow all formatting rules and citation requirements outlined in your primary system instructions. Remember to use citation markers like [1], [2], corresponding to the "Source Context" number above. Do not add a separate "Sources" section. If the context is insufficient, state that clearly unless Google Search is enabled (as per system instructions).
  `;

  // Rebuild the last user message with the combined prompt
  const finalParts: Part[] = [{ text: finalUserPromptText }];
  if (lastUserMessageContent.parts && lastUserMessageContent.parts.length > 1 && lastUserMessageContent.parts[1].inlineData) {
    finalParts.push(lastUserMessageContent.parts[1]); // Keep attachment
  }
  const finalUserMessage: Content = { role: 'user', parts: finalParts };

  // Prepare tools if grounding options are enabled
  // --- IMPORTANT: Adjust Tool typing based on your installed @google/generative-ai version ---
  // The exact types (Tool, GoogleSearchTool, FunctionDeclarationTool) might vary slightly.
  const tools: (GoogleSearchTool | FunctionDeclarationTool | Tool)[] = [];
  if (groundingOptions.useGoogleSearch) {
    // Correct way to specify the Google Search tool
    tools.push({ googleSearch: {} });
  }

  // Define a simple function declaration for maps (example)
  // You would need corresponding backend logic if you actually call this
  // const mapsFunction: FunctionDeclaration = {
  //     name: "find_places_nearby",
  //     description: "Find places of a specific type near a location.",
  //     parameters: {
  //         type: FunctionDeclarationSchemaType.OBJECT,
  //         properties: {
  //             query: { type: FunctionDeclarationSchemaType.STRING, description: "Type of place (e.g., 'restaurants', 'coffee shops')" },
  //             latitude: { type: FunctionDeclarationSchemaType.NUMBER, description: "Latitude of the location" },
  //             longitude: { type: FunctionDeclarationSchemaType.NUMBER, description: "Longitude of the location" },
  //         },
  //         required: ["query", "latitude", "longitude"],
  //     },
  // };

  if (groundingOptions.useGoogleMaps && location) {
    // If using function calling for maps:
    // tools.push({ functionDeclarations: [mapsFunction] });
    console.warn("Google Maps grounding via built-in tools is not directly supported like Google Search. Function calling or specific API features would be needed.");
    // For now, we won't add a specific tool for maps unless function calling is implemented
  }

  try {
    // Generate the system instruction dynamically based on whether Google Search is enabled
    const finalSystemInstruction = getSystemInstruction(
        true, // Assume a data source exists if we are in this function
        groundingOptions.useGoogleSearch // Pass the actual boolean value
    );

    const genAI = ai.getGenerativeModel({
        model,
        systemInstruction: { role: "system", parts: [{ text: finalSystemInstruction }] }, // Use correct structure
        tools: tools.length > 0 ? tools as FunctionDeclarationsTool[] | GoogleSearchTool[] : undefined, // Cast tools appropriately
    });

    // Generate content stream using the combined final message
    const result = await genAI.generateContentStream({
      contents: [finalUserMessage], // Send only the combined message
      // generationConfig can be added here if needed (e.g., temperature)
    });
    return result.stream; // Return the async iterable stream
  } catch (error) {
    console.error("Gemini API error (RAG Response):", error);
    // More specific error handling for safety filter
    if (error instanceof Error && error.message.includes('SAFETY')) { // Simple check, adjust if needed
        throw new Error("BlockedBySafetyFilter"); // Throw specific error type
    }
    throw new Error("There was an error communicating with the Gemini API.");
  }
};

// Export the helper function
export { getTextFromChunk };
