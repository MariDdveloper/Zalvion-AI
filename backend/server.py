import os
import uuid
import base64
import random
import hashlib
import asyncio
import logging
from pathlib import Path
from datetime import datetime, timezone, timedelta, date
from typing import List, Optional

import httpx
import resend
from dotenv import load_dotenv
from fastapi import FastAPI, APIRouter, Request, Response, HTTPException, Depends
from starlette.middleware.cors import CORSMiddleware
from supabase import create_client, Client
from pydantic import BaseModel, EmailStr, Field

# Verifica ID token di Google (login Google reale, senza passare da server terzi)
from google.oauth2 import id_token as google_id_token
from google.auth.transport import requests as google_auth_requests

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# =====================================================================================
# CONFIGURAZIONE SUPABASE
# =====================================================================================
# Usiamo la SERVICE_ROLE key perché il backend gira lato server: bypassa le Row Level
# Security (RLS) delle tabelle, quindi è il client "amministrativo". NON va MAI esposta
# al frontend/browser: resta solo nel file .env del backend.
SUPABASE_URL = os.environ['SUPABASE_URL']
SUPABASE_SERVICE_KEY = os.environ['SUPABASE_SERVICE_KEY']
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# =====================================================================================
# ALTRE CONFIGURAZIONI
# =====================================================================================
RESEND_API_KEY = os.environ.get('RESEND_API_KEY')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'noreply@getzalvion.com')
resend.api_key = RESEND_API_KEY

# Login Google reale: Client ID del progetto Google Cloud (OAuth consent screen)
GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID')

# ---- Mistral AI (unico provider di testo attivo) ----
MISTRAL_API_KEY = os.environ.get('MISTRAL_API_KEY')
MISTRAL_MODEL = os.environ.get('MISTRAL_MODEL', 'mistral-large-latest')
# Altri model id validi: "mistral-small-latest" (più economico/veloce),
# "open-mistral-nemo", "codestral-latest" (specializzato su codice).

# ---- Pollinations AI (SOLO generazione immagini — l'endpoint testuale non si usa più) ----
POLLINATIONS_IMAGE_URL = "https://image.pollinations.ai/prompt/"
POLLINATIONS_REFERRER = os.environ.get('POLLINATIONS_REFERRER', 'https://claus-ai.preview.emergentagent.com')
POLLINATIONS_TOKEN = os.environ.get('POLLINATIONS_TOKEN')  # opzionale, se hai un token Pollinations

# ---- AWS Bedrock / DeepSeek: PREDISPOSTO MA NON ATTIVO ----
# Il flag use_aws_fallback esiste già nell'endpoint di generazione, ma la funzione
# call_deepseek_bedrock() sotto è solo un placeholder finché non mi dai le credenziali
# AWS IAM e confermi il model id da usare (es. "deepseek.v3.2" su Bedrock).
AWS_BEDROCK_ENABLED = False

PAYPAL_MODE = os.environ.get('PAYPAL_MODE', 'sandbox')
PAYPAL_CLIENT_ID = os.environ.get('PAYPAL_CLIENT_ID', '')
PAYPAL_SECRET = os.environ.get('PAYPAL_SECRET', '')
PAYPAL_BASE = "https://api-m.sandbox.paypal.com" if PAYPAL_MODE == 'sandbox' else "https://api-m.paypal.com"

FREE_DAILY_LIMIT = 10
PRO_DAILY_LIMIT = 10

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = FastAPI()
api_router = APIRouter(prefix="/api")

LANG_NAMES = {
    "en": "English", "it": "Italian", "es": "Spanish", "fr": "French", "de": "German",
    "pt": "Portuguese", "nl": "Dutch", "ru": "Russian", "zh": "Chinese", "ja": "Japanese",
    "ko": "Korean", "ar": "Arabic", "hi": "Hindi", "tr": "Turkish", "pl": "Polish",
}

