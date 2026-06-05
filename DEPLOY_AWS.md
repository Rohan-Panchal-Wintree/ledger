# AWS Deployment Guide

## Recommended Setup

Use the simplest production path for this repo:

- Backend: Docker image on AWS App Runner
- Frontend: Static site on AWS Amplify Hosting
- Database: keep existing MongoDB Atlas connection
- Redis: keep existing external Redis connection
- File storage: existing S3 bucket

This keeps operations light while still being production-friendly.

## What Was Added

- `backend/Dockerfile`
- `frontend/Dockerfile`
- `frontend/nginx.conf`
- `docker-compose.yml`
- per-app `.dockerignore`

## Local Docker Test

From repo root:

```bash
docker compose up --build
```
