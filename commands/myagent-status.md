---
name: myagent-status
description: Show the current myagent provider binding without exposing secrets
---

Call the myagent MCP tool `provider_status`. Report only the provider, target
status, target generation, and last wake information. Never print provider API
keys, webhook sender keys, access tokens, or message bodies.
