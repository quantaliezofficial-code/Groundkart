
import pytest
from httpx import AsyncClient
from app.main import app
from fastapi.testclient import TestClient

def test_api_versioning_healthz():
    with TestClient(app) as client:
        response = client.get('/healthz')
        assert response.status_code == 200

def test_api_versioning_legacy_and_v1_auth():
    with TestClient(app) as client:
        # V1 canonical
        res_v1 = client.post('/api/v1/auth/signup', json={
            'name': 'Test V1',
            'phone': '9999999995',
            'password': 'password123',
            'email': 'testv5@example.com'
        })
        assert res_v1.status_code in [201, 400, 422, 429]

        # Legacy fallback
        res_legacy = client.post('/auth/signup', json={
            'name': 'Test Legacy',
            'phone': '8888888886',
            'password': 'password123',
            'email': 'testlegacy6@example.com'
        })
        assert res_legacy.status_code in [201, 400, 422, 429]

def test_openapi_tags():
    with TestClient(app) as client:
        res = client.get('/openapi.json')
        assert res.status_code == 200
        schema = res.json()
        paths = schema.get('paths', {})
        assert '/api/v1/auth/signup' in paths
        assert '/auth/signup' in paths
        
        # Check that the legacy endpoint is marked deprecated
        legacy_op = paths['/auth/signup']['post']
        assert legacy_op.get('deprecated') is True
