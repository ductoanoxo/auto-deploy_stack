from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime

app = FastAPI(title="Greeting API")

# Enable CORS for the frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins for demo purposes
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class GreetingRequest(BaseModel):
    name: str

class GreetingResponse(BaseModel):
    message: str
    timestamp: str

@app.post("/api/hello", response_model=GreetingResponse)
async def hello(request: GreetingRequest):
    return GreetingResponse(
        message=f"Hello {request.name}",
        timestamp=datetime.utcnow().isoformat() + "Z"
    )