SYSTEM_PROMPT = (
    "You are Zalvion AI, an elite, world-class software engineer and AI assistant — the perfect AI, "
    "especially for writing code. You reason deeply, explain clearly, write flawless production-grade code, "
    "debug and fix scraping/automation issues, and can analyze documents and images the user shares. "
    "Use Markdown formatting (headings, lists, tables, fenced code blocks with language ids). "
    "Always answer in the user's language: {lang}.\n\n"
    "ARTIFACTS — VERY IMPORTANT:\n"
    "When the user asks you to build, create, code or write a runnable PROJECT (a web app, component, "
    "website, landing page, game, UI, dashboard, or a script/program in any language), you MUST output a "
    "COMPLETE, WORKING, self-contained project wrapped EXACTLY in this format (and nothing pseudo):\n\n"
    "<claus-artifact type=\"react\" title=\"Short Title\">\n"
    "<file path=\"/App.js\">\n...full file content...\n</file>\n"
    "<file path=\"/styles.css\">\n...full file content...\n</file>\n"
    "</claus-artifact>\n\n"
    "Rules:\n"
    "- `type` must be one of: react, static, vanilla, node, python, other.\n"
    "- react: provide at least /App.js with a default-exported React function component. You may add more "
    "files like /styles.css or /components/Foo.js. Import CSS with `import './styles.css'`. DO NOT include "
    "index.js, package.json or index.html — they are provided automatically. Use ONLY React and its hooks — "
    "do NOT import any external npm package (no lodash, axios, framer-motion, etc.); implement everything "
    "yourself. Never reference local image files that don't exist — use inline SVG, CSS or public https URLs.\n"
    "- static: provide /index.html (link /styles.css and /script.js from it if used).\n"
    "- vanilla: provide /index.js (plain JS entry) and optional /index.html, /styles.css.\n"
    "- node / python / other: provide the real files (e.g. /main.py, /server.js). These have no live preview "
    "but the user will read the code.\n"
    "- Write FULLY working code. NEVER use placeholders, TODOs, ellipses (`...`) or 'rest of code here'. "
    "Handle edge cases and errors inside the code.\n"
    "- Put ONE short sentence BEFORE the artifact saying what you built, and you may add a short note AFTER it. "
    "Do NOT repeat the code outside the artifact.\n"
    "- For normal questions that are NOT about building a project, reply with plain Markdown as usual "
    "(short inline ```code``` snippets are fine and must NOT be wrapped in an artifact)."
)


# =====================================================================================
# MODELLI Pydantic
# =====================================================================================
class OTPRequest(BaseModel):
    email: EmailStr


class OTPVerify(BaseModel):
    email: EmailStr
    code: str


class GoogleTokenBody(BaseModel):
    credential: str  # JWT restituito dal pulsante "Sign in with Google" (Google Identity Services)


class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    plan: str = "free"
    subscription_id: Optional[str] = None
    plan_type: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
class GoogleSessionPayload(BaseModel):
    session_id: str

@app.post("/api/auth/google/session")
async def verify_google_session_endpoint(payload: GoogleSessionPayload):
    try:
        if not payload.session_id:
            raise HTTPException(status_code=400, detail="Session ID richiesto")
            
        # Richiamo corretto per il client Supabase Python
        try:
            user_response = supabase.auth.admin.get_user_by_id(payload.session_id)
        except Exception as auth_err:
            logging.error(f"Errore diretto da Supabase Auth: {str(auth_err)}")
            raise HTTPException(status_code=401, detail="Sessione non riconosciuta da Supabase")
        
        if not user_response or not hasattr(user_response, 'user'):
            raise HTTPException(status_code=401, detail="Sessione non valida o scaduta")
            
        # Genera la struttura JSON pulita attesa dal client di React
        return {
            "session": {
                "access_token": payload.session_id,
                "token_type": "bearer",
                "user": {
                    "id": str(user_data.user.id) if hasattr(user_data.user, 'id') else user_data.user.get('id'),
                    "email": user_data.user.email if hasattr(user_data.user, 'email') else user_data.user.get('email')
                }
            },
            "authenticated": True
        }
    except HTTPException as http_err:
        raise http_err
    except Exception as e:
        logging.error(f"Crash interno del server: {str(e)}")
        raise HTTPException(status_code=500, detail="Errore di elaborazione interna")


class ChatMessageIn(BaseModel):
    role: str
    content: str


class ChatGenerateBody(BaseModel):
    messages: List[ChatMessageIn]
    language: str = "en"
    use_aws_fallback: bool = False  # switch manuale: True = passa a DeepSeek su AWS (non ancora attivo)


class ImageGenerateBody(BaseModel):
    prompt: str
    width: int = 768
    height: int = 768
    content: str = ""
    attachments: List[dict] = []


class AssistantMsgBody(BaseModel):
    content: str = ""
    type: str = "text"
    image_url: str = ""
    replace_last: bool = False


class UserMsgBody(BaseModel):
    content: str = ""
    attachments: List[dict] = []


class ChatUpdate(BaseModel):
    title: Optional[str] = None
    folder_id: Optional[str] = None
    clear_folder: bool = False


class FolderBody(BaseModel):
    name: str


class ActivateBody(BaseModel):
    subscription_id: str
    plan_type: str = "monthly"


# =====================================================================================
# HELPER GENERICI SUPABASE
# =====================================================================================
# Il client supabase-py e' sincrono: ogni chiamata viene eseguita in un thread separato
# con asyncio.to_thread per non bloccare il event loop di FastAPI.

async def sb_select_one(table: str, **filters) -> Optional[dict]:
    def _run():
        q = supabase.table(table).select("*")
        for k, v in filters.items():
            q = q.eq(k, v)
        res = q.limit(1).execute()
        return res.data[0] if res.data else None
    return await asyncio.to_thread(_run)


async def sb_select(table: str, columns: str = "*", order_by: Optional[str] = None,
                    desc: bool = True, limit: int = 500, **filters) -> list:
    def _run():
        q = supabase.table(table).select(columns)
        for k, v in filters.items():
            q = q.eq(k, v)
        if order_by:
            q = q.order(order_by, desc=desc)
        q = q.limit(limit)
        return q.execute().data
    return await asyncio.to_thread(_run)


