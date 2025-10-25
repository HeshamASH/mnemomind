import os
import json
import logging # Import logging
import traceback # Import traceback for detailed error logging
import base64 # Add this import
from fastapi import FastAPI, HTTPException, Body, Request, Cookie, status # Added status
from fastapi.responses import RedirectResponse, JSONResponse # Added JSONResponse
from pydantic import BaseModel
from elasticsearch import Elasticsearch, ConnectionError as ESConnectionError, NotFoundError as ESNotFoundError, RequestError as ESRequestError
from dotenv import load_dotenv
from pathlib import Path
from itsdangerous import URLSafeSerializer, BadSignature
from google.oauth2.credentials import Credentials
from googleapiclient.errors import HttpError as GoogleHttpError
# Use TextEmbedding directly from fastembed
from fastembed import TextEmbedding
# Import google drive helpers
from api.google_drive import get_google_flow, get_drive_service, get_sheets_service

# Configure logging more robustly
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler()] # Ensure logs go to stdout/stderr for Vercel
)
logger = logging.getLogger(__name__) # Use a named logger

# Construct the path to the .env.local file relative to main.py's parent directory
# __file__ points to api/main.py, parent is api/, parent.parent is the project root
dotenv_path = Path(__file__).resolve().parent.parent / '.env.local'
logger.info(f"Attempting to load .env file from: {dotenv_path}")
loaded_env = load_dotenv(dotenv_path=dotenv_path)
logger.info(f".env file loaded: {loaded_env}")


ELASTIC_CLOUD_ID = os.getenv("ELASTIC_CLOUD_ID")
ELASTIC_API_KEY = os.getenv("ELASTIC_API_KEY")
ELASTIC_INDEX = os.getenv("ELASTIC_INDEX")
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID") # Needed for auth flow
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET") # Needed for auth flow
SECRET_KEY = os.getenv("SECRET_KEY") # Needed for session signing

# --- Environment Variable Validation ---
required_env_vars = {
    "ELASTIC_CLOUD_ID": ELASTIC_CLOUD_ID,
    "ELASTIC_API_KEY": ELASTIC_API_KEY,
    "ELASTIC_INDEX": ELASTIC_INDEX,
    "GOOGLE_CLIENT_ID": GOOGLE_CLIENT_ID,
    "GOOGLE_CLIENT_SECRET": GOOGLE_CLIENT_SECRET,
    "SECRET_KEY": SECRET_KEY,
}

missing_vars = [name for name, value in required_env_vars.items() if not value]

if missing_vars:
    logger.critical(f"Missing critical environment variables: {', '.join(missing_vars)}. Check .env.local or Vercel environment settings.")
    # In a real app, you might exit here, but for Vercel, let it try and fail.
    # raise RuntimeError(f"Missing critical environment variables: {', '.join(missing_vars)}")
else:
    logger.info("All required environment variables seem to be present.")

# --- Elasticsearch Connection ---
es = None
try:
    if ELASTIC_CLOUD_ID and ELASTIC_API_KEY:
        logger.info(f"Connecting to Elasticsearch Cloud ID: {ELASTIC_CLOUD_ID}, Index: {ELASTIC_INDEX}")
        es = Elasticsearch(
            cloud_id=ELASTIC_CLOUD_ID,
            api_key=ELASTIC_API_KEY,
            request_timeout=30,
            retry_on_timeout=True, # Added retry
            max_retries=3          # Added retry
        )
        # Verify connection
        if not es.ping():
            logger.error("Failed to ping Elasticsearch.")
            # Don't raise RuntimeError here, let endpoints handle es=None
        else:
            logger.info("Successfully connected to Elasticsearch.")
    else:
        logger.warning("Elasticsearch environment variables not fully set. Elasticsearch client not initialized.")
except ESConnectionError as conn_err:
    logger.exception(f"Elasticsearch connection error: {conn_err}") # Log full traceback
    es = None # Ensure es is None on connection error
except Exception as e:
    logger.exception(f"Unexpected error initializing Elasticsearch client: {e}") # Log full traceback
    es = None # Ensure es is None on other init errors

app = FastAPI()

