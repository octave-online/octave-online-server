Octave Online Projects
======================

This is the source code for the Octave Online back server.  In the future, the "front" and "client" will also be merged into this repo.

## Setup

There are two versions of the back server.  One uses Docker and is easier to set up and configure.  The other uses SELinux and is faster.

### Option 1: Docker Setup

Download and install [Docker](https://www.docker.com).

Run `make docker` from the project directory to build the required Docker images.  Building the images, especially the *docker-octave* image, will take time, so be patient.  You may want to let this step run overnight.

### Option 2: SELinux

Ensure that you are running on CentOS or another distribution of Linux that supports SELinux.  SELinux should come pre-installed on CentOS.

Make and build Octave from source.  Follow a procedure similar to the one put forth in *dockerfiles/build-octave.dockerfile*.

Run `sudo yum install -y selinux-policy-devel policycoreutils-sandbox selinux-policy-sandbox`

Run `sudo make install-selinux-policy` and `sudo make install-selinux-bin` from the project directory.

Run `sudo make install-site-m`.

## Additional Setup

### Git SSH Key

If you use SSH to connect to the Git server containing people's saved files, you need to create a private key, save it at *back-filesystem/git/key.pem*, and export the variable `GIT_SSH=/path/to/back-filesystem/git/key.pem`.  You need to export that variable before you run `DEBUG=* node app.js` as described below.

### Config File

You need to create a file called *config.json* at *shared/config.json*.  Here is an example *config.json*.

    {
		"worker": {
			"token": "local",
			"clockInterval": {
				"min": 1500,
				"max": 2500
			},
			"maxSessions": 12,
			"uid": 1000,
			"logDir": "/srv/logs"
		},
		"session": {
			"legalTime": {
				"guest": 5000,
				"user": 10000
			},
			"timewarnTime": 90000,
			"timeoutTime": 120000,
			"timewarnMessage": "NOTICE: Due to inactivity, your session will expire in five minutes.",
			"payloadLimit": {
				"guest": 5000,
				"user": 10000
			},
			"payloadMessageDelay": 100,
			"textFileSizeLimit": 50000,
			"jsonMaxMessageLength": 1000000,
			"implementation": "docker"
		},
		"sessionManager": {
			"logInterval": 60000,
			"poolSize": 2,
			"poolInterval": 5000,
			"startupTimeLimit": 30000
		},
		"git": {
			"hostname": "localhost",
			"author": {
				"name": "Local User",
				"email": "localhost@localhost"
			},
			"commitTimeLimit": 30000,
			"autoCommitInterval": 300000
		},
		"docker": {
			"cwd": "/home/oo",
			"gitdir": "/srv/git",
			"cpuShares": 512,
			"memoryShares": "256m",
			"diskQuotaKiB": 20480,
			"images": {
				"filesystemSuffix": "files",
				"octaveSuffix": "octave:prod"
			}
		},
		"maintenance": {
			"interval": 1800000,
			"requestInterval": 5000,
			"responseWaitTime": 3000,
			"pauseDuration": 15000,
			"maxNodesInMaintenance": 1
		},
		"redis": {
			"hostname": "localhost",
			"port": 6379,
			"options": {
				"auth_pass": "xyzxyzxyzxyzxyz"
			},
			"expire": {
				"interval": 5000,
				"timeout": 16000
			},
			"maxPayload": 10000
		},
		"forge": {
			"placeholders": ["aar", "aarmam", "ac2poly", "ac2rc", "acorf", "acovf", "adim", "amarma", "ambiguityfunction", "ar2poly", "ar2rc", "ar_spa", "arcext", "arfit2", "audfiltbw", "audfilters", "audspace", "audspacebw", "audtofreq", "bat", "batmask", "biacovf", "bisdemo", "bispec", "bland_altman", "blfilter", "block", "blockana", "blockdevices", "blockdone", "blockfigure", "blockframeaccel", "blockframepairaccel", "blockpanel", "blockpanelget", "blockplay", "blockplot", "blockread", "blocksyn", "blockwrite", "cameraman", "cat2bin", "cdfplot", "ceil23", "ceil235", "center", "chirpzt", "classify", "cocktailparty", "coefficient_of_variation", "col2diag", "constructphase", "constructphasereal", "convolve", "cor", "corrcoef", "cov", "covm", "cqt", "cqtfilters", "crestfactor", "ctestfun", "cumsumskipnan", "dcti", "dctii", "dctiii", "dctiv", "dctresample", "decovm", "demo_audiocompression", "demo_audiodenoise", "demo_audioshrink", "demo_auditoryfilterbank", "demo_audscales", "demo_blockproc_basicloop", "demo_blockproc_denoising", "demo_blockproc_dgtequalizer", "demo_blockproc_effects", "demo_blockproc_paramequalizer", "demo_blockproc_slidingcqt", "demo_blockproc_slidingerblets", "demo_blockproc_slidingsgram", "demo_bpframemul", "demo_dgt", "demo_filterbanks", "demo_filterbanksynchrosqueeze", "demo_framemul", "demo_frsynabs", "demo_gabfir", "demo_gabmixdual", "demo_gabmulappr", "demo_imagecompression", "demo_nextfastfft", "demo_nsdgt", "demo_ofdm", "demo_pbspline", "demo_pgauss", "demo_phaseplot", "demo_phaseret", "demo_wavelets", "demo_wfbt", "detrend", "dfracft", "dft", "dgt", "dgt2", "dgtlength", "dgtreal", "drihaczekdist", "dsft", "dsti", "dstii", "dstiii", "dstiv", "dtwfb", "dtwfb2filterbank", "dtwfbbounds", "dtwfbinit", "dtwfbreal", "durlev", "dwilt", "dwilt2", "dwiltlength", "dynlimit", "erbfilters", "erblett", "erbspace", "erbspacebw", "erbtofreq", "expchirp", "expwave", "ffracft", "fftanalytic", "fftgram", "fftindex", "fftreal", "fftresample", "filterbank", "filterbankbounds", "filterbankdual", "filterbankfreqz", "filterbanklength", "filterbanklengthcoef", "filterbankphasegrad", "filterbankrealbounds", "filterbankrealdual", "filterbankrealtight", "filterbankreassign", "filterbankresponse", "filterbanksynchrosqueeze", "filterbanktight", "filterbankwin", "fir2long", "firfilter", "firkaiser", "firwin", "flag_implicit_samplerate", "flag_implicit_significance", "flix", "floor23", "floor235", "frame", "frameaccel", "framebounds", "frameclength", "framecoef2native", "framecoef2tf", "framecoef2tfplot", "framediag", "framedual", "framegram", "framelength", "framelengthcoef", "framematrix", "framemul", "framemuladj", "framemulappr", "framemuleigs", "framenative2coef", "frameoperator", "framepair", "framered", "frametf2coef", "frametight", "frana", "franabp", "franagrouplasso", "franaiter", "franalasso", "freqtoaud", "freqtoerb", "frgramian", "frsyn", "frsynabs", "frsyniter", "frsynmatrix", "fss", "fwt", "fwt2", "fwtclength", "fwtinit", "fwtlength", "gabconvexopt", "gabdual", "gabdualnorm", "gabelitistlasso", "gabfirdual", "gabfirtight", "gabframebounds", "gabframediag", "gabgrouplasso", "gabimagepars", "gablasso", "gabmixdual", "gabmul", "gabmulappr", "gabmuleigs", "gaboptdual", "gabopttight", "gabphasederiv", "gabphasegrad", "gabprojdual", "gabreassign", "gabreassignadjust", "gabrieszbounds", "gabtight", "gabwin", "gaindb", "gammatonefir", "geomean", "gga", "greasy", "groupthresh", "gscatter", "gspi", "harmmean", "hermbasis", "hist2res", "histo", "histo2", "histo3", "histo4", "hup", "icqt", "idft", "idgt", "idgt2", "idgtreal", "idtwfb", "idtwfbreal", "idwilt", "idwilt2", "ierblett", "ifftreal", "ifilterbank", "iframemul", "ifwt", "ifwt2", "insdgt", "insdgtreal", "instfreqplot", "invest0", "invest1", "invfdemo", "involute", "ioperator", "iqam4", "iqr", "isevenfunction", "isgram", "isgramreal", "isoctave", "iufilterbank", "iufwt", "iunsdgt", "iunsdgtreal", "iuwfbt", "iuwpfbt", "iwfbt", "iwmdct", "iwmdct2", "iwpfbt", "izak", "jpeg2rgb", "kurtosis", "largestn", "largestr", "lattice", "latticetype2matrix", "lconv", "lichtenstein", "linus", "long2fir", "ltfatarghelper", "ltfatbasepath", "ltfatgetdefaults", "ltfathelp", "ltfatlogo", "ltfatmex", "ltfatplay", "ltfatsetdefaults", "ltfatstart", "ltfatstop", "ltfattext", "lxcorr", "mad", "magresp", "mahal", "matrix2latticetype", "mean", "meandev", "meansq", "median", "middlepad", "modcent", "moment", "mulaclab", "mvaar", "mvar", "mvfilter", "mvfreqz", "nanconv", "nanfft", "nanfilter", "nanfilter1uc", "naninsttest", "nanstd", "nansum", "nantest", "nextfastfft", "noise", "nonu2ucfmt", "nonu2ufilterbank", "normalize", "normcdf", "norminv", "normpdf", "noshearlength", "nsdgt", "nsdgtreal", "nsgabdual", "nsgabframebounds", "nsgabframediag", "nsgabtight", "operator", "operatoradj", "operatorappr", "operatoreigs", "operatormatrix", "operatornew", "otoclick", "pacf", "parcor", "pbspline", "pchirp", "pconv", "pderiv", "percentile", "peven", "pfilt", "pgauss", "pgrpdelay", "phaselock", "phaselockreal", "phaseplot", "phaseunlock", "phaseunlockreal", "pheaviside", "pherm", "pinknoise", "plotdgt", "plotdgtreal", "plotdwilt", "plotfft", "plotfftreal", "plotfilterbank", "plotframe", "plotnsdgt", "plotnsdgtreal", "plotquadtfdist", "plotwavelets", "plotwmdct", "podd", "poly2ac", "poly2ar", "poly2rc", "prctile", "prect", "projkern", "psech", "psinc", "pxcorr", "qam4", "quadtfdist", "quantile", "rampdown", "rampsignal", "rampup", "range", "rangecompress", "rangeexpand", "rankcorr", "ranks", "rc2ac", "rc2ar", "rc2poly", "rect2wil", "resgram", "rgb2jpeg", "rmle", "rms", "s0norm", "sbispec", "scalardistribute", "selmo", "selmo2", "sem", "semiaudplot", "sgram", "shah", "shearfind", "sinvest1", "skewness", "spearman", "spreadadj", "spreadeigs", "spreadfun", "spreadinv", "spreadop", "statistic", "std", "stk_boundingbox", "stk_conditioning", "stk_discretecov", "stk_dist", "stk_distrib_normal_ei", "stk_distrib_student_ei", "stk_example_doe01", "stk_example_doe02", "stk_example_doe03", "stk_example_kb01", "stk_example_kb02", "stk_example_kb03", "stk_example_kb04", "stk_example_kb05", "stk_example_kb06", "stk_example_kb07", "stk_example_kb08", "stk_example_kb09", "stk_example_misc01", "stk_example_misc02", "stk_example_misc03", "stk_example_misc04", "stk_feval", "stk_filldist", "stk_gausscov_aniso", "stk_gausscov_iso", "stk_generate_samplepaths", "stk_init", "stk_isdominated", "stk_length", "stk_make_matcov", "stk_materncov32_aniso", "stk_materncov32_iso", "stk_materncov52_aniso", "stk_materncov52_iso", "stk_materncov_aniso", "stk_materncov_iso", "stk_maxabscorr", "stk_mindist", "stk_model", "stk_noisecov", "stk_normalize", "stk_options_get", "stk_options_set", "stk_param_estim", "stk_param_gls", "stk_param_init", "stk_param_init_lnv", "stk_param_relik", "stk_paretofind", "stk_phipcrit", "stk_plot1d", "stk_predict", "stk_rescale", "stk_sampling_halton_rr2", "stk_sampling_maximinlhs", "stk_sampling_olhs", "stk_sampling_randomlhs", "stk_sampling_randunif", "stk_sampling_regulargrid", "stk_sampling_vdc_rr2", "stk_select_optimizer", "stk_version", "sumskipnan", "symphase", "tcdf", "tconv", "test_sc", "tfmat", "tfplot", "thresh", "tinv", "tpdf", "train_lda_sparse", "train_sc", "traindoppler", "transferfunction", "trimean", "tsademo", "ttest", "u2nonucfmt", "ucp", "ufilterbank", "ufwt", "unsdgt", "unsdgtreal", "uquant", "uwfbt", "uwfbtbounds", "uwpfbt", "uwpfbtbounds", "var", "warpedblfilter", "warpedfilters", "wavcell2pack", "wavfun", "wavpack2cell", "wfbt", "wfbt2filterbank", "wfbtbounds", "wfbtclength", "wfbtinit", "wfbtlength", "wfbtput", "wfbtremove", "wfilt_algmband", "wfilt_cmband", "wfilt_coif", "wfilt_db", "wfilt_dden", "wfilt_ddena", "wfilt_ddenb", "wfilt_dgrid", "wfilt_hden", "wfilt_lemarie", "wfilt_matlabwrapper", "wfilt_mband", "wfilt_oddevena", "wfilt_oddevenb", "wfilt_optsyma", "wfilt_optsymb", "wfilt_qshifta", "wfilt_qshiftb", "wfilt_remez", "wfilt_spline", "wfilt_sym", "wfilt_symdden", "wfilt_symds", "wfilt_symorth", "wfilt_symtight", "wfiltdt_dden", "wfiltdt_oddeven", "wfiltdt_optsym", "wfiltdt_qshift", "wfiltdtinfo", "wfiltinfo", "wignervilledist", "wil2rect", "wilbounds", "wildual", "wilframediag", "wilorth", "wilwin", "wmdct", "wmdct2", "wpbest", "wpfbt", "wpfbt2filterbank", "wpfbtbounds", "wpfbtclength", "xcovf", "xval", "y2res", "zak", "zscore"]
		}
	}

A few settings to notice:

1. `.worker.logDir` needs to exist and be writable by the Octave Online process.
2. `.session.implementation` needs to be either "docker" or "selinux" depending on which version you decided to configure.
3. The settings in `.git` need to correspond to a working Git server.
4. The settings in `.redis` need to correspond to a working Redis server.

## Running the Back Server

Go to the *back-octave* directory and run `DEBUG=* node app.js` to start the back server.  The `DEBUG=*` is optional, but it gives you more details and can help with debugging problems.

## To-do list

- Update /usr/bin/sandbox according to https://github.com/SELinuxProject/selinux/commit/0f4620d6111838ce78bf5a591bb80c99c9d88730
- Resolve binary output created by the Octave process fails (generates JSON parse error)
- Disable fork in the core Octave code (syscalls.cc) instead of in the octaverc.m
- If using RHEL, the line "Defaults requiretty" must be commented out.

## License

Note: You may use, but not redistribute, the software.

Copyright (c) 2016 Shane Carr

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to use, copy, merge, and modify the Software, subject to the following conditions: The above copyright notice and this License shall be included in all copies or substantial portions of the Software.

Persons obtaining a copy of the Software may not publish, distribute, sublicense, and/or sell the Software or substantial portions of the Software under the terms of this License.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
