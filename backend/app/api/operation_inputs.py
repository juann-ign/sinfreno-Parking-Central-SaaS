from fastapi import Header, Path
from typing import Annotated

RecordId = Annotated[int, Path(gt=0, le=2147483647)]


def idempotency_key(value: str = Header(
    ..., alias="Idempotency-Key", min_length=8, max_length=128, pattern=r"^[A-Za-z0-9._:-]+$",
)):
    return value
