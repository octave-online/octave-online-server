Octave Online Server: Shared Utilities
======================================

This directory contains code that is shared among the client, front server, and back server.

Unfortunately, the front server does not currently use shared libraries as often as it should.  For example, the front server has its own implementation of much of the code you find in *redis-util.js* and *redis-messenger.js*.  A TODO item is to clean this up and make the front server use more of the shared libraries.