# --- Serializer Setup (Ensure SECRET_KEY is loaded) ---
serializer = None
if SECRET_KEY:
    serializer = URLSafeSerializer(SECRET_KEY)
else:
    logger.critical("SECRET_KEY environment variable is not set. Cannot create serializer for session signing.")
    # Depending on requirements, you might raise an error or disable features needing signing

# --- Pydantic Models ---
class SearchQuery(BaseModel):
    query: str

class Source(BaseModel):
    id: str
    fileName: str
    path: str

# --- Embedding Model Loading ---
embedding_model: TextEmbedding | None = None
try:
    # Specify cache_dir to control where models are downloaded (important for serverless)
    # Vercel provides /tmp which is writable
    model_cache_dir = "/tmp/fastembed_cache"
    logger.info(f"Attempting to load FastEmbed model 'sentence-transformers/all-MiniLM-L6-v2' into cache: {model_cache_dir}")
    embedding_model = TextEmbedding(
        model_name="sentence-transformers/all-MiniLM-L6-v2",
        cache_dir=model_cache_dir
    )
    # Perform a dummy embed to ensure model downloads if not cached
    list(embedding_model.embed(["test"]))
    logger.info("FastEmbed model loaded successfully.")
except Exception as e:
    logger.exception(f"Failed to load FastEmbed model: {e}") # Log full traceback
    embedding_model = None # Ensure model is None if loading fails

# --- Google OAuth Helper ---
def credentials_to_dict(credentials):
    return {'token': credentials.token,
            'refresh_token': credentials.refresh_token,
            'token_uri': credentials.token_uri,
            'client_id': credentials.client_id,
            'client_secret': credentials.client_secret,
            'scopes': credentials.scopes}

# Helper to get credentials from cookie more safely
def get_credentials_from_cookie(credentials_cookie: str | None) -> Credentials | None:
    if not credentials_cookie or not serializer: # Check if serializer exists
        return None
    try:
        creds_dict = serializer.loads(credentials_cookie) # Unsign the cookie value
        return Credentials(**creds_dict)
    except BadSignature:
        logger.warning("Invalid signature for credentials cookie.")
        return None
    except Exception as e:
        logger.error(f"Failed to load credentials from cookie: {e}", exc_info=False) # Log less verbosely
        return None

# --- API Endpoints ---

# --- Google Auth Endpoints (Error Handling Improved) ---
@app.get("/api/auth/google")
async def auth_google():
    """Initiates the Google OAuth2 flow."""
    if not serializer:
         logger.error("Cannot initiate Google Auth: Serializer not available (SECRET_KEY missing?).")
         raise HTTPException(status_code=500, detail="Server configuration error.")
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
         logger.error("Cannot initiate Google Auth: Google client credentials missing.")
         raise HTTPException(status_code=500, detail="Google API credentials not configured.")
    try:
        flow = get_google_flow()
        authorization_url, state = flow.authorization_url(
            access_type='offline', include_granted_scopes='true'
        )
        response = RedirectResponse(url=authorization_url)
        response.set_cookie(key="state", value=serializer.dumps(state), httonly=True, samesite='lax', secure=True, path="/") # Add secure=True, path=/
        logger.info("Redirecting user to Google for authentication.")
        return response
    except Exception as e:
        logger.exception(f"Error during Google auth initiation: {e}") # Log full traceback
        raise HTTPException(status_code=500, detail="Could not initiate Google authentication.")

