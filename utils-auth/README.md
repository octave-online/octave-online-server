Octave Online Server: Authentication Service
============================================

This directory contains a standalone service for authenticating user accounts stored in MongoDB.  It is a very basic HTTP server that uses HTTP Basic Auth to authenticate against the MongoDB user database.

This service was designed for plugging into Nginx to allow for authenticated https access to Git repositories, a feature on octave-online.net.

**Note: Most users do not need to worry about the code in this directory.**
