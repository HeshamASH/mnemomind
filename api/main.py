import os
import json
import logging # Import logging
import base64 # Add this import
from fastapi import FastAPI, HTTPException, Body, Request, Cookie
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from elasticsearch import Elasticsearch
from dotenv import load_dotenv
from pathlib import Path
from itsdangerous import URLSafeSerializer
from google.oauth2.credentials import Credentials
from fastembed import TextEmbedding
from api.google_drive import get_google_flow, get_drive_service, get_sheets_service

# Configure logging
logging.basicConfig(level=logging.INFO)

# Construct the path to the .env.local file
dotenv_path = Path(__file__).resolve().parent.parent / '.env.local'
load_dotenv(dotenv_path=dotenv_path)

ELASTIC_CLOUD_ID = os.getenv("ELASTIC_CLOUD_ID")
ELASTIC_API_KEY = os.getenv("ELASTIC_API_KEY")
ELASTIC_INDEX = os.getenv("ELASTIC_INDEX")

if not all([ELASTIC_CLOUD_ID, ELASTIC_API_KEY, ELASTIC_INDEX]):
    # Use logging instead of print for errors
    logging.error("Missing required environment variables for Elasticsearch")
    raise RuntimeError("Missing required environment variables for Elasticsearch")

try:
    es = Elasticsearch(
        cloud_id=ELASTIC_CLOUD_ID,
        api_key=ELASTIC_API_KEY,
        request_timeout=30 # Optional: Set a default timeout
    )
    # Verify connection
    if not es.ping():
        logging.error("Failed to connect to Elasticsearch.")
        raise RuntimeError("Failed to connect to Elasticsearch.")
    logging.info("Successfully connected to Elasticsearch.")
except Exception as e:
    logging.error(f"Error connecting to Elasticsearch: {e}", exc_info=True)
    raise RuntimeError(f"Error connecting to Elasticsearch: {e}")


app = FastAPI()

# Secret key for signing session data
# In a production application, this should be a long, random string stored securely
SECRET_KEY = os.getenv("SECRET_KEY", "your-fallback-secret-key") # Load from env or use fallback
if SECRET_KEY == "your-fallback-secret-key":
     logging.warning("Using fallback SECRET_KEY. Set a strong SECRET_KEY environment variable for production.")
serializer = URLSafeSerializer(SECRET_KEY)

# --- Pydantic Models ---
class SearchQuery(BaseModel):
    query: str

class Source(BaseModel):
    id: str
    fileName: str
    path: str

# --- Embedding Model ---
try:
    # Load the sentence transformer model upon startup
    embedding_model = TextEmbedding(model_name="BAAI/bge-base-en")
    logging.info("FastEmbed model loaded successfully.")
except Exception as e:
    logging.error(f"Failed to load FastEmbed model: {e}", exc_info=True)
    # Depending on your app's requirements, you might want to raise an error here
    # raise RuntimeError(f"Failed to load Sentence Transformer model: {e}")
    embedding_model = None # Set to None if loading fails

# --- Google OAuth Helper ---
def credentials_to_dict(credentials):
    return {'token': credentials.token,
            'refresh_token': credentials.refresh_token,
            'token_uri': credentials.token_uri,
            'client_id': credentials.client_id,
            'client_secret': credentials.client_secret,
            'scopes': credentials.scopes}

# --- API Endpoints ---

@app.get("/api/auth/google")
async def auth_google():
    """Initiates the Google OAuth2 flow."""
    try:
        flow = get_google_flow()
        authorization_url, state = flow.authorization_url(
            access_type='offline',
            include_granted_scopes='true',
            # prompt='consent' # Optional: Forces consent screen every time
        )
        response = RedirectResponse(url=authorization_url)
        # Sign the state before putting it in the cookie
        response.set_cookie(key="state", value=serializer.dumps(state), httponly=True, samesite='lax')
        logging.info("Redirecting user to Google for authentication.")
        return response
    except Exception as e:
        logging.error(f"Error during Google auth initiation: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Could not initiate Google authentication.")

