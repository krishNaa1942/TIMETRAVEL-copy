"""
Retry Utilities
================
Shared retry decorator for external API calls using ``tenacity``.
Retries only on transient network errors (connection failures, timeouts)
with exponential back-off.  Non-retryable HTTP errors (4xx) are
re-raised immediately.
"""

import logging

import requests
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
    before_sleep_log,
)

logger = logging.getLogger(__name__)

# A pre-configured retry decorator that can be applied to any function
# making external HTTP requests.
#
# Usage:
#   from app.utils.retry import api_retry
#
#   @api_retry
#   def call_some_api(url, params):
#       ...
api_retry = retry(
    retry=retry_if_exception_type(
        (
            requests.exceptions.ConnectionError,
            requests.exceptions.Timeout,
            requests.exceptions.ChunkedEncodingError,
        )
    ),
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=10),
    before_sleep=before_sleep_log(logger, logging.WARNING),
    reraise=True,
)