@app.get("/api/auth/google/callback")
async def auth_google_callback(request: Request, state: str | None = Cookie(None)): # Make state optional
    """Handles the callback from Google after user authentication."""
    logger.info("Received callback from Google.")
    if not serializer:
         logger.error("Cannot process Google Callback: Serializer not available (SECRET_KEY missing?).")
         raise HTTPException(status_code=500, detail="Server configuration error.")
    if not state:
        logger.error("State cookie missing in Google auth callback.")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="State cookie missing.")

    try:
        signed_state_from_cookie = serializer.loads(state)
        state_from_request = request.query_params.get('state')

        if not state_from_request or signed_state_from_cookie != state_from_request:
            logger.error(f"State mismatch: Cookie='{signed_state_from_cookie}' Request='{state_from_request}'")
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="State mismatch.")

        flow = get_google_flow()
        # Use full URL string
        logger.info(f"Fetching token with URL: {str(request.url)}")
        flow.fetch_token(authorization_response=str(request.url))
        credentials = flow.credentials
        logger.info("Successfully fetched Google API token.")

        # Store credentials securely
        response = RedirectResponse(url="/?source=google-drive") # Redirect back to frontend root
        response.set_cookie(
            key="credentials",
            value=serializer.dumps(credentials_to_dict(credentials)),
            httponly=True, samesite='lax', secure=True, path="/", # Add secure=True, path=/
            max_age=3600 * 24 * 7 # 7 days
        )
        response.delete_cookie("state", path="/") # Ensure path matches set_cookie
        logger.info("Credentials cookie set, redirecting to frontend.")
        return response
    except Exception as e:
        logger.exception(f"Error during Google auth callback: {e}") # Log full traceback
        raise HTTPException(status_code=500, detail=f"Could not process Google callback.")


# --- Google Drive/Sheets Endpoints (Error Handling Improved) ---
@app.get("/api/drive/files")
async def list_drive_files(credentials: str | None = Cookie(None)):
    """Lists files (Docs and Sheets) from the user's Google Drive."""
    creds = get_credentials_from_cookie(credentials)
    if not creds:
        logger.warning("Unauthorized attempt to list Drive files (no valid credentials cookie).")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.")

    try:
        drive_service = get_drive_service(creds)
        logger.info("Listing Drive files...")
        results = drive_service.files().list(
            q="trashed=false and (mimeType='application/vnd.google-apps.document' or mimeType='application/vnd.google-apps.spreadsheet')",
            pageSize=100,
            fields="files(id, name, mimeType, modifiedTime, webViewLink)"
        ).execute()
        items = results.get('files', [])
        logger.info(f"Retrieved {len(items)} files from Google Drive.")
        return items
    except GoogleHttpError as google_err:
        logger.error(f"Google API error listing Drive files: {google_err}", exc_info=False)
        detail = f"Google API error: {google_err.resp.status} - {google_err.reason}"
        status_code = google_err.resp.status
        if status_code == 401: detail = "Google authentication token may have expired. Please reconnect Google Drive."
        raise HTTPException(status_code=status_code, detail=detail)
    except Exception as e:
        logger.exception(f"Unexpected error listing Google Drive files: {e}") # Log full traceback
        raise HTTPException(status_code=500, detail="Could not list Google Drive files.")

@app.get("/api/drive/files/{file_id}")
async def get_drive_file(file_id: str, credentials: str | None = Cookie(None)):
    """Gets the content of a specific Google Drive file (Doc or Sheet)."""
    creds = get_credentials_from_cookie(credentials)
    if not creds:
        logger.warning(f"Unauthorized attempt to get Drive file {file_id} (no valid credentials cookie).")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.")

    try:
        drive_service = get_drive_service(creds)
        file_metadata = drive_service.files().get(fileId=file_id, fields="mimeType, name").execute()
        mime_type = file_metadata.get('mimeType')
        file_name = file_metadata.get('name', file_id)
        logger.info(f"Fetching content for Google Drive file: '{file_name}' (ID: {file_id}), MIME Type: {mime_type}")

        request = None
        export_mime_type = None

        if mime_type == 'application/vnd.google-apps.document':
            export_mime_type = 'text/plain'
            request = drive_service.files().export_media(fileId=file_id, mimeType=export_mime_type)
        elif mime_type == 'application/vnd.google-apps.spreadsheet':
            export_mime_type = 'text/csv'
            request = drive_service.files().export_media(fileId=file_id, mimeType=export_mime_type)
        # Allow direct download for common text-based types if stored directly in Drive
        elif mime_type and ('text/' in mime_type or 'application/json' in mime_type or 'application/markdown' in mime_type):
            export_mime_type = mime_type # Use original type for logging/return
            request = drive_service.files().get_media(fileId=file_id)
        else:
            logger.warning(f"Unsupported MIME type '{mime_type}' for file ID {file_id}. Cannot fetch content directly.")
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unsupported file type: {mime_type}")

        if request:
            file_content_bytes = request.execute()
            # Decode bytes to string assuming UTF-8, handle potential errors
            try:
                file_content_str = file_content_bytes.decode('utf-8')
                logger.info(f"Successfully fetched and decoded content for Google Drive file: '{file_name}'")
                return {"content": file_content_str} # Return plain text
            except UnicodeDecodeError:
                logger.error(f"Failed to decode content as UTF-8 for file: '{file_name}' (ID: {file_id}). Might be binary or wrong encoding.")
                raise HTTPException(status_code=500, detail=f"Could not decode file content for '{file_name}'.")
        else:
             raise HTTPException(status_code=500, detail="Failed to create download request for the file.")
    except GoogleHttpError as google_err:
        logger.error(f"Google API error getting Drive file {file_id}: {google_err}", exc_info=False)
        detail = f"Google API error: {google_err.resp.status} - {google_err.reason}"
        status_code = google_err.resp.status
        if status_code == 401: detail = "Google authentication token may have expired. Please reconnect Google Drive."
        elif status_code == 404: detail = f"Google Drive file not found (ID: {file_id})."
        raise HTTPException(status_code=status_code, detail=detail)
    except Exception as e:
        logger.exception(f"Unexpected error getting Google Drive file content for ID {file_id}: {e}") # Log full traceback
        raise HTTPException(status_code=500, detail="Could not get Google Drive file content.")

