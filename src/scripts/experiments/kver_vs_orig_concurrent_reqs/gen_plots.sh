#!/bin/bash

USAGE="Usage: $0 with optional flag --all to run all plots."
run_all_experiments=false;

while [ $# -gt 0 ]; do
  case $1 in
    -a | --all)
      run_all_experiments=true
      ;;
    *)
      break;
  esac
  shift
done

rm -r plots
mkdir plots
cd gnu_plot_scripts 

gnuplot -c kver_vs_baseline_message_w.gnu || fail "running gnuplot on message write-heavy workload"
gnuplot -c kver_vs_baseline_stackTrace_r.gnu || fail "running gnuplot on stackTrace read-heavy workload"
gnuplot -c kver_vs_baseline_wiki_m.gnu || fail "running gnuplot on wiki mixed workload"
gnuplot -c advice_size_message_w.gnu || fail "running gnuplot on message write-heavy workload"
gnuplot -c advice_size_stackTrace_r.gnu || fail "running gnuplot on stackTrace read-heavy workload"
gnuplot -c advice_size_wiki_m.gnu || fail "running gnuplot on wiki mixed workload"

if $run_all_experiments; then
	gnuplot -c kver_vs_baseline_message_m.gnu || fail "running gnuplot on message mixed workload"
	gnuplot -c kver_vs_baseline_message_r.gnu || fail "running gnuplot on message read-heavy workload"
	gnuplot -c kver_vs_baseline_stackTrace_m.gnu || fail "running gnuplot on stackTrace mixed workload"
	gnuplot -c kver_vs_baseline_stackTrace_w.gnu || fail "running gnuplot on stackTrace write-heavy workload"
	gnuplot -c advice_size_message_m.gnu || fail "running gnuplot on message mixed workload"
	gnuplot -c advice_size_message_r.gnu || fail "running gnuplot on message read-heavy workload"
	gnuplot -c advice_size_stackTrace_m.gnu || fail "running gnuplot on stackTrace mixed workload"
	gnuplot -c advice_size_stackTrace_w.gnu || fail "running gnuplot on stackTrace write-heavy workload"
fi


cd ..
