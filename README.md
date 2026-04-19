# Cloud Notes

A simple note-taking web application built with Node.js, Express, and Sequelize. Dockerized and ready to deploy on Amazon ECS Fargate.

---

## Tech Stack

- **Backend:** Node.js, Express, Sequelize ORM
- **Database:** PostgreSQL (external, e.g., Amazon RDS)
- **Frontend:** Vanilla JS with Tailwind CSS
- **Container:** Docker (Alpine-based, multi-stage build)

---

## Project Structure

```
├── server.js          # Express server and API routes
├── db-sync.js         # One-off database migration script
├── package.json       # Dependencies and scripts
├── Dockerfile         # Multi-stage production Docker image
├── .dockerignore      # Files excluded from Docker build
├── .gitignore         # Files excluded from Git
└── public/
    └── index.html     # Frontend UI
```

---

## Environment Variables

All configuration is injected via environment variables (12-Factor compliant). No credentials are hardcoded.

| Variable      | Required | Description                          | Default |
|---------------|----------|--------------------------------------|---------|
| `DB_HOST`     | Yes      | PostgreSQL host                      | —       |
| `DB_USER`     | Yes      | Database username                    | —       |
| `DB_PASSWORD` | Yes      | Database password                    | —       |
| `DB_NAME`     | Yes      | Database name                        | —       |
| `DB_PORT`     | No       | Database port                        | `5432`  |
| `DB_SSL`      | No       | Set to `false` to disable SSL        | `true`  |
| `PORT`        | No       | Port the server listens on           | `3000`  |

---

## Running Locally with Docker Compose

Create a `.env` file in the project root (this file is git-ignored):

```env
DB_HOST=db
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=notes
DB_SSL=false
```

Create a `docker-compose.yml`:

```yaml
version: "3.8"
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: notes
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  app:
    build: .
    ports:
      - "3000:3000"
    env_file:
      - .env
    depends_on:
      - db

volumes:
  pgdata:
```

Then run:

```bash
docker compose up --build
```

The app will be available at `http://localhost:3000`.

---

## Database Migrations

Run the migration script as a one-off command before deploying a new version:

```bash
# Locally
docker compose run --rm app node db-sync.js

# On ECS (run as a standalone task with the same env vars)
aws ecs run-task --cluster your-cluster --task-definition your-db-sync-task
```

---

## Building and Pushing the Docker Image

```bash
# Build
docker build -t cloud-notes-app .

# Tag for ECR
docker tag cloud-notes-app:latest <account-id>.dkr.ecr.<region>.amazonaws.com/cloud-notes-app:latest

# Push
docker push <account-id>.dkr.ecr.<region>.amazonaws.com/cloud-notes-app:latest
```

---

## Deploying to ECS Fargate

1. Push the image to Amazon ECR.
2. Create an ECS Task Definition referencing the image, with the `DB_*` environment variables sourced from AWS Secrets Manager or SSM Parameter Store.
3. Run `db-sync.js` as a one-off ECS RunTask for migrations.
4. Create an ECS Service behind an Application Load Balancer, using `/health` as the health check path.

---

## API Endpoints

| Method   | Path             | Description        |
|----------|------------------|--------------------|
| `GET`    | `/`              | Serves the frontend |
| `GET`    | `/health`        | Health check        |
| `GET`    | `/api/notes`     | List all notes      |
| `POST`   | `/api/notes`     | Create a note       |
| `DELETE`  | `/api/notes/:id` | Delete a note       |

---

## License

MIT
