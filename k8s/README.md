# Parlor — Kubernetes Deployment

Deployed at https://parlor.whatsdoom.com on a k3s cluster (donnie, `152.53.90.120`).

## First deploy

```bash
kubectl apply -f k8s/
kubectl apply -f k8s/  # run twice — namespace must exist before other resources
```

## Redeploy after a new image

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
