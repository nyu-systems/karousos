#!/bin/bash
cd kserver_vs_orig && ./run_experiments.sh && python3 produce_csv.py && ./gen_plots.sh && cd ..
cd kver_vs_orig_concurrent_reqs && ./run_experiments.sh && python3 produce_csv.py && ./gen_plots.sh && cd ..
