# Clear Vars Patch from wiki.octave.org
function clear (varargin)
  args = sprintf (', "%s"', varargin{:});

  # this line is kind-of funky, but without it, running "clear"
  # without any arguments does not work
  if strcmp(args, ', "')
    args = '';
  end

  evalin ("caller", ['builtin ("clear"' args ')']);
  pkglist = pkg ("list");
  loadedpkg = cell (0);
  for ii = 1:numel (pkglist)
    if (pkglist{ii}.loaded)
      loadedpkg{end+1} = pkglist{ii}.name;
    endif
  endfor
  if exist("~/.octaverc")
    source("~/.octaverc");
  endif
  source("/usr/local/share/octave/site/m/startup/octaverc");
  if (numel (loadedpkg) != 0)
    pkg ("load", loadedpkg{:});
  endif
endfunction

% Auto-load packages (no more pkg-auto since 4.2.1)
% Packages that are installed but not auto-loaded have a reason, such as shadows.
pkg load control;
pkg load signal;
pkg load struct;
pkg load optim;
pkg load io;
pkg load image;
pkg load symbolic;
pkg load general;
pkg load odepkg;
pkg load geometry;
pkg load data-smoothing;
pkg load financial;
pkg load interval;
pkg load fuzzy-logic-toolkit;
