# Parlor — Kubernetes Deployment

Deployed at https://parlor.whatsdoom.com on a k3s cluster (donnie, `152.53.90.120`).

Pushes to `main` automatically build, publish, and deploy via GitHub Actions.

## First deploy

```bash
kubectl apply -f k8s/
kubectl apply -f k8s/  # run twice — namespace must exist before other resources
```

## GitHub Actions deploy secret

The `KUBECONFIG` secret must be set in repo settings for automatic deploys to work.
To regenerate it (e.g. after cluster rebuild):

```bash
kubectl apply -f k8s/github-actions-rbac.yaml

TOKEN=$(kubectl get secret github-actions-token -n parlor -o jsonpath='{.data.token}' | base64 -d)
CA=$(kubectl get secret github-actions-token -n parlor -o jsonpath='{.data.ca\.crt}')

cat <<EOF
apiVersion: v1
kind: Config
clusters:
- cluster:
    certificate-authority-data: $CA
    server: https://152.53.90.120:6443
  name: parlor
contexts:
- context:
    cluster: parlor
    namespace: parlor
    user: github-actions
  name: parlor
current-context: parlor
users:
- name: github-actions
  user:
    token: $TOKEN
EOF
```

Copy the output into the `KUBECONFIG` secret at:
`github.com/paul-schwendenman/parlor/settings/secrets/actions`

## Manual redeploy

```bash
kubectl rollout restart deployment/parlor -n parlor
kubectl rollout status deployment/parlor -n parlor
```

## Check status

```bash
kubectl get pods -n parlor
kubectl get certificate -n parlor
kubectl logs -n parlor -l app=parlor --tail=50
```

## Tear down

```bash
kubectl delete namespace parlor  # removes everything
```
