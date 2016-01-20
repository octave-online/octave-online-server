#include <stdio.h>
#include <stdlib.h>
#include <inttypes.h>
#include <string.h>
#include <uv.h>
#include <json-c/json.h>
#include <unistd.h>

// MACROS, CONSTANTS, GLOBALS, AND TYPEDEFS

int r;
#define CATCH(expr){ \
	r = expr; \
	if(r){ \
		fprintf(stderr, "@ %s (%d): ", __FILE__, __LINE__); \
		fprintf(stderr, "%d: %s\n", r, uv_strerror(r)); \
		fflush(stderr); \
		return r; \
	} \
}

#define LOG(...){ \
	fprintf(stderr, __VA_ARGS__); \
	fprintf(stderr, "\n"); \
	fflush(stderr); \
}

#define TMP_DIR_STRLEN 14
#define TMP_DIR_FORMAT "/tmp/octXXXXXX"
#define TMP_COM_STRLEN 19
#define TMP_COM_FORMAT "/tmp/octXXXXXX/sock"

uv_loop_t* loop = NULL;
uv_tcp_t* sock_client = NULL;

uv_process_t child_req;
uv_process_options_t options;
char* tmp_path;
char* com_path;
uv_pipe_t worker_com_p;
uv_pipe_t worker_out_p;
uv_pipe_t worker_err_p;
uv_pipe_t host_in_p;
uv_pipe_t host_out_p;

uv_signal_t sigint_s;
uv_signal_t sigterm_s;
uv_signal_t sighup_s;

typedef struct {
	uv_write_t req;
	uv_buf_t buf;
} write_req_t;

enum STD_STREAM {
	STD_STREAM_SOCKET_OUT,
	STD_STREAM_SOCKET_ERR,
	STD_STREAM_HOST_IN,
	STD_STREAM_SOCKET
};

// UTILITY CALLBACKS

void cb_walk(uv_handle_t* handle, void* arg) {
	uv_close(handle, NULL);
}

void cleanup() {
	// Close all remaining file descriptors
	uv_walk(loop, cb_walk, NULL);

	// End the loop
	uv_loop_close(loop);
}

void cb_cleanup_write_req(uv_write_t *req, int status) {
	write_req_t *wr = (write_req_t*) req;
	free(wr->buf.base);
	free(wr);
}

void cb_alloc_buffer(uv_handle_t* handle, size_t suggested_size, uv_buf_t* buf) {
	*buf = uv_buf_init((char*) malloc(suggested_size), suggested_size);
}

void cb_sigfwd(uv_signal_t *handle, int signum) {
	LOG("Forwarding signal %d", signum);
	kill(child_req.pid, signum);
}

void cb_exit(uv_process_t* req, int64_t exit_status, int term_signal) {
	LOG("Process exited with status %" PRId64 ", signal %d", exit_status, term_signal);
	cleanup();
}

// UTILITY FUNCTIONS

// write_to_socket and write_to_stdout copy the memory so that other parts of the program cannot asynchronously mess with the writing process.

void write_to_socket(const char* str, size_t len) {
	write_req_t* req = malloc(sizeof(write_req_t));
	req->buf = uv_buf_init((char*) malloc(len), len);
	memcpy(req->buf.base, str, len);
	uv_write((uv_write_t*) req, (uv_stream_t*) sock_client, &req->buf, 1, cb_cleanup_write_req);
}

void write_to_stdout(const char* str, size_t len) {
	write_req_t* req = malloc(sizeof(write_req_t));
	req->buf = uv_buf_init((char*) malloc(len), len);
	memcpy(req->buf.base, str, len);
	uv_write((uv_write_t*) req, (uv_stream_t*) &host_out_p, &req->buf, 1, cb_cleanup_write_req);
}

void print_json_msg_str(const char* name, const char* str, size_t len) {
	// Make the object
	json_object* nameobj = json_object_new_string(name);
	json_object* strobj = json_object_new_string_len(str, len);
	json_object* obj = json_object_new_array();
	json_object_array_add(obj, nameobj);
	json_object_array_add(obj, strobj);

	// Make the string and print it
	const char* jstr = json_object_to_json_string(obj);
	write_to_stdout(jstr, strlen(jstr));

	// Relese memory
	// jstr is automatically released along with obj: https://github.com/json-c/json-c/issues/83
	json_object_put(obj);
	json_object_put(nameobj);
	json_object_put(strobj);
}

// Process all messages received from the streams: child out, child err, stdin, and socket.
//  - "nread" is the number of bytes in the output.
//  - "buf" is the buffer, which was originally created by "alloc_buffer".
//    It may be longer than "nread".
void process_std_stream(enum STD_STREAM type, uv_stream_t* stream, ssize_t nread, const uv_buf_t* buf) {

	// Is the stream closed?
	if (nread < 0) {
		if (nread == UV_EOF) {
			uv_close((uv_handle_t*) stream, NULL);
		}
	}

	// What to do with the data?
	else if (nread > 0) {
		switch (type) {

			case STD_STREAM_SOCKET_OUT:
				print_json_msg_str("out", buf->base, nread);
				break;

			case STD_STREAM_SOCKET_ERR:
				print_json_msg_str("err", buf->base, nread);
				break;

			case STD_STREAM_HOST_IN:
				write_to_socket(buf->base, nread);
				break;

			case STD_STREAM_SOCKET:
				write_to_stdout(buf->base, nread);
				break;

			default:
				break;

		}
	}

	// Free memory (corresponding malloc: cb_alloc_buffer)
	if (buf->base) free(buf->base);
}