async def sb_insert(table: str, doc: dict) -> dict:
    def _run():
        res = supabase.table(table).insert(doc).execute()
        return res.data[0] if res.data else doc
    return await asyncio.to_thread(_run)


async def sb_update(table: str, values: dict, **filters):
    def _run():
        q = supabase.table(table).update(values)
        for k, v in filters.items():
            q = q.eq(k, v)
        return q.execute()
    return await asyncio.to_thread(_run)


async def sb_delete(table: str, **filters):
    def _run():
        q = supabase.table(table).delete()
        for k, v in filters.items():
            q = q.eq(k, v)
        return q.execute()
    return await asyncio.to_thread(_run)


async def sb_upsert(table: str, doc: dict, on_conflict: Optional[str] = None):
    def _run():
        if on_conflict:
            return supabase.table(table).upsert(doc, on_conflict=on_conflict).execute()
        return supabase.table(table).upsert(doc).execute()
    return await asyncio.to_thread(_run)


# =====================================================================================
# HELPER GENERALI
# =====================================================================================
def now_utc():
    return datetime.now(timezone.utc)


def hash_code(code: str) -> str:
    return hashlib.sha256(code.encode()).hexdigest()


async def create_session(user_id: str) -> str:
    token = uuid.uuid4().hex + uuid.uuid4().hex
    await sb_insert("user_sessions", {
        "user_id": user_id, "session_token": token,
        "expires_at": (now_utc() + timedelta(days=7)).isoformat(),
        "created_at": now_utc().isoformat(),
    })
    return token


def set_session_cookie(response: Response, token: str):
    response.set_cookie(key="session_token", value=token, httponly=True, secure=True,
                        samesite="none", path="/", max_age=7 * 24 * 60 * 60)


