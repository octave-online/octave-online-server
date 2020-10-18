Octave Online Server: Front
===========================

The Front server is responsible for running all Socket.IO connections. It also comes with an Express HTTP server that handles authentication-related requests and serves static files.

The Front server does not handle HTTPS requests. It is recommended that you put another piece of server software, such as Nginx, in front of the Front server to handle HTTPS. You can also point Nginx to the "dist" directory to serve static files and reduce the number of requests going into Express.

## Building and Running

To perform a one-time production bulid:

```bash
$ npm ci
$ npm build
$ NODE_ENV=production DEBUG=oo:* node dist/app.js
```

To perform an auto-updating development build:

```bash
$ npm install
$ npm watch &
$ DEBUG=oo:* node dist/app.js
```

## Extra Static Files

You can create a directory parallel to this file named *static*; the files in this directory will be served by Express.
