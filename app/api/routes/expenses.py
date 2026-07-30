"""
Expense Tracker API Route
===========================
POST   /api/expenses              – Add an expense
GET    /api/expenses              – List user's expenses
GET    /api/expenses/summary      – Summary with totals by category
DELETE /api/expenses/<id>         – Delete an expense
"""

from datetime import date
from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user

from app.models.database import db
from app.models.entities import Expense

expenses_bp = Blueprint("expenses", __name__)


@expenses_bp.route("/api/expenses", methods=["POST"])
@login_required
def add_expense():
    """Add a new expense entry."""
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Request body must be JSON"}), 400

    destination = (data.get("destination") or "").strip()
    category = (data.get("category") or "").strip()
    description = (data.get("description") or "").strip()

    try:
        amount = float(data.get("amount", 0))
    except (TypeError, ValueError):
        return jsonify({"error": "Invalid amount"}), 400

    if not destination or not category or not description or amount <= 0:
        return (
            jsonify(
                {
                    "error": "destination, category, description, and positive amount are required"
                }
            ),
            400,
        )

    expense = Expense(
        user_id=current_user.id,
        trip_id=data.get("trip_id"),
        destination=destination,
        category=category,
        description=description,
        amount=amount,
        currency=data.get("currency", "INR"),
        date=date.fromisoformat(data["date"]) if data.get("date") else date.today(),
    )
    db.session.add(expense)
    db.session.commit()

    return jsonify({"message": "Expense added", "expense": expense.to_dict()}), 201


@expenses_bp.route("/api/expenses", methods=["GET"])
@login_required
def list_expenses():
    """List current user's expenses, optionally filtered by destination."""
    dest = request.args.get("destination", "")
    query = Expense.query.filter_by(user_id=current_user.id)

    if dest:
        query = query.filter_by(destination=dest)

    expenses = query.order_by(Expense.date.desc(), Expense.created_at.desc()).all()
    return jsonify({"expenses": [e.to_dict() for e in expenses]})


@expenses_bp.route("/api/expenses/summary", methods=["GET"])
@login_required
def expense_summary():
    """Get expense totals grouped by category for a destination."""
    dest = request.args.get("destination", "")
    query = Expense.query.filter_by(user_id=current_user.id)

    if dest:
        query = query.filter_by(destination=dest)

    from sqlalchemy import func

    rows = (
        query.with_entities(
            Expense.category,
            func.sum(Expense.amount),
            func.count(Expense.id),
        )
        .group_by(Expense.category)
        .all()
    )

    by_category = [
        {"category": cat, "total": round(total, 2), "count": count}
        for cat, total, count in rows
    ]
    total_expenses = sum(r["total"] for r in by_category)
    total_count = sum(r["count"] for r in by_category)

    return jsonify(
        {
            "destination": dest or "all",
            "total": round(total_expenses, 2),
            "count": total_count,
            "by_category": by_category,
        }
    )


@expenses_bp.route("/api/expenses/<int:expense_id>", methods=["DELETE"])
@login_required
def delete_expense(expense_id):
    """Delete an expense (owner only)."""
    expense = Expense.query.get_or_404(expense_id)
    if expense.user_id != current_user.id:
        return jsonify({"error": "Forbidden"}), 403

    db.session.delete(expense)
    db.session.commit()
    return jsonify({"message": "Expense deleted"})
