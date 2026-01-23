# Review Kit Deployment Guide

## Architecture Overview

```
                    ┌─────────────────────────────────────────────┐
                    │              INTERNET                        │
                    └─────────────────────────────────────────────┘
                                        │
                                        ▼
                    ┌─────────────────────────────────────────────┐
                    │           NGINX (Port 80/443)                │
                    │         Reverse Proxy + SSL                  │
                    └─────────────────────────────────────────────┘
                           │                        │
                           ▼                        ▼
              ┌────────────────────┐    ┌────────────────────┐
              │   FRONTEND         │    │   BACKEND          │
              │   (Port 8080)      │    │   (Port 8000)      │
              │                    │    │                    │
              │   React + Vite     │    │   FastAPI          │
              │   Served by Nginx  │    │   Uvicorn          │
              └────────────────────┘    └────────────────────┘
                                                 │
                                                 ▼
                                        ┌────────────────────┐
                                        │   SUPABASE         │
                                        │   (External)       │
                                        └────────────────────┘
```

**Routing:**
- `https://your-domain.com/*` → Frontend (React SPA)
- `https://your-domain.com/api/*` → Backend (FastAPI)

---

## Option 1: DigitalOcean Droplet (Recommended for docker-compose)

### Step 1: Create a Droplet

1. Go to [DigitalOcean](https://cloud.digitalocean.com/)
2. Create → Droplets
3. Choose:
   - **Image**: Ubuntu 22.04 LTS
   - **Plan**: Basic, $6/mo (1GB RAM) or $12/mo (2GB RAM recommended)
   - **Region**: Choose closest to your users
   - **Authentication**: SSH Key (recommended) or Password

### Step 2: Initial Server Setup

SSH into your droplet:
```bash
ssh root@your-droplet-ip
```

Install Docker and Docker Compose:
```bash
# Update system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
apt install docker-compose-plugin -y

# Verify installation
docker --version
docker compose version
```

### Step 3: Clone Your Repository

```bash
# Install git if needed
apt install git -y

# Clone your repo
cd /opt
git clone https://github.com/YOUR_USERNAME/Review-Kit-2.0.git review-kit
cd review-kit
```

### Step 4: Configure Environment Variables

```bash
# Copy example env file
cp .env.example .env

# Edit with your values
nano .env
```

Fill in all the required values:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key
JWT_SECRET_KEY=your-super-secret-key
GEMINI_API_KEY=your-gemini-key
APIFY_API_KEY=your-apify-key
VITE_API_URL=/api
```

### Step 5: Build and Run

```bash
# Build and start all containers
docker compose up -d --build

# Check status
docker compose ps

# View logs
docker compose logs -f
```

### Step 6: Setup Domain & SSL (Optional but Recommended)

1. Point your domain's A record to your Droplet IP
2. Install Certbot:
```bash
apt install certbot -y

# Get SSL certificate
certbot certonly --standalone -d your-domain.com

# Copy certs to nginx ssl directory
cp /etc/letsencrypt/live/your-domain.com/fullchain.pem /opt/review-kit/nginx/ssl/
cp /etc/letsencrypt/live/your-domain.com/privkey.pem /opt/review-kit/nginx/ssl/
```

3. Update `nginx/nginx.conf` - uncomment the HTTPS server block and update `server_name`

4. Restart nginx:
```bash
docker compose restart nginx
```

### Useful Commands

```bash
# Stop all containers
docker compose down

# Rebuild and restart
docker compose up -d --build

# View logs for specific service
docker compose logs -f backend
docker compose logs -f frontend

# Shell into container
docker compose exec backend sh
docker compose exec frontend sh

# Update from git and redeploy
cd /opt/review-kit
git pull
docker compose up -d --build
```

---

## Option 2: DigitalOcean App Platform

**Note:** App Platform doesn't support docker-compose. You'll configure services separately.

### Step 1: Prepare Repository

Ensure your GitHub repo has:
- `/Dockerfile` (frontend)
- `/review-kit-backend/Dockerfile` (backend)

### Step 2: Create App in DigitalOcean

1. Go to [DigitalOcean App Platform](https://cloud.digitalocean.com/apps)
2. Click "Create App"
3. Connect your GitHub account
4. Select your repository

### Step 3: Configure Services

You'll need to configure **2 services**:

#### Service 1: Backend (API)
- **Name**: `api`
- **Source Directory**: `/review-kit-backend`
- **Type**: Web Service
- **HTTP Port**: 8000
- **HTTP Route**: `/api`
- **Environment Variables**:
  ```
  SUPABASE_URL=...
  SUPABASE_ANON_KEY=...
  SUPABASE_SERVICE_KEY=...
  JWT_SECRET_KEY=...
  GEMINI_API_KEY=...
  APIFY_API_KEY=...
  CORS_ORIGINS=*
  ```

#### Service 2: Frontend
- **Name**: `web`
- **Source Directory**: `/`
- **Type**: Web Service
- **HTTP Port**: 8080
- **HTTP Route**: `/`
- **Build Args**:
  ```
  VITE_API_URL=/api
  ```

### Step 4: Deploy

Click "Create Resources" and wait for deployment.

App Platform will:
- Build both services from Dockerfiles
- Route `/api/*` to backend
- Route `/*` to frontend
- Provide automatic HTTPS
- Handle load balancing

---

## Option 3: Manual VPS Setup (Any Provider)

Works on AWS EC2, Google Cloud, Linode, Vultr, etc.

### Requirements
- Ubuntu 20.04+ or Debian 11+
- 1GB+ RAM
- Docker & Docker Compose installed

### Steps

```bash
# 1. Clone repo
git clone https://github.com/YOUR_USERNAME/Review-Kit-2.0.git
cd Review-Kit-2.0

# 2. Configure environment
cp .env.example .env
nano .env  # Fill in your values

# 3. Build and run
docker compose up -d --build

# 4. Verify
curl http://localhost/health
curl http://localhost/api/docs
```

---

## Quick Reference

### Local Development (without Docker)

```bash
# Terminal 1 - Backend
cd review-kit-backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Terminal 2 - Frontend
npm install
npm run dev
```

### Local Development (with Docker)

```bash
# Build and run
docker compose up -d --build

# Access
# Frontend: http://localhost
# Backend API: http://localhost/api
# API Docs: http://localhost/api/docs
```

### Production Deployment Checklist

- [ ] Set strong `JWT_SECRET_KEY` (generate: `openssl rand -hex 32`)
- [ ] Configure proper `CORS_ORIGINS` (not `*` in production)
- [ ] Setup SSL/HTTPS
- [ ] Configure firewall (allow only 80, 443, 22)
- [ ] Setup automated backups
- [ ] Configure monitoring/alerts
- [ ] Set `VITE_API_URL` to your production domain

---

## Troubleshooting

### Container won't start
```bash
docker compose logs backend  # Check specific service logs
```

### Port already in use
```bash
# Find what's using port 80
lsof -i :80
# Kill it or change port in docker-compose.yml
```

### Database connection issues
- Verify Supabase credentials in `.env`
- Check Supabase dashboard for connection limits

### Frontend can't reach backend
- Verify `VITE_API_URL` is set correctly
- Check nginx logs: `docker compose logs nginx`
- Ensure backend is healthy: `curl http://localhost/api/docs`

### SSL certificate issues
- Ensure domain DNS is pointing to your server
- Check certbot logs: `/var/log/letsencrypt/letsencrypt.log`
