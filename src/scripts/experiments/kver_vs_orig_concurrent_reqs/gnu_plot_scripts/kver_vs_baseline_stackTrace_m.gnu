# Note you need gnuplot 4.4 for the pdfcairo terminal.
set terminal pdfcairo font "Gill Sans, 24" linewidth 3 rounded
set rmargin 0.2
set lmargin 6

# Line style for axes
set style line 80 lt rgb "#808080"

# Line style for grid
set style line 81 lt 0  # dashed
set style line 81 lt rgb "#808080"  # grey

#set grid back linestyle 81
set border 3 back linestyle 80 # Remove border on top and right.  These
# borders are useless and make it harder to see plotted lines near the border.
# Also, put it in grey; no need for so much emphasis on a border.

load 'colorscheme.gnu'

set xtics nomirror
set ytics nomirror
set yrange [0:*]

set ylabel "Turnaround time (s)" offset 1,0
set xlabel "# Concurrent Requests"

set output '../plots/kver_vs_baseline_stackTrace_m.pdf'
set datafile separator comma

set key nobox outside bottom Left reverse horizontal 

set style data histogram
set style histogram cluster gap 1 errorbars lw 0.5
set style fill solid  border -1

plot '../csv_files_ver/stackTrace_m.csv' using 2:3:4:xticlabels(1) title "Baseline" ls 1, \
  '../csv_files_ver/stackTrace_m.csv' using 8:9:10:xticlabels(1) title "Orochi-JS" ls 3, \
  '../csv_files_ver/stackTrace_m.csv' using 5:6:7:xticlabels(1) title "Karousos" ls 2
