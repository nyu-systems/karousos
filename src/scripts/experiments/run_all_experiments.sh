#!/bin/bash
cd kserver_vs_orig && ./run_all_experiments.sh && python3 produce_csv.py --all && ./gen_plots.sh --all && cd ..
cd kver_vs_orig_concurrent_reqs && ./run_all_experiments.sh && python3 produce_csv.py --all && ./gen_plots.sh --all && cd ..
