# Security Policy

## Reporting a Vulnerability

Please report vulnerabilities privately by opening a GitHub security advisory
(**Security > Report a vulnerability**) or contacting the maintainer directly.
Do not open public issues for security problems.

- You'll get an acknowledgement within a few days.
- Please avoid automated scanners' blanket output; a focused writeup with a
  repro gets fixed fastest.

## Deployment Notes

- All secrets are environment variables (see `.env.example`). Never commit a
  real `.env`, Tuya device dumps (`devices.json`, `tinytuya.json`, etc. — they
  contain local keys), or broker credentials. These are gitignored; keep it
  that way.
- MQTT and the API are intended to run on a trusted LAN. Do not expose the
  broker or the API directly to the internet without TLS and auth in front.