@app.post("/api/sheets/export")
async def export_to_sheets(request: Request, credentials: str | None = Cookie(None)):
    """Exports provided table data to a new Google Sheet."""
    creds = get_credentials_from_cookie(credentials)
    if not creds:
        logger.warning("Unauthorized attempt to export to Sheets (no valid credentials cookie).")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.")

    try:
        sheets_service = get_sheets_service(creds)
        data = await request.json()
        table_data = data.get('tableData')

        if not table_data or not isinstance(table_data, list):
             logger.error(f"Invalid tableData received for Sheets export: {table_data}")
             raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or missing 'tableData' in request body.")

        logger.info(f"Attempting to export table data ({len(table_data)} rows) to Google Sheets.")

        spreadsheet_body = {'properties': {'title': 'Exported Data from MnemoMind'}}
        spreadsheet = sheets_service.spreadsheets().create(
            body=spreadsheet_body, fields='spreadsheetId,spreadsheetUrl'
        ).execute()
        spreadsheet_id = spreadsheet.get('spreadsheetId')
        spreadsheet_url = spreadsheet.get('spreadsheetUrl')
        logger.info(f"Created new Google Sheet with ID: {spreadsheet_id}")

        update_body = {'values': table_data}
        update_range = 'Sheet1!A1'
        result = sheets_service.spreadsheets().values().update(
            spreadsheetId=spreadsheet_id, range=update_range,
            valueInputOption='USER_ENTERED', # Try USER_ENTERED to allow Sheets interpretation
            body=update_body
        ).execute()

        logger.info(f"Successfully updated sheet. Result: {result}")
        return JSONResponse(content={"sheetUrl": spreadsheet_url}) # Use JSONResponse

    except GoogleHttpError as google_err:
        logger.error(f"Google API error exporting to Sheets: {google_err}", exc_info=False)
        detail = f"Google API error: {google_err.resp.status} - {google_err.reason}"
        status_code = google_err.resp.status
        if status_code == 401: detail = "Google authentication token may have expired. Please reconnect Google Drive."
        raise HTTPException(status_code=status_code, detail=detail)
    except Exception as e:
        logger.exception(f"Unexpected error exporting data to Google Sheets: {e}") # Log full traceback
        raise HTTPException(status_code=500, detail="Could not export to Google Sheets.")

