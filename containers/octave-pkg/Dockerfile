# Copyright © 2019, Octave Online LLC
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

ARG FULL_BASE_IMAGE
FROM $FULL_BASE_IMAGE

# Install some popular Octave Forge packages.
# If a package fails to install, try building the image again and it might work the second time.
# Most packages are auto-loaded via octaverc (since version 4.2.1) except for the following packages that shadow core library functions or are slow to load: tsa, stk, ltfat, and nan.
# Note: The package list gets written to /usr/local/share/octave/octave_packages

# rpmfusion is required for ffmpeg
RUN dnf install -y --nogpgcheck https://download1.rpmfusion.org/free/el/rpmfusion-free-release-8.noarch.rpm
RUN yum install -y \
	units \
	mpfr-devel \
	portaudio-devel \
	patch \
	ncurses-devel \
	libicu-devel \
	ffmpeg-devel \
	netcdf-devel \
	python3-pip

# TODO: install version 1.5.1 until the symbolic package is fixed:
# https://github.com/cbm755/octsympy/issues/1023
RUN pip3 install sympy==1.5.1

ARG PKG_BASE_URL=https://downloads.sourceforge.net/project/octave/Octave%20Forge%20Packages/Individual%20Package%20Releases

RUN mkdir pkg-downloads

RUN cd pkg-downloads && wget $PKG_BASE_URL/control-3.3.1.tar.gz && \
	LC_ALL=C /usr/local/bin/octave -q --eval "pkg install control-3.3.1.tar.gz;"

RUN cd pkg-downloads && wget $PKG_BASE_URL/signal-1.4.1.tar.gz && \
	LC_ALL=C /usr/local/bin/octave -q --eval "pkg install signal-1.4.1.tar.gz;"

# NOTE: The signal package is not compatible with Octave 7.0.1:
# https://sourceforge.net/p/octave/signal/merge-requests/3/
# RUN cd pkg-downloads && \
# 	hg clone -r o7compat http://hg.code.sf.net/u/octave-online/signal && \
# 	(cd signal && hg archive signal.tar.gz) && \
# 	LC_ALL=C /usr/local/bin/octave -q --eval "pkg install signal/signal.tar.gz;"

RUN cd pkg-downloads && wget $PKG_BASE_URL/communications-1.2.3.tar.gz && \
	LC_ALL=C /usr/local/bin/octave -q --eval "pkg install communications-1.2.3.tar.gz;"

RUN cd pkg-downloads && wget $PKG_BASE_URL/struct-1.0.17.tar.gz && \
	LC_ALL=C /usr/local/bin/octave -q --eval "pkg install struct-1.0.17.tar.gz;"

RUN cd pkg-downloads && wget $PKG_BASE_URL/io-2.6.3.tar.gz && \
	LC_ALL=C /usr/local/bin/octave -q --eval "pkg install io-2.6.3.tar.gz;"

RUN cd pkg-downloads && wget $PKG_BASE_URL/statistics-1.4.3.tar.gz && \
	LC_ALL=C /usr/local/bin/octave -q --eval "pkg install statistics-1.4.3.tar.gz;"

RUN cd pkg-downloads && wget $PKG_BASE_URL/optim-1.6.1.tar.gz && \
	LC_ALL=C /usr/local/bin/octave -q --eval "pkg install optim-1.6.1.tar.gz;"

RUN cd pkg-downloads && wget $PKG_BASE_URL/image-2.12.0.tar.gz && \
	LC_ALL=C /usr/local/bin/octave -q --eval "pkg install image-2.12.0.tar.gz;"

RUN cd pkg-downloads && wget $PKG_BASE_URL/general-2.1.1.tar.gz && \
	LC_ALL=C /usr/local/bin/octave -q --eval "pkg install general-2.1.1.tar.gz;"

RUN cd pkg-downloads && wget $PKG_BASE_URL/matgeom-1.2.3.tar.gz && \
	LC_ALL=C /usr/local/bin/octave -q --eval "pkg install matgeom-1.2.3.tar.gz;"

RUN cd pkg-downloads && wget $PKG_BASE_URL/linear-algebra-2.2.3.tar.gz && \
	LC_ALL=C /usr/local/bin/octave -q --eval "pkg install linear-algebra-2.2.3.tar.gz;"

RUN cd pkg-downloads && wget $PKG_BASE_URL/geometry-4.0.0.tar.gz && \
	LC_ALL=C /usr/local/bin/octave -q --eval "pkg install geometry-4.0.0.tar.gz;"

# NOTE: The geometry package has a compile error with modern GCC:
# https://sourceforge.net/p/octave/geometry/ci/04965cda30b5f9e51774194c67879e7336df1710/
RUN cd pkg-downloads && \
	hg clone -r 04965c http://hg.code.sf.net/p/octave/geometry && \
	(cd geometry && hg archive geometry.tar.gz) && \
	LC_ALL=C /usr/local/bin/octave -q --eval "pkg install geometry/geometry.tar.gz;"

