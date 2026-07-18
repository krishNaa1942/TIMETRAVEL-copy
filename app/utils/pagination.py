"""
Pagination Utilities
====================
Provides pagination helpers for API endpoints.
"""

from typing import Generic, TypeVar, List, Dict, Any, Optional
from dataclasses import dataclass

T = TypeVar("T")


@dataclass
class PaginationParams:
    """Pagination parameters from request"""
    page: int = 1
    per_page: int = 20
    sort_by: str = "created_at"
    sort_order: str = "desc"
    
    @classmethod
    def from_request(cls, request) -> "PaginationParams":
        """Extract pagination params from Flask request"""
        return cls(
            page=max(1, int(request.args.get("page", 1))),
            per_page=min(100, max(1, int(request.args.get("per_page", 20)))),
            sort_by=request.args.get("sort_by", "created_at"),
            sort_order=request.args.get("sort_order", "desc"),
        )
    
    @property
    def offset(self) -> int:
        return (self.page - 1) * self.per_page
    
    @property
    def limit(self) -> int:
        return self.per_page


@dataclass
class PaginatedResult(Generic[T]):
    """Paginated result with metadata"""
    items: List[T]
    total: int
    page: int
    per_page: int
    
    @property
    def total_pages(self) -> int:
        return (self.total + self.per_page - 1) // self.per_page if self.per_page > 0 else 0
    
    @property
    def has_next(self) -> bool:
        return self.page < self.total_pages
    
    @property
    def has_prev(self) -> bool:
        return self.page > 1
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "items": self.items,
            "total": self.total,
            "page": self.page,
            "per_page": self.per_page,
            "total_pages": self.total_pages,
            "has_next": self.has_next,
            "has_prev": self.has_prev,
        }


def paginate_list(items: List[Any], page: int = 1, per_page: int = 20) -> PaginatedResult:
    """Paginate a Python list"""
    total = len(items)
    start = (page - 1) * per_page
    end = start + per_page
    
    return PaginatedResult(
        items=items[start:end],
        total=total,
        page=page,
        per_page=per_page,
    )