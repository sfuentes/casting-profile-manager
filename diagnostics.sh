echo "--- 1. repeat requests: first vs subsequent ---"
for i in 1 2 3; do curl -sS -o /dev/null -m 40 -w "  frontend try$i: %{http_code} in %{time_total}s\n" https://tkkk4osw4oowo44sg80k4088.46.225.109.224.sslip.io/; done
for i in 1 2; do curl -sS -o /dev/null -m 40 -w "  backend  try$i: %{http_code} in %{time_total}s\n" https://o0cgsgk008ckcocsookck8sc.46.225.109.224.sslip.io/health; done
echo "--- 2. container state + restarts ---"; docker ps -a --format '{{.Names}}\t{{.Status}}' | grep -Ei 'mongo|backend|frontend'
echo "--- 3. memory (Chromium + Node + Mongo on one box) ---"; free -h; docker stats --no-stream --format '{{.Name}}\t{{.MemUsage}}\t{{.CPUPerc}}' | grep -Ei 'mongo|backend|frontend'
echo "--- 4. backend logs (should have content now) ---"; docker logs --tail 50 $(docker ps -aq --filter name=backend|head -1) 2>&1 | tail -50