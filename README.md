# 🚀 Jenkins CI/CD Pipeline Demo

![Project Banner](/home/traductoan/.gemini/antigravity/brain/62f36ad1-ee68-4614-b867-10b3abab34d2/project_banner_1777961552317.png)

[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
[![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![Vite](https://img.shields.io/badge/vite-%23646CFF.svg?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Python](https://img.shields.io/badge/python-3670A0?style=for-the-badge&logo=python&logoColor=ffdd54)](https://www.python.org/)

A professional, full-stack demonstration platform engineered for modern **Docker-based CI/CD pipelines**. This project features a high-performance **FastAPI** backend and a premium **React (Vite)** frontend with cinematic background transitions.

---

## ✨ Key Features

- 🎥 **Cinematic UI:** Premium frontend with looping video backgrounds and custom requestAnimationFrame fade logic.
- ⚡ **High Performance:** Lightning-fast API responses powered by FastAPI and Uvicorn.
- 🐳 **Container First:** Fully dockerized architecture with optimized multi-stage builds.
- 🛠️ **Developer Experience:** Hot-reloading enabled for both frontend and backend development.
- 🧪 **Reliable:** Integrated unit testing with Pytest.

---

## 🏗️ Project Architecture

```mermaid
graph LR
    User((User)) <--> Frontend[React/Vite Frontend]
    Frontend <--> Backend[FastAPI Backend]
    Backend <--> API[API Endpoints]
```

---

## 🚀 Getting Started

### 🐳 The Docker Way (Recommended)

Start the entire stack with a single command:

```bash
docker-compose up --build
```

- **Frontend:** [http://localhost:3000](http://localhost:3000)
- **Backend API:** [http://localhost:8000](http://localhost:8000)
- **API Docs:** [http://localhost:8000/docs](http://localhost:8000/docs)

---

### 🛠️ Local Development

#### ⚛️ Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

#### 🐍 Backend Setup

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

---

## 🧪 Testing & Quality

Ensure your backend is running correctly by running the test suite:

```bash
cd backend
pytest
```

---

## 🔗 API Reference

### Greeting Endpoint

`POST /api/hello`

**Request Body:**
```json
{
  "name": "Jane Doe"
}
```

**Successful Response:**
```json
{
  "message": "Hello Jane Doe",
  "timestamp": "2024-05-03T12:00:00.000000Z"
}
```

---

<p align="center">
  Built with ❤️ for the DevOps Community
</p>
# auto-deploy_stack
