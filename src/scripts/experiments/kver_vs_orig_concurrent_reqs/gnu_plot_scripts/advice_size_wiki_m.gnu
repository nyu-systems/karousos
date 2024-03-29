set terminal pdfcairo font "Gill Sans, 24" linewidth 3 rounded
set rmargin 0.2
set lmargin 7

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
set style histogram cluster gap 1 
set style fill solid  border -1

#axis
set auto x
set yrange [0:*]
set xtics nomirror
set ytics nomirror 

#the colors
load 'colorscheme.gnu'

#output and input type
set output '../plots/advice_size_wiki_m.pdf'
set datafile separator comma

#key
set key nobox outside bottom Left reverse horizontal 

set ylabel "Advice size (MB)"  offset 1,0 
set xlabel "# Concurrent Requests"

plot '../csv_files_advice/wiki_m.csv' using 3:xticlabels(1) title "Orochi-JS" ls 3, \
'../csv_files_advice/wiki_m.csv' using 2:xticlabels(1) title "Karousos" ls 2