RUN cd pkg-downloads && wget $PKG_BASE_URL/data-smoothing-1.3.0.tar.gz && \
	LC_ALL=C /usr/local/bin/octave -q --eval "pkg install data-smoothing-1.3.0.tar.gz;"

RUN cd pkg-downloads && wget $PKG_BASE_URL/nan-3.6.1.tar.gz && \
	LC_ALL=C /usr/local/bin/octave -q --eval "pkg install nan-3.6.1.tar.gz;"

# TODO: Remove?
RUN cd pkg-downloads && wget $PKG_BASE_URL/tsa-4.6.3.tar.gz && \
	LC_ALL=C /usr/local/bin/octave -q --eval "pkg install tsa-4.6.3.tar.gz;"

RUN cd pkg-downloads && wget $PKG_BASE_URL/miscellaneous-1.3.0.tar.gz && \
	LC_ALL=C /usr/local/bin/octave -q --eval "pkg install miscellaneous-1.3.0.tar.gz;"

RUN cd pkg-downloads && wget $PKG_BASE_URL/interval-3.2.0.tar.gz && \
	LC_ALL=C /usr/local/bin/octave -q --eval "pkg install interval-3.2.0.tar.gz;"

# TODO: Remove?
RUN cd pkg-downloads && wget $PKG_BASE_URL/stk-2.6.1.tar.gz && \
	LC_ALL=C /usr/local/bin/octave -q --eval "pkg install stk-2.6.1.tar.gz;"

RUN cd pkg-downloads && wget $PKG_BASE_URL/mapping-1.4.1.tar.gz && \
	LC_ALL=C /usr/local/bin/octave -q --eval "pkg install mapping-1.4.1.tar.gz;"

RUN cd pkg-downloads && wget $PKG_BASE_URL/financial-0.5.3.tar.gz && \
	LC_ALL=C /usr/local/bin/octave -q --eval "pkg install financial-0.5.3.tar.gz;"

RUN cd pkg-downloads && wget $PKG_BASE_URL/symbolic-2.9.0.tar.gz && \
	LC_ALL=C /usr/local/bin/octave -q --eval "pkg install symbolic-2.9.0.tar.gz;"

# Workaround for bug in package ltfat:
# https://github.com/ltfat/ltfat/issues/115
COPY containers/octave-pkg/ltfat.patch pkg-downloads/ltfat.patch
RUN cd pkg-downloads && wget $PKG_BASE_URL/ltfat-2.3.1.tar.gz && \
	tar zxf ltfat-2.3.1.tar.gz && \
	patch --ignore-whitespace -p0 < ltfat.patch && \
	tar czf ltfat_fix.tar.gz ltfat && \
	LC_ALL=C /usr/local/bin/octave -q --eval "pkg install ltfat_fix.tar.gz;"

RUN cd pkg-downloads && wget $PKG_BASE_URL/video-2.0.2.tar.gz && \
	LC_ALL=C /usr/local/bin/octave -q --eval "pkg install video-2.0.2.tar.gz;"

RUN cd pkg-downloads && wget $PKG_BASE_URL/netcdf-1.0.14.tar.gz && \
	LC_ALL=C /usr/local/bin/octave -q --eval "pkg install netcdf-1.0.14.tar.gz;"

RUN cd pkg-downloads && wget $PKG_BASE_URL/dataframe-1.2.0.tar.gz && \
	LC_ALL=C /usr/local/bin/octave -q --eval "pkg install dataframe-1.2.0.tar.gz;"

RUN cd pkg-downloads && wget $PKG_BASE_URL/mvn-1.1.0.tar.gz && \
	LC_ALL=C /usr/local/bin/octave -q --eval "pkg install mvn-1.1.0.tar.gz;"

RUN cd pkg-downloads && wget $PKG_BASE_URL/fuzzy-logic-toolkit-0.4.6.tar.gz && \
	LC_ALL=C /usr/local/bin/octave -q --eval "pkg install fuzzy-logic-toolkit-0.4.6.tar.gz;"

# Package for additional MATLAB compatibility; not on Octave Forge
RUN cd pkg-downloads && wget https://github.com/apjanke/octave-tablicious/releases/download/v0.3.6/tablicious-0.3.6.tar.gz && \
	LC_ALL=C /usr/local/bin/octave -q --eval "pkg install tablicious-0.3.6.tar.gz;"

# Policy for adding or removing packages:
# - Add packages that garner at least 40 downloads/week
# - Remove packages that fall below 10 downloads/week

# Former packages:
# - mechanics-1.3.1 (dropped due to only 4 downloads/week)
# - divand-1.1.2 (dropped due to only 8 downloads/week)

# Generate package metadata, used for warning messages
RUN cd /usr/local/share/octave/site/m && /usr/local/bin/octave -q --eval "\
	packages = {}; \
	for p=pkg('list'); \
		packages = {packages{:} pkg('describe', '-verbose', p{1}.name){:}}; \
	endfor; \
	save('package_metadata.mat', 'packages'); "
