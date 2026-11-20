---
id: do-w2
title: Networking & Server Foundations
week: Week 2
summary: IP addressing and subnetting, ports, TCP and UDP, DNS, HTTP/HTTPS, setting up a server with SSH keys and a firewall, Nginx as a reverse proxy, domains and TLS certificates, and network troubleshooting.
builds_on: do-w1, f-web
leads_to: do-w3, do-w4, do-w9
---

Every outage eventually becomes a networking question: *Can A reach B? On which port? Does the name resolve? Is the certificate valid?* This week builds a working mental model of networks, then applies it: you'll set up a server securely and put Nginx with HTTPS in front of an app.

# Lesson: IP addresses, subnets and routing (35 min)

An **IPv4 address** is 32 bits, written as four octets: `192.168.1.20`. A **subnet** is a range of addresses, written in **CIDR** notation: `192.168.1.0/24` means the first 24 bits are the **network** part, and the remaining 8 bits identify **hosts** (2⁸ = 256 addresses).

| CIDR | Netmask | Addresses | Typical use |
|---|---|---|---|
| /32 | 255.255.255.255 | 1 | A single host (firewall rules) |
| /24 | 255.255.255.0 | 256 | A small LAN / subnet |
| /16 | 255.255.0.0 | 65,536 | A VPC (cloud network) |
| /8 | 255.0.0.0 | 16.7 M | Very large networks |

```python
import ipaddress
net = ipaddress.ip_network("10.0.1.0/24")
print(net.num_addresses, net.netmask, net.network_address, net.broadcast_address)
print(ipaddress.ip_address("10.0.1.77") in net, ipaddress.ip_address("10.0.2.5") in net)
vpc = ipaddress.ip_network("10.0.0.0/16")
print([str(s) for s in list(vpc.subnets(new_prefix=20))[:4]])   # carve a VPC into /20 subnets
```

- **Private ranges** (RFC 1918): `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`. These aren't routable on the internet. **NAT** maps them to public addresses.
- `127.0.0.1` is **localhost** (the same machine), and `0.0.0.0` in a server config means "listen on all interfaces".
- A **default gateway** forwards traffic out of the local subnet. Routing tables decide the next hop.
- **IPv6** uses 128-bit addresses (`2001:db8::1`), so there are vastly more addresses and less need for NAT.

> [!connect] Cloud networking is subnetting
> In the cloud (week 7) you design a VPC (e.g. `/16`), split it into public and private subnets (`/24`s or `/20`s) across availability zones, and write security rules with CIDRs. Kubernetes assigns pod and service CIDRs too (week 9).

> [!recap]
> - CIDR /n: n network bits; 2^(32−n) addresses.
> - Private ranges + NAT. 127.0.0.1 vs 0.0.0.0. Gateways and routes.

# Lesson: Ports, TCP, UDP, DNS and HTTPS (30 min)

### Ports and transport protocols

An IP address finds the machine, and a **port** (0–65535) finds the program on it. Well-known ports: 22 SSH, 53 DNS, 80 HTTP, 443 HTTPS, 5432 PostgreSQL, 6379 Redis, 3306 MySQL.

| | TCP | UDP |
|---|---|---|
| Connection | Yes (3-way handshake: SYN, SYN-ACK, ACK) | No |
| Reliability | Ordered, retransmitted, flow control | Best effort |
| Use | HTTP(S), SSH, databases | DNS queries, video/voice, QUIC (HTTP/3) |

### DNS

DNS translates names into addresses through a hierarchy: the resolver → root servers → `.com` servers → the domain's **authoritative** nameservers. Answers are cached according to their **TTL**.

| Record | Purpose |
|---|---|
| A / AAAA | Name → IPv4 / IPv6 |
| CNAME | Alias to another name |
| MX | Mail servers |
| TXT | Verification, SPF/DKIM |
| NS | Which nameservers are authoritative |

```bash norun
dig +short example.com A
dig example.com NS
dig @1.1.1.1 api.example.com        # ask a specific resolver
```

> [!tip] "It's always DNS"
> Changed a record and nothing happened? The old answer may be cached until its TTL expires. Lower TTLs (e.g. 300 s) *before* a planned migration.

### HTTPS = HTTP over TLS

TLS gives **encryption**, **integrity** and **server authentication**. The server presents a **certificate** signed by a trusted Certificate Authority (CA), proving that it controls the domain. **Let's Encrypt** issues free, automated, 90-day certificates via the ACME protocol.

> [!recap]
> - Port = the program. TCP is reliable, UDP is lightweight.
> - DNS: A/AAAA/CNAME/MX/TXT/NS records, caching via TTL. Debug with `dig`.
> - TLS certificates prove identity. Let's Encrypt automates them.

# Lesson: Setting up a server: SSH, keys and firewalls (30 min)

### SSH key authentication

