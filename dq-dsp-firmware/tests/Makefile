# Host-side tests for the firmware DSP (compiled with plain gcc, no ESP-IDF).
#
# These verify the C DSP algorithms against reference implementations and
# pin them so future optimizations can't silently diverge.
#
# Usage:
#   make test-host          # build & run all host tests
#   make test-host-clean    # remove test binaries

CC      ?= gcc
CFLAGS  ?= -O2 -Wall
LDLIBS  := -lm
BINDIR  := /tmp/dq-dsp-host-tests

TESTS := golden_biquad golden_crc golden_crossover

.PHONY: test-host test-host-clean

test-host: $(BINDIR)
	@set -e; for t in $(TESTS); do \
		echo "== $$t =="; \
		$(CC) $(CFLAGS) -o $(BINDIR)/$$t $$t.c $(LDLIBS) && $(BINDIR)/$$t; \
	done

$(BINDIR):
	mkdir -p $(BINDIR)

test-host-clean:
	rm -rf $(BINDIR)