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
    "ace-core": "vendor/ace-builds/src/ace",
    "splittr": "vendor/splittr/splittr",
    "filesaver": "vendor/FileSaver/FileSaver",
    "canvas-toblob": "vendor/canvas-toBlob.js/canvas-toBlob",
    "blob": "vendor/blob/Blob",

    // NPM Libraries
    "SocketIOFileUpload": "../node_modules/socketio-file-upload/client",
    "socket.io": "../node_modules/socket.io-client/socket.io",

    // Local Libraries
    "ace-extras": "js/ace-extras",
    "ismobile": "js/detectmobilebrowser",
    "base64": "js/base64v1.module",
    "base64-toblob": "js/base64-toBlob",
    "ko-takeArray": "js/ko-takeArray",
    "ko-flash": "js/ko-flash"
  },
  bundles: {
    "ace-core": ["ace/ace", "ace/lib/fixoldbrowsers", "ace/lib/regexp", "ace/lib/es5-shim", "ace/lib/dom", "ace/lib/event", "ace/lib/keys", "ace/lib/oop", "ace/lib/useragent", "ace/editor", "ace/lib/lang", "ace/keyboard/textinput", "ace/mouse/mouse_handler", "ace/mouse/default_handlers", "ace/mouse/default_gutter_handler", "ace/mouse/mouse_event", "ace/mouse/dragdrop_handler", "ace/config", "ace/lib/net", "ace/lib/event_emitter", "ace/mouse/fold_handler", "ace/keyboard/keybinding", "ace/edit_session", "ace/selection", "ace/range", "ace/mode/text", "ace/tokenizer", "ace/mode/text_highlight_rules", "ace/mode/behaviour", "ace/unicode", "ace/token_iterator", "ace/document", "ace/anchor", "ace/background_tokenizer", "ace/search_highlight", "ace/edit_session/folding", "ace/edit_session/fold_line", "ace/edit_session/fold", "ace/range_list", "ace/edit_session/bracket_match", "ace/search", "ace/commands/command_manager", "ace/keyboard/hash_handler", "ace/commands/default_commands", "ace/undomanager", "ace/virtual_renderer", "ace/layer/gutter", "ace/layer/marker", "ace/layer/text", "ace/layer/cursor", "ace/scrollbar", "ace/renderloop", "ace/multi_select", "ace/mouse/multi_select_handler", "ace/commands/multi_select_commands", "ace/worker/worker_client", "ace/placeholder", "ace/mode/folding/fold_mode", "ace/theme/textmate", "ace/ext/error_marker", "ace/line_widgets"],
    "ace-extras": ["ace/ext/language_tools", "ace/snippets", "ace/autocomplete", "ace/autocomplete/popup", "ace/autocomplete/util", "ace/autocomplete/text_completer", "ace/mode/octave", "ace/mode/matching_brace_outdent", "ace/mode/octave_highlight_rules", "ace/theme/crimson_editor", "ace/theme/merbivore_soft", "ace/ext/static_highlighter"]
  },
  packages: [
    {
        // This does not work since the build directory doesn't have the right structure.
        // I've manually put all non-core Ace dependencies are in ace-extras.js.
        name: "ace",
        location: "vendor/ace-builds/src",
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
