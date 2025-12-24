from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form, Query, Response, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorGridFSBucket
from gridfs import GridFS
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
import hashlib
import secrets

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# GridFS for file storage
fs_bucket = AsyncIOMotorGridFSBucket(db)

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', secrets.token_hex(32))
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# Storage limit per user (500MB)
MAX_STORAGE_BYTES = 500 * 1024 * 1024

# Create the main app
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

security = HTTPBearer()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============== MODELS ==============

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str
    storage_used: int
    storage_limit: int
    created_at: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class FolderCreate(BaseModel):
    name: str
    parent_id: Optional[str] = None

class FolderResponse(BaseModel):
    id: str
    name: str
    parent_id: Optional[str]
    user_id: str
    created_at: str

class FileResponse(BaseModel):
    id: str
    name: str
    size: int
    type: str
    folder_id: Optional[str]
    user_id: str
    gridfs_id: str
    created_at: str
    updated_at: str

class ShareLinkCreate(BaseModel):
    file_id: str
    password: Optional[str] = None
    expires_in_hours: Optional[int] = None

class ShareLinkResponse(BaseModel):
    id: str
    file_id: str
    token: str
    has_password: bool
    expires_at: Optional[str]
    access_count: int
    created_at: str

class ShareLinkAccess(BaseModel):
    password: Optional[str] = None

class ActivityLogResponse(BaseModel):
    id: str
    user_id: str
    user_name: str
    action: str
    resource_type: str
    resource_name: str
    ip_address: str
    created_at: str

class AdminUserUpdate(BaseModel):
    role: Optional[str] = None
    storage_limit: Optional[int] = None

# ============== HELPERS ==============

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

def create_token(user_id: str, role: str) -> str:
    payload = {
        "user_id": user_id,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    payload = decode_token(credentials.credentials)
    user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

async def get_admin_user(user: dict = Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

async def log_activity(user_id: str, user_name: str, action: str, resource_type: str, resource_name: str, ip_address: str = "unknown"):
    log = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "user_name": user_name,
        "action": action,
        "resource_type": resource_type,
        "resource_name": resource_name,
        "ip_address": ip_address,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.activity_logs.insert_one(log)

def get_file_type(filename: str) -> str:
    ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
    type_map = {
        'pdf': 'document', 'doc': 'document', 'docx': 'document', 'txt': 'document',
        'xls': 'spreadsheet', 'xlsx': 'spreadsheet', 'csv': 'spreadsheet',
        'ppt': 'presentation', 'pptx': 'presentation',
        'jpg': 'image', 'jpeg': 'image', 'png': 'image', 'gif': 'image', 'webp': 'image', 'svg': 'image',
        'mp4': 'video', 'avi': 'video', 'mov': 'video', 'mkv': 'video',
        'mp3': 'audio', 'wav': 'audio', 'ogg': 'audio',
        'zip': 'archive', 'rar': 'archive', '7z': 'archive', 'tar': 'archive', 'gz': 'archive',
        'js': 'code', 'py': 'code', 'html': 'code', 'css': 'code', 'json': 'code',
    }
    return type_map.get(ext, 'file')

# ============== AUTH ROUTES ==============

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserCreate):
    # Check if user exists
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Check if this is the first user (make admin)
    user_count = await db.users.count_documents({})
    role = "admin" if user_count == 0 else "user"
    
    user_id = str(uuid.uuid4())
    user = {
        "id": user_id,
        "email": user_data.email,
        "password_hash": hash_password(user_data.password),
        "name": user_data.name,
        "role": role,
        "storage_used": 0,
        "storage_limit": MAX_STORAGE_BYTES,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user)
    
    token = create_token(user_id, role)
    
    await log_activity(user_id, user_data.name, "register", "account", user_data.email)
    
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user_id,
            email=user_data.email,
            name=user_data.name,
            role=role,
            storage_used=0,
            storage_limit=MAX_STORAGE_BYTES,
            created_at=user["created_at"]
        )
    )

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user or not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    token = create_token(user["id"], user["role"])
    
    await log_activity(user["id"], user["name"], "login", "account", user["email"])
    
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user["id"],
            email=user["email"],
            name=user["name"],
            role=user["role"],
            storage_used=user["storage_used"],
            storage_limit=user.get("storage_limit", MAX_STORAGE_BYTES),
            created_at=user["created_at"]
        )
    )

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(user: dict = Depends(get_current_user)):
    return UserResponse(
        id=user["id"],
        email=user["email"],
        name=user["name"],
        role=user["role"],
        storage_used=user["storage_used"],
        storage_limit=user.get("storage_limit", MAX_STORAGE_BYTES),
        created_at=user["created_at"]
    )