```bash norun
ssh-keygen -t ed25519 -C "laptop-2025"        # creates ~/.ssh/id_ed25519 (private!) and .pub
ssh-copy-id deploy@203.0.113.10               # installs the public key on the server
ssh deploy@203.0.113.10
```

Public-key cryptography: the server stores your **public** key, and you prove you hold the **private** key without ever sending it. Use a passphrase on the private key, and keep it on your device only.

### Hardening the SSH daemon (`/etc/ssh/sshd_config`)

```text
PermitRootLogin no
PasswordAuthentication no        # keys only (after confirming key login works!)
PubkeyAuthentication yes
```

Then run `sudo systemctl reload ssh`. **Keep your current session open** while you test a new one, so a typo can't lock you out.

### A firewall with ufw

```bash norun
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH            # port 22
sudo ufw allow 80,443/tcp
sudo ufw enable
sudo ufw status verbose
```

Expose **only** what's needed. Databases and Redis should listen on private interfaces, or be reachable only from the app servers. Add **fail2ban** to ban IPs with repeated failed logins. In the cloud, use security groups as an additional layer.

> [!recap]
> - ed25519 keys; disable root and password login (test first!).
> - Deny incoming by default; open 22/80/443 only; keep data stores private.

# Lesson: Nginx, reverse proxies and TLS (35 min)

A **reverse proxy** sits in front of your applications and handles TLS termination, routing by domain or path, compression, caching, rate limiting and load balancing. The app only listens on localhost.

```nginx
# /etc/nginx/sites-available/app.conf
upstream api_backend {
    server 127.0.0.1:8000;
    server 127.0.0.1:8001;           # load balancing across two app processes
}

server {
    listen 80;
    server_name app.example.com;
    return 301 https://$host$request_uri;          # force HTTPS
}

server {
    listen 443 ssl;
    http2 on;
    server_name app.example.com;
    ssl_certificate     /etc/letsencrypt/live/app.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.example.com/privkey.pem;

    location / {
        root /var/www/app;                          # static frontend
        try_files $uri /index.html;
    }
    location /api/ {
        proxy_pass http://api_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;                        # needed for SSE streaming (Full-Stack week 2)
        proxy_read_timeout 300s;
    }
}
```

```bash norun
sudo ln -s /etc/nginx/sites-available/app.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx        # always test the config before reloading
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d app.example.com             # obtains and installs a cert, sets up auto-renewal
```

Certificates renew automatically via a systemd timer. Check it with `sudo certbot renew --dry-run`.

### Network troubleshooting, layer by layer

```bash norun
ping -c 3 203.0.113.10                 # is the host reachable (ICMP)?
dig +short app.example.com             # does the name resolve to the right IP?
nc -vz app.example.com 443             # is the port open (TCP)?
curl -vI https://app.example.com       # TLS handshake + HTTP status + headers
sudo ss -tulpn | grep 8000             # is the app listening, and on which interface?
traceroute app.example.com             # where along the path is it failing?
sudo tail -f /var/log/nginx/error.log  # what does the proxy say? (502 = app down / wrong port)
```

| Symptom | Usual cause |
|---|---|
| Name doesn't resolve | DNS record missing, or still cached at the old TTL |
| Connection timed out | A firewall or security group is blocking; wrong IP |
| Connection refused | Nothing listening on that port (the app is down, or bound to 127.0.0.1 only) |
| 502 Bad Gateway | Nginx can't reach the upstream app |
| 504 Gateway Timeout | The upstream is too slow; tune timeouts or fix the app |
| Certificate error | Expired, wrong domain, or missing chain |

> [!recap]
> - Nginx: TLS termination, routing, load balancing, proxy headers. Turn off buffering for SSE.
> - `nginx -t` before reloading. certbot for Let's Encrypt with auto-renewal.
> - Troubleshoot bottom-up: ping → dig → nc → curl -v → ss → logs.

# Quiz

## How many addresses does a /26 subnet contain?
- [ ] 26
- [ ] 32
- [x] 64
- [ ] 256
> 2^(32−26) = 2^6 = 64.

## Which address range is private (not routable on the internet)?
- [x] 10.20.30.40
- [ ] 8.8.8.8
- [ ] 1.1.1.1
- [ ] 203.0.113.5 (it's documentation-reserved, but not RFC 1918 private)
> RFC 1918: 10/8, 172.16/12, 192.168/16.

## Your app listens on 127.0.0.1:8000, but another machine can't connect. Why?
- [ ] The port is too high
- [x] 127.0.0.1 is only reachable from the same machine; bind to 0.0.0.0 (or put a proxy in front)
- [ ] TCP isn't supported
- [ ] DNS is wrong
> Localhost-only binding is common, and correct behind a reverse proxy.

## Which DNS record maps a name to an IPv4 address?
- [x] A
- [ ] MX
- [ ] TXT
- [ ] NS
> AAAA is for IPv6. CNAME aliases one name to another.

## Before disabling SSH password authentication, you should:
- [ ] Reboot the server
- [x] Confirm key-based login works in a separate session, keeping the current one open
- [ ] Delete your keys
- [ ] Open all ports
> Avoid locking yourself out.

## Nginx returns 502 Bad Gateway. The most likely cause?
- [ ] The DNS TTL is too high
- [x] Nginx can't reach the upstream app (it's down, on the wrong port, or crashed)
- [ ] The client is offline
- [ ] The certificate expired
> Check the upstream process and Nginx's error log.

