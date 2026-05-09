FROM python:3.11-slim

WORKDIR /app

RUN pip install uv

COPY pyproject.toml uv.lock README.md ./

# cache uv downloads between rebuilds
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev && \
    uv pip install uvicorn[standard]

COPY . .

EXPOSE 8000

COPY start.sh ./
RUN chmod +x start.sh
CMD ["./start.sh"]
