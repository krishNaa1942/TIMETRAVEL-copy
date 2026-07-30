"""
File Uploads API – Photos and travel documents.
Supports Supabase Storage when configured, falls back to local disk.
"""

import os
import re
import uuid
from io import BytesIO
from urllib.parse import urlparse

from flask import Blueprint, request, jsonify, send_from_directory, current_app, redirect
from flask_login import login_required, current_user
from werkzeug.utils import secure_filename
from PIL import Image

from app.main import limiter
from app.models.database import db
from app.models.entities import Trip, TripPhoto, TripDocument
from app.services.supabase_service import (
    is_supabase_configured,
    upload_file,
    delete_file,
    get_signed_url,
    get_local_upload_dir,
)

uploads_bp = Blueprint("uploads", __name__, url_prefix="/api/uploads")

ALLOWED_IMAGE_EXTS = {"png", "jpg", "jpeg", "gif", "webp", "heic"}
ALLOWED_DOC_EXTS = {"pdf", "png", "jpg", "jpeg", "doc", "docx"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
MAX_IMAGE_DIMENSION = 1920
MAX_FILES_PER_REQUEST = 10

# MIME type mapping for Supabase uploads
_MIME_TYPES = {
    "png": "image/png",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "gif": "image/gif",
    "webp": "image/webp",
    "heic": "image/heic",
    "pdf": "application/pdf",
    "doc": "application/msword",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


def _get_upload_dir(subdir):
    """Get (and create) the upload directory for a type of file."""
    base = os.path.join(current_app.instance_path, "..", "uploads", subdir)
    base = os.path.abspath(base)
    os.makedirs(base, exist_ok=True)
    return base


def _allowed_file(filename, allowed_exts):
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    return ext in allowed_exts


def _storage_path(user_id: int, stored_name: str) -> str:
    """Build the storage path: ``{user_id}/{filename}``."""
    return f"{user_id}/{stored_name}"


def _sanitize_text(value: str, max_len: int = 500) -> str:
    """Sanitize user-supplied text fields (strip HTML, limit length)."""
    clean = re.sub(r"<[^>]+>", "", value)  # strip HTML tags
    return clean.strip()[:max_len]


def _optimize_image(file):
    try:
        img = Image.open(file)
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
        if max(img.width, img.height) > MAX_IMAGE_DIMENSION:
            ratio = MAX_IMAGE_DIMENSION / max(img.width, img.height)
            new_size = (int(img.width * ratio), int(img.height * ratio))
            img = img.resize(new_size, Image.LANCZOS)
        buf = BytesIO()
        img.save(buf, format="JPEG", quality=85)
        buf.seek(0)
        return buf
    except Exception:
        current_app.logger.warning("Image optimization failed, using original", exc_info=True)
        return None


def _is_safe_redirect(url: str) -> bool:
    """Only allow redirects to the configured Supabase host."""
    supabase_url = current_app.config.get("SUPABASE_URL", "")
    if not supabase_url:
        return False
    allowed_host = urlparse(supabase_url).netloc
    parsed = urlparse(url)
    return parsed.scheme == "https" and parsed.netloc.endswith(allowed_host)


def _safe_serve(upload_dir: str, db_filename: str):
    """Serve a file from upload_dir only if it stays inside that directory."""
    real_dir = os.path.realpath(upload_dir)
    real_path = os.path.realpath(os.path.join(upload_dir, db_filename))
    if not real_path.startswith(real_dir + os.sep):
        return jsonify({"error": "Access denied."}), 403
    return send_from_directory(upload_dir, db_filename)


# ── Photo Upload ────────────────────────────────────────────────────────

@uploads_bp.route("/photos", methods=["POST"])
@limiter.limit("10 per minute")
@login_required
def upload_photo():
    """Upload a photo to a trip."""
    trip_id = request.form.get("trip_id")
    if not trip_id:
        return jsonify({"error": "trip_id is required."}), 400

    trip = Trip.query.filter_by(id=int(trip_id), user_id=current_user.id).first()
    if not trip:
        return jsonify({"error": "Trip not found."}), 404

    if "file" not in request.files:
        return jsonify({"error": "No file uploaded."}), 400

    files = request.files.getlist("file")
    if len(files) > MAX_FILES_PER_REQUEST:
        return jsonify({"error": f"Too many files. Maximum {MAX_FILES_PER_REQUEST} per request."}), 400

    file = files[0]
    if not file.filename:
        return jsonify({"error": "No file selected."}), 400

    if not _allowed_file(file.filename, ALLOWED_IMAGE_EXTS):
        return jsonify({"error": f"Allowed formats: {', '.join(ALLOWED_IMAGE_EXTS)}"}), 400

    # Read and check size
    file.seek(0, 2)
    size = file.tell()
    file.seek(0)
    if size > MAX_FILE_SIZE:
        return jsonify({"error": "File too large (max 10MB)."}), 400

    # Generate unique filename
    ext = file.filename.rsplit(".", 1)[-1].lower()
    stored_name = f"{uuid.uuid4().hex}.{ext}"

    # Optimize image if applicable
    file_data = None
    content_type = _MIME_TYPES.get(ext, "application/octet-stream")
    if file.content_type and file.content_type.startswith("image/"):
        optimized = _optimize_image(file)
        if optimized is not None:
            file_data = optimized.read()
            content_type = "image/jpeg"

    if file_data is None:
        file.seek(0)
        file_data = file.read()

    if is_supabase_configured():
        bucket = current_app.config["SUPABASE_STORAGE_BUCKET_PHOTOS"]
        path = _storage_path(current_user.id, stored_name)
        upload_file(bucket, path, file_data, content_type)
    else:
        upload_dir = get_local_upload_dir("photos")
        with open(os.path.join(upload_dir, stored_name), "wb") as f:
            f.write(file_data)

    photo = TripPhoto(
        trip_id=trip.id,
        user_id=current_user.id,
        filename=stored_name,
        original_name=secure_filename(file.filename),
        caption=_sanitize_text(request.form.get("caption", ""), 300),
        place_name=_sanitize_text(request.form.get("place_name", ""), 200),
        file_size=size,
    )
    db.session.add(photo)
    db.session.commit()
    return jsonify({"photo": photo.to_dict()}), 201


@uploads_bp.route("/photos/<int:photo_id>", methods=["DELETE"])
@limiter.limit("20 per minute")
@login_required
def delete_photo(photo_id):
    """Delete a photo."""
    photo = TripPhoto.query.filter_by(id=photo_id, user_id=current_user.id).first()
    if not photo:
        return jsonify({"error": "Photo not found."}), 404

    if is_supabase_configured():
        bucket = current_app.config["SUPABASE_STORAGE_BUCKET_PHOTOS"]
        path = _storage_path(current_user.id, photo.filename)
        delete_file(bucket, path)
    else:
        upload_dir = get_local_upload_dir("photos")
        filepath = os.path.join(upload_dir, photo.filename)
        if os.path.exists(filepath):
            os.remove(filepath)

    db.session.delete(photo)
    db.session.commit()
    return jsonify({"message": "Photo deleted."})


# ── Document Upload ─────────────────────────────────────────────────────

@uploads_bp.route("/documents", methods=["POST"])
@limiter.limit("10 per minute")
@login_required
def upload_document():
    """Upload a travel document."""
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded."}), 400

    files = request.files.getlist("file")
    if len(files) > MAX_FILES_PER_REQUEST:
        return jsonify({"error": f"Too many files. Maximum {MAX_FILES_PER_REQUEST} per request."}), 400

    file = files[0]
    if not file.filename:
        return jsonify({"error": "No file selected."}), 400

    if not _allowed_file(file.filename, ALLOWED_DOC_EXTS):
        return jsonify({"error": f"Allowed formats: {', '.join(ALLOWED_DOC_EXTS)}"}), 400

    file.seek(0, 2)
    size = file.tell()
    file.seek(0)
    if size > MAX_FILE_SIZE:
        return jsonify({"error": "File too large (max 10MB)."}), 400

    ext = file.filename.rsplit(".", 1)[-1].lower()
    stored_name = f"{uuid.uuid4().hex}.{ext}"

    file.seek(0)
    file_data = file.read()
    content_type = _MIME_TYPES.get(ext, "application/octet-stream")

    if is_supabase_configured():
        bucket = current_app.config["SUPABASE_STORAGE_BUCKET_DOCS"]
        path = _storage_path(current_user.id, stored_name)
        upload_file(bucket, path, file_data, content_type)
    else:
        upload_dir = get_local_upload_dir("documents")
        with open(os.path.join(upload_dir, stored_name), "wb") as f:
            f.write(file_data)

    expiry_date = None
    if request.form.get("expiry_date"):
        try:
            from datetime import date
            expiry_date = date.fromisoformat(request.form["expiry_date"])
        except ValueError:
            pass

    trip_id = int(request.form["trip_id"]) if request.form.get("trip_id") else None
    if trip_id is not None:
        trip = Trip.query.filter_by(id=trip_id, user_id=current_user.id).first()
        if not trip:
            return jsonify({"error": "Trip not found or access denied"}), 404

    doc = TripDocument(
        user_id=current_user.id,
        trip_id=trip_id,
        doc_type=_sanitize_text(request.form.get("doc_type", "other"), 50),
        title=_sanitize_text(request.form.get("title", file.filename), 200),
        filename=stored_name,
        original_name=secure_filename(file.filename),
        expiry_date=expiry_date,
        notes=_sanitize_text(request.form.get("notes", ""), 1000),
        file_size=size,
    )
    db.session.add(doc)
    db.session.commit()
    return jsonify({"document": doc.to_dict()}), 201


@uploads_bp.route("/documents", methods=["GET"])
@limiter.limit("60 per minute")
@login_required
def list_documents():
    """List user's travel documents."""
    trip_id = request.args.get("trip_id")
    q = TripDocument.query.filter_by(user_id=current_user.id)
    if trip_id:
        q = q.filter_by(trip_id=int(trip_id))
    docs = q.order_by(TripDocument.created_at.desc()).all()
    return jsonify({"documents": [d.to_dict() for d in docs]})


@uploads_bp.route("/documents/<int:doc_id>", methods=["DELETE"])
@limiter.limit("20 per minute")
@login_required
def delete_document(doc_id):
    """Delete a document."""
    doc = TripDocument.query.filter_by(id=doc_id, user_id=current_user.id).first()
    if not doc:
        return jsonify({"error": "Document not found."}), 404

    if is_supabase_configured():
        bucket = current_app.config["SUPABASE_STORAGE_BUCKET_DOCS"]
        path = _storage_path(current_user.id, doc.filename)
        delete_file(bucket, path)
    else:
        upload_dir = get_local_upload_dir("documents")
        filepath = os.path.join(upload_dir, doc.filename)
        if os.path.exists(filepath):
            os.remove(filepath)

    db.session.delete(doc)
    db.session.commit()
    return jsonify({"message": "Document deleted."})


# ── Serve uploaded files ────────────────────────────────────────────────

@uploads_bp.route("/serve/photos/<path:filename>", methods=["GET"])
@limiter.limit("60 per minute")
@login_required
def serve_photo(filename):
    """Serve an uploaded photo (auth required).

    When Supabase is configured, redirects to a signed URL.
    Otherwise serves from the local uploads directory.
    """
    photo = TripPhoto.query.filter_by(filename=filename, user_id=current_user.id).first()
    if not photo:
        return jsonify({"error": "Access denied."}), 403

    if is_supabase_configured():
        bucket = current_app.config["SUPABASE_STORAGE_BUCKET_PHOTOS"]
        path = _storage_path(current_user.id, photo.filename)
        signed = get_signed_url(bucket, path, expires_in=3600)
        if not _is_safe_redirect(signed):
            return jsonify({"error": "Invalid redirect target"}), 502
        return redirect(signed)

    upload_dir = get_local_upload_dir("photos")
    return _safe_serve(upload_dir, photo.filename)


@uploads_bp.route("/serve/documents/<path:filename>", methods=["GET"])
@limiter.limit("60 per minute")
@login_required
def serve_document(filename):
    """Serve an uploaded document (auth required).

    When Supabase is configured, redirects to a signed URL.
    Otherwise serves from the local uploads directory.
    """
    doc = TripDocument.query.filter_by(filename=filename, user_id=current_user.id).first()
    if not doc:
        return jsonify({"error": "Access denied."}), 403

    if is_supabase_configured():
        bucket = current_app.config["SUPABASE_STORAGE_BUCKET_DOCS"]
        path = _storage_path(current_user.id, doc.filename)
        signed = get_signed_url(bucket, path, expires_in=3600)
        if not _is_safe_redirect(signed):
            return jsonify({"error": "Invalid redirect target"}), 502
        return redirect(signed)

    upload_dir = get_local_upload_dir("documents")
    return _safe_serve(upload_dir, doc.filename)
