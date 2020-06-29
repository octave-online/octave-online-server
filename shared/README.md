Octave Online Server: Shared Utilities
======================================

This directory contains code that is shared among the client, front server, and back server.

When changing any exports here, run `npm run dtx-gen` to re-generate *index.d.ts*, which is used by the front server for TypeScript type definitions.

The logging code can optionally send logs to Google Stackdriver.  If you don't know what this means, you can ignore this feature.  To enable this feature, from this directory, run:

```bash
$ npm install ./stackdriver
```
