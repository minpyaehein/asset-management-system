# Asset Management System

A full-stack asset management application built with **Next.js**, **NestJS**, **TypeORM**, and **PostgreSQL**. It provides a central place to manage organizational assets and related workflows.

## Features

The application includes modules for:

- Asset inventory and employee records
- Asset check-in/check-out and transfers
- Asset acknowledgements and disposals
- Maintenance and service desk workflows
- Software management
- User, role, and authentication management
- Dashboard, reports, notifications, and audit logs

## Tech stack

- **Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS
- **Backend:** NestJS 12, TypeScript, TypeORM
- **Database:** PostgreSQL

## Repository structure

```text
.
├── backend/   # NestJS API
└── frontend/  # Next.js web application
```

## Prerequisites

- Node.js and npm
- PostgreSQL

## Getting started

### 1. Clone the repository

```bash
git clone https://github.com/minpyaehein/asset-management-system.git
cd asset-management-system
```

### 2. Configure PostgreSQL and the backend

Create a PostgreSQL database (the default name is `asset_management`), then configure the backend environment:

```bash
cd backend
npm install
cp .env.example .env
```

Update `.env` with your local PostgreSQL credentials and frontend URL. The backend reads the database name from `DB_NAME`; make sure `.env` defines `DB_NAME=asset_management` (the example file currently uses `DB_DATABASE`). The default backend port is `3001`.

The API uses TypeORM with schema synchronization disabled. Set up the database schema required by the application before starting the API; do not rely on TypeORM to create or alter tables automatically.

Start the backend in development mode:

```bash
npm run start:dev
```

### 3. Start the frontend

In a second terminal, from the repository root:

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. The backend is configured to run at [http://localhost:3001](http://localhost:3001) by default.

## Useful commands

Run these from the corresponding `backend/` or `frontend/` directory.

### Backend

```bash
npm run start:dev  # Start NestJS with watch mode
npm run build      # Build the API
npm run test       # Run unit tests
npm run test:e2e   # Run end-to-end tests
npm run lint       # Lint backend source and tests
```

### Frontend

```bash
npm run dev    # Start Next.js in development mode
npm run build  # Build the frontend
npm run start  # Serve the production build
npm run lint   # Lint frontend source
```

## Configuration

Backend settings are read from `backend/.env`:

| Variable | Description | Default |
| --- | --- | --- |
| `PORT` | API listening port | `3001` |
| `DB_HOST` | PostgreSQL host | `localhost` |
| `DB_PORT` | PostgreSQL port | `5432` |
| `DB_USERNAME` | PostgreSQL username | `postgres` |
| `DB_PASSWORD` | PostgreSQL password | — |
| `DB_NAME` | PostgreSQL database name | `asset_management` |
| `FRONTEND_URL` | Allowed frontend origin | `http://localhost:3000` |

Never commit real credentials or other secrets. The frontend and backend are separate applications and each has its own `package.json` and dependencies.

## Contributing

Contributions and bug reports are welcome. For changes, please open an issue or pull request with a clear description of the proposed change.
