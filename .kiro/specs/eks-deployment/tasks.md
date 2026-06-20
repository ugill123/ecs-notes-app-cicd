# Implementation Plan: EKS Deployment

## Overview

Create Kubernetes YAML manifests in a `k8s/` directory and deployment documentation to enable manual deployment of the Notes App on Amazon EKS. All manifests target the `notes-app-dev` namespace and follow the architecture defined in the design document.

## Tasks

- [ ] 1. Set up k8s directory and namespace manifest
  - [ ] 1.1 Create the `k8s/` directory and `namespace.yaml`
    - Create `k8s/namespace.yaml` defining the `notes-app-dev` namespace
    - Include `app: notes-app` and `environment: dev` labels on the namespace
    - Use `apiVersion: v1` and `kind: Namespace`
    - _Requirements: 3.1_

- [ ] 2. Create configuration manifests
  - [ ] 2.1 Create `k8s/configmap.yaml`
    - Define ConfigMap named `notes-app-config` in `notes-app-dev` namespace
    - Include placeholder values for DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_SSL, and PORT
    - Add `app: notes-app` and `environment: dev` labels
    - _Requirements: 4.1, 4.5_

  - [ ] 2.2 Create `k8s/secret.yaml`
    - Define Secret named `notes-app-secret` in `notes-app-dev` namespace with type `Opaque`
    - Include DB_PASSWORD key with a base64-encoded placeholder value
    - Add `app: notes-app` and `environment: dev` labels
    - _Requirements: 4.2_

- [ ] 3. Create deployment manifest
  - [ ] 3.1 Create `k8s/deployment.yaml`
    - Define Deployment named `notes-app` with `apps/v1` API version in `notes-app-dev` namespace
    - Set replica count to 2
    - Configure container image reference as `<account-id>.dkr.ecr.us-east-1.amazonaws.com/notes-app-shared:latest`
    - Set containerPort to 3000
    - Inject environment variables from ConfigMap (`notes-app-config`) using `envFrom`
    - Inject DB_PASSWORD from Secret (`notes-app-secret`) using `valueFrom.secretKeyRef`
    - Configure liveness probe: HTTP GET `/health` port 3000, initialDelaySeconds 10, periodSeconds 30, failureThreshold 3
    - Configure readiness probe: HTTP GET `/health` port 3000, initialDelaySeconds 5, periodSeconds 10, failureThreshold 3
    - Set resource requests (cpu: 128m, memory: 256Mi) and limits (cpu: 512m, memory: 512Mi)
    - Add `securityContext.runAsNonRoot: true` on the container
    - Set `restartPolicy: Always`
    - Use `app: notes-app` as pod label and selector matchLabels
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 3.2, 4.3, 4.4, 6.1, 6.2, 6.3, 6.4_

- [ ] 4. Create service manifest
  - [ ] 4.1 Create `k8s/service.yaml`
    - Define Service named `notes-app-service` of type LoadBalancer in `notes-app-dev` namespace
    - Set port 80 with targetPort 3000, protocol TCP
    - Use selector `app: notes-app` to match Deployment pod labels
    - Add `app: notes-app` and `environment: dev` labels
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.3_

- [ ] 5. Checkpoint - Validate manifests
  - Ensure all YAML files are syntactically valid and cross-reference each other correctly (Service selector matches Deployment labels, ConfigMap/Secret names match Deployment references, all resources target `notes-app-dev` namespace). Ask the user if questions arise.

- [ ] 6. Create deployment documentation
  - [ ] 6.1 Create `EKS-DEPLOY.md` at project root
    - Document prerequisites: kubectl, AWS CLI v2, configured kubeconfig for the EKS cluster
    - Provide step-by-step apply instructions in correct order: namespace → configmap → secret → deployment → service
    - Include instructions to verify deployment: check pod status (`kubectl get pods -n notes-app-dev`), check service endpoint (`kubectl get svc -n notes-app-dev`), and curl the health endpoint
    - Include instructions for updating the container image tag using `kubectl set image`
    - Include rollback instructions using `kubectl rollout undo`
    - Document required IAM permissions for EKS worker nodes to pull from ECR (ecr:GetDownloadUrlForLayer, ecr:BatchGetImage, ecr:GetAuthorizationToken)
    - Add a note that no `imagePullSecrets` are needed when worker node IAM roles have correct permissions
    - _Requirements: 5.1, 5.2, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

- [ ] 7. YAML validation and consistency verification
  - [ ]* 7.1 Add YAML linting verification
    - Validate all manifests in `k8s/` parse as valid YAML
    - Verify required fields are present in each manifest (apiVersion, kind, metadata.name, metadata.namespace)
    - _Requirements: 1.1, 2.1, 3.1_

  - [ ]* 7.2 Cross-file consistency checks
    - Verify Service selector (`app: notes-app`) matches Deployment pod template labels
    - Verify ConfigMap name in Deployment `envFrom` matches ConfigMap metadata name
    - Verify Secret name in Deployment env `secretKeyRef` matches Secret metadata name
    - Verify all resources reference namespace `notes-app-dev`
    - _Requirements: 2.3, 3.2, 3.3, 4.3, 4.4_

- [ ] 8. Final checkpoint
  - Ensure all manifests are complete, documentation is accurate, and YAML validation passes. Ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster delivery
- This is an IaC feature — all deliverables are YAML manifests and markdown documentation
- No property-based tests apply; validation uses YAML parsing and cross-file consistency checks
- The deployment is manual (kubectl) with no CI/CD pipeline changes
- All manifests use placeholder values for environment-specific configuration (ECR image URI, RDS endpoint, credentials)
- Checkpoints ensure incremental validation of manifest correctness

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1", "2.2"] },
    { "id": 2, "tasks": ["3.1", "4.1"] },
    { "id": 3, "tasks": ["6.1"] },
    { "id": 4, "tasks": ["7.1", "7.2"] }
  ]
}
```
