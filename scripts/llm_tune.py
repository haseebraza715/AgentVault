import argparse
import os
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests


class RateLimiter:
    def __init__(self, max_per_minute: int) -> None:
        self.max_per_minute = max_per_minute
        self.timestamps: list[float] = []

    def wait(self) -> None:
        if self.max_per_minute <= 0:
            return
        while True:
            now = time.time()
            self.timestamps = [t for t in self.timestamps if now - t < 60]
            if len(self.timestamps) < self.max_per_minute:
                self.timestamps.append(now)
                return
            sleep_for = 60 - (now - self.timestamps[0])
            time.sleep(max(0.05, sleep_for))


def call_llm(model: str, api_key: str, rate_limiter: RateLimiter) -> tuple[int, str]:
    rate_limiter.wait()
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": "You are a helpful editor."},
            {"role": "user", "content": "Rewrite this note briefly."},
        ],
    }
    response = requests.post(
        "https://openrouter.ai/api/v1/chat/completions",
        headers={"Authorization": f"Bearer {api_key}"},
        json=payload,
        timeout=60,
    )
    return response.status_code, response.text[:200]


def run() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--requests", type=int, default=30)
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--rpm", type=int, default=20)
    args = parser.parse_args()

    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise RuntimeError("OPENROUTER_API_KEY is required")

    model = os.getenv("OPENROUTER_MODEL", "arcee-ai/trinity-large-preview:free")
    limiter = RateLimiter(args.rpm)

    start = time.time()
    errors = []

    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = [
            executor.submit(call_llm, model, api_key, limiter)
            for _ in range(args.requests)
        ]
        for future in as_completed(futures):
            status, text = future.result()
            if status != 200:
                errors.append((status, text))

    duration = time.time() - start
    print(f"requests={args.requests} workers={args.workers} rpm={args.rpm} duration={duration:.1f}s")
    if errors:
        first = errors[0]
        print(f"errors={len(errors)} first_status={first[0]} first_body={first[1]}")
        return 1
    print("errors=0")
    return 0


if __name__ == "__main__":
    raise SystemExit(run())