async def get_current_user(request: Request) -> User:
    token = request.cookies.get("session_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    session = await sb_select_one("user_sessions", session_token=token)
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    expires_at = session["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < now_utc():
        raise HTTPException(status_code=401, detail="Session expired")
    user_doc = await sb_select_one("users", user_id=session["user_id"])
    if not user_doc:
        raise HTTPException(status_code=401, detail="User not found")
    return User(**user_doc)


async def upsert_user(email: str, name: str, picture: Optional[str] = None) -> User:
    existing = await sb_select_one("users", email=email)
    if existing:
        return User(**existing)
    user = User(user_id=f"user_{uuid.uuid4().hex[:12]}", email=email,
                name=name or email.split("@")[0], picture=picture, plan="free")
    doc = user.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await sb_insert("users", doc)
    return user


def daily_limit_for(plan: str) -> int:
    return PRO_DAILY_LIMIT if plan == "pro" else FREE_DAILY_LIMIT


async def get_usage_today(user_id: str) -> int:
    today = date.today().isoformat()
    doc = await sb_select_one("usage", user_id=user_id, date=today)
    return doc["count"] if doc else 0


async def enforce_and_increment(user: User):
    today = date.today().isoformat()
    existing = await sb_select_one("usage", user_id=user.user_id, date=today)
    used = existing["count"] if existing else 0
    if used >= daily_limit_for(user.plan):
        raise HTTPException(status_code=402, detail="daily_limit_reached")
    if existing:
        await sb_update("usage", {"count": used + 1}, user_id=user.user_id, date=today)
    else:
        await sb_insert("usage", {"user_id": user.user_id, "date": today, "count": 1})


async def append_chat_message(chat_id: str, user_id: str, message: dict,
                              new_title: Optional[str] = None, replace_last: bool = False) -> dict:
    """Aggiunge un messaggio all'array jsonb 'messages' di una chat (equivalente del $push Mongo)."""
    chat = await sb_select_one("chats", chat_id=chat_id, user_id=user_id)
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    messages = list(chat.get("messages") or [])
    if replace_last and messages and messages[-1].get("role") == "assistant":
        messages.pop()
    messages.append(message)
    update = {"messages": messages, "updated_at": now_utc().isoformat()}
    if new_title is not None:
        update["title"] = new_title
    await sb_update("chats", update, chat_id=chat_id)
    return chat


IMAGE_QUOTA_MSG = {
    "it": "🎨 **Oggi abbiamo raggiunto il limite di generazione immagini!**\n\nLe nostre GPU creative stanno prendendo fiato dopo aver disegnato tantissimo. Riprova tra poco ✨\n\nNel frattempo posso aiutarti con testo, codice, idee e analisi — chiedimi pure!",
    "en": "🎨 **We've hit today's image generation limit!**\n\nOur creative GPUs are catching their breath after a lot of drawing. Please try again shortly ✨\n\nIn the meantime I can help you with text, code, ideas and analysis — just ask!",
}


def image_quota_message(lang: str) -> str:
    return IMAGE_QUOTA_MSG.get(lang, IMAGE_QUOTA_MSG["en"])


# =====================================================================================
# PROVIDER AI: MISTRAL AI (attivo) + BEDROCK/DEEPSEEK (predisposto, non attivo)
# =====================================================================================
MISTRAL_API_URL = "https://api.mistral.ai/v1/chat/completions"


async def call_mistral(messages: List[dict], timeout: float = 60.0, max_retries: int = 3) -> str:
    """
    Chiama l'API ufficiale di Mistral AI (non Pollinations). E' l'UNICO provider attivo
    di default: nessun fallback automatico verso altri provider in caso di errore.
    Include un retry con backoff sui 429/502/503/504.
    """
    if not MISTRAL_API_KEY:
        raise RuntimeError("MISTRAL_API_KEY non configurata nel file .env")
    headers = {"Authorization": f"Bearer {MISTRAL_API_KEY}", "Content-Type": "application/json"}
    payload = {"model": MISTRAL_MODEL, "messages": messages}

    last_exc: Optional[Exception] = None
    for attempt in range(max_retries):
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                r = await client.post(MISTRAL_API_URL, json=payload, headers=headers)
            if r.status_code in (429, 502, 503, 504) and attempt < max_retries - 1:
                await asyncio.sleep(3 * (attempt + 1))
                continue
            r.raise_for_status()
            data = r.json()
            return data["choices"][0]["message"]["content"]
        except (httpx.HTTPStatusError, httpx.RequestError, KeyError, IndexError, TypeError) as e:
            last_exc = e
            if attempt < max_retries - 1:
                await asyncio.sleep(3 * (attempt + 1))
    raise RuntimeError(f"Mistral AI non raggiungibile dopo {max_retries} tentativi: {last_exc}")


async def call_pollinations_image(prompt: str, timeout: float = 90.0, max_retries: int = 3,
                                  width: int = 768, height: int = 768, model: str = "flux"):
    """
    Genera un'immagine con Pollinations (gratuito, senza chiave). Restituisce
    (bytes, content_type). Include retry con backoff sui 502/503/504, tipici di
    un servizio gratuito senza SLA.
    """
    import urllib.parse
    headers = {"Referer": POLLINATIONS_REFERRER}
    if POLLINATIONS_TOKEN:
        headers["Authorization"] = f"Bearer {POLLINATIONS_TOKEN}"
    url = POLLINATIONS_IMAGE_URL + urllib.parse.quote(prompt)
    params = {"width": width, "height": height, "model": model, "nologo": "true"}

    last_exc: Optional[Exception] = None
    for attempt in range(max_retries):
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                r = await client.get(url, params=params, headers=headers)
            if r.status_code in (502, 503, 504) and attempt < max_retries - 1:
                await asyncio.sleep(3 * (attempt + 1))
                continue
            r.raise_for_status()
            content_type = r.headers.get("Content-Type", "")
            if not content_type.startswith("image/"):
                raise RuntimeError(f"Risposta non e' un'immagine (Content-Type: {content_type})")
            return r.content, content_type
        except (httpx.HTTPStatusError, httpx.RequestError, RuntimeError) as e:
            last_exc = e
            if attempt < max_retries - 1:
                await asyncio.sleep(3 * (attempt + 1))
    raise RuntimeError(f"Pollinations (immagini) non raggiungibile dopo {max_retries} tentativi: {last_exc}")


async def call_deepseek_bedrock(messages: List[dict]) -> str:
    """
    PLACEHOLDER — non ancora attivo.
    Verra' implementato con boto3 (bedrock-runtime, API Converse) quando mi darai le
    credenziali IAM (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION) e confermerai
    il model id Bedrock da usare (es. "deepseek.v3.2" — "DeepSeek v4 Flash" non esiste
    ad oggi nel catalogo Bedrock).
    """
    raise HTTPException(
        status_code=501,
        detail="Il provider AWS Bedrock/DeepSeek non e' ancora attivo. "
               "Resta disponibile solo Mistral AI finche' non viene configurato."
    )


async def generate_ai_response(messages: List[dict], use_aws_fallback: bool = False) -> str:
    """
    Dispatcher centrale. Lo switch verso AWS e' SOLO manuale (parametro use_aws_fallback):
    nessun automatismo nel blocco except di Mistral.
    """
    if use_aws_fallback:
        if not AWS_BEDROCK_ENABLED:
            raise HTTPException(status_code=501, detail="AWS Bedrock non e' ancora attivo su questo backend.")
        return await call_deepseek_bedrock(messages)

    try:
        return await call_mistral(messages)
    except Exception as e:
        logger.error(f"Mistral AI error: {e}")
        raise HTTPException(status_code=502, detail="Errore nella generazione con Mistral AI")


# =====================================================================================
# AUTH: OTP via email
# =====================================================================================
@api_router.post("/auth/otp/request")
async def request_otp(body: OTPRequest):
    code = f"{random.randint(0, 999999):06d}"
    await sb_delete("otps", email=body.email)
    await sb_insert("otps", {
        "email": body.email, "code_hash": hash_code(code),
        "expires_at": (now_utc() + timedelta(minutes=10)).isoformat(),
        "created_at": now_utc().isoformat(),
    })
    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#FDFDF9;border:1px solid #EBE8E0;border-radius:16px">
      <h1 style="color:#D97251;font-size:24px;margin:0 0 8px">Zalvion AI</h1>
      <p style="color:#5C5954;font-size:15px">Your verification code is:</p>
      <div style="font-size:38px;font-weight:700;letter-spacing:10px;color:#2D2A26;background:#F3F2EC;padding:18px;text-align:center;border-radius:12px;margin:16px 0">{code}</div>
      <p style="color:#5C5954;font-size:13px">This code expires in 10 minutes.</p>
    </div>"""
    try:
        await asyncio.to_thread(resend.Emails.send, {
            "from": SENDER_EMAIL, "to": [body.email],
            "subject": f"{code} is your Zalvion AI verification code", "html": html,
        })
    except Exception as e:
        logger.error(f"Resend send failed: {e}")
        raise HTTPException(status_code=500, detail="Could not send the verification email.")
    return {"status": "sent"}


@api_router.post("/auth/otp/verify")
async def verify_otp(body: OTPVerify, response: Response):
    otp = await sb_select_one("otps", email=body.email)
    if not otp:
        raise HTTPException(status_code=400, detail="No code requested for this email")
    expires_at = datetime.fromisoformat(otp["expires_at"])
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < now_utc():
        raise HTTPException(status_code=400, detail="Code expired, request a new one")
    if otp["code_hash"] != hash_code(body.code.strip()):
        raise HTTPException(status_code=400, detail="Invalid code")
    await sb_delete("otps", email=body.email)
    user = await upsert_user(body.email, body.email.split("@")[0])
    token = await create_session(user.user_id)
    set_session_cookie(response, token)
    return {"user": user.model_dump(), "token": token}


# =====================================================================================
# AUTH: Google (verifica reale dell'ID token, nessun server terzo)
# =====================================================================================
@api_router.post("/auth/google/verify")
async def google_verify(body: GoogleTokenBody, response: Response):
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="GOOGLE_CLIENT_ID non configurato sul backend")
    try:
        idinfo = await asyncio.to_thread(
            google_id_token.verify_oauth2_token,
            body.credential, google_auth_requests.Request(), GOOGLE_CLIENT_ID,
        )
    except ValueError as e:
        logger.warning(f"Google token non valido: {e}")
        raise HTTPException(status_code=401, detail="Token Google non valido")
    if not idinfo.get("email_verified", False):
        raise HTTPException(status_code=401, detail="Email Google non verificata")
    user = await upsert_user(idinfo["email"], idinfo.get("name", ""), idinfo.get("picture"))
    token = await create_session(user.user_id)
    set_session_cookie(response, token)
    return {"user": user.model_dump(), "token": token}


@api_router.get("/auth/me")
async def auth_me(user: User = Depends(get_current_user)):
    used = await get_usage_today(user.user_id)
    data = user.model_dump()
    data["usage_used"] = used
    data["usage_limit"] = daily_limit_for(user.plan)
    return data


@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    token = request.cookies.get("session_token")
    if token:
        await sb_delete("user_sessions", session_token=token)
    response.delete_cookie("session_token", path="/")
    return {"status": "ok"}


# =====================================================================================
# GENERAZIONE AI (endpoint usato dal frontend per parlare col modello)
# =====================================================================================
@api_router.post("/ai/generate")
async def ai_generate(body: ChatGenerateBody, user: User = Depends(get_current_user)):
    lang_name = LANG_NAMES.get(body.language, "English")
    messages = [{"role": "system", "content": SYSTEM_PROMPT.format(lang=lang_name)}]
    messages += [{"role": m.role, "content": m.content} for m in body.messages]
    content = await generate_ai_response(messages, use_aws_fallback=body.use_aws_fallback)
    used = await get_usage_today(user.user_id)
    return {
        "content": content,
        "provider": "aws-bedrock-deepseek" if body.use_aws_fallback else "mistral",
        "usage_used": used,
        "usage_limit": daily_limit_for(user.plan),
    }


@api_router.get("/ai/test-mistral")
async def test_mistral():
    """
    Sessione di test approfondita su Mistral AI: verifica che il provider risponda
    correttamente su casi diversi (testo semplice, ragionamento, codice, multilingua,
    contesto multi-turno). Nessuna scrittura su Supabase, endpoint pensato per
    debug/monitoraggio manuale.

    NB: l'API di Mistral e' testuale (chat completions) e non include generazione
    immagini — per quella serve un provider separato (es. Stability, Flux via altro
    servizio, DALL-E, ecc.); fammi sapere se vuoi che lo aggiunga.
    """
    cases = [
        {
            "name": "risposta_semplice",
            "messages": [{"role": "user", "content": "Rispondi con una sola parola: 'ok'."}],
        },
        {
            "name": "ragionamento_matematico",
            "messages": [{"role": "user", "content": "Un treno viaggia a 80 km/h per 2 ore e mezza. "
                                                      "Quanti km percorre? Spiega il calcolo passo passo."}],
        },
        {
            "name": "generazione_codice",
            "messages": [{"role": "system", "content": SYSTEM_PROMPT.format(lang="Italian")},
                        {"role": "user", "content": "Scrivi una funzione Python che calcola il fattoriale, "
                                                    "gestendo input negativi con un'eccezione."}],
        },
        {
            "name": "supporto_multilingua_it",
            "messages": [{"role": "system", "content": SYSTEM_PROMPT.format(lang="Italian")},
                        {"role": "user", "content": "Ciao, chi sei?"}],
        },
        {
            "name": "contesto_multi_turno",
            "messages": [
                {"role": "user", "content": "Ricordami questo numero: 4471."},
                {"role": "assistant", "content": "Ok, ricordo 4471."},
                {"role": "user", "content": "Qual era il numero che ti ho dato? Rispondi solo col numero."},
            ],
        },
    ]

    results = []
    for case in cases:
        started = now_utc()
        try:
            content = await call_mistral(case["messages"], timeout=45.0)
            elapsed = (now_utc() - started).total_seconds()
            results.append({
                "test": case["name"], "status": "ok", "elapsed_seconds": round(elapsed, 2),
                "response_preview": content[:200],
            })
        except Exception as e:
            elapsed = (now_utc() - started).total_seconds()
            results.append({
                "test": case["name"], "status": "error", "elapsed_seconds": round(elapsed, 2),
                "error": str(e),
            })

    passed = sum(1 for r in results if r["status"] == "ok")
    return {
        "provider": "mistral",
        "model": MISTRAL_MODEL,
        "endpoint": MISTRAL_API_URL,
        "tests_total": len(results),
        "tests_passed": passed,
        "tests_failed": len(results) - passed,
        "all_passed": passed == len(results),
        "results": results,
        "note": "Mistral non genera immagini: per quello serve un provider separato.",
    }


@api_router.post("/ai/generate-image")
async def ai_generate_image(body: ImageGenerateBody, user: User = Depends(get_current_user)):
    """
    Genera un'immagine con Pollinations AI (gratuito). Restituisce l'immagine come
    data URL base64, cosi' il frontend puo' mostrarla subito senza un secondo giro
    di rete e senza dover ospitare il file da nessuna parte.
    """
    await enforce_and_increment(user)
    try:
        content, content_type = await call_pollinations_image(
            body.prompt, width=body.width, height=body.height)
    except Exception as e:
        logger.error(f"Pollinations image error: {e}")
        lang = "it"  # fallback semplice; il frontend puo' passare la lingua se serve differenziare
        raise HTTPException(status_code=502, detail=image_quota_message(lang))
    b64 = base64.b64encode(content).decode()
    used = await get_usage_today(user.user_id)
    return {
        "image_url": f"data:{content_type};base64,{b64}",
        "usage_used": used,
        "usage_limit": daily_limit_for(user.plan),
    }


@api_router.get("/ai/test-pollinations-image")
async def test_pollinations_image():
    """
    Test rapido della generazione immagini via Pollinations. Nessuna scrittura su
    Supabase, endpoint pensato per debug/monitoraggio manuale (nessuna auth
    richiesta per semplicita' di verifica).
    """
    started = now_utc()
    try:
        content, content_type = await call_pollinations_image(
            "a red apple on a wooden table, photorealistic")
        elapsed = (now_utc() - started).total_seconds()
        return {
            "provider": "pollinations", "endpoint": POLLINATIONS_IMAGE_URL,
            "status": "ok", "elapsed_seconds": round(elapsed, 2),
            "content_type": content_type, "size_bytes": len(content),
        }
    except Exception as e:
        elapsed = (now_utc() - started).total_seconds()
        return {
            "provider": "pollinations", "endpoint": POLLINATIONS_IMAGE_URL,
            "status": "error", "elapsed_seconds": round(elapsed, 2), "error": str(e),
        }


# =====================================================================================
# CHATS
# =====================================================================================
@api_router.get("/chats")
async def list_chats(user: User = Depends(get_current_user)):
    return await sb_select("chats", columns="chat_id,user_id,title,folder_id,created_at,updated_at",
                           order_by="updated_at", desc=True, user_id=user.user_id)


@api_router.post("/chats")
async def create_chat(user: User = Depends(get_current_user)):
    chat = {"chat_id": f"chat_{uuid.uuid4().hex[:12]}", "user_id": user.user_id,
            "title": "New chat", "folder_id": None, "messages": [],
            "created_at": now_utc().isoformat(), "updated_at": now_utc().isoformat()}
    await sb_insert("chats", chat)
    chat.pop("messages", None)
    return chat


@api_router.patch("/chats/{chat_id}")
async def update_chat(chat_id: str, body: ChatUpdate, user: User = Depends(get_current_user)):
    update = {"updated_at": now_utc().isoformat()}
    if body.title is not None:
        update["title"] = body.title.strip()[:80] or "New chat"
    if body.clear_folder:
        update["folder_id"] = None
    elif body.folder_id is not None:
        update["folder_id"] = body.folder_id
    existing = await sb_select_one("chats", chat_id=chat_id, user_id=user.user_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Chat not found")
    await sb_update("chats", update, chat_id=chat_id)
    return {"status": "ok"}


@api_router.delete("/chats/{chat_id}")
async def delete_chat(chat_id: str, user: User = Depends(get_current_user)):
    await sb_delete("chats", chat_id=chat_id, user_id=user.user_id)
    return {"status": "ok"}


@api_router.get("/chats/{chat_id}/messages")
async def get_messages(chat_id: str, user: User = Depends(get_current_user)):
    chat = await sb_select_one("chats", chat_id=chat_id, user_id=user.user_id)
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    return {"messages": chat.get("messages", []), "title": chat.get("title")}


@api_router.post("/chats/{chat_id}/messages/user")
async def add_user_message(chat_id: str, body: UserMsgBody, user: User = Depends(get_current_user)):
    chat = await sb_select_one("chats", chat_id=chat_id, user_id=user.user_id)
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    await enforce_and_increment(user)
    user_msg = {"id": uuid.uuid4().hex, "role": "user", "type": "text",
                "content": body.content, "attachments": body.attachments,
                "created_at": now_utc().isoformat()}
    new_title = chat["title"]
    if chat["title"] == "New chat" and body.content:
        new_title = body.content[:48]
    await append_chat_message(chat_id, user.user_id, user_msg, new_title=new_title)
    used = await get_usage_today(user.user_id)
    return {"ok": True, "title": new_title, "usage_used": used, "usage_limit": daily_limit_for(user.plan)}


@api_router.post("/chats/{chat_id}/messages/assistant")
async def add_assistant_message(chat_id: str, body: AssistantMsgBody, user: User = Depends(get_current_user)):
    chat = await sb_select_one("chats", chat_id=chat_id, user_id=user.user_id)
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    assistant_msg = {"id": uuid.uuid4().hex, "role": "assistant", "type": body.type,
                     "content": body.content, "image_url": body.image_url,
                     "created_at": now_utc().isoformat()}
    await append_chat_message(chat_id, user.user_id, assistant_msg, replace_last=body.replace_last)
    return {"ok": True}


# =====================================================================================
# FOLDERS
# =====================================================================================
@api_router.get("/folders")
async def list_folders(user: User = Depends(get_current_user)):
    return await sb_select("folders", order_by="created_at", desc=False, user_id=user.user_id)


@api_router.post("/folders")
async def create_folder(body: FolderBody, user: User = Depends(get_current_user)):
    folder = {"folder_id": f"folder_{uuid.uuid4().hex[:12]}", "user_id": user.user_id,
              "name": (body.name.strip() or "New folder")[:60], "created_at": now_utc().isoformat()}
    await sb_insert("folders", folder)
    return folder


@api_router.patch("/folders/{folder_id}")
async def rename_folder(folder_id: str, body: FolderBody, user: User = Depends(get_current_user)):
    existing = await sb_select_one("folders", folder_id=folder_id, user_id=user.user_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Folder not found")
    await sb_update("folders", {"name": (body.name.strip() or "New folder")[:60]}, folder_id=folder_id)
    return {"status": "ok"}


@api_router.delete("/folders/{folder_id}")
async def delete_folder(folder_id: str, user: User = Depends(get_current_user)):
    await sb_delete("folders", folder_id=folder_id, user_id=user.user_id)
    chats_in_folder = await sb_select("chats", columns="chat_id", user_id=user.user_id, folder_id=folder_id)
    for c in chats_in_folder:
        await sb_update("chats", {"folder_id": None}, chat_id=c["chat_id"])
    return {"status": "ok"}


# =====================================================================================
# BILLING (PayPal) — invariato nella logica, solo db -> Supabase
# =====================================================================================
def paypal_configured() -> bool:
    return bool(PAYPAL_CLIENT_ID and PAYPAL_SECRET)


async def paypal_token() -> str:
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.post(f"{PAYPAL_BASE}/v1/oauth2/token",
                              auth=(PAYPAL_CLIENT_ID, PAYPAL_SECRET),
                              data={"grant_type": "client_credentials"})
        r.raise_for_status()
        return r.json()["access_token"]


async def ensure_paypal_plans():
    cfg = await sb_select_one("app_config", key="paypal_plans")
    if cfg and cfg.get("mode") == PAYPAL_MODE and cfg.get("monthly_plan_id") and cfg.get("yearly_plan_id"):
        return cfg
    token = await paypal_token()
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    async with httpx.AsyncClient(timeout=20) as client:
        prod = await client.post(f"{PAYPAL_BASE}/v1/catalogs/products", headers=headers,
            json={"name": "Claus IA Pro", "description": "Claus IA Pro subscription",
                  "type": "SERVICE", "category": "SOFTWARE"})
        prod.raise_for_status()
        product_id = prod.json()["id"]

        def plan_payload(name, interval, value):
            return {"product_id": product_id, "name": name, "status": "ACTIVE",
                    "billing_cycles": [{"frequency": {"interval_unit": interval, "interval_count": 1},
                                        "tenure_type": "REGULAR", "sequence": 1, "total_cycles": 0,
                                        "pricing_scheme": {"fixed_price": {"value": value, "currency_code": "EUR"}}}],
                    "payment_preferences": {"auto_bill_outstanding": True,
                                            "setup_fee": {"value": "0", "currency_code": "EUR"},
                                            "setup_fee_failure_action": "CONTINUE",
                                            "payment_failure_threshold": 1}}

        m = await client.post(f"{PAYPAL_BASE}/v1/billing/plans", headers=headers,
                              json=plan_payload("Claus IA Pro Monthly", "MONTH", "10"))
        m.raise_for_status()
        y = await client.post(f"{PAYPAL_BASE}/v1/billing/plans", headers=headers,
                              json=plan_payload("Claus IA Pro Yearly", "YEAR", "100"))
        y.raise_for_status()

    cfg = {"key": "paypal_plans", "mode": PAYPAL_MODE, "product_id": product_id,
           "monthly_plan_id": m.json()["id"], "yearly_plan_id": y.json()["id"]}
    await sb_upsert("app_config", cfg, on_conflict="key")
    return cfg


@api_router.get("/billing/config")
async def billing_config():
    if not paypal_configured():
        return {"configured": False, "mode": PAYPAL_MODE,
                "prices": {"monthly": "10", "yearly": "100", "currency": "EUR"}}
    try:
        cfg = await ensure_paypal_plans()
    except Exception as e:
        logger.error(f"PayPal plan setup failed: {e}")
        return {"configured": False, "mode": PAYPAL_MODE, "error": "paypal_setup_failed",
                "prices": {"monthly": "10", "yearly": "100", "currency": "EUR"}}
    return {"configured": True, "mode": PAYPAL_MODE, "client_id": PAYPAL_CLIENT_ID,
            "monthly_plan_id": cfg["monthly_plan_id"], "yearly_plan_id": cfg["yearly_plan_id"],
            "prices": {"monthly": "10", "yearly": "100", "currency": "EUR"}}


@api_router.post("/billing/activate")
async def billing_activate(body: ActivateBody, user: User = Depends(get_current_user)):
    if not paypal_configured():
        raise HTTPException(status_code=400, detail="PayPal not configured")
    try:
        token = await paypal_token()
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.get(f"{PAYPAL_BASE}/v1/billing/subscriptions/{body.subscription_id}",
                                 headers={"Authorization": f"Bearer {token}"})
            r.raise_for_status()
            sub = r.json()
    except Exception as e:
        logger.error(f"PayPal verify failed: {e}")
        raise HTTPException(status_code=400, detail="Could not verify subscription")
    if sub.get("status") not in ("ACTIVE", "APPROVED"):
        raise HTTPException(status_code=400, detail=f"Subscription not active: {sub.get('status')}")
    await sb_update("users", {"plan": "pro", "subscription_id": body.subscription_id,
                              "plan_type": body.plan_type, "plan_since": now_utc().isoformat()},
                    user_id=user.user_id)
    return {"status": "ok", "plan": "pro"}


@api_router.post("/billing/cancel")
async def billing_cancel(user: User = Depends(get_current_user)):
    if user.subscription_id and paypal_configured():
        try:
            token = await paypal_token()
            async with httpx.AsyncClient(timeout=20) as client:
                await client.post(f"{PAYPAL_BASE}/v1/billing/subscriptions/{user.subscription_id}/cancel",
                                  headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                                  json={"reason": "User requested cancellation"})
        except Exception as e:
            logger.error(f"PayPal cancel failed: {e}")
    await sb_update("users", {"plan": "free", "subscription_id": None, "plan_type": None}, user_id=user.user_id)
    return {"status": "ok", "plan": "free"}


@api_router.post("/webhook/paypal")
async def paypal_webhook(request: Request):
    body = await request.json()
    event_type = body.get("event_type", "")
    resource = body.get("resource", {})
    sub_id = resource.get("id") or resource.get("billing_agreement_id")
    try:
        if event_type in ("BILLING.SUBSCRIPTION.CANCELLED", "BILLING.SUBSCRIPTION.EXPIRED",
                          "BILLING.SUBSCRIPTION.SUSPENDED") and sub_id:
            await sb_update("users", {"plan": "free", "subscription_id": None, "plan_type": None},
                            subscription_id=sub_id)
        elif event_type == "BILLING.SUBSCRIPTION.ACTIVATED" and sub_id:
            await sb_update("users", {"plan": "pro"}, subscription_id=sub_id)
    except Exception as e:
        logger.error(f"Webhook handling error: {e}")
    return {"status": "ok"}


@api_router.get("/")
async def root():
    return {"message": "Claus IA API"}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware, allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"], allow_headers=["*"],
)