@app.get("/api/auth/google/callback")
async def auth_google_callback(request: Request, state: str = Cookie(None)):
    """Handles the callback from Google after user authentication."""
    logging.info("Received callback from Google.")
    if not state:
        logging.error("State cookie missing in Google auth callback.")
        raise HTTPException(status_code=400, detail="State cookie missing.")

    try:
        # Unsign the state from the cookie
        signed_state_from_cookie = serializer.loads(state)
        state_from_request = request.query_params.get('state')

        if not state_from_request or signed_state_from_cookie != state_from_request:
            logging.error(f"State mismatch: Cookie='{signed_state_from_cookie}' Request='{state_from_request}'")
            raise HTTPException(status_code=400, detail="State mismatch.")

        flow = get_google_flow()
        # Use the full URL string for fetch_token
        flow.fetch_token(authorization_response=str(request.url))
        credentials = flow.credentials
        logging.info("Successfully fetched Google API token.")

        # Store credentials securely in a signed, http-only cookie
        response = RedirectResponse(url="/?source=google-drive") # Redirect back to the frontend
        response.set_cookie(
            key="credentials",
            value=serializer.dumps(credentials_to_dict(credentials)), # Sign the credentials dict
            httponly=True,
            samesite='lax',
            secure=request.url.scheme == "https", # Use secure=True if served over HTTPS
            max_age=3600 * 24 * 7 # Example: Cookie lasts for 7 days
        )
        # Clear the state cookie
        response.delete_cookie("state")
        return response
    except Exception as e:
        logging.error(f"Error during Google auth callback: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Could not process Google callback: {e}")

# Helper to get credentials from cookie
def get_credentials_from_cookie(credentials_cookie: str | None) -> Credentials | None:
    if not credentials_cookie:
        return None
    try:
        creds_dict = serializer.loads(credentials_cookie) # Unsign the cookie value
        return Credentials(**creds_dict)
    except Exception as e:
        logging.warning(f"Failed to load credentials from cookie: {e}")
        return None

@app.get("/api/drive/files")
async def list_drive_files(credentials: str | None = Cookie(None)):
    """Lists files (Docs and Sheets) from the user's Google Drive."""
    creds = get_credentials_from_cookie(credentials)
    if not creds:
        raise HTTPException(status_code=401, detail="Not authenticated or invalid credentials.")

    try:
        drive_service = get_drive_service(creds)
        # Updated query to be more specific and exclude trashed files
        results = drive_service.files().list(
            q="trashed=false and (mimeType='application/vnd.google-apps.document' or mimeType='application/vnd.google-apps.spreadsheet')",
            pageSize=100, # Adjust as needed, consider pagination for >100 files
            fields="nextPageToken, files(id, name, mimeType, modifiedTime, webViewLink)").execute() # Added webViewLink
        items = results.get('files', [])
        logging.info(f"Retrieved {len(items)} files from Google Drive.")
        return items
    except Exception as e:
        logging.error(f"Error listing Google Drive files: {e}", exc_info=True)
        # Potentially check for specific Google API errors (e.g., expired token)
        raise HTTPException(status_code=500, detail=f"Could not list Google Drive files: {e}")

@app.get("/api/drive/files/{file_id}")
async def get_drive_file(file_id: str, credentials: str | None = Cookie(None)):
    """Gets the content of a specific Google Drive file (Doc or Sheet)."""
    creds = get_credentials_from_cookie(credentials)
    if not creds:
        raise HTTPException(status_code=401, detail="Not authenticated or invalid credentials.")

    try:
        drive_service = get_drive_service(creds)
        file_metadata = drive_service.files().get(fileId=file_id, fields="mimeType, name").execute() # Added name field
        mime_type = file_metadata.get('mimeType')
        file_name = file_metadata.get('name', file_id) # Use name for logging
        logging.info(f"Fetching content for Google Drive file: '{file_name}' (ID: {file_id}), MIME Type: {mime_type}")

        request = None
        export_mime_type = None

        if mime_type == 'application/vnd.google-apps.document':
            export_mime_type = 'text/plain'
            request = drive_service.files().export_media(fileId=file_id, mimeType=export_mime_type)
        elif mime_type == 'application/vnd.google-apps.spreadsheet':
            export_mime_type = 'text/csv'
            request = drive_service.files().export_media(fileId=file_id, mimeType=export_mime_type)
        elif mime_type and ('text/' in mime_type or 'application/json' in mime_type): # Handle plain text like files directly
             request = drive_service.files().get_media(fileId=file_id)
        else:
            logging.warning(f"Unsupported MIME type '{mime_type}' for file ID {file_id}. Cannot fetch content directly.")
            raise HTTPException(status_code=400, detail=f"Unsupported file type: {mime_type}")

        if request:
            file_content_bytes = request.execute()
            # Decode bytes to string assuming UTF-8
            file_content_str = file_content_bytes.decode('utf-8')
            logging.info(f"Successfully fetched content for Google Drive file: '{file_name}'")
            return {"content": file_content_str}
        else:
             # Should not happen if MIME type check is done correctly, but as a safeguard
             raise HTTPException(status_code=500, detail="Failed to create download request for the file.")

    except Exception as e:
        logging.error(f"Error getting Google Drive file content for ID {file_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Could not get Google Drive file content: {e}")

