FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libpq-dev && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY Interfaz /app

RUN pip install --no-cache-dir \
    django djangorestframework django-cors-headers \
    psycopg2-binary gunicorn

EXPOSE 8000
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]