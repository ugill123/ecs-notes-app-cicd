# EKS Deployment Guide

Manual deployment guide for running the Notes App on Amazon EKS.

## Prerequisites

- **kubectl** — Kubernetes CLI installed and configured
- **AWS CLI v2** — Authenticated with access to your AWS account
- **kubeconfig** — Configured for your EKS cluster:
  ```bash
  aws eks update-kubeconfig --name <your-cluster-name> --region us-east-1
  ```
- **EKS Cluster** — Running with EC2/self-managed worker nodes
- **ECR Image** — At least one image pushed to `notes-app-shared` repository

## IAM Requirements

EKS worker nodes must have an IAM role with these permissions to pull images from ECR:

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

> **Note:** No `imagePullSecrets` are needed in the Deployment when worker node IAM roles have these permissions. The kubelet authenticates to ECR using the node's instance profile.

## Configuration

Before deploying, update the placeholder values in the manifests:

### k8s/configmap.yaml

Replace these placeholders with your actual values:
- `<your-rds-endpoint>` — Your RDS PostgreSQL endpoint
- `<your-db-name>` — Database name
- `<your-db-user>` — Database username

### k8s/secret.yaml

Encode your database password in base64 and replace the placeholder:
```bash
echo -n "your-actual-password" | base64
```

### k8s/deployment.yaml

Replace `<account-id>` with your AWS account ID in the image reference:
```
<account-id>.dkr.ecr.us-east-1.amazonaws.com/notes-app-shared:latest
```

## Deploy

Apply manifests in this order:

```bash
# 1. Create the namespace
kubectl apply -f k8s/namespace.yaml

# 2. Create configuration (must exist before pods reference them)
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret.yaml

# 3. Create the deployment (pods start and pull config/secrets)
kubectl apply -f k8s/deployment.yaml

# 4. Expose via LoadBalancer
kubectl apply -f k8s/service.yaml
```

Or apply everything at once:
```bash
kubectl apply -f k8s/
```

## Verify Deployment

### Check pod status
```bash
kubectl get pods -n notes-app-dev
```

All pods should show `Running` status with `2/2` ready containers.

### Check service endpoint
```bash
kubectl get svc notes-app-service -n notes-app-dev
```

Wait for the `EXTERNAL-IP` field to populate (may take 2-3 minutes for the NLB to provision).

### Test health endpoint
```bash
curl http://<EXTERNAL-IP>/health
```

Expected response: `200 OK`

### Check logs
```bash
kubectl logs -l app=notes-app -n notes-app-dev --tail=50
```

## Update Image

To deploy a new version of the application:

```bash
kubectl set image deployment/notes-app \
  notes-app=<account-id>.dkr.ecr.us-east-1.amazonaws.com/notes-app-shared:<new-tag> \
  -n notes-app-dev
```

Monitor the rollout:
```bash
kubectl rollout status deployment/notes-app -n notes-app-dev
```

## Rollback

To revert to the previous version:

```bash
kubectl rollout undo deployment/notes-app -n notes-app-dev
```

Check rollout history:
```bash
kubectl rollout history deployment/notes-app -n notes-app-dev
```

## Troubleshooting

### Pods stuck in ImagePullBackOff
- Verify worker node IAM role has ECR permissions listed above
- Confirm the image tag exists in ECR: `aws ecr describe-images --repository-name notes-app-shared`

### Pods in CrashLoopBackOff
- Check logs: `kubectl logs <pod-name> -n notes-app-dev`
- Verify ConfigMap/Secret values are correct (DB connection details)
- Confirm RDS security group allows inbound from EKS worker node IPs

### LoadBalancer has no external IP
- Verify your EKS cluster has the AWS cloud controller properly configured
- Check service events: `kubectl describe svc notes-app-service -n notes-app-dev`
