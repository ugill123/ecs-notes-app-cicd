# Design Document

## Introduction

This document describes the architecture and implementation design for deploying the Notes App to Amazon EKS using plain Kubernetes YAML manifests. The design reuses the existing multi-stage Docker image from ECR and introduces a `k8s/` directory containing all Kubernetes resource definitions. Deployment is manual via `kubectl` with no changes to the existing CI/CD pipeline.

## Architecture Overview

The EKS deployment follows a standard Kubernetes resource model:

```
┌─────────────────────────────────────────────────────────────┐
│  EKS Cluster                                                │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Namespace: notes-app-dev                           │    │
│  │                                                     │    │
│  │  ┌──────────────┐     ┌──────────────────────────┐  │    │
│  │  │  Service      │────▶│  Deployment (2 replicas) │  │    │
│  │  │  (LoadBalancer│     │  ┌────────┐ ┌────────┐   │  │    │
│  │  │   :80)        │     │  │ Pod 1  │ │ Pod 2  │   │  │    │
│  │  └──────────────┘     │  └────────┘ └────────┘   │  │    │
│  │                        └──────────────────────────┘  │    │
│  │  ┌──────────────┐     ┌──────────────┐              │    │
│  │  │  ConfigMap    │     │    Secret    │              │    │
│  │  │  (DB config)  │     │ (DB_PASSWORD)│              │    │
│  │  └──────────────┘     └──────────────┘              │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  Worker Nodes (IAM Role with ECR pull permissions)          │
└─────────────────────────────────────────────────────────────┘
         │
         │ pulls image
         ▼
┌─────────────────────┐
│  ECR Repository     │
│  notes-app-shared   │
└─────────────────────┘
         │
         │ connects to
         ▼
┌─────────────────────┐
│  RDS PostgreSQL     │
│  (dev environment)  │
└─────────────────────┘
```

Traffic flows from the internet through the AWS Network Load Balancer (provisioned by the LoadBalancer Service) to pods on port 3000. Pods pull the container image from ECR using IAM roles attached to worker nodes. Application configuration is injected from ConfigMap and Secret resources.

## Directory Structure

```
project-root/
├── k8s/
│   ├── namespace.yaml        # Namespace definition
│   ├── configmap.yaml        # Non-sensitive env vars (placeholder values)
│   ├── secret.yaml           # DB_PASSWORD (base64 placeholder)
│   ├── deployment.yaml       # Deployment with 2 replicas
│   └── service.yaml          # LoadBalancer Service
├── Dockerfile                # Existing multi-stage build (unchanged)
├── server.js                 # Application entry point (unchanged)
└── ...
```

All Kubernetes manifests are stored in the `k8s/` directory at the project root. Each resource gets its own file for clarity and to allow selective application.

## Components

### Namespace (namespace.yaml)

Defines the `notes-app-dev` namespace for logical isolation of dev workloads.

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: notes-app-dev
  labels:
    app: notes-app
    environment: dev
```

### ConfigMap (configmap.yaml)

Stores non-sensitive database and application configuration as environment variables. Values are placeholders that operators replace before applying.

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: notes-app-config
  namespace: notes-app-dev
  labels:
    app: notes-app
    environment: dev
data:
  DB_HOST: "<your-rds-endpoint>"
  DB_PORT: "5432"
  DB_NAME: "<your-db-name>"
  DB_USER: "<your-db-user>"
  DB_SSL: "true"
  PORT: "3000"
```

### Secret (secret.yaml)

Stores the database password as a base64-encoded value. Operators must encode their password before applying.

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: notes-app-secret
  namespace: notes-app-dev
  labels:
    app: notes-app
    environment: dev
type: Opaque
data:
  DB_PASSWORD: <base64-encoded-password>
```

### Deployment (deployment.yaml)

Manages pod replicas running the Notes App container. Key design decisions:

- **Replicas**: 2 for basic availability
- **Image**: References the shared ECR repository; tag is updated per deployment
- **Security**: `runAsNonRoot: true` matching the Dockerfile's non-root user
- **Resources**: Conservative requests/limits appropriate for a lightweight Node.js app
- **Probes**: Liveness and readiness probes on `/health` with staggered timing

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: notes-app
  namespace: notes-app-dev
  labels:
    app: notes-app
    environment: dev
spec:
  replicas: 2
  selector:
    matchLabels:
      app: notes-app
  template:
    metadata:
      labels:
        app: notes-app
        environment: dev
    spec:
      containers:
        - name: notes-app
          image: <account-id>.dkr.ecr.us-east-1.amazonaws.com/notes-app-shared:latest
          ports:
            - containerPort: 3000
              protocol: TCP
          envFrom:
            - configMapRef:
                name: notes-app-config
          env:
            - name: DB_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: notes-app-secret
                  key: DB_PASSWORD
          resources:
            requests:
              cpu: "128m"
              memory: "256Mi"
            limits:
              cpu: "512m"
              memory: "512Mi"
          livenessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 10
            periodSeconds: 30
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 10
            failureThreshold: 3
          securityContext:
            runAsNonRoot: true
      restartPolicy: Always
```

### Service (service.yaml)

