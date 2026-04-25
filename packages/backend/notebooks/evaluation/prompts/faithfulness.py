"""Faithfulness with LLM-as-a-judge.

Метрика відповідає на питання: чи кожне твердження у згенерованому звіті
підкріплене наданим контекстом (журнальними записами)?

Формула: supported_claims / total_claims
Підхід: двокроковий — спочатку витягуємо твердження, потім верифікуємо кожне.
"""

FAITHFULNESS_EXTRACT_CLAIMS_TEMPLATE = """\
You are analyzing a personal progress report generated for a behavioral change journal app.

Generated report:
\"\"\"
{generated_report}
\"\"\"

Task: Extract all atomic factual claims made in this report. An atomic claim is a single
statement about the user's behavior, habits, emotions, goal progress, or events.
Do not include meta-statements like "this report covers..." or "based on your entries...".

Respond with a JSON object:
{{
  "claims": [
    "claim 1",
    "claim 2",
    ...
  ]
}}
Only output the JSON, nothing else.\
"""

# Крок 2: перевіряємо кожне твердження по контексту
FAITHFULNESS_VERIFY_CLAIM_TEMPLATE = """\
Context:
\"\"\"{context}\"\"\"

Claim: "{claim}"

Is this claim supported by the context? 
Respond with JSON: {{"supported": 1 or 0}}
Only output the JSON, nothing else.
"""
