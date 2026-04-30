#!/usr/bin/env node
import { spawn } from 'node:child_process'

const args = process.argv.slice(2)
const wantsHelp = args.includes('--help') || args.includes('-h')
const bucket = args.find((arg) => !arg.startsWith('-')) || 'beehive'
const mode = args.includes('--apply') ? 'apply' : 'dry-run'
const sshTarget = process.env.RUSTFS_POLICY_SSH_TARGET || 'dev@128.39.142.138'
const sshPort = process.env.RUSTFS_POLICY_SSH_PORT || '2203'
const remoteEnvPath = process.env.RUSTFS_POLICY_REMOTE_ENV || '/home/dev/s3/.env'
const remoteS3Host = process.env.RUSTFS_POLICY_REMOTE_HOST || '127.0.0.1'
const remoteS3Port = process.env.RUSTFS_POLICY_REMOTE_PORT || '9101'
const signedHost = process.env.RUSTFS_POLICY_SIGNED_HOST || 'spaces.login.no'

if (wantsHelp) {
  console.log(`Usage: node scripts/rustfs-bucket-policy.mjs [bucket] [--apply]

Dry-runs by default. With --apply, writes a public-read object policy for the bucket.

Environment overrides:
  RUSTFS_POLICY_SSH_TARGET   SSH target. Default: dev@128.39.142.138
  RUSTFS_POLICY_SSH_PORT     SSH port. Default: 2203
  RUSTFS_POLICY_REMOTE_ENV   Remote .env path. Default: /home/dev/s3/.env
  RUSTFS_POLICY_REMOTE_HOST  Remote RustFS host. Default: 127.0.0.1
  RUSTFS_POLICY_REMOTE_PORT  Remote RustFS port. Default: 9101
  RUSTFS_POLICY_SIGNED_HOST  Host used in SigV4 signing. Default: spaces.login.no`)
  process.exit(0)
}

if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket)) {
  console.error(`Invalid bucket name: ${bucket}`)
  process.exit(2)
}

const remoteScript = String.raw`
import datetime
import hashlib
import hmac
import http.client
import json
import sys
import urllib.parse
from pathlib import Path

bucket = sys.argv[1]
mode = sys.argv[2]
env_path = sys.argv[3]
rustfs_host = sys.argv[4]
rustfs_port = int(sys.argv[5])
signed_host = sys.argv[6]

def load_env(path):
    data = {}
    for line in Path(path).read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        data[key] = value.strip().strip("'\"")
    return data

env = load_env(env_path)
access_key = env["RUSTFS_ACCESS_KEY"]
secret_key = env["RUSTFS_SECRET_KEY"]

policy = {
    "Version": "2012-10-17",
    "Statement": [{
        "Sid": "PublicReadObjects",
        "Effect": "Allow",
        "Principal": "*",
        "Action": ["s3:GetObject"],
        "Resource": [f"arn:aws:s3:::{bucket}/*"],
    }],
}

def sign(method, path, host, body=b""):
    region = "us-east-1"
    service = "s3"
    now = datetime.datetime.now(datetime.UTC)
    amz_date = now.strftime("%Y%m%dT%H%M%SZ")
    date = now.strftime("%Y%m%d")
    payload_hash = hashlib.sha256(body).hexdigest()
    uri = urllib.parse.urlsplit(path)
    canonical_uri = uri.path or "/"
    canonical_query = uri.query
    headers = {
        "host": host,
        "x-amz-content-sha256": payload_hash,
        "x-amz-date": amz_date,
    }
    signed_headers = "host;x-amz-content-sha256;x-amz-date"
    canonical_headers = "".join(f"{k}:{headers[k]}\n" for k in sorted(headers))
    canonical_request = "\n".join(
        [method, canonical_uri, canonical_query, canonical_headers, signed_headers, payload_hash]
    )
    scope = f"{date}/{region}/{service}/aws4_request"
    string_to_sign = "\n".join(
        ["AWS4-HMAC-SHA256", amz_date, scope, hashlib.sha256(canonical_request.encode()).hexdigest()]
    )

    def digest(key, message):
        return hmac.new(key, message.encode(), hashlib.sha256).digest()

    signing_key = digest(
        digest(digest(digest(("AWS4" + secret_key).encode(), date), region), service),
        "aws4_request",
    )
    signature = hmac.new(signing_key, string_to_sign.encode(), hashlib.sha256).hexdigest()
    headers["authorization"] = (
        f"AWS4-HMAC-SHA256 Credential={access_key}/{scope}, "
        f"SignedHeaders={signed_headers}, Signature={signature}"
    )
    return headers

def request(method, path, body=b""):
    conn = http.client.HTTPConnection(rustfs_host, rustfs_port, timeout=10)
    headers = sign(method, path, signed_host, body)
    if body:
        headers["content-type"] = "application/json"
    conn.request(method, path, body=body, headers=headers)
    response = conn.getresponse()
    response_body = response.read(4000).decode(errors="replace")
    return response.status, response_body

head_status, _ = request("HEAD", f"/{bucket}")
if head_status != 200:
    print(json.dumps({"ok": False, "mode": mode, "bucket": bucket, "error": f"bucket HEAD returned {head_status}"}))
    sys.exit(1)

if mode == "apply":
    body = json.dumps(policy, separators=(",", ":")).encode()
    put_status, put_body = request("PUT", f"/{bucket}?policy=", body)
    if put_status not in (200, 204):
        print(json.dumps({"ok": False, "mode": mode, "bucket": bucket, "putStatus": put_status, "body": put_body[:500]}))
        sys.exit(1)

get_status, get_body = request("GET", f"/{bucket}?policyStatus=")
result = {
    "ok": get_status == 200,
    "mode": mode,
    "bucket": bucket,
    "headStatus": head_status,
    "policyStatusCode": get_status,
    "policyStatusBody": get_body[:500],
    "wouldApplyPolicy": policy if mode != "apply" else None,
}
print(json.dumps(result, indent=2))
sys.exit(0 if result["ok"] else 1)
`

const ssh = spawn('ssh', [
  '-p',
  sshPort,
  '-o',
  'StrictHostKeyChecking=accept-new',
  sshTarget,
  'python3',
  '-',
  bucket,
  mode,
  remoteEnvPath,
  remoteS3Host,
  remoteS3Port,
  signedHost,
], {
  stdio: ['pipe', 'pipe', 'pipe'],
})

ssh.stdin.end(remoteScript)

let stdout = ''
let stderr = ''
ssh.stdout.on('data', (chunk) => { stdout += chunk.toString() })
ssh.stderr.on('data', (chunk) => { stderr += chunk.toString() })

ssh.on('close', (code) => {
  if (stdout.trim()) console.log(stdout.trim())
  if (stderr.trim()) console.error(stderr.trim())
  process.exit(code || 0)
})
