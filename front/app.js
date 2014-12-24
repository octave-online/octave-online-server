// Entry point to application

// Pre-initialization: add timestamps to console messages
require('console-stamp')(console, '[d mmm HH:MM:ss.l]');

// Require application code
require("./build/app");
