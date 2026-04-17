# MealCraft API

Backend API for MealCraft, built with Express and MySQL.  
This service handles authentication, recipe discovery, group ordering, and fridge ingredient management for the app.

## What This Project Includes

- JWT-based user authentication (`register`, `login`)
- Recipe feeds and recipe detail endpoints
- Personalized and fridge-based recipe matching
- Group meal ordering flows (create, join, leave, view)
- Fridge inventory endpoints per user

## Tech Stack

- Node.js
- Express
- MySQL (`mysql2/promise`)
- JWT (`jsonwebtoken`)
- Password hashing (`bcrypt`)

## Project Structure

- `mealcraft-backend/index.js` - bootstraps app and tests DB connection
- `mealcraft-backend/src/app.js` - Express app setup and route mounting
- `mealcraft-backend/src/config/db.js` - MySQL pool + connection test
- `mealcraft-backend/src/middleware/auth.js` - JWT auth middleware
- `mealcraft-backend/src/routes/` - feature route modules

## Prerequisites

- Node.js 18+ recommended
- MySQL server
- A MySQL database with the expected tables used by routes

## Getting Started

1. Install dependencies:

```bash
cd mealcraft-backend
npm install
```

2. Create a `.env` file in `mealcraft-backend/`:

```env
PORT=3000
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=your_db_name
JWT_SECRET=your_strong_secret
```

3. Start the server:

```bash
npm run dev
```

4. Confirm API health:

```bash
curl http://localhost:3000/health
```

Expected response:

```json
{ "status": "ok" }
```

## Available Scripts

Run these inside `mealcraft-backend/`:

- `npm start` - start server with Node
- `npm run dev` - start with Nodemon (auto-reload)
- `npm test` - placeholder test script

## Authentication

Most endpoints require:

`Authorization: Bearer <token>`

Get the token from `POST /api/auth/login`.

## API Routes

Base URL: `http://localhost:3000`

### Health

- `GET /health`

### Auth (`/api/auth`)

- `POST /register`
- `POST /login`

### Recipes (`/api/recipes`) - requires auth

- `GET /` - latest recipe feed
- `GET /recommended` - based on user preferences
- `GET /matching` - recipes that match fridge items
- `GET /category/:category` - recipes by category
- `POST /save` - save recipe to user cookbook
- `DELETE /save/:recipe_id` - remove saved recipe
- `GET /:recipe_id` - full recipe detail

### Group Orders (`/api/group`) - requires auth

- `GET /nearby?latitude=<lat>&longitude=<lng>` - nearby open groups
- `POST /create` - create a new group
- `POST /:group_id/join` - join a group
- `DELETE /:group_id/leave` - leave a group
- `GET /:group_id/messages` - group chat messages
- `GET /:group_id` - group details + members

### Fridge (`/api/fridge`) - requires auth

- `GET /` - get user's fridge ingredients
- `GET /all` - all available ingredients
- `POST /` - add ingredient to fridge
- `DELETE /clear` - clear all ingredients
- `DELETE /:ingredient_id` - remove one ingredient

## Notes

- The server starts even if DB connection fails, but logs the error.
- Ensure `JWT_SECRET` is set, or protected routes will fail token validation.
- Route logic assumes existing MySQL tables (for example: `User`, `Recipe`, `Ingredient`, `UserFridge`, `GroupOrder`).
