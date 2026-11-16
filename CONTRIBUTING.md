# Contributing

Thanks for the interest — this started as a personal aeroponics build and is
now open for anyone to run and extend.

## Ways to help

- **Bugs**: open an issue with your hardware, sensor setup, service logs
  (`docker compose logs api`), and what you expected vs. what happened.
- **Sensor support**: the easiest contributions. Node-RED publishes retained
  discovery messages to `pio/discovery/<sensor_id>` — a new sensor type just
  needs a flow that publishes the documented metadata shape, and it appears
  in the dashboard automatically. A flow export + README note is a complete
  contribution.
- **Docs fixes**: typos and clarity fixes are always welcome, one-liner PRs
  included.

## Ground rules

- Keep changes scoped; one feature or fix per PR.
- Don't commit credentials, device dumps, or your real `.env` — CI will not
  run with them and they will be rejected.
- Match the existing code style; no reformat-everything PRs.