## Why set `proxy_buffering off` for an LLM chat endpoint?
- [ ] To save disk space
- [x] So streamed (SSE) tokens reach the client immediately instead of being buffered by Nginx
- [ ] To enable HTTPS
- [ ] To compress responses
> Buffering delays streaming responses.

## `nc -vz host 443` succeeds but `curl https://host` fails with a certificate error. Where's the problem?
- [ ] Network connectivity
- [ ] DNS
- [x] The TLS layer: an expired, mismatched or incomplete certificate chain
- [ ] The firewall
> The TCP port is open, so move up the stack.

# Exercise: Subnet calculator from scratch

Without the `ipaddress` module, write:
- `ip_to_int("10.0.1.5")` → integer, and `int_to_ip(n)` → dotted string
- `subnet_info("10.0.1.77/24")` → a dict with `network`, `broadcast`, `first_host`, `last_host` (dotted strings) and `hosts` (the number of usable hosts: total − 2; for /31 and /32 use the total count)
- `contains(cidr, ip)` → bool

## Starter

```python
def ip_to_int(ip):
    pass

def int_to_ip(n):
    pass

def subnet_info(cidr):
    pass

def contains(cidr, ip):
    pass
```

## Tests

```python
ns = load()
assert ns["ip_to_int"]("10.0.1.5") == 167772421 and ns["int_to_ip"](167772421) == "10.0.1.5"
info = ns["subnet_info"]("10.0.1.77/24")
assert info == {"network": "10.0.1.0", "broadcast": "10.0.1.255", "first_host": "10.0.1.1",
                "last_host": "10.0.1.254", "hosts": 254}, info
assert ns["subnet_info"]("192.168.5.130/26")["network"] == "192.168.5.128"
assert ns["subnet_info"]("192.168.5.130/26")["broadcast"] == "192.168.5.191"
assert ns["contains"]("172.16.0.0/12", "172.31.255.1") and not ns["contains"]("172.16.0.0/12", "172.32.0.1")
assert ns["subnet_info"]("8.8.8.8/32")["hosts"] == 1
```

## Hint

Mask = `(0xFFFFFFFF << (32 - prefix)) & 0xFFFFFFFF`. Network = `ip & mask`. Broadcast = `network | (~mask & 0xFFFFFFFF)`.

## Solution

```python
def ip_to_int(ip):
    a, b, c, d = (int(x) for x in ip.split("."))
    return (a << 24) | (b << 16) | (c << 8) | d

def int_to_ip(n):
    return ".".join(str((n >> s) & 255) for s in (24, 16, 8, 0))

def _parse(cidr):
    ip, prefix = cidr.split("/")
    prefix = int(prefix)
    mask = (0xFFFFFFFF << (32 - prefix)) & 0xFFFFFFFF
    return ip_to_int(ip), prefix, mask

def subnet_info(cidr):
    ip, prefix, mask = _parse(cidr)
    net = ip & mask
    bcast = net | (~mask & 0xFFFFFFFF)
    total = 2 ** (32 - prefix)
    if prefix >= 31:
        first, last, hosts = net, bcast, total
    else:
        first, last, hosts = net + 1, bcast - 1, total - 2
    return {"network": int_to_ip(net), "broadcast": int_to_ip(bcast),
            "first_host": int_to_ip(first), "last_host": int_to_ip(last), "hosts": hosts}

def contains(cidr, ip):
    net_ip, _, mask = _parse(cidr)
    return (ip_to_int(ip) & mask) == (net_ip & mask)
```

# Sources

- [Cloudflare Learning Center: What is DNS?, TLS, TCP/IP](https://www.cloudflare.com/learning/)
- [Julia Evans: networking zines and "How DNS works" explanations](https://wizardzines.com/)
- [Nginx documentation: reverse proxy (ngx_http_proxy_module)](https://nginx.org/en/docs/http/ngx_http_proxy_module.html)
- [Let's Encrypt: How it works](https://letsencrypt.org/how-it-works/) and [Certbot instructions](https://certbot.eff.org/)
- [DigitalOcean: Initial server setup with Ubuntu (SSH, ufw)](https://www.digitalocean.com/community/tutorials/initial-server-setup-with-ubuntu)
- [Mozilla SSL Configuration Generator](https://ssl-config.mozilla.org/)
