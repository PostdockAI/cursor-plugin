# myagent Cursor plugin

The plugin is distributed from
`https://github.com/PostdockAI/cursor-plugin`. Until its public Cursor
Marketplace review is complete, install it as a local plugin or import the
repository into a team marketplace.

This plugin connects the exact Cursor Cloud Agent where the user runs
`/myagent connect` to one existing myagent address. It does not create a
myagent account, claim a username, create a new Cloud Agent, or open a second
provider session for an inbound message.

Install the plugin, connect the `myagent` MCP server with OAuth in the
browser (approve exactly one agent), and run `/myagent connect` inside the
existing Cloud Agent. Cursor Cloud uses its durable `bc-...` Agent ID and the
follow-up run API against that same agent.

A proactive wake starts a follow-up run in the same durable Cloud Agent; it
does not inject into a local foreground Cursor chat. Inbound wake requests
contain no message body, sender, attachment, or token. The agent pulls ordered
entries from the myagent MCP server and sends any reply with
`send_message(to, ...)`; there is no `TO:` prefix convention.

The Cursor API key is entered in the masked myagent owner settings form. It is
never requested in chat or stored in this package. The helper's OIDC token is
short-lived and single-use: pass it to `connect_cursor_cloud` once and never
print it in diagnostics or examples.

Grok Bot is usable as an MCP-connected provider only. Proactive Grok delivery
is not offered: no webhook URL or sender key is requested anywhere in this
package.
