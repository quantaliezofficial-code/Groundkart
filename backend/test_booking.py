import asyncio
import httpx

async def main():
    async with httpx.AsyncClient(base_url="http://127.0.0.1:8000") as client:
        # Create client
        res = await client.post("/api/v1/auth/signup", json={
            "email": "client2@example.com",
            "password": "password",
            "name": "Client",
            "role": "customer"
        })
        print("Register:", res.status_code, res.text)
        
        # Login
        res = await client.post("/api/v1/auth/login", json={
            "login_id": "client2@example.com",
            "password": "password"
        })
        print("Login:", res.status_code, res.text)
        token = res.json()["access_token"]
        
        # Get venues
        res = await client.get("/api/v1/catalog/venues")
        venues = res.json()
        if not venues:
            print("No venues")
            return
        venue = venues[0]
        
        # Get slots
        res = await client.get(f"/api/v1/venues/{venue['id']}/inventory-units")
        slots = res.json()
        if not slots:
            print("No slots")
            return
        
        available_slots = [s for s in slots if s['status'] == 'available']
        if not available_slots:
            print("No available slots")
            return
            
        slot = available_slots[0]
        print("Booking slot:", slot['id'])
        
        # Book
        res = await client.post("/api/v1/bookings", json={
            "inventory_unit_id": slot["id"]
        }, headers={"Authorization": f"Bearer {token}"})
        print("Book response:", res.status_code, res.text)

asyncio.run(main())
