# Entrypoint
WORKDIR /home/oo
ENV GNUTERM "svg"
# ENV GNUTERM "svg mouse jsdir '/js/gnuplot'"
ENTRYPOINT [ "/usr/local/bin/octave-host" ]
