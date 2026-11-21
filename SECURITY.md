# Security

## Reporting a vulnerability

Please report it privately, through GitHub: open the repo's **Security** tab and choose **Report a vulnerability**, or go straight to https://github.com/pincastFM/placecard-kit-public/security/advisories/new. Only the maintainers see what you send.

A public issue or pull request shows the problem to everyone before there's a fix, so please keep it to the private report. It helps to include:

- the versions of `@pincast/placecard-kit` and `vue`
- the subpath, and the function or component involved
- the steps or a small example that shows it, and what it lets someone do

We'll confirm we have it, work on the fix with you in the private advisory, and credit you when the fix ships, unless you'd rather we didn't.

## Supported versions

Fixes land in the latest release, so upgrade to it to get them.

## Scope

In scope: the code in this repo, and the package published from it, `@pincast/placecard-kit`.

Out of scope: the apps that use the kit (their servers, their data, their sign-in) and the services they call. Report those to the app.

## What the kit does and doesn't do

- It holds no keys, tokens or passwords, and it signs no one in. The person and their session come from your app.
- The table and the `registry` subpath fetch nothing. Your `source.load()` hands the table its collection, and your server holds any key the data needs.
- Two parts make requests, and only when your app uses them:
  - the moderation components call your own endpoints (`TT_MOD_ENDPOINTS`, same origin by default, or your own `request` function);
  - `ntfyAlert` in the `moderation` subpath posts an alert to ntfy (https://ntfy.sh, or the `server` you pass) when your server calls it with a topic.
- It never writes to `<head>` or `<html>` itself. Font links, `<html>` attributes and the page lock go through the hooks your app passes to `setTtHost`.
- Its font stylesheets are Google Fonts URLs, and they load only if your app adds them to the page.
