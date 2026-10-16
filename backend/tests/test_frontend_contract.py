import re
from pathlib import Path
import pytest
from app.main import app

def test_frontend_api_contract():
    """Verify that every API call in frontend/src/lib/api/*.ts matches an existing route and HTTP method in the FastAPI OpenAPI schema."""
    openapi = app.openapi()
    
    # Map normalized OpenAPI paths: e.g. "/api/v1/venues/{}/images/{}" -> {"get", "post", ...}
    openapi_paths = {}
    for path, methods in openapi["paths"].items():
        norm_path = re.sub(r"\{[^}]+\}", "{}", path)
        openapi_paths[norm_path] = {m.lower() for m in methods.keys()}

    # Resolve frontend/src/lib/api path relative to this test file
    frontend_api_dir = Path(__file__).resolve().parent.parent.parent / "frontend" / "src" / "lib" / "api"
    assert frontend_api_dir.exists(), f"Frontend API directory not found at {frontend_api_dir}"

    call_pattern = re.compile(
        r"api\.(get|post|patch|delete|put|postForm)\s*(?:<[\s\S]*?>)?\s*\(\s*([`'\"])([\s\S]*?)\2"
    )

    mismatches = []
    checked_calls = 0

    for ts_file in frontend_api_dir.glob("*.ts"):
        if ts_file.name in ("client.ts", "types.ts") or ts_file.name.endswith(".test.ts"):
            continue
        content = ts_file.read_text(encoding="utf-8")
        for match in call_pattern.finditer(content):
            method_call, _, raw_path = match.groups()
            http_method = "post" if method_call == "postForm" else method_call.lower()
            
            # Remove any query string from the path template, e.g. ?${searchParams.toString()}
            clean_path = raw_path.split("?")[0].strip()
            # Normalize template literal placeholders: ${...} -> {}
            norm_path = re.sub(r"\$\{[^}]+\}", "{}", clean_path)

            checked_calls += 1
            if norm_path not in openapi_paths:
                mismatches.append(
                    f"{ts_file.name}: Path '{clean_path}' (normalized: '{norm_path}') does not exist in backend OpenAPI routes"
                )
            elif http_method not in openapi_paths[norm_path]:
                available = ", ".join(m.upper() for m in sorted(openapi_paths[norm_path]))
                mismatches.append(
                    f"{ts_file.name}: Method {http_method.upper()} for '{norm_path}' not allowed by backend. Available: [{available}]"
                )

    assert checked_calls > 0, "No frontend API calls were detected by contract test!"
    assert not mismatches, "Frontend API contract mismatches found:\n" + "\n".join(f" - {m}" for m in mismatches)
