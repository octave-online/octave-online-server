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

FROM rockylinux:8.5

WORKDIR /root

# Development tools for Octave
RUN yum groupinstall -y "Development Tools"
RUN yum install -y \
	cmake \
	epel-release \
	git \
	mercurial \
	net-tools \
	librsvg2-tools \
	traceroute \
	wget \
	yum-utils
RUN dnf config-manager --set-enabled powertools

# Library dependencies for Octave
RUN yum install -y \
	arpack-devel \
	bzip2-devel \
	eigen3-devel \
	fftw-devel \
	fltk-devel \
	gl2ps-devel \
	glpk-devel \
	gnuplot \
	gperf \
	GraphicsMagick-c++-devel \
	hdf5-devel \
	icoutils \
	java-11-openjdk-devel \
	lapack-devel \
	libqhull \
	libsndfile-devel \
	llvm-devel \
	openblas-devel \
	pcre-devel \
	qhull-devel \
	qrupdate-devel \
	suitesparse-devel \
	sundials-devel \
	texinfo \
	texinfo-tex \
	transfig \
	zlib-devel

# Manually install rapidjson; see comments in configure.ac
RUN git clone https://github.com/Tencent/rapidjson.git && \
	cd rapidjson && \
	git reset --hard fd3dc29a5c2852df569e1ea81dbde2c412ac5051 && \
	git submodule update --init && \
	mkdir build && \
	cd build && \
	cmake .. && \
	time make -j8 && \
	make install

# TODO: It's not clear which is the "correct" way to set the environment variable
RUN echo "export JAVA_HOME=/usr/lib/jvm/java-11-openjdk" > /etc/profile.d/oo.sh
ENV JAVA_HOME /usr/lib/jvm/java-11-openjdk

# TODO
# arpack-devel
# atlas-devel
# bison
# libcurl-devel
# desktop-file-utils
# fftw-devel
# flex
# fltk-devel
# ftgl-devel
# gcc-gfortran
# ghostscript
# gl2ps-devel
# glpk-devel
# gnuplot
# gperf
# GraphicsMagick-c++-devel
# hdf5-devel
# less
# libX11-devel
# llvm-devel
# mesa-libGL-devel
# mesa-libGLU-devel
# ncurses-devel
# pcre-devel
# qhull-devel
# qrupdate-devel
# qscintilla-devel
# readline-devel
# suitesparse-devel
# texinfo
# texinfo-tex
# zlib-devel

# When building without --disable-docs, the following additional packages are required:
# texlive-collection-latexrecommended
# texlive-metapost
