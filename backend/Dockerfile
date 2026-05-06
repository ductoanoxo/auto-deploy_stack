#Stage 1 : Build stage 
FROM python:3.10-slim AS builder

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1



COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# Stage 2: Tester stage
FROM python:3.10-slim AS tester
WORKDIR /app
COPY --from=builder /install /usr/local
COPY . .
RUN pip install pytest
RUN pytest

#Stage 2 : Production Stage

FROM python:3.10-slim 

WORKDIR /app
RUN addgroup --system appgroup && adduser --system --group appuser

COPY --from=builder /install /usr/local
COPY . /app/

RUN chown -R appuser:appgroup /app
USER appuser

HEALTHCHECK --interval=30s --timeout=3s \ 
CMD curl -f http://localhost:8000/api/hello || exit 1 

EXPOSE 8000

CMD ["uvicorn","main:app","--host","0.0.0.0","--port","8000"]
