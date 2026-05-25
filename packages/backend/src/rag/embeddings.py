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

    # Warmup must run in the executor thread to seed the rope cache there.
    future = embed_executor.submit(model.encode, "warmup", normalize_embeddings=True)
    future.result()
    return model


async def embed_text(text: str) -> list[float]:
    """Embed *text* asynchronously, always using the single embed_executor thread."""
    model = get_embedding_model()
    loop = asyncio.get_event_loop()
    vector = await loop.run_in_executor(
        embed_executor, lambda: model.encode(text, normalize_embeddings=True)
    )
    return vector.tolist()
