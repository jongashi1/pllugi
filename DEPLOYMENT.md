# Pllugi Website Deployment

The journal on `pages/page-2-1.html` needs the Node server in `server.js`.

Use a host that can run Node.js and set the start command to:

```sh
npm start
```

After deploying, test this URL in a browser:

```txt
https://your-domain.com/api/health
```

If the server is running, it should show:

```json
{"ok":true}
```

If it shows `503`, the hosting provider is not running the Node app or the app crashed during startup. Check the host's logs, make sure the start command is `npm start`, and make sure the site is deployed as a Node app instead of static files.

Static-only hosting will load the HTML/CSS, but the diary cannot save, load, or delete entries because `/api/journal` will not exist.

If your host does not support Node but does support PHP, upload the `api` folder too. The page will automatically fall back from:

```txt
/api/journal
```

to:

```txt
/api/journal.php
```

You can test the PHP backend here:

```txt
https://your-domain.com/api/journal.php
```

Without the password header it should show `Unauthorized`. That is good: it means the PHP file exists.

If your host lets you set environment variables, set:

```sh
JOURNAL_PASSWORD=Kevpatty
```

The saved entries live in:

```txt
data/journal-entries.json
```

Some hosts erase local files when the app restarts or redeploys. On those hosts the diary will work temporarily, but entries can disappear after a restart. Use a VPS or persistent disk/storage if you want the entries to stay permanently.
