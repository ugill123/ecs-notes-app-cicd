# Requirements Document

## Introduction

This feature adds Amazon EKS (Elastic Kubernetes Service) deployment capability to the existing Notes App. The application currently deploys to ECS Fargate via GitHub Actions CI/CD. This feature introduces plain Kubernetes YAML manifests and deployment documentation to run the same containerized application on an EKS cluster in the dev environment. The deployment is manual (no CI/CD changes) and uses a LoadBalancer Service type for external access. The same Docker image from the shared ECR repository is reused.

## Glossary

- **Notes_App**: The Node.js Express application with Sequelize ORM connecting to PostgreSQL, serving a note-taking frontend and REST API on port 3000.
- **EKS_Cluster**: The Amazon Elastic Kubernetes Service cluster running EC2/self-managed worker nodes in the dev environment.
- **Kubernetes_Deployment**: A Kubernetes Deployment resource that manages the desired number of Notes_App pod replicas.
- **Kubernetes_Service**: A Kubernetes Service resource of type LoadBalancer that exposes the Notes_App externally via an AWS Network Load Balancer.
- **ECR_Repository**: The shared Amazon Elastic Container Registry repository (`notes-app-shared`) storing Docker images across all environments.
- **Health_Check_Endpoint**: The `/health` HTTP endpoint on the Notes_App that returns a 200 status indicating the application is ready to serve traffic.
- **Kubernetes_Namespace**: A Kubernetes namespace used to logically isolate the dev environment workloads on the EKS_Cluster.
- **ConfigMap**: A Kubernetes ConfigMap resource storing non-sensitive environment configuration for the Notes_App.
- **Secret**: A Kubernetes Secret resource storing sensitive credentials such as database password.

## Requirements

### Requirement 1: Kubernetes Deployment Manifest

**User Story:** As a DevOps engineer, I want a Kubernetes Deployment manifest for the Notes App, so that I can run the application as pods on the EKS cluster.

#### Acceptance Criteria

1. THE Kubernetes_Deployment SHALL define a Deployment resource with the API version `apps/v1` targeting the Notes_App container.
2. THE Kubernetes_Deployment SHALL specify the container image reference pointing to the ECR_Repository in the format `<account-id>.dkr.ecr.<region>.amazonaws.com/notes-app-shared:<tag>`.
3. THE Kubernetes_Deployment SHALL set the container port to 3000.
4. THE Kubernetes_Deployment SHALL configure a liveness probe using an HTTP GET request to the Health_Check_Endpoint on port 3000.
5. THE Kubernetes_Deployment SHALL configure a readiness probe using an HTTP GET request to the Health_Check_Endpoint on port 3000.
6. THE Kubernetes_Deployment SHALL set the initial replica count to 2.
7. THE Kubernetes_Deployment SHALL define CPU and memory resource requests and limits for the Notes_App container.
8. THE Kubernetes_Deployment SHALL run the container as a non-root user consistent with the existing Dockerfile security configuration.

### Requirement 2: Kubernetes Service Manifest

**User Story:** As a DevOps engineer, I want a Kubernetes Service of type LoadBalancer, so that the Notes App is accessible externally via an AWS-provisioned load balancer.

#### Acceptance Criteria

1. THE Kubernetes_Service SHALL define a Service resource of type LoadBalancer.
2. THE Kubernetes_Service SHALL route traffic on port 80 to the Notes_App container target port 3000.
3. THE Kubernetes_Service SHALL use label selectors that match the pod labels defined in the Kubernetes_Deployment.
4. WHEN the Kubernetes_Service is applied to the EKS_Cluster, THE EKS_Cluster SHALL provision an AWS Network Load Balancer with an external DNS endpoint.

### Requirement 3: Namespace Isolation

**User Story:** As a DevOps engineer, I want the EKS deployment isolated in a dedicated namespace, so that dev workloads do not interfere with other cluster resources.

#### Acceptance Criteria

1. THE Kubernetes_Namespace SHALL define a namespace named `notes-app-dev`.
2. THE Kubernetes_Deployment SHALL deploy all resources into the `notes-app-dev` namespace.
3. THE Kubernetes_Service SHALL be created in the `notes-app-dev` namespace.

### Requirement 4: Environment Configuration

**User Story:** As a DevOps engineer, I want database and application configuration managed through Kubernetes ConfigMaps and Secrets, so that the same environment variable pattern used in ECS is replicated on EKS.

#### Acceptance Criteria

1. THE ConfigMap SHALL store non-sensitive configuration values including DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_SSL, and PORT.
2. THE Secret SHALL store the DB_PASSWORD value in base64-encoded format.
3. THE Kubernetes_Deployment SHALL inject all ConfigMap values as environment variables into the Notes_App container.
4. THE Kubernetes_Deployment SHALL inject the DB_PASSWORD from the Secret as an environment variable into the Notes_App container.
5. THE ConfigMap SHALL use placeholder values that operators replace before applying to the cluster.

### Requirement 5: ECR Image Pull Authentication

**User Story:** As a DevOps engineer, I want the EKS worker nodes to authenticate with ECR, so that Kubernetes can pull the Notes App container image from the private registry.

#### Acceptance Criteria

1. THE Kubernetes_Deployment SHALL document that EKS worker node IAM roles require the `ecr:GetDownloadUrlForLayer`, `ecr:BatchGetImage`, and `ecr:GetAuthorizationToken` permissions.
2. WHEN the EKS worker nodes have the correct IAM permissions, THE EKS_Cluster SHALL pull container images from the ECR_Repository without additional imagePullSecrets configuration.

### Requirement 6: Health Check Configuration

**User Story:** As a DevOps engineer, I want properly configured health checks, so that Kubernetes automatically restarts unhealthy pods and only routes traffic to ready pods.

#### Acceptance Criteria

1. THE Kubernetes_Deployment SHALL configure the liveness probe with an initial delay of 10 seconds and a check period of 30 seconds.
2. THE Kubernetes_Deployment SHALL configure the readiness probe with an initial delay of 5 seconds and a check period of 10 seconds.
3. IF the readiness probe fails, THEN THE EKS_Cluster SHALL remove the pod from the Kubernetes_Service endpoints.
4. IF the liveness probe fails 3 consecutive times, THEN THE EKS_Cluster SHALL restart the failing pod.

### Requirement 7: Deployment Documentation

**User Story:** As a DevOps engineer, I want step-by-step deployment documentation, so that I can manually deploy and verify the Notes App on EKS without CI/CD automation.

#### Acceptance Criteria

1. THE deployment documentation SHALL include prerequisites listing required CLI tools (kubectl, AWS CLI) and cluster access configuration.
2. THE deployment documentation SHALL provide step-by-step instructions to apply all Kubernetes manifests in the correct order.
3. THE deployment documentation SHALL include instructions to verify the deployment by checking pod status and accessing the Health_Check_Endpoint through the LoadBalancer URL.
4. THE deployment documentation SHALL include instructions for updating the container image tag to deploy a new version.
5. THE deployment documentation SHALL include instructions for rolling back to a previous version using kubectl rollout undo.
6. THE deployment documentation SHALL document the required IAM permissions for EKS worker nodes to pull images from the ECR_Repository.
