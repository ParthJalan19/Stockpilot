# StockPilot Deployment Guide

This guide details the step-by-step procedure to deploy the entire **StockPilot** system on **GitHub**, **Render** (for the Node.js API), and **Netlify** (for the static landing website and frontend application pages).

---

## Part 1: Push Code to GitHub

I have already initialized Git locally and created the commits for you. To push it online:

1. Go to [GitHub](https://github.com) and sign in.
2. Click **New Repository**.
3. Name it `StockPilot` (choose Public or Private). **Do not** check "Initialize this repository with a README".
4. Copy the remote URL commands from GitHub.
5. In your terminal at `d:\StockPilot`, execute:
   ```bash
   # Add the remote repository
   git remote add origin <your-github-repo-url>
   
   # Rename default branch to main and push
   git branch -M main
   git push -u origin main
   ```

---

## Part 2: Deploy Backend to Render

[Render](https://render.com) is perfect for running the Node.js API server and managing database cluster connections.

1. Sign in to [Render Console](https://dashboard.render.com).
2. Click **New** -> **Web Service**.
3. Link your GitHub account and select the **StockPilot** repository.
4. Configure the Web Service settings:
   - **Name**: `stockpilot-api`
   - **Environment**: `Node`
   - **Region**: (Choose closest to your users)
   - **Branch**: `main`
   - **Root Directory**: (Leave blank)
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. Under **Advanced / Environment Variables**, add the variables from your local `.env`:
   - `PORT`: `5000`
   - `MONGODB_URI`: `mongodb://parthjalan73_db_user:UKwTGelisTfnMhTy@ac-zzpvoga-shard-00-00.lfdphlb.mongodb.net:27017,ac-zzpvoga-shard-00-01.lfdphlb.mongodb.net:27017,ac-zzpvoga-shard-00-02.lfdphlb.mongodb.net:27017/stockpilot?ssl=true&authSource=admin&retryWrites=true&w=majority`
   - `JWT_SECRET`: `stockpilot_secret_access_key_2026_nexovian`
   - `JWT_REFRESH_SECRET`: `stockpilot_secret_refresh_key_2026_nexovian`
   - `JWT_ACCESS_EXPIRY`: `15m`
   - `JWT_REFRESH_EXPIRY`: `7d`
   - `NODE_ENV`: `production`
6. Click **Create Web Service**. 
7. Once deployed, note down your Render Web Service URL (e.g., `https://stockpilot-api.onrender.com`).

---

## Part 3: Deploy Frontend to Netlify

[Netlify](https://netlify.com) serves static pages (HTML, CSS, assets) from an ultra-fast global CDN. 

### Step 1: Update Proxy Address
1. Open [`netlify.toml`](file:///d:/StockPilot/netlify.toml) in the project root.
2. In the last redirect rule, replace the placeholder URL with your **Render Web Service URL** obtained in Part 2:
   ```toml
   # FROM THIS:
   [[redirects]]
     from = "/api/*"
     to = "https://your-render-backend-url.onrender.com/api/:splat"
     status = 200
     force = true

   # TO THIS (Example):
   [[redirects]]
     from = "/api/*"
     to = "https://stockpilot-api.onrender.com/api/:splat"
     status = 200
     force = true
   ```
3. Commit and push this change to GitHub:
   ```bash
   git add netlify.toml
   git commit -m "Update API proxy redirect URL to Render"
   git push origin main
   ```

### Step 2: Configure Netlify Web App
1. Sign in to your [Netlify Dashboard](https://app.netlify.com).
2. Click **Add new site** -> **Import from Git**.
3. Choose **GitHub** and authorize, selecting the **StockPilot** repository.
4. Configure Build settings:
   - **Branch**: `main`
   - **Base directory**: (Leave blank)
   - **Build command**: (Leave blank / No build command required)
   - **Publish directory**: `frontend` (This serves the assets folder, app templates, and landing pages)
5. Click **Deploy Site**.
6. Once deployed, Netlify will generate a custom subdomain (e.g. `https://smart-stockpilot.netlify.app`).

### Why this architecture is premium:
* **No CORS Issues**: The Netlify proxy transparently redirects frontend `/api` requests to Render, making it look like a unified domain.
* **Asset Loading Speed**: Front-end JS controllers, styles, images, and HTML load instantly via Netlify CDN without waiting for Render's Node.js instance to wake up.
