import google.generativeai as genai
import os

genai.configure(api_key=os.environ["VITE_GEMINI_API_KEY"])

def classify_intent(user_query: str, model: str):
    prompt = f"""You are an advanced intent classifier for an AI assistant that helps with documents and code. Your job is to determine the user's primary intent.

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

User: "{user_query}"
Assistant:"""

    try:
        genai_model = genai.GenerativeModel(model)
        response = genai_model.generate_content(prompt)
        intent = response.text.strip()
        return intent
    except Exception as e:
        print(f"Intent classification error: {e}")
        return "query_documents"

def stream_chit_chat_response(history, model):
    genai_model = genai.GenerativeModel(model)
    return genai_model.generate_content(history, stream=True)

def stream_ai_response(history, context, model, grounding_options):
    genai_model = genai.GenerativeModel(model)

    user_query = ''
    if history and history[-1]['role'] == 'user':
        if 'parts' in history[-1] and isinstance(history[-1]['parts'], list) and history[-1]['parts']:
            if isinstance(history[-1]['parts'][0], dict) and 'text' in history[-1]['parts'][0]:
                user_query = history[-1]['parts'][0]['text']

    if not user_query:
        user_query = "Please provide a summary based on the context."

    formatted_context_parts = []
    for item in context:
        content_snippet = item.get('contentSnippet', 'No snippet available.')
        formatted_context_parts.append(content_snippet)
    formatted_context = "\n\n---\n\n".join(formatted_context_parts)

    prompt = f"""You are a helpful AI assistant. Your task is to answer the user's question based *only* on the context provided below.

If the answer is not available in the context, you must state that you cannot answer the question with the given information. Do not use any external knowledge.

**Context:**
---
{formatted_context}
---

**Question:**
{user_query}

**Answer:**
"""
    return genai_model.generate_content(prompt, stream=True)