Exposes the deployment externally via an AWS Network Load Balancer.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: notes-app-service
  namespace: notes-app-dev
  labels:
    app: notes-app
    environment: dev
spec:
  type: LoadBalancer
  selector:
    app: notes-app
  ports:
    - protocol: TCP
      port: 80
      targetPort: 3000
```

## Interfaces

### External Access

| Interface | Protocol | Port | Description |
|-----------|----------|------|-------------|
| LoadBalancer → Pod | TCP | 80 → 3000 | External HTTP traffic routed to app containers |
| Pod → RDS | TCP | 5432 | Database connections from app to PostgreSQL |
| Worker Node → ECR | HTTPS | 443 | Container image pulls via IAM authentication |

### Environment Variables

The container receives the following environment variables:

| Variable | Source | Description |
|----------|--------|-------------|
| DB_HOST | ConfigMap | RDS PostgreSQL endpoint |
| DB_PORT | ConfigMap | Database port (5432) |
| DB_NAME | ConfigMap | Database name |
| DB_USER | ConfigMap | Database username |
| DB_SSL | ConfigMap | SSL mode flag |
| PORT | ConfigMap | Application listen port (3000) |
| DB_PASSWORD | Secret | Database password |

### Health Check Endpoints

| Probe | Path | Port | Initial Delay | Period | Failure Threshold |
|-------|------|------|---------------|--------|-------------------|
| Liveness | /health | 3000 | 10s | 30s | 3 |
| Readiness | /health | 3000 | 5s | 10s | 3 |

## Data Models

No new data models are introduced. The application connects to the same PostgreSQL database using the existing Sequelize `Note` model. Configuration data is structured as Kubernetes ConfigMap key-value pairs and Secret data entries.

### Resource Specifications

| Resource | CPU Request | CPU Limit | Memory Request | Memory Limit |
|----------|-------------|-----------|----------------|--------------|
| notes-app container | 128m | 512m | 256Mi | 512Mi |

These values are sized for a lightweight Node.js Express application in a dev environment. They can be tuned based on observed usage.

## Error Handling

### Pod Failure Recovery

- **Liveness probe failure**: After 3 consecutive failures (90s total at 30s intervals), Kubernetes restarts the pod automatically
- **Readiness probe failure**: After 3 consecutive failures (30s total at 10s intervals), the pod is removed from Service endpoints; traffic stops routing to it
- **Pod crash**: Kubernetes `restartPolicy: Always` ensures crashed containers are restarted with exponential backoff

### Image Pull Failures

- If IAM permissions are misconfigured, pods enter `ImagePullBackOff` state
- Resolution: Verify worker node IAM role has `ecr:GetDownloadUrlForLayer`, `ecr:BatchGetImage`, and `ecr:GetAuthorizationToken` permissions

### Database Connection Failures

- The application exits with code 1 if it cannot connect to the database on startup (existing behavior in `server.js`)
- The liveness probe will detect the failed state and trigger a restart
- Operators should verify ConfigMap/Secret values and RDS security group rules

### Deployment Rollback

- `kubectl rollout undo deployment/notes-app -n notes-app-dev` reverts to the previous ReplicaSet
- Kubernetes maintains revision history for rollback capability

## IAM Requirements

EKS worker nodes must have an IAM role with the following policy permissions for ECR image pulls:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
        "ecr:GetAuthorizationToken"
      ],
      "Resource": "*"
    }
  ]
}
```

No `imagePullSecrets` are needed in the Deployment when worker nodes have these permissions, as the kubelet authenticates to ECR using the node's instance profile.

## Manual Deployment Workflow

The deployment is performed manually using `kubectl`. The apply order matters:

1. `kubectl apply -f k8s/namespace.yaml` — Create the namespace first
2. `kubectl apply -f k8s/configmap.yaml` — Configuration must exist before pods reference it
3. `kubectl apply -f k8s/secret.yaml` — Secret must exist before pods reference it
4. `kubectl apply -f k8s/deployment.yaml` — Pods start and pull config/secrets
5. `kubectl apply -f k8s/service.yaml` — Expose pods via LoadBalancer

Alternatively, apply all at once: `kubectl apply -f k8s/`

### Image Update Workflow

```bash
kubectl set image deployment/notes-app \
  notes-app=<account-id>.dkr.ecr.us-east-1.amazonaws.com/notes-app-shared:<new-tag> \
  -n notes-app-dev
```

### Rollback Workflow

```bash
kubectl rollout undo deployment/notes-app -n notes-app-dev
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

This feature consists entirely of Infrastructure as Code (declarative Kubernetes YAML manifests) and deployment documentation. Per the PBT guidelines, IaC is not suitable for property-based testing because:

- Kubernetes manifests are declarative configuration, not functions with inputs/outputs
- There is no meaningful input variation — the YAML is static
- Behavior depends on the Kubernetes platform, not on our code logic
- The appropriate testing strategies are schema validation, smoke tests, and integration tests

No property-based tests are defined for this feature. Validation should use:
- **Smoke tests**: YAML parsing and schema validation to verify manifest structure
- **Example tests**: Cross-file consistency checks (e.g., Service selector matches Deployment labels)
- **Integration tests**: Manual verification that pods start, probes pass, and LoadBalancer provisions correctly
