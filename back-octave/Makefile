CC = gcc
CFLAGS = -Wall -pthread
DEPS = 
OBJ = host.o
LIBS = -Wl,-Bstatic -luv -ljson-c -Wl,-Bdynamic
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