@app.post("/api/sheets/export")
async def export_to_sheets(request: Request, credentials: str | None = Cookie(None)):
    """Exports provided table data to a new Google Sheet."""
    creds = get_credentials_from_cookie(credentials)
    if not creds:
        raise HTTPException(status_code=401, detail="Not authenticated or invalid credentials.")

    try:
        sheets_service = get_sheets_service(creds)
        data = await request.json()
        table_data = data.get('tableData')

        if not table_data or not isinstance(table_data, list):
             raise HTTPException(status_code=400, detail="Invalid or missing 'tableData' in request body.")

        logging.info(f"Attempting to export table data ({len(table_data)} rows) to Google Sheets.")

        spreadsheet_body = {
            'properties': {
                'title': 'Exported Data from MnemoMind' # More descriptive title
            }
        }
        spreadsheet = sheets_service.spreadsheets().create(
            body=spreadsheet_body,
            fields='spreadsheetId,spreadsheetUrl'
        ).execute()
        spreadsheet_id = spreadsheet.get('spreadsheetId')
        spreadsheet_url = spreadsheet.get('spreadsheetUrl')
        logging.info(f"Created new Google Sheet with ID: {spreadsheet_id}")


        update_body = {
            'values': table_data
        }
        # Update Sheet1 starting at cell A1
        update_range = 'Sheet1!A1'
        result = sheets_service.spreadsheets().values().update(
            spreadsheetId=spreadsheet_id,
            range=update_range,
            valueInputOption='RAW', # Treats input as literal strings
            body=update_body
        ).execute()

        logging.info(f"Successfully updated sheet. Result: {result}")
        return {"sheetUrl": spreadsheet_url}

    except Exception as e:
        logging.error(f"Error exporting data to Google Sheets: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Could not export to Google Sheets: {e}")


@app.post("/api/search")
async def search_documents(query_body: SearchQuery = Body(...)): # Use Body for clarity
    """Searches documents in Elasticsearch using KNN vector search and highlighting."""
    if not embedding_model:
        logging.error("Embedding model not loaded, cannot perform search.")
        raise HTTPException(status_code=503, detail="Search service temporarily unavailable (model loading failed).")
    try:
        query_text = query_body.query
        logging.info(f"Received search query: '{query_text}'")
        query_vector = list(embedding_model.embed([query_text]))[0].tolist()


        search_body = {
            "knn": {
                "field": "chunk_vector", # Ensure this matches your index mapping
                "query_vector": query_vector,
                "k": 10,
                "num_candidates": 100
            },
            "_source": ["file_name", "path", "chunk_text"], # Include chunk_text for fallback
            "highlight": {
                "fields": {
                    "chunk_text": {
                         "fragment_size": 150,
                         "number_of_fragments": 1
                    }
                 },
                 "pre_tags": [""], # Optional: Remove default <em> tags if needed
                 "post_tags": [""]
            }
        }

        response = es.search(
            index=ELASTIC_INDEX,
            body=search_body,
            request_timeout=30 # Optional: Specific timeout for search
        )
        logging.info(f"Elasticsearch response received for query '{query_text}'. Hits: {len(response.get('hits', {}).get('hits', []))}")

        results = []
        for hit in response.get("hits", {}).get("hits", []):
            source = hit.get("_source", {})
            file_name = source.get("file_name", "")
            path = source.get("path", "")

            # Get highlighted snippet or fall back to original chunk text
            highlighted_snippet = ""
            if "highlight" in hit and "chunk_text" in hit["highlight"]:
                highlighted_snippet = hit["highlight"]["chunk_text"][0]
            elif "chunk_text" in source:
                 # Fallback: Truncate original chunk text if no highlight
                 full_chunk = source["chunk_text"]
                 highlighted_snippet = (full_chunk[:147] + '...') if len(full_chunk) > 150 else full_chunk


            if hit.get("_id") and file_name and highlighted_snippet: # Ensure essential data is present
                 results.append({
                    "source": {
                        "id": hit["_id"],
                        "fileName": file_name,
                        "path": path
                    },
                    "contentSnippet": highlighted_snippet,
                    "score": hit.get("_score") # KNN score might be different from traditional _score
                 })
            else:
                 logging.warning(f"Skipping hit due to missing data: ID={hit.get('_id')}, FileName={file_name}, Snippet={highlighted_snippet is not None}")


        logging.info(f"Processed {len(results)} results for query '{query_text}'.")
        return results

    except Exception as e:
        logging.error(f"Error during Elasticsearch search for query '{query_body.query}': {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Search failed: {e}")


