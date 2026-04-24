# Cloud Notes

A simple note-taking web application built with Node.js, Express, and Sequelize. Dockerized and deployed to Amazon ECS Fargate with a 4-phase CI/CD pipeline powered by GitHub Actions.

---

## Tech Stack

- **Backend:** Node.js, Express, Sequelize ORM
- **Database:** PostgreSQL (Amazon RDS)
- **Frontend:** Vanilla JS with Tailwind CSS
- **Container:** Docker (Alpine-based, multi-stage build)
- **CI/CD:** GitHub Actions
- **Infrastructure:** AWS ECS Fargate, ECR, ALB
- **Code Quality:** ESLint, Jest
- **Security:** CodeQL static analysis

---

## Project Structure

```
├── server.js                              # Express server and API routes
├── db-sync.js                             # One-off database migration script
├── package.json                           # Dependencies and scripts
├── Dockerfile                             # Multi-stage production Docker image
├── .dockerignore                          # Files excluded from Docker build
├── .gitignore                             # Files excluded from Git
├── .eslintrc.json                         # ESLint configuration
├── .eslintignore                          # Files excluded from linting
├── __tests__/
│   └── routes.test.js                     # Unit tests for API routes
├── public/
│   └── index.html                         # Frontend UI
└── .github/workflows/
    ├── deploy.yml                         # Main CI/CD pipeline
    ├── codeql.yml                         # Security scanning workflow
    └── terraform-plan.yml                 # Infrastructure review on PRs
```

---

## CI/CD Pipeline

### Branch Strategy

Each branch deploys to its own environment. Promotion happens through pull requests:

```
dev branch  ──push──>  deploy to Dev
                │
                │  (PR: dev → staging)
                ▼
staging branch  ──push──>  deploy to Staging
                │
                │  (PR: staging → main)
                ▼
main branch  ──push──>  deploy to Production (requires approval)
```

### Pipeline Jobs (on every push)

```
quality-gate  →  build-and-push  →  deploy-{environment}
```

1. **Quality Gate** — Runs ESLint and Jest tests. If either fails, the pipeline stops.
2. **Build & Push** — Builds the Docker image, tags it with the git commit SHA, and pushes to Amazon ECR.
3. **Deploy** — Deploys to the environment matching the branch. Waits up to 5 minutes for ECS to reach steady state.

### Production Approval

The `production` GitHub Environment has a Required Reviewers protection rule. When the pipeline reaches the deploy step on `main`, it pauses and waits for a reviewer to approve in the GitHub Actions UI.

### Additional Workflows

- **CodeQL** (`codeql.yml`) — Runs on push/PR to `main`. Scans JavaScript for security vulnerabilities. Results appear in the GitHub Security tab.
- **Terraform Plan** (`terraform-plan.yml`) — Runs on PRs targeting `main`. Executes `terraform plan` and posts the output as a PR comment.

---

## Environment Variables

All configuration is injected via environment variables (12-Factor compliant).

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

## GitHub Setup

### Environments

Create three environments in Settings → Environments:
- `dev` — with `DEPLOY_ROLE_ARN` secret
- `staging` — with `DEPLOY_ROLE_ARN` secret
- `production` — with `DEPLOY_ROLE_ARN` secret and Required Reviewers enabled

### Repository Secrets

| Secret             | Description                              |
|--------------------|------------------------------------------|
| `ECR_PUSH_ROLE_ARN`| IAM role for pushing images to ECR       |

Each environment has its own `DEPLOY_ROLE_ARN` secret for deploying to that environment's AWS account.

---

## Running Locally

Create a `.env` file (git-ignored):

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

```bash
docker compose up --build
```

The app will be available at `http://localhost:3000`.

---

## Scripts

```bash
npm start        # Start the server
npm run lint     # Run ESLint
npm test         # Run Jest unit tests
node db-sync.js  # Run database migrations
```

---

## API Endpoints

| Method   | Path             | Description        |
|----------|------------------|--------------------|
| `GET`    | `/`              | Serves the frontend |
| `GET`    | `/health`        | Health check (used by ECS) |
| `GET`    | `/api/notes`     | List all notes      |
| `POST`   | `/api/notes`     | Create a note       |
| `DELETE`  | `/api/notes/:id` | Delete a note       |

---

## Health Check

The `/health` endpoint returns `{"status": "ok"}` with HTTP 200. This is used by:
- The Dockerfile `HEALTHCHECK` directive
- ECS task health checks
- ALB target group health checks

If the health check fails after deployment, ECS automatically rolls back to the previous task definition.

---

## License

MIT
