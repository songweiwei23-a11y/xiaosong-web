#!/usr/bin/env bash
set -Eeuo pipefail

app_name=xiaosong-web
entries=(app components hooks lib types supabase public tests middleware.ts instrumentation.ts
  next.config.js postcss.config.js tailwind.config.js tsconfig.json components.json
  package.json package-lock.json node_modules .next)

read_build_id() {
  node -e 'const fs=require("fs"); console.log(JSON.parse(fs.readFileSync(0,"utf8")).buildId || "")'
}

check_release() {
  local origin=$1 expected=$2 release=${3:-} version health status
  version=$(curl -fsS --max-time 5 "$origin/api/build-id") || return 1
  if ! printf '%s' "$version" | node -e '
    const d = JSON.parse(require("fs").readFileSync(0, "utf8"));
    process.exit(d.buildId === process.argv[1] && (!process.argv[2] || d.release === process.argv[2]) ? 0 : 1);
  ' "$expected" "$release"; then return 1; fi
  health=$(curl -fsS --max-time 5 "$origin/api/health") || return 1
  printf '%s' "$health" | node -e 'process.exit(JSON.parse(require("fs").readFileSync(0,"utf8")).ok === true ? 0 : 1)' || return 1
  status=$(curl -sS --location --max-redirs 3 --max-time 5 -o /dev/null -w '%{http_code}' "$origin/") || return 1
  [[ $status == 200 ]] || return 1
  if [[ -n $release ]]; then
    status=$(curl -sS --max-time 5 -o /dev/null -w '%{http_code}' "$origin/api/generation-tasks?taskType=release-probe") || return 1
    [[ $status == 401 ]] || return 1
  fi
}

wait_for_release() {
  local attempt
  for ((attempt=1; attempt<=30; attempt++)); do
    if check_release "$@"; then return 0; fi
    sleep 2
  done
  return 1
}

# Runs inside EXIT so a failed switch, restart or verification also restores the previous files.
rollback() {
  local status=$? entry restore_failed=0
  trap - EXIT INT TERM HUP
  if [[ ${switching:-0} == 1 ]]; then
    set +e
    echo "Activation failed. Restoring $previous_build."
    pm2 stop "$app_name" >/dev/null || restore_failed=1
    for entry in "${moved_new[@]}"; do mv -- "$live/$entry" "$stage/$entry" || restore_failed=1; done
    for entry in "${moved_old[@]}"; do mv -- "$backup/$entry" "$live/$entry" || restore_failed=1; done
    if ((restore_failed == 0)) && pm2 restart "$app_name" &&
      wait_for_release "$local_origin" "$previous_build" && wait_for_release "$public_origin" "$previous_build"; then
      echo "ROLLBACK_VERIFIED $previous_build"
    else
      echo "ROLLBACK_REQUIRES_ATTENTION $backup" >&2
    fi
  fi
  exit "$status"
}

activate_release() {
  local entry
  moved_new=()
  moved_old=()
  switching=0
  trap rollback EXIT
  trap 'exit 130' INT
  trap 'exit 143' TERM HUP
  switching=1
  pm2 stop "$app_name"
  for entry in "${entries[@]}"; do
    if [[ -e $live/$entry || -L $live/$entry ]]; then
      mv -- "$live/$entry" "$backup/$entry"
      moved_old+=("$entry")
    fi
    if [[ -e $stage/$entry || -L $stage/$entry ]]; then
      mv -- "$stage/$entry" "$live/$entry"
      moved_new+=("$entry")
    fi
  done
  pm2 restart "$app_name"
  wait_for_release "$local_origin" "$expected_build" "$tag"
  wait_for_release "$public_origin" "$expected_build" "$tag"
  switching=0
  echo "RELEASE_VERIFIED $tag $expected_build"
  echo "PREVIOUS_RELEASE $previous_build $backup"
}

main() {
  live=$1
  tag=$2
  local archive=$3 hash=$4 commit=$5 env_file cmd_cwd space
  [[ $live == /var/www/xiaosong-web && $tag =~ ^BUILD_[0-9]{17}$ && $hash =~ ^[a-f0-9]{64}$ ]]
  [[ $archive == "/tmp/kaiwu-$tag.tar.gz" && $commit =~ ^[a-f0-9]{40}$ ]]
  local_origin=http://127.0.0.1:3000
  public_origin=https://biandao.icu
  umask 077
  mkdir -p "$live/.deployments"
  exec 9>"$live/.deployments/deploy.lock"
  flock -n 9
  cmd_cwd=$(pm2 jlist | node -e '
    const rows = JSON.parse(require("fs").readFileSync(0,"utf8")).filter(r => r.name === "xiaosong-web");
    if (rows.length !== 1 || rows[0].pm2_env.status !== "online") process.exit(1);
    console.log(rows[0].pm2_env.pm_cwd);
  ')
  [[ $cmd_cwd == "$live" ]]
  previous_build=$(curl -fsS --max-time 5 "$local_origin/api/build-id" | read_build_id)
  [[ -n $previous_build ]]
  check_release "$local_origin" "$previous_build"
  check_release "$public_origin" "$previous_build"

  # A separate dependency tree and build protect the running server and the rollback point.
  space=$(df -Pm "$live" | awk 'NR == 2 {print $4}')
  if [[ ! $space =~ ^[0-9]+$ ]] || ((space < 1800)); then
    echo "Insufficient free disk for a separate build (need 1800 MiB)." >&2
    return 1
  fi
  printf '%s  %s\n' "$hash" "$archive" | sha256sum --check
  stage="$live/.deployments/$tag-candidate"
  backup="$live/.deployments/$tag-previous"
  mkdir "$stage" "$backup"
  tar -xzf "$archive" -C "$stage"
  for env_file in .env .env.local .env.production .env.production.local .npmrc; do
    if [[ -f $live/$env_file ]]; then ln -s -- "$live/$env_file" "$stage/$env_file"; fi
  done
  cd "$stage"
  printf 'Source HEAD %s, packaged tree SHA256 %s\n' "$commit" "$hash"
  npm ci --no-audit --no-fund
  NEXT_PUBLIC_APP_BUILD=$tag NODE_OPTIONS=--max-old-space-size=1400 npm run build
  [[ -s .next/BUILD_ID && -s .next/app-path-routes-manifest.json ]]
  expected_build=$(cat .next/BUILD_ID)
  [[ -n $expected_build && $expected_build != "$previous_build" ]]
  [[ -z $(find app components hooks lib -type f -newer .next/BUILD_ID -print -quit) ]]
  cd "$live"
  activate_release
}

if [[ ${BASH_SOURCE[0]} == "$0" ]]; then
  main "$@"
fi