@app.get("/api/files/{file_id}")
async def get_file_content(file_id: str):
    """Gets the full content of a file from Elasticsearch based on its ID."""
    try:
        logging.info(f"Fetching content for file ID: {file_id}")
        # Fetch the document source including 'content' and 'file_name'
        response = es.get(
            index=ELASTIC_INDEX,
            id=file_id,
            _source_includes=["content", "file_name"] # Ensure 'content' field is indexed and requested
        )

        source = response.get("_source", {})
        content = source.get("content")
        file_name = source.get("file_name", "") # Get the filename for type checking

        if content is None:
             logging.warning(f"Content field not found for document ID: {file_id}")
             raise HTTPException(status_code=404, detail="Content field not found in document.")

        # --- PDF Base64 Handling ---
        if file_name.lower().endswith(".pdf"):
            is_base64 = False
            try:
                # Attempt to decode to validate if it's base64
                base64.b64decode(content, validate=True)
                is_base64 = True
            except (TypeError, ValueError, Exception): # Catch potential errors during decoding
                is_base64 = False # Not valid base64 or not a string

            if is_base64:
                 logging.info(f"Returning base64 content for PDF: {file_name}")
                 return {"content": content, "isBase64": True}
            else:
                 # If PDF content stored is not base64 (e.g., extracted text)
                 logging.warning(f"Stored content for PDF '{file_name}' is not base64. Returning raw text.")
                 # Option 1: Raise error - forces correct indexing
                 # raise HTTPException(status_code=500, detail="Stored PDF content is raw text, cannot display as PDF. Re-index PDFs with base64 content.")
                 # Option 2: Return raw text (as currently implemented)
                 return {"content": content, "isBase64": False}
        else:
             # For non-PDF files, assume plain text
             logging.info(f"Returning plain text content for: {file_name}")
             return {"content": content, "isBase64": False}

    except HTTPException as http_exc:
        raise http_exc # Re-raise known HTTP exceptions (like 404 from es.get)
    except Exception as e:
        logging.error(f"Error fetching file content for ID {file_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error processing file request: {e}")


@app.get("/api/files")
async def get_all_files():
    """Retrieves a list of all indexed files (ID, name, path)."""
    try:
        logging.info("Fetching list of all indexed files.")
        # Use scroll API if expecting thousands of files, otherwise 'size' is okay for hundreds/few thousands
        response = es.search(
            index=ELASTIC_INDEX,
            body={
                "size": 1000, # Adjust size limit as needed, or implement scrolling
                "query": { "match_all": {} },
                "_source": ["file_name", "path"] # Ensure these fields exist in mapping
            },
            request_timeout=30 # Optional timeout
        )

        # Robust check for response structure
        hits_data = response.get("hits", {}).get("hits", [])
        if not isinstance(hits_data, list):
             logging.error(f"Unexpected Elasticsearch response structure for get_all_files: {response}")
             raise HTTPException(status_code=500, detail="Failed to parse file list from storage.")

        results = []
        for hit in hits_data:
             source = hit.get("_source")
             hit_id = hit.get("_id")
             if source and hit_id:
                 file_name = source.get("file_name")
                 path = source.get("path")
                 if file_name: # Ensure filename is present
                     results.append({
                         "id": hit_id,
                         "fileName": file_name,
                         "path": path if path is not None else "" # Ensure path is always a string
                     })
                 else:
                      logging.warning(f"Skipping hit {hit_id} due to missing file_name.")
             else:
                 logging.warning(f"Skipping hit due to missing _source or _id: {hit}")


        logging.info(f"Returning {len(results)} files.")
        return results
    except Exception as e:
        logging.error(f"Error fetching all files: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error retrieving file list: {e}")

# --- Optional: Add a root endpoint for basic check ---
@app.get("/")
async def read_root():
    return {"message": "MnemoMind API is running"}

# --- Uvicorn entry point (if running directly) ---
# This part is usually handled by your deployment setup (e.g., Vercel doesn't need this)
# if __name__ == "__main__":
#     import uvicorn
#     uvicorn.run(app, host="0.0.0.0", port=8000)