// MAIN CALLBACKS

void cb_stdmsg(uv_stream_t* stream, ssize_t nread, const uv_buf_t* buf) {
	process_std_stream(STD_STREAM_SOCKET, stream, nread, buf);
}

void cb_stdout(uv_stream_t* stream, ssize_t nread, const uv_buf_t* buf) {
	process_std_stream(STD_STREAM_SOCKET_OUT, stream, nread, buf);
}

void cb_stderr(uv_stream_t* stream, ssize_t nread, const uv_buf_t* buf) {
	process_std_stream(STD_STREAM_SOCKET_ERR, stream, nread, buf);
}

void cb_stdin(uv_stream_t* stream, ssize_t nread, const uv_buf_t* buf) {
	process_std_stream(STD_STREAM_HOST_IN, stream, nread, buf);
}

void cb_connect(uv_stream_t* comm, int status) {
	if (status == -1) return;
	LOG("Connection received");

	// Ignore connection if we already have one
	if (sock_client != NULL) return;
	sock_client = (uv_tcp_t*) malloc(sizeof(uv_tcp_t));

	uv_tcp_init(loop, sock_client);
	if (uv_accept(comm, (uv_stream_t*) sock_client) == 0) {
		uv_read_start((uv_stream_t*) sock_client, cb_alloc_buffer, cb_stdmsg);
	}
	else {
		uv_close((uv_handle_t*) sock_client, NULL);
		sock_client = NULL;
	}
}

// MAIN FUNCTION

int main() {
	signal(SIGPIPE, SIG_IGN);
	loop = uv_default_loop();

	tmp_path = malloc(TMP_DIR_STRLEN); strcpy(tmp_path, TMP_DIR_FORMAT);
	com_path = malloc(TMP_COM_STRLEN); strcpy(com_path, TMP_COM_FORMAT);
	mkdtemp(tmp_path);
	memcpy(com_path, tmp_path, TMP_DIR_STRLEN);
	LOG("tmpdir: %s", com_path);
	// FIXME: Delete the temp dir before the process exits.

	CATCH(uv_pipe_init(loop, &worker_com_p, 0));
	CATCH(uv_pipe_init(loop, &worker_out_p, 0));
	CATCH(uv_pipe_init(loop, &worker_err_p, 0));
	CATCH(uv_pipe_init(loop, &host_in_p, 0));
	CATCH(uv_pipe_init(loop, &host_out_p, 0));
	CATCH(uv_pipe_open(&host_in_p, 0));
	CATCH(uv_pipe_open(&host_out_p, 1));

	CATCH(uv_signal_init(loop, &sigint_s));
	CATCH(uv_signal_init(loop, &sigterm_s));
	CATCH(uv_signal_init(loop, &sighup_s));

	char* args[6];
	args[0] = "octave";
	args[1] = "--json-sock";
	args[2] = com_path;
	args[3] = "--interactive";
	args[4] = "--quiet";
	args[5] = NULL;

	options.exit_cb = cb_exit;
	options.file = "/usr/local/bin/octave";
	// options.file = "/vagrant/octave/octave/build-no-docs/run-octave";
	options.args = args;

	options.stdio_count = 3;
	uv_stdio_container_t child_stdio[3];
	child_stdio[0].flags = UV_IGNORE;
	child_stdio[1].flags = UV_CREATE_PIPE | UV_WRITABLE_PIPE;
	child_stdio[1].data.stream = (uv_stream_t*) &worker_out_p;
	child_stdio[2].flags = UV_CREATE_PIPE | UV_WRITABLE_PIPE;
	child_stdio[2].data.stream = (uv_stream_t*) &worker_err_p;
	options.stdio = child_stdio;

	CATCH(uv_spawn(loop, &child_req, &options));
	CATCH(uv_pipe_bind(&worker_com_p, com_path));
	CATCH(uv_listen((uv_stream_t*) &worker_com_p, 128, cb_connect));
	CATCH(uv_read_start((uv_stream_t*) &worker_out_p, cb_alloc_buffer, cb_stdout));
	CATCH(uv_read_start((uv_stream_t*) &worker_err_p, cb_alloc_buffer, cb_stderr));
	CATCH(uv_read_start((uv_stream_t*) &host_in_p, cb_alloc_buffer, cb_stdin));

	CATCH(uv_signal_start(&sigint_s, cb_sigfwd, SIGINT));
	CATCH(uv_signal_start(&sigterm_s, cb_sigfwd, SIGTERM));
	CATCH(uv_signal_start(&sighup_s, cb_sigfwd, SIGHUP));

	LOG("Launched process with ID %d", child_req.pid);

	free(tmp_path);
	free(com_path);

	return uv_run(loop, UV_RUN_DEFAULT);
}
