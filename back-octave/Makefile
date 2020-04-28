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

CC = gcc
CFLAGS = -Wall -pthread
DEPS = 
OBJ = host.o
LIBS = -Wl,-Bstatic -luv -ljson-c -Wl,-Bdynamic -Wl,--no-as-needed -ldl
EXE = octave-host

%.o: %.c $(DEPS)
	$(CC) -c -o $@ $< $(CFLAGS)

$(EXE): $(OBJ)
	$(CC) -o $@ $^ $(CFLAGS) $(LIBS)

install: $(EXE)
	cp $(EXE) /usr/local/bin

clean:
	rm $(OBJ) $(EXE)

run: $(EXE)
	./$(EXE)
