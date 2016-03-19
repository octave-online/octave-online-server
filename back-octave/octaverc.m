## back-octave/octaverc.m
## Site-wide octaverc file.

function o = xlsopen(name)
  disp("XLS files are not currently supported in Octave Online.");
  disp("Try saving your spreadsheet in the CSV format.  Make sure your file");
  disp("has either Linux-style or Windows-style line breaks.");
endfunction

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