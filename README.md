# 📞 Sigma Cloud Neppo Integration

## 📋 Overview

Sigma Cloud Neppo Integration is a multi-stage data pipeline that collects, processes, and dispatches satisfaction surveys via WhatsApp using the Neppo platform. It integrates with both Sigma Cloud (via REST API) and Query Gateway (for desktop service orders) to pull recent service order data and send user-specific satisfaction messages automatically.

The system supports phone normalization, filters invalid or irrelevant records, and tracks message delivery status for further auditing or retries. It ensures that both cloud-based and desktop-based service orders are processed uniformly, enhancing service quality feedback collection.

### 🎯 Objectives

- Automate the extraction of recent service orders from Sigma Cloud and desktop environments
- Normalize and validate client phone numbers for messaging compatibility
- Store satisfaction survey records for both cloud and desktop sources in a centralized database
- Dispatch WhatsApp messages via Neppo using dynamic message templates
- Track message delivery status and handle errors with retry support
- Reduce manual oversight by providing a resilient and unified survey delivery pipeline
- Integrate with existing systems using Query Gateway for secure, structured data access

--- 

## 📦 Quick Start

### ⚠️ Prerequisites 

- [**Node.js**](https://nodejs.org/) ≥ `20.14.0` — _JavaScript runtime environment_
- [**MySQL**](https://www.mysql.com/) ≥ `8.0` — _Relational database_
- [**Query Gateway**](https://github.com/gabrielmendezsoares/query-gateway) ≥ `3.0.2` — _Configurable data query service_

### ⚙️ Setup 

```bash 
# Clone & navigate
git clone <repository-url> && cd sigma-cloud-neppo-integration

# Configure environment
cp .env.example .env  # Edit with your settings

# Install dependencies (auto-runs database setup)
npm install
```

> **💡 Database:** Import `storage.sql.example` before running `npm install`

---

## ⚡ Usage

### 🛠️ Development

```bash
npm run start:development
```

### 🏗️ Production

```bash
npm run build && npm run start:production
```

---

## 📚 Command Reference

### 🧰 Core

| Command | Description |
| ------- | ----------- |
| `npm run start:development` | _Start the application in development_ |
| `npm run start:production` | _Start the application in production_ |
| `npm run build` | _Build the application for production_ |
| `npm run build:watch` | _Build the application with watch mode_ |
| `npm run clean` | _Clean application build artifacts_ |
 
### 🛢️ Database

| Command | Description |
| ------- | ----------- |
| `npm run db:pull` | _Pull database schema into Prisma across all schemas_ |
| `npm run db:push` | _Push Prisma schema to the database across all schemas_ |
| `npm run db:generate` | _Generate Prisma Client for all schemas_ |
| `npm run db:migrate:dev` | _Run development migrations across all schemas_ |
| `npm run db:migrate:deploy` | _Deploy migrations to production across all schemas_ |
| `npm run db:studio` | _Open Prisma Studio (GUI) across all schemas_ |
| `npm run db:reset` | _Reset database (pull + generate) for all schemas_ |

### 🐳 Docker 

| Command | Description |
| ------- | ----------- |
| `npm run docker:build:development` | _Build Docker image for development_ |
| `npm run docker:build:production` | _Build Docker image for production_ |
| `npm run docker:run:development` | _Run development Docker container_ |
| `npm run docker:run:production` | _Run production Docker container_ |
| `npm run docker:compose:up:development` | _Start Docker Compose in development_ |
| `npm run docker:compose:up:production` | _Start Docker Compose in production_ |
| `npm run docker:compose:up:build:development` | _Start & rebuild Docker Compose in development_ |
| `npm run docker:compose:up:build:production` | _Start & rebuild Docker Compose in production_ |
| `npm run docker:compose:down` | _Stop Docker Compose services_ |
| `npm run docker:compose:logs` | _View Docker Compose logs_ |
| `npm run docker:prune` | _Clean up unused Docker resources_ |

### 🧪 Testing

| Command | Description |
| ------- | ----------- |
| `npm test` | _Run all tests once_ |
| `npm run test:watch` | _Run tests in watch mode_ |
| `npm run test:coverage` | _Run tests and generate a coverage report_ |
   