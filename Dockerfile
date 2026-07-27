# =============================================================================
# Étape 1 : compilation du front Angular
# On part d'une image contenant Node. Elle sert uniquement à fabriquer les
# fichiers HTML/CSS/JS ; elle ne sera pas conservée dans l'image finale.
# =============================================================================
FROM node:20-alpine AS front

WORKDIR /front

# On copie d'abord les fichiers de dépendances : Docker peut ainsi réutiliser
# son cache et éviter de réinstaller les paquets à chaque modification du code.
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install --no-audit --no-fund

COPY frontend/ ./
RUN npx ng build

# =============================================================================
# Étape 2 : image finale Python qui sert l'API ET le front compilé
# =============================================================================
FROM python:3.12-slim AS final

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./

# Récupération du front compilé à l'étape précédente.
# FastAPI sert automatiquement ce dossier (voir app/main.py).
COPY --from=front /front/dist ./static

# Render fournit le port à écouter dans la variable d'environnement PORT.
ENV PORT=8000
EXPOSE 8000

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