# ============== FOLDER ROUTES ==============

@api_router.post("/folders", response_model=FolderResponse)
async def create_folder(folder_data: FolderCreate, user: dict = Depends(get_current_user)):
    # Check if folder with same name exists in same location
    existing = await db.folders.find_one({
        "user_id": user["id"],
        "name": folder_data.name,
        "parent_id": folder_data.parent_id
    })
    if existing:
        raise HTTPException(status_code=400, detail="Folder with this name already exists")
    
    folder_id = str(uuid.uuid4())
    folder = {
        "id": folder_id,
        "name": folder_data.name,
        "parent_id": folder_data.parent_id,
        "user_id": user["id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.folders.insert_one(folder)
    await log_activity(user["id"], user["name"], "create", "folder", folder_data.name)
    
    return FolderResponse(**folder)

@api_router.get("/folders", response_model=List[FolderResponse])
async def get_folders(parent_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    query = {"user_id": user["id"], "parent_id": parent_id}
    folders = await db.folders.find(query, {"_id": 0}).to_list(1000)
    return [FolderResponse(**f) for f in folders]

@api_router.delete("/folders/{folder_id}")
async def delete_folder(folder_id: str, user: dict = Depends(get_current_user)):
    folder = await db.folders.find_one({"id": folder_id, "user_id": user["id"]}, {"_id": 0})
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    
    # Delete all files in folder
    files = await db.files.find({"folder_id": folder_id}, {"_id": 0}).to_list(1000)
    total_size = 0
    for file in files:
        try:
            await fs_bucket.delete(file["gridfs_id"])
        except Exception:
            pass
        total_size += file["size"]
    await db.files.delete_many({"folder_id": folder_id})
    
    # Update user storage
    await db.users.update_one(
        {"id": user["id"]},
        {"$inc": {"storage_used": -total_size}}
    )
    
    # Delete subfolders recursively
    async def delete_subfolders(parent):
        subfolders = await db.folders.find({"parent_id": parent}, {"_id": 0}).to_list(1000)
        for sf in subfolders:
            await delete_subfolders(sf["id"])
            await db.files.delete_many({"folder_id": sf["id"]})
        await db.folders.delete_many({"parent_id": parent})
    
    await delete_subfolders(folder_id)
    await db.folders.delete_one({"id": folder_id})
    
    await log_activity(user["id"], user["name"], "delete", "folder", folder["name"])
    
    return {"message": "Folder deleted"}

@api_router.put("/folders/{folder_id}")
async def rename_folder(folder_id: str, folder_data: FolderCreate, user: dict = Depends(get_current_user)):
    folder = await db.folders.find_one({"id": folder_id, "user_id": user["id"]}, {"_id": 0})
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    
    await db.folders.update_one(
        {"id": folder_id},
        {"$set": {"name": folder_data.name}}
    )
    
    await log_activity(user["id"], user["name"], "rename", "folder", folder_data.name)
    
    return {"message": "Folder renamed"}

# ============== FILE ROUTES ==============

@api_router.post("/files/upload", response_model=FileResponse)
async def upload_file(
    file: UploadFile = File(...),
    folder_id: Optional[str] = Form(None),
    user: dict = Depends(get_current_user)
):
    # Read file content
    content = await file.read()
    file_size = len(content)
    
    # Check storage limit
    if user["storage_used"] + file_size > user.get("storage_limit", MAX_STORAGE_BYTES):
        raise HTTPException(status_code=400, detail="Storage limit exceeded")
    
    # Upload to GridFS
    gridfs_id = await fs_bucket.upload_from_stream(
        file.filename,
        content,
        metadata={"user_id": user["id"], "content_type": file.content_type}
    )
    
    file_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    file_doc = {
        "id": file_id,
        "name": file.filename,
        "size": file_size,
        "type": get_file_type(file.filename),
        "content_type": file.content_type,
        "folder_id": folder_id,
        "user_id": user["id"],
        "gridfs_id": str(gridfs_id),
        "created_at": now,
        "updated_at": now
    }
    
    await db.files.insert_one(file_doc)
    
    # Update user storage
    await db.users.update_one(
        {"id": user["id"]},
        {"$inc": {"storage_used": file_size}}
    )
    
    await log_activity(user["id"], user["name"], "upload", "file", file.filename)
    
    return FileResponse(**file_doc)

@api_router.get("/files", response_model=List[FileResponse])
async def get_files(folder_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    query = {"user_id": user["id"], "folder_id": folder_id}
    files = await db.files.find(query, {"_id": 0}).to_list(1000)
    return [FileResponse(**f) for f in files]

@api_router.get("/files/search", response_model=List[FileResponse])
async def search_files(q: str = Query(..., min_length=1), user: dict = Depends(get_current_user)):
    query = {
        "user_id": user["id"],
        "name": {"$regex": q, "$options": "i"}
    }
    files = await db.files.find(query, {"_id": 0}).to_list(100)
    return [FileResponse(**f) for f in files]

@api_router.get("/files/{file_id}/download")
async def download_file(file_id: str, user: dict = Depends(get_current_user)):
    file = await db.files.find_one({"id": file_id, "user_id": user["id"]}, {"_id": 0})
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    
    from bson import ObjectId
    grid_out = await fs_bucket.open_download_stream(ObjectId(file["gridfs_id"]))
    content = await grid_out.read()
    
    await log_activity(user["id"], user["name"], "download", "file", file["name"])
    
    return Response(
        content=content,
        media_type=file.get("content_type", "application/octet-stream"),
        headers={"Content-Disposition": f'attachment; filename="{file["name"]}"'}
    )

@api_router.get("/files/{file_id}/preview")
async def preview_file(file_id: str, user: dict = Depends(get_current_user)):
    file = await db.files.find_one({"id": file_id, "user_id": user["id"]}, {"_id": 0})
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    
    from bson import ObjectId
    grid_out = await fs_bucket.open_download_stream(ObjectId(file["gridfs_id"]))
    content = await grid_out.read()
    
    return Response(
        content=content,
        media_type=file.get("content_type", "application/octet-stream")
    )

@api_router.delete("/files/{file_id}")
async def delete_file(file_id: str, user: dict = Depends(get_current_user)):
    file = await db.files.find_one({"id": file_id, "user_id": user["id"]}, {"_id": 0})
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    
    from bson import ObjectId
    try:
        await fs_bucket.delete(ObjectId(file["gridfs_id"]))
    except Exception:
        pass
    
    await db.files.delete_one({"id": file_id})
    
    # Update user storage
    await db.users.update_one(
        {"id": user["id"]},
        {"$inc": {"storage_used": -file["size"]}}
    )
    
    # Delete associated share links
    await db.share_links.delete_many({"file_id": file_id})
    
    await log_activity(user["id"], user["name"], "delete", "file", file["name"])
    
    return {"message": "File deleted"}

@api_router.put("/files/{file_id}/move")
async def move_file(file_id: str, folder_id: Optional[str] = Query(None), user: dict = Depends(get_current_user)):
    file = await db.files.find_one({"id": file_id, "user_id": user["id"]}, {"_id": 0})
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    
    if folder_id:
        folder = await db.folders.find_one({"id": folder_id, "user_id": user["id"]})
        if not folder:
            raise HTTPException(status_code=404, detail="Folder not found")
    
    await db.files.update_one(
        {"id": file_id},
        {"$set": {"folder_id": folder_id, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    await log_activity(user["id"], user["name"], "move", "file", file["name"])
    
    return {"message": "File moved"}

# ============== SHARE LINK ROUTES ==============

@api_router.post("/share", response_model=ShareLinkResponse)
async def create_share_link(link_data: ShareLinkCreate, user: dict = Depends(get_current_user)):
    file = await db.files.find_one({"id": link_data.file_id, "user_id": user["id"]}, {"_id": 0})
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    
    link_id = str(uuid.uuid4())
    token = secrets.token_urlsafe(32)
    now = datetime.now(timezone.utc)
    
    expires_at = None
    if link_data.expires_in_hours:
        expires_at = (now + timedelta(hours=link_data.expires_in_hours)).isoformat()
    
    password_hash = None
    if link_data.password:
        password_hash = hash_password(link_data.password)
    
    share_link = {
        "id": link_id,
        "file_id": link_data.file_id,
        "file_name": file["name"],
        "user_id": user["id"],
        "token": token,
        "password_hash": password_hash,
        "expires_at": expires_at,
        "access_count": 0,
        "created_at": now.isoformat()
    }
    
    await db.share_links.insert_one(share_link)
    
    await log_activity(user["id"], user["name"], "share", "file", file["name"])
    
    return ShareLinkResponse(
        id=link_id,
        file_id=link_data.file_id,
        token=token,
        has_password=password_hash is not None,
        expires_at=expires_at,
        access_count=0,
        created_at=share_link["created_at"]
    )

@api_router.get("/share", response_model=List[ShareLinkResponse])
async def get_share_links(user: dict = Depends(get_current_user)):
    links = await db.share_links.find({"user_id": user["id"]}, {"_id": 0}).to_list(1000)
    return [ShareLinkResponse(
        id=l["id"],
        file_id=l["file_id"],
        token=l["token"],
        has_password=l.get("password_hash") is not None,
        expires_at=l.get("expires_at"),
        access_count=l.get("access_count", 0),
        created_at=l["created_at"]
    ) for l in links]

@api_router.delete("/share/{link_id}")
async def delete_share_link(link_id: str, user: dict = Depends(get_current_user)):
    link = await db.share_links.find_one({"id": link_id, "user_id": user["id"]}, {"_id": 0})
    if not link:
        raise HTTPException(status_code=404, detail="Share link not found")
    
    await db.share_links.delete_one({"id": link_id})
    
    await log_activity(user["id"], user["name"], "unshare", "file", link.get("file_name", "Unknown"))
    
    return {"message": "Share link deleted"}

# Public share access (no auth required)
@api_router.get("/shared/{token}")
async def get_shared_file_info(token: str):
    link = await db.share_links.find_one({"token": token}, {"_id": 0})
    if not link:
        raise HTTPException(status_code=404, detail="Share link not found")
    
    # Check expiration
    if link.get("expires_at"):
        expires = datetime.fromisoformat(link["expires_at"])
        if datetime.now(timezone.utc) > expires:
            raise HTTPException(status_code=410, detail="Share link has expired")
    
    file = await db.files.find_one({"id": link["file_id"]}, {"_id": 0})
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    
    return {
        "file_name": file["name"],
        "file_size": file["size"],
        "file_type": file["type"],
        "requires_password": link.get("password_hash") is not None,
        "expires_at": link.get("expires_at")
    }

@api_router.post("/shared/{token}/download")
async def download_shared_file(token: str, access_data: ShareLinkAccess, request: Request):
    link = await db.share_links.find_one({"token": token}, {"_id": 0})
    if not link:
        raise HTTPException(status_code=404, detail="Share link not found")
    
    # Check expiration
    if link.get("expires_at"):
        expires = datetime.fromisoformat(link["expires_at"])
        if datetime.now(timezone.utc) > expires:
            raise HTTPException(status_code=410, detail="Share link has expired")
    
    # Check password
    if link.get("password_hash"):
        if not access_data.password or not verify_password(access_data.password, link["password_hash"]):
            raise HTTPException(status_code=401, detail="Invalid password")
    
    file = await db.files.find_one({"id": link["file_id"]}, {"_id": 0})
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    
    from bson import ObjectId
    grid_out = await fs_bucket.open_download_stream(ObjectId(file["gridfs_id"]))
    content = await grid_out.read()
    
    # Update access count
    await db.share_links.update_one(
        {"token": token},
        {"$inc": {"access_count": 1}}
    )
    
    # Log activity
    client_ip = request.client.host if request.client else "unknown"
    await log_activity(link["user_id"], "Anonymous", "shared_download", "file", file["name"], client_ip)
    
    return Response(
        content=content,
        media_type=file.get("content_type", "application/octet-stream"),
        headers={"Content-Disposition": f'attachment; filename="{file["name"]}"'}
    )

# ============== ACTIVITY LOG ROUTES ==============

@api_router.get("/activity", response_model=List[ActivityLogResponse])
async def get_activity_logs(limit: int = 50, user: dict = Depends(get_current_user)):
    logs = await db.activity_logs.find(
        {"user_id": user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    return [ActivityLogResponse(**l) for l in logs]

# ============== ADMIN ROUTES ==============

@api_router.get("/admin/users", response_model=List[UserResponse])
async def get_all_users(admin: dict = Depends(get_admin_user)):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    return [UserResponse(
        id=u["id"],
        email=u["email"],
        name=u["name"],
        role=u["role"],
        storage_used=u["storage_used"],
        storage_limit=u.get("storage_limit", MAX_STORAGE_BYTES),
        created_at=u["created_at"]
    ) for u in users]

@api_router.put("/admin/users/{user_id}")
async def update_user(user_id: str, update_data: AdminUserUpdate, admin: dict = Depends(get_admin_user)):
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    update_fields = {}
    if update_data.role:
        update_fields["role"] = update_data.role
    if update_data.storage_limit is not None:
        update_fields["storage_limit"] = update_data.storage_limit
    
    if update_fields:
        await db.users.update_one({"id": user_id}, {"$set": update_fields})
    
    await log_activity(admin["id"], admin["name"], "update", "user", user["email"])
    
    return {"message": "User updated"}

@api_router.delete("/admin/users/{user_id}")
async def delete_user(user_id: str, admin: dict = Depends(get_admin_user)):
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user["id"] == admin["id"]:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    
    # Delete all user's files from GridFS
    files = await db.files.find({"user_id": user_id}, {"_id": 0}).to_list(10000)
    from bson import ObjectId
    for file in files:
        try:
            await fs_bucket.delete(ObjectId(file["gridfs_id"]))
        except Exception:
            pass
    
    # Delete user's data
    await db.files.delete_many({"user_id": user_id})
    await db.folders.delete_many({"user_id": user_id})
    await db.share_links.delete_many({"user_id": user_id})
    await db.activity_logs.delete_many({"user_id": user_id})
    await db.users.delete_one({"id": user_id})
    
    await log_activity(admin["id"], admin["name"], "delete", "user", user["email"])
    
    return {"message": "User deleted"}

@api_router.get("/admin/stats")
async def get_admin_stats(admin: dict = Depends(get_admin_user)):
    total_users = await db.users.count_documents({})
    total_files = await db.files.count_documents({})
    total_folders = await db.folders.count_documents({})
    
    # Calculate total storage used
    pipeline = [{"$group": {"_id": None, "total": {"$sum": "$storage_used"}}}]
    result = await db.users.aggregate(pipeline).to_list(1)
    total_storage = result[0]["total"] if result else 0
    
    # Recent activity
    recent_activity = await db.activity_logs.find(
        {},
        {"_id": 0}
    ).sort("created_at", -1).limit(10).to_list(10)
    
    return {
        "total_users": total_users,
        "total_files": total_files,
        "total_folders": total_folders,
        "total_storage_used": total_storage,
        "recent_activity": recent_activity
    }

@api_router.get("/admin/activity", response_model=List[ActivityLogResponse])
async def get_all_activity_logs(limit: int = 100, admin: dict = Depends(get_admin_user)):
    logs = await db.activity_logs.find(
        {},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    return [ActivityLogResponse(**l) for l in logs]

# ============== ROOT ROUTE ==============

@api_router.get("/")
async def root():
    return {"message": "Kuro File Storage API", "version": "1.0.0"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
