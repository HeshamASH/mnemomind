import os
import json
import google.generativeai as genai
from fastapi import FastAPI, HTTPException, Body, Request, Cookie
from fastapi.responses import RedirectResponse, StreamingResponse
from pydantic import BaseModel
from elasticsearch import Elasticsearch
from dotenv import load_dotenv
from pathlib import Path
from itsdangerous import URLSafeSerializer
from urllib.parse import unquote
# from google.oauth2.credentials import Credentials
# from api.google_drive import get_google_flow, get_drive_service, get_sheets_service
from fastembed import TextEmbedding

# Construct the path to the .env.local file
dotenv_path = Path(__file__).resolve().parent.parent / '.env.local'
load_dotenv(dotenv_path=dotenv_path)

ELASTIC_CLOUD_ID = os.getenv("ELASTIC_CLOUD_ID")
ELASTIC_API_KEY = os.getenv("ELASTIC_API_KEY")
ELASTIC_INDEX = os.getenv("ELASTIC_INDEX")
GEMINI_API_KEY = os.getenv("VITE_API_KEY")

if not all([ELASTIC_CLOUD_ID, ELASTIC_API_KEY, ELASTIC_INDEX, GEMINI_API_KEY]):
    raise RuntimeError("Missing required environment variables")

genai.configure(api_key=GEMINI_API_KEY)

es = Elasticsearch(
    cloud_id=ELASTIC_CLOUD_ID,
    api_key=ELASTIC_API_KEY
)

app = FastAPI()

# Secret key for signing session data
# In a production application, this should be a long, random string stored securely
SECRET_KEY = "your-secret-key"
serializer = URLSafeSerializer(SECRET_KEY)

class ChatQuery(BaseModel):
    query: str
    model: str

class SearchQuery(BaseModel):
    query: str

class Source(BaseModel):
    id: str
    file_name: str
    path: str

# --- Helper Functions for Gemini API ---

async def get_intent(query: str) -> str:
    model = genai.GenerativeModel('gemini-2.5-flash-lite-preview-09-2025')
    prompt = f"""Determine the user's intent. Respond with "chit-chat" or "query_document".
    User: "Hello" -> "chit-chat"
    User: "Tell me about the new features" -> "query_document"
    User: "{query}" ->"""
    response = await model.generate_content_async(prompt)
    return response.text.strip()

async def get_keywords(query: str) -> str:
    model = genai.GenerativeModel('gemini-2.5-flash-lite-preview-09-2025')
    prompt = f"""Extract keywords from the user's query for a search engine.
    User: "Tell me about the new features in the latest version" -> "new features latest version"
    User: "{query}" ->"""
    response = await model.generate_content_async(prompt)
    return response.text.strip()

async def stream_gemini_response(model_id: str, prompt: str):
    model = genai.GenerativeModel(model_id)
    stream = await model.generate_content_async(prompt, stream=True)
    for chunk in stream:
        yield f"data: {json.dumps({'text': chunk.text})}\n\n"

# --- API Endpoints ---

@app.post("/api/chat")
async def chat_handler(chat_query: ChatQuery):
    intent = await get_intent(chat_query.query)

    if intent == "chit-chat":
        async def chit_chat_stream():
            model = genai.GenerativeModel('gemini-2.5-flash-lite-preview-09-2025')
            stream = await model.generate_content_async(chat_query.query, stream=True)
            for chunk in stream:
                yield f"data: {json.dumps({'text': chunk.text})}\n\n"
        return StreamingResponse(chit_chat_stream(), media_type="text/event-stream")

    elif intent == "query_document":
        keywords = await get_keywords(chat_query.query)
        
        # Perform search on Elasticsearch
        query_vector = list(embedding_model.embed([keywords]))[0].tolist()
        search_body = {
            "knn": {
                "field": "chunk_vector",
                "query_vector": query_vector,
                "k": 10,
                "num_candidates": 100
            },
            "_source": ["chunk_text"]
        }
        response = es.search(index=ELASTIC_INDEX, body=search_body)
        
        chunks = [hit["_source"]["chunk_text"] for hit in response["hits"]["hits"]]
        context = "\n".join(chunks)

        prompt = f"""Answer the following query based on the provided context.
        Context: {context}
        Query: {chat_query.query}
        Answer:"""
        
        return StreamingResponse(stream_gemini_response(chat_query.model, prompt), media_type="text/event-stream")

    else:
        raise HTTPException(status_code=400, detail="Invalid intent")


# @app.get("/api/auth/google")
# async def auth_google():
#     flow = get_google_flow()
#     authorization_url, state = flow.authorization_url(
#         access_type='offline',
#         include_granted_scopes='true'
#     )
#     response = RedirectResponse(url=authorization_url)
#     response.set_cookie(key="state", value=serializer.dumps(state))
#     return response

# @app.get("/api/auth/google/callback")
# async def auth_google_callback(request: Request, state: str = Cookie(None)):
#     if not state or serializer.loads(state) != request.query_params.get('state'):
#         raise HTTPException(status_code=400, detail="State mismatch")

#     flow = get_google_flow()
#     flow.fetch_token(authorization_response=str(request.url))
    
#     credentials = flow.credentials
    
#     # Store credentials in a secure, http-only cookie
#     response = RedirectResponse(url="/?source=google-drive") # Redirect to the frontend app
#     response.set_cookie(
#         key="credentials", 
#         value=serializer.dumps(credentials_to_dict(credentials)),
#         httponly=True,
#         samesite='lax'
#     )
#     return response