# --- Elasticsearch Endpoints (Error Handling Improved) ---
@app.post("/api/search")
async def search_documents(query_body: SearchQuery = Body(...)):
    """Searches documents in Elasticsearch using KNN vector search and highlighting."""
    if not es:
        logger.error("Search failed: Elasticsearch client is not available.")
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Search service temporarily unavailable.")
    if not embedding_model:
        logger.error("Search failed: Embedding model not loaded.")
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Search service temporarily unavailable (model loading failed).")

    query_text = query_body.query
    logger.info(f"Received search query: '{query_text}'")

    try:
        # Generate embedding
        logger.info("Generating embedding for query...")
        query_vector = list(embedding_model.embed([query_text]))[0].tolist()
        logger.info("Embedding generated successfully.")

        # Define search body (ensure field names match your index mapping)
        search_body = {
            "knn": {
                "field": "chunk_vector", # FIELD NAME FOR VECTOR
                "query_vector": query_vector,
                "k": 10,
                "num_candidates": 100
            },
            "_source": ["file_name", "path", "chunk_text"], # Fields to retrieve
            "highlight": {
                "fields": {
                    "chunk_text": { # FIELD NAME FOR TEXT CONTENT
                         "fragment_size": 150,
                         "number_of_fragments": 1,
                         "type": "plain" # Use plain highlighter for KNN usually
                    }
                 },
                 "pre_tags": [""], # No tags for plain highlight if needed
                 "post_tags": [""]
            }
        }
        logger.debug(f"Elasticsearch search body: {json.dumps(search_body, indent=2)}")

        # Perform search
        response = es.search(
            index=ELASTIC_INDEX,
            body=search_body,
            request_timeout=30
        )
        hits_data = response.get("hits", {}).get("hits", [])
        logger.info(f"Elasticsearch returned {len(hits_data)} hits for query '{query_text}'.")

        # Process results
        results = []
        for hit in hits_data:
            source = hit.get("_source", {})
            hit_id = hit.get("_id")
            score = hit.get("_score") # KNN score might be in _score
            file_name = source.get("file_name")
            path = source.get("path", "") # Default to empty string if missing

            # Get highlighted snippet or fall back to original chunk text
            highlighted_snippet = ""
            if hit.get("highlight") and hit["highlight"].get("chunk_text"):
                highlighted_snippet = hit["highlight"]["chunk_text"][0]
            elif source.get("chunk_text"):
                 full_chunk = source["chunk_text"]
                 highlighted_snippet = (full_chunk[:147] + '...') if len(full_chunk) > 150 else full_chunk
            else:
                 highlighted_snippet = "[Content not available]" # Placeholder if chunk_text is missing

            if hit_id and file_name:
                 results.append({
                    "source": {"id": hit_id, "fileName": file_name, "path": path},
                    "contentSnippet": highlighted_snippet,
                    "score": score if score is not None else 0.0 # Handle missing score
                 })
            else:
                 logger.warning(f"Skipping hit due to missing _id or file_name: {hit}")

        logger.info(f"Processed {len(results)} valid results for query '{query_text}'.")
        return results

    except ESRequestError as es_req_err:
        logger.error(f"Elasticsearch request error for query '{query_text}': {es_req_err.info}", exc_info=False)
        # Check for common KNN errors
        error_info = es_req_err.info or {}
        error_reason = error_info.get("error", {}).get("root_cause", [{}])[0].get("reason", "Unknown ES Request Error")
        if "knn query field [chunk_vector] is not a knn_vector type" in error_reason:
             detail = "Search configuration error: 'chunk_vector' field mapping is incorrect in Elasticsearch."
             status_code=500
        elif "knn vector dims" in error_reason:
             detail = "Search configuration error: Vector dimensions mismatch between query and index."
             status_code=500
        else:
             detail = f"Elasticsearch search failed: {error_reason}"
             status_code=500
        raise HTTPException(status_code=status_code, detail=detail)
    except Exception as e:
        logger.exception(f"Unexpected error during Elasticsearch search for query '{query_text}': {e}") # Log full traceback
        raise HTTPException(status_code=500, detail="Search failed due to an internal server error.")


