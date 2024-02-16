#Reads a temporary trace file with timestamps
#and generates the sorted trace file (with no timestamps)

import sys
import os
import csv

def write_trace_file(temp_trace, trace):
	# First, read the input file and map each timestamp to 
	# the entry in the file
	timestamp_to_entries = {}
	with open(temp_trace, 'r') as temp_trace_file:
		while True:
			line = temp_trace_file.readline();
			if not line:
				break
			entries = line.split(",");
			ts = float(entries[0]) 
			if ts in timestamp_to_entries:
				timestamp_to_entries[ts].append(entries[1:])
			else:
				timestamp_to_entries[ts] = [entries[1:]]
	# Sort the keys in timestamp_to_entries and write the corresponding
	# entries in order
	with open(trace, 'w') as csv_file:
		for timestamp in sorted(timestamp_to_entries.keys()):
			for entries in timestamp_to_entries[timestamp]:
				to_write = ",".join(entries)
				if not to_write.endswith("\n"):
					to_write += "\n"
				csv_file.write(to_write)

if __name__ == "__main__":
	if len(sys.argv) < 2: 
		print("ERROR: Need to supply at least 2 arguments")
		print("Usage: " + sys.argv[0] + "[temp trace] [trace]")
		sys.exit()
	write_trace_file(sys.argv[1], sys.argv[2])
