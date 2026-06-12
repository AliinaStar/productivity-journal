"""Embedding model singleton for the RAG pipeline."""

import asyncio
from concurrent.futures import ThreadPoolExecutor
from functools import lru_cache

import torch
from sentence_transformers import SentenceTransformer

# Single-threaded executor so all model.encode() calls happen in the same
# thread — required because the GTE model's rope cache is not thread-safe.
embed_executor = ThreadPoolExecutor(max_workers=1)


@lru_cache(maxsize=1)
def get_embedding_model() -> SentenceTransformer:
    """Load and warm up the model.

    Must only ever be called from the ``embed_executor`` thread (see
    ``embed_text`` / ``preload_embedding_model``): loading takes tens of
    seconds and would freeze the event loop, and the warmup must seed the
    rope cache in the thread that will run all encode() calls.
    """
    model = SentenceTransformer(
        "Alibaba-NLP/gte-multilingual-base",
        trust_remote_code=True,
        # Disable meta-tensor loading: transformers 5.x may default to
        # low_cpu_mem_usage=True which initialises weights as uninitialised
        # "meta" tensors and only populates those saved in the checkpoint.
        # position_ids is registered with persistent=False so it is never
        # saved — without this flag it stays as garbage memory on Linux.
        model_kwargs={"low_cpu_mem_usage": False, "torch_dtype": torch.float32},
    )
    model.max_seq_length = 512

    # Belt-and-suspenders: explicitly re-register position_ids in every
    # module that owns one, ensuring they contain torch.arange values even
    # if meta-tensor loading somehow slipped through.
    for module in model.modules():
        if hasattr(module, "position_ids"):
            n = module.position_ids.shape[0]
            module.register_buffer("position_ids", torch.arange(n), persistent=False)

    # Warmup directly in the calling thread — which is the embed_executor
    # thread — to seed the rope cache where all encode() calls will run.
    # (Do NOT submit to embed_executor here: with max_workers=1 a call from
    # inside the executor thread would deadlock waiting on itself.)
    model.encode("warmup", normalize_embeddings=True)
    return model


async def preload_embedding_model() -> None:
    """Load the model at startup so no user request ever pays the load cost.

    Called from the FastAPI lifespan before the app starts serving traffic.
    Runs in the embed_executor thread, keeping the event loop free.
    """
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(embed_executor, get_embedding_model)


async def embed_text(text: str) -> list[float]:
    """Embed *text* asynchronously, always using the single embed_executor thread."""
    loop = asyncio.get_event_loop()
    vector = await loop.run_in_executor(
        embed_executor,
        lambda: get_embedding_model().encode(text, normalize_embeddings=True),
    )
    return vector.tolist()
