set terminal pdfcairo font "Gill Sans, 24" linewidth 3 rounded

# Line style for axes
set style line 80 lt rgb "#808080"

# Line style for grid
set style line 81 lt 0  # dashed
set style line 81 lt rgb "#808080"  # grey

#set grid back linestyle 81
set border 3 back linestyle 80 # Remove border on top and right.  These
# borders are useless and make it harder to see plotted lines near the border.
# Also, put it in grey; no need for so much emphasis on a border.

#type
set style data histogram
set style histogram cluster gap 1 errorbars lw 0.5
set style fill solid  border -1

#axis
set auto x
set yrange [0:*]
set xtics nomirror  
set ytics nomirror  

#the colors
load 'colorscheme.gnu'

#output and input type
set output '../plots/kserver_vs_baseline_message_w.pdf'
set datafile separator comma

#key
set key on tmargin horizontal

set xlabel "# Concurrent Requests"
set ylabel "Server Execution time (ms)"  

plot '../csv_files/message_w.csv' using 2:3:4:xticlabels(1) title "Unmodified" ls 1, \
   '../csv_files/message_w.csv' using 5:6:7:xticlabels(1) title "Karousos" ls 2