@app.get("/api/files/{file_id}")
async def get_file_content(file_id: str):
    """Gets the full content of a file from Elasticsearch based on its ID."""
    if not es:
        logger.error("Get file content failed: Elasticsearch client is not available.")
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Data service temporarily unavailable.")

    logger.info(f"Fetching content for file ID: {file_id}")
    try:
        response = es.get(
            index=ELASTIC_INDEX,
            id=file_id,
            _source_includes=["content", "file_name", "content_type"] # Added content_type
        )

        source = response.get("_source", {})
        content = source.get("content")
        file_name = source.get("file_name", "")
        content_type = source.get("content_type", "") # Get content_type if stored

        if content is None:
             logger.warning(f"Content field not found for document ID: {file_id}")
             raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File content not found.")

        # Determine if content is base64 based on stored type or filename fallback
        is_base64_content = False
        if content_type == "pdf_base64":
            is_base64_content = True
            # Optional: Add validation if needed, but trust the stored type primarily
            # try: base64.b64decode(content, validate=True); is_base64_content = True
            # except: is_base64_content = False; logger.warning(f"Content type mismatch for {file_id}")
        elif not content_type and file_name.lower().endswith(".pdf"):
             # Fallback check if content_type wasn't indexed
             try: base64.b64decode(content, validate=True); is_base64_content = True
             except: is_base64_content = False
             if is_base64_content:
                 logger.warning(f"Detected base64 PDF content for {file_id} based on filename (content_type missing).")
             else:
                  logger.warning(f"PDF file {file_id} content is not base64 (content_type missing).")


        if is_base64_content:
             logger.info(f"Returning base64 content for: {file_name}")
             return JSONResponse(content={"content": content, "isBase64": True})
        else:
             logger.info(f"Returning plain text content for: {file_name}")
             return JSONResponse(content={"content": content, "isBase64": False})

    except ESNotFoundError:
        logger.warning(f"File not found in Elasticsearch (404): ID {file_id}")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"File not found (ID: {file_id})")
    except Exception as e:
        logger.exception(f"Error fetching file content for ID {file_id}: {e}") # Log full traceback
        raise HTTPException(status_code=500, detail="Error retrieving file content.")


@app.get("/api/files")
async def get_all_files():
    """Retrieves a list of all indexed files (ID, name, path)."""
    if not es:
        logger.error("Get all files failed: Elasticsearch client is not available.")
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Data service temporarily unavailable.")

    logger.info("Fetching list of all indexed files.")
    try:
        # Use scroll API for potentially large number of files
        all_results = []
        scroll_timeout = "1m" # Keep scroll context open for 1 minute
        page = es.search(
            index=ELASTIC_INDEX,
            scroll=scroll_timeout,
            size=500, # Process 500 docs per scroll page
            query={"match_all": {}},
            _source=["file_name", "path"] # Fields to retrieve
        )
        sid = page['_scroll_id']
        scroll_size = len(page['hits']['hits'])
        all_results.extend(page['hits']['hits'])

        while scroll_size > 0:
            logger.debug(f"Scrolling... got {scroll_size} more docs")
            page = es.scroll(scroll_id=sid, scroll=scroll_timeout)
            sid = page['_scroll_id'] # Update scroll ID
            scroll_size = len(page['hits']['hits'])
            all_results.extend(page['hits']['hits'])

        # Clear the scroll context
        es.clear_scroll(scroll_id=sid)

        # Process the results
        processed_files = []
        seen_files = set() # Keep track of unique file paths to avoid duplicates from chunks
        for hit in all_results:
            source = hit.get("_source")
            hit_id = hit.get("_id") # Use hit ID for the source ID in frontend
            if source and hit_id:
                file_name = source.get("file_name")
                path = source.get("path", "")
                if file_name:
                    # Create a unique key based on path and name
                    file_key = f"{path}/{file_name}"
                    if file_key not in seen_files:
                         processed_files.append({
                             "id": hit_id, # Use the document/chunk ID
                             "fileName": file_name,
                             "path": path
                         })
                         seen_files.add(file_key)
                else:
                    logger.warning(f"Skipping hit {hit_id} due to missing file_name.")
            else:
                logger.warning(f"Skipping hit due to missing _source or _id: {hit}")

        logger.info(f"Returning {len(processed_files)} unique files.")
        return processed_files

    except Exception as e:
        logger.exception(f"Error fetching all files: {e}") # Log full traceback
        raise HTTPException(status_code=500, detail="Error retrieving file list.")


@app.get("/")
async def read_root():
    # Simple health check endpoint
    es_status = "connected" if es and es.ping() else "disconnected"
    model_status = "loaded" if embedding_model else "not loaded"
    return {
        "message": "MnemoMind API is running",
        "elasticsearch_status": es_status,
        "embedding_model_status": model_status
    }
