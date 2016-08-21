// Main RequireJS configuration for local builds.

require.config({
  paths: {
    // jQuery and Plugins
    "jquery": "vendor/jquery/dist/jquery",
    "jquery.cookie": "vendor/jquery.cookie/jquery.cookie",
    "jquery.md5": "vendor/jquery-md5/jquery.md5",
    "jquery.purl": "vendor/purl/purl",

    // Vendor Libraries
    "canvg": "vendor/canvg/dist/canvg.bundle",
    "knockout": "vendor/knockoutjs/dist/knockout.debug",
    "knockout-ace": "vendor/knockout-ace/knockout-ace",
    "splittr": "vendor/splittr/splittr",
    "filesaver": "vendor/FileSaver/FileSaver",
    "canvas-toblob": "vendor/canvas-toBlob.js/canvas-toBlob",
    "blob": "vendor/blob/Blob",

    // NPM Libraries
    "SocketIOFileUpload": "../node_modules/socketio-file-upload/client",
    "socket.io": "../node_modules/socket.io-client/socket.io",

    // Local Libraries
    "ismobile": "js/detectmobilebrowser",
    "base64": "js/base64v1.module",
    "base64-toblob": "js/base64-toBlob",
    "ko-takeArray": "js/ko-takeArray",
    "ko-flash": "js/ko-flash"
  },
  packages: [
    {
        name: "ace",
        location: "vendor/ace/lib/ace",
        main: "ace"
    }
  ],
  shim: {
    // jQuery Plugins
    "jquery.md5": ["jquery"],
    "jquery.purl": ["jquery"],

    // CanVG
    "canvg": {
      exports: "canvg"
    },

    // Other Libraries
    "filesaver": {
      deps: ["canvas-toblob", "blob"]
    }
  }
});