# def credentials_to_dict(credentials):
#     return {'token': credentials.token,
#             'refresh_token': credentials.refresh_token,
#             'token_uri': credentials.token_uri,
#             'client_id': credentials.client_id,
#             'client_secret': credentials.client_secret,
#             'scopes': credentials.scopes}

# @app.get("/api/drive/files")
# async def list_drive_files(credentials: str = Cookie(None)):
#     if not credentials:
#         raise HTTPException(status_code=401, detail="Not authenticated")

#     try:
#         creds_dict = serializer.loads(credentials)
#         creds = Credentials(**creds_dict)
#     except Exception:
#         raise HTTPException(status_code=401, detail="Invalid credentials")

#     drive_service = get_drive_service(creds)

#     try:
#         results = drive_service.files().list(
#             q="mimeType='application/vnd.google-apps.document' or mimeType='application/vnd.google-apps.spreadsheet'",
#             pageSize=100, 
#             fields="nextPageToken, files(id, name, mimeType, modifiedTime)").execute()
#         items = results.get('files', [])
#         return items
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))

# @app.get("/api/drive/files/{file_id}")
# async def get_drive_file(file_id: str, credentials: str = Cookie(None)):
#     if not credentials:
#         raise HTTPException(status_code=401, detail="Not authenticated")

#     try:
#         creds_dict = serializer.loads(credentials)
#         creds = Credentials(**creds_dict)
#     except Exception:
#         raise HTTPException(status_code=401, detail="Invalid credentials")

#     drive_service = get_drive_service(creds)

#     try:
#         file_metadata = drive_service.files().get(fileId=file_id).execute()
#         mime_type = file_metadata.get('mimeType')

#         if mime_type == 'application/vnd.google-apps.document':
#             request = drive_service.files().export_media(fileId=file_id, mimeType='text/plain')
#         elif mime_type == 'application/vnd.google-apps.spreadsheet':
#             request = drive_service.files().export_media(fileId=file_id, mimeType='text/csv')
#         else:
#             request = drive_service.files().get_media(fileId=file_id)
        
#         file_content = request.execute()
#         return {"content": file_content.decode('utf-8')}
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))

# @app.post("/api/sheets/export")
# async def export_to_sheets(request: Request, credentials: str = Cookie(None)):
#     if not credentials:
#         raise HTTPException(status_code=401, detail="Not authenticated")

#     try:
#         creds_dict = serializer.loads(credentials)
#         creds = Credentials(**creds_dict)
#     except Exception:
#         raise HTTPException(status_code=401, detail="Invalid credentials")

#     sheets_service = get_sheets_service(creds)
#     data = await request.json()
#     table_data = data.get('tableData')

#     try:
#         spreadsheet = {
#             'properties': {
#                 'title': 'Exported Table Data'
#             }
#         }
#         spreadsheet = sheets_service.spreadsheets().create(body=spreadsheet,
#                                                     fields='spreadsheetId,spreadsheetUrl').execute()
        
#         body = {
#             'values': table_data
#         }
#         result = sheets_service.spreadsheets().values().update(
#             spreadsheetId=spreadsheet.get('spreadsheetId'),
#             range='A1',
#             valueInputOption='RAW',
#             body=body).execute()

#         return {"sheetUrl": spreadsheet.get('spreadsheetId')}
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))



# ... (existing code) ...

embedding_model = TextEmbedding(model_name='BAAI/bge-small-en-v1.5', cache_dir='/tmp/fastembed_cache')

# ... (existing code) ...

import logging

# ... (existing code) ...

@app.post("/api/search")
async def search_documents(query: SearchQuery):
    try:
        query_vector = list(embedding_model.embed([query.query]))[0].tolist()

        search_body = {
            "knn": {
                "field": "chunk_vector",
                "query_vector": query_vector,
                "k": 10,
                "num_candidates": 100
            },
            "_source": ["file_name", "path", "chunk_text"],
            "highlight": {
                "fields": { "chunk_text": {} },
                "fragment_size": 150,
                "number_of_fragments": 1
            }
        }

        response = es.search(
            index=ELASTIC_INDEX,
            body=search_body
        )

        results = []
        for hit in response["hits"]["hits"]:
            logging.info(f"hit: {hit}")
            content_snippet = hit.get("highlight", {}).get("chunk_text", [hit["_source"].get("chunk_text", "")])[0]
            logging.info(f"content_snippet: {content_snippet}")
            if content_snippet:
                results.append({
                    "source": {
                        "id": hit["_id"],
                        "file_name": hit["_source"].get("file_name", ""),
                        "path": hit["_source"].get("path", "")
                    },
                    "contentSnippet": content_snippet,
                    "score": hit["_score"]
                })
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/files/{file_id}")
async def get_file_content(file_id: str):
    try:
        decoded_file_id = unquote(file_id)
        response = es.get(index=ELASTIC_INDEX, id=decoded_file_id)
        return {"content": response["_source"].get("content", "Content not found")}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/files")
async def get_all_files():
    try:
        response = es.search(
            index=ELASTIC_INDEX,
            body={
                "size": 1000,
                "query": { "match_all": {} },
                "_source": ["file_name", "path"]
            }
        )
        results = [
            {
                "id": hit["_id"],
                "file_name": hit["_source"].get("file_name", ""),
                "path": hit["_source"].get("path", "")
            }
            for hit in response["hits"]["hits"]
        ]
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
