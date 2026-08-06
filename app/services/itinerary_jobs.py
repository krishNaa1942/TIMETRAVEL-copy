"""
Itinerary Job Store
====================
Long-running itinerary generations run in background worker threads. The
store keeps their live state (step, progress, streamed days, cancellation)
so the API can serve status polling and SSE streams, and reaps expired jobs.

Job lifecycle: queued -> running -> (done | error | cancelled)
"""

import logging
import threading
import time
import uuid

from app.services.itinerary_service import (
    build_full_response,
    generate_itinerary_days,
)

logger = logging.getLogger(__name__)

JOB_TTL_SECONDS = 2 * 60 * 60  # jobs are reaped 2h after completion/creation
TERMINAL_STATUSES = {"done", "error", "cancelled"}


class ItineraryJob:
    def __init__(self, job_id: str, params: dict):
        self.id = job_id
        self.params = params
        self.status = "queued"
        self.step = "queued"
        self.progress = 0
        self.days: list[dict] = []
        self.result: dict | None = None
        self.error: str | None = None
        self.cancel_event = threading.Event()
        self.created_at = time.time()
        self.updated_at = time.time()
        self.events: list[dict] = []
        self._cond = threading.Condition()
        self._seq = 0

    # ── helpers (caller must hold self._cond) ─────────────────────────
    def _publish(self, event_type: str, **data):
        self._seq += 1
        event = {"seq": self._seq, "type": event_type, **data}
        self.events.append(event)
        self.updated_at = time.time()
        self._cond.notify_all()
        return event

    # ── public API ─────────────────────────────────────────────────────
    def publish(self, event_type: str, **data):
        with self._cond:
            return self._publish(event_type, **data)

    def set_status(self, status: str, step: str | None = None, progress: int | None = None):
        with self._cond:
            self.status = status
            if step is not None:
                self.step = step
            if progress is not None:
                self.progress = progress
            self.updated_at = time.time()
            self._cond.notify_all()

    def append_day(self, day: dict, progress: int, step: str):
        with self._cond:
            self.days.append(day)
            self.progress = progress
            self.step = step
            self.updated_at = time.time()
            self._publish("day", day=day, progress=progress, step=step)

    def finish(self, result: dict):
        with self._cond:
            self.result = result
            self.status = "done"
            self.progress = 100
            self.step = "complete"
            self.updated_at = time.time()
            self._publish("done", result=result, progress=100)

    def fail(self, error: str):
        with self._cond:
            self.error = error
            self.status = "error"
            self.step = "error"
            self.updated_at = time.time()
            self._publish("error", error=error)

    def snapshot(self) -> dict:
        with self._cond:
            return {
                "id": self.id,
                "status": self.status,
                "step": self.step,
                "progress": self.progress,
                "day_count": len(self.days),
                "itinerary": list(self.days),
                "error": self.error,
                "params": dict(self.params),
                "created_at": self.created_at,
                "updated_at": self.updated_at,
            }

    def events_since(self, seq: int) -> tuple[list[dict], int]:
        """Return events after `seq` and the new cursor (best-effort)."""
        with self._cond:
            return list(self.events[seq:]), len(self.events)

    def wait_for_events(self, seq: int, timeout: float) -> bool:
        """Block until events after `seq` exist or status is terminal."""
        with self._cond:
            if len(self.events) > seq or self.status in TERMINAL_STATUSES:
                return True
            self._cond.wait(timeout)
            return len(self.events) > seq or self.status in TERMINAL_STATUSES


_jobs: dict[str, ItineraryJob] = {}
_jobs_lock = threading.Lock()


def _cleanup():
    now = time.time()
    with _jobs_lock:
        for job_id in [j for j, job in _jobs.items() if now - job.updated_at > JOB_TTL_SECONDS]:
            _jobs.pop(job_id, None)


def create_job(params: dict) -> str:
    _cleanup()
    job_id = uuid.uuid4().hex[:16]
    job = ItineraryJob(job_id, params)
    with _jobs_lock:
        _jobs[job_id] = job
    return job_id


def get_job(job_id: str) -> ItineraryJob | None:
    _cleanup()
    with _jobs_lock:
        return _jobs.get(job_id)


def cancel_job(job_id: str) -> bool:
    job = get_job(job_id)
    if not job:
        return False
    if job.status in TERMINAL_STATUSES:
        return job.status == "cancelled"
    job.cancel_event.set()
    job.set_status("cancelling", step="cancelling")
    return True


def _run_job(job_id: str) -> None:
    """Background worker: generate days, publish events, compose result."""
    job = get_job(job_id)
    if not job:
        return

    p = job.params
    try:
        job.set_status("running", step="starting", progress=5)
        job.publish("step", step="starting", progress=5)

        day_batch: list[dict] = []
        for index, day in enumerate(
            generate_itinerary_days(
                destination=p["destination"],
                num_days=p["num_days"],
                family_size=p["family_size"],
                travel_class=p["travel_class"],
                interests=p.get("interests", ""),
                api_key=p["api_key"],
                stop_event=job.cancel_event,
            ),
            start=1,
        ):
            if job.cancel_event.is_set():
                break
            day_batch.append(day)
            progress = int(index / p["num_days"] * 100)
            job.append_day(day, progress=progress, step=f"planning_day_{index}")

        if job.cancel_event.is_set():
            job.set_status("cancelled", step="cancelled", progress=0)
            job.publish("cancelled", step="cancelled")
            return

        job.publish("step", step="finalizing", progress=95)
        result = build_full_response(
            destination=p["destination"],
            num_days=p["num_days"],
            family_size=p["family_size"],
            travel_class=p["travel_class"],
            interests=p.get("interests", ""),
            days=day_batch,
            maps_api_key=p.get("maps_api_key", ""),
        )
        job.finish(result)
    except Exception as exc:  # noqa: BLE001 - job failure must not kill the thread
        logger.exception("Itinerary job %s failed", job_id)
        job.fail(str(exc)[:300])


def start_job(job_id: str) -> None:
    """Spawn the background worker thread for a queued job."""
    worker = threading.Thread(
        target=_run_job,
        args=(job_id,),
        name=f"itinerary-job-{job_id}",
        daemon=True,
    )
    worker.start()
