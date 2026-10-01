#!/usr/bin/env python3
"""The m360 voice box on RunPod, in one command. No Docker image to build, no domain to point: the pod
starts from RunPod's PyTorch image, the server and its requirements ride along as environment
variables, the weights download on first boot and stay on the pod's volume, and RunPod's proxy gives
the box an https address straight away.

  export RUNPOD_API_KEY=...        # runpod.io > Settings > API Keys
  python3 runpod.py up             # creates the pod, waits for /health, prints the address and the key
  python3 runpod.py status         # the pod and whether the box answers
  python3 runpod.py down           # stops the bill

Then on the team site: Admin > Controls > Super > Voice box, paste the address and the key, Connect.
Options (environment): VOICE_API_KEY (made up for you when absent), RUNPOD_GPU (default NVIDIA GeForce
RTX 4090), RUNPOD_CLOUD (COMMUNITY, cheaper, or SECURE), WHISPER_HINTS, ALLOWED_ORIGINS.
"""
import base64
import json
import os
import pathlib
import secrets
import sys
import time
import urllib.error
import urllib.request

API = 'https://rest.runpod.io/v1'
HERE = pathlib.Path(__file__).resolve().parent
STATE = HERE / '.runpod.json'
IMAGE = 'runpod/pytorch:2.4.0-py3.11-cuda12.4.1-devel-ubuntu22.04'
START = ("mkdir -p /workspace/m360-voice && cd /workspace/m360-voice && "
         "echo \"$M360_SERVER_B64\" | base64 -d > server.py && echo \"$M360_REQ_B64\" | base64 -d > requirements.txt && "
         "pip install -q -r requirements.txt && "
         "export LD_LIBRARY_PATH=$(python3 -c 'import os, nvidia.cublas.lib, nvidia.cudnn.lib; print(os.path.dirname(nvidia.cublas.lib.__file__) + \":\" + os.path.dirname(nvidia.cudnn.lib.__file__))' 2>/dev/null):$LD_LIBRARY_PATH && "
         "exec uvicorn server:app --host 0.0.0.0 --port 8000")


def key():
    k = os.environ.get('RUNPOD_API_KEY', '').strip()
    if not k:
        sys.exit('Set RUNPOD_API_KEY first (runpod.io > Settings > API Keys).')
    return k


def call(method, path, body=None):
    data = json.dumps(body).encode('utf-8') if body is not None else None
    req = urllib.request.Request(API + path, data=data, method=method,
                                 headers={'authorization': 'Bearer ' + key(), 'content-type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            raw = r.read().decode('utf-8')
            return json.loads(raw) if raw.strip() else {}
    except urllib.error.HTTPError as e:
        sys.exit('RunPod said %d on %s %s: %s' % (e.code, method, path, e.read().decode('utf-8', 'replace')[:600]))


def state():
    try:
        return json.loads(STATE.read_text())
    except (OSError, ValueError):
        return {}


def health(url, voice_key, timeout=8):
    try:
        req = urllib.request.Request(url + '/health', headers={'authorization': 'Bearer ' + voice_key})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read().decode('utf-8'))
    except Exception:
        return None


def up():
    if state().get('id'):
        sys.exit('A pod is already recorded in %s (id %s). Run "python3 runpod.py down" first, or delete that file.' % (STATE.name, state()['id']))
    voice_key = os.environ.get('VOICE_API_KEY', '').strip() or secrets.token_urlsafe(32)
    env = {
        'VOICE_API_KEY': voice_key,
        'WHISPER_HINTS': os.environ.get('WHISPER_HINTS', 'Mask360, M360, Kaavish'),
        'ALLOWED_ORIGINS': os.environ.get('ALLOWED_ORIGINS', 'https://m360os-wx9u1bqs.edgeone.dev'),
        'HF_HOME': '/workspace/hf',
        'VOICES_DIR': '/workspace/m360-voice/voices',
        'M360_SERVER_B64': base64.b64encode((HERE / 'server.py').read_bytes()).decode('ascii'),
        'M360_REQ_B64': base64.b64encode((HERE / 'requirements.txt').read_bytes()).decode('ascii'),
    }
    body = {
        'name': 'm360-voice',
        'imageName': IMAGE,
        'gpuTypeIds': [os.environ.get('RUNPOD_GPU', 'NVIDIA GeForce RTX 4090')],
        'gpuCount': 1,
        'cloudType': os.environ.get('RUNPOD_CLOUD', 'COMMUNITY'),
        'containerDiskInGb': 40,
        'volumeInGb': 40,
        'volumeMountPath': '/workspace',
        'ports': ['8000/http'],
        'env': env,
        'dockerStartCmd': ['bash', '-lc', START],
    }
    print('Creating the pod (%s, %s)...' % (body['gpuTypeIds'][0], body['cloudType']))
    pod = call('POST', '/pods', body)
    pid = pod.get('id')
    if not pid:
        sys.exit('RunPod did not return a pod id: %s' % json.dumps(pod)[:600])
    url = 'https://%s-8000.proxy.runpod.net' % pid
    STATE.write_text(json.dumps({'id': pid, 'url': url, 'key': voice_key, 'at': time.time()}, indent=1))
    print('Pod %s. The box will answer at %s' % (pid, url))
    print('First boot installs the models (several GB); five to fifteen minutes. Waiting...')
    t0 = time.time()
    while time.time() - t0 < 1500:
        h = health(url, voice_key)
        if h and h.get('ok'):
            print('\nUp. device %s, multilingual %s, voices %s' % (h.get('device'), h.get('multilingual'), ', '.join(h.get('voices') or [])))
            print('\nPaste into Admin > Controls > Super > Voice box:\n  address  %s\n  key      %s\n  voice    m360 (after the clip is uploaded) or default' % (url, voice_key))
            print('\nTo give it the m360 voice, record ten clean seconds of one speaker and run:\n  curl -s -X POST %s/v1/voices -H "Authorization: Bearer %s" -F name=m360 -F file=@m360_voice.wav' % (url, voice_key))
            return
        time.sleep(15)
        sys.stdout.write('.'); sys.stdout.flush()
    print('\nStill not answering after 25 minutes. Check the pod logs on runpod.io; the address and key are in %s.' % STATE.name)


def status():
    s = state()
    if not s.get('id'):
        sys.exit('No pod recorded here. Run "python3 runpod.py up".')
    pod = call('GET', '/pods/' + s['id'])
    h = health(s['url'], s['key'])
    print('pod %s: %s' % (s['id'], pod.get('desiredStatus') or pod.get('status') or json.dumps(pod)[:200]))
    print('box %s: %s' % (s['url'], ('up, device %s, voices %s' % (h.get('device'), ', '.join(h.get('voices') or []))) if h and h.get('ok') else 'not answering'))


def down():
    s = state()
    if not s.get('id'):
        sys.exit('No pod recorded here.')
    call('DELETE', '/pods/' + s['id'])
    STATE.unlink(missing_ok=True)
    print('Pod %s deleted. The bill stops; the next "up" downloads the models again.' % s['id'])


if __name__ == '__main__':
    {'up': up, 'status': status, 'down': down}.get(sys.argv[1] if len(sys.argv) > 1 else 'up', lambda: sys.exit(__doc__))()
