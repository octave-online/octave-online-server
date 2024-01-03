# Copyright © 2018, Octave Online LLC
#
# This file is part of Octave Online Server.
#
# Octave Online Server is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation, either version 3 of the License, or (at your
# option) any later version.
#
# Octave Online Server is distributed in the hope that it will be useful, but
# WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
# or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Affero General Public
# License for more details.
#
# You should have received a copy of the GNU Affero General Public License
# along with Octave Online Server.  If not, see
# <https://www.gnu.org/licenses/>.

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

% Set environment variables
% 2022-03-06: Java does not have enough memory to support xlsopen, so disable it by default
setenv("PYTHON", "python3");
setenv("OCTAVE_JAVA_DIR", "/dev/null");

% Auto-load packages (no more pkg-auto since 4.2.1)
% Packages that are installed but not auto-loaded have a reason, such as shadows.

pkg load communications;
pkg load control;
pkg load dataframe;
pkg load fuzzy-logic-toolkit;
pkg load general;
pkg load image;
pkg load interval;
pkg load linear-algebra;
pkg load miscellaneous;
pkg load mvn;
pkg load signal;
pkg load struct;
pkg load symbolic;
pkg load video;

% 2023-01-03: The statistics package contains known shadows in Octave 8.4.
% See: https://github.com/gnu-octave/statistics/issues/121
% Remove this condition upon upgrading to Octave 9.
warning("off","Octave:shadowed-function");
pkg load statistics;
warning("on","Octave:shadowed-function");

% Packages not auto-loaded because of the JVM dependency or other performance tradeoff:
% pkg load data-smoothing;
% pkg load financial;
% pkg load io;
% pkg load mapping;
% pkg load netcdf;
% pkg load optim;
% pkg load stk;

% Packages not auto-loaded due to shadow functions:
% pkg load geometry;
% pkg load ltfat;
% pkg load matgeom;
% pkg load nan;
% pkg load tablicious;
% pkg load tsa;